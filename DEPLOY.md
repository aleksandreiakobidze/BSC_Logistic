# BSC Logistics — Production Deployment Runbook

End-to-end runbook for the first cut over to Azure Container Apps + Azure
DevOps. Follow it once, top to bottom. After the first deploy, day-to-day
shipping is just `git push origin main` and approving the pipeline gate.

> Architecture, code refactors, and Bicep modules are described in
> [`infra/README.md`](infra/README.md). This file focuses on the **operational
> sequence** — what to do, in what order, with what credentials.

---

## Prerequisites

You will need:

| Item                                | Why                                              |
|-------------------------------------|--------------------------------------------------|
| Azure subscription ID + tenant ID   | Target tenant for the resource group             |
| Azure account with `Owner` role     | Required to create role assignments              |
| Azure DevOps org URL + Project Admin| To create the pipeline + service connection      |
| `az` CLI ≥ 2.55, `bicep`, `git`     | Local tooling                                    |
| Strong Postgres admin password      | Stored only in Key Vault (`openssl rand -base64 24`) |
| (optional) Resend API key           | Outbound email                                   |
| (optional) Twilio creds             | Outbound SMS                                     |
| (optional) Custom domain access     | DNS CNAME for `app.bsc.ge` → ACA FQDN            |

---

## Phase A — Provision Azure infrastructure (~30 min)

### A1. Login + select subscription
```bash
az login
az account set --subscription <subscription-id>
az account show --query '{sub:name, tenant:tenantId, id:id}'
```

### A2. Create the resource group
```bash
az group create -n bsc-prod-rg -l westeurope
```

> Pick a region close to your customers. Edit
> `infra/main.parameters.prod.json::location` to match.

### A3. Generate secrets
```bash
PG_PW=$(openssl rand -base64 24 | tr -d '/+=')$RANDOM
NEXTAUTH=$(openssl rand -base64 32)
ADMIN_OID=$(az ad signed-in-user show --query id -o tsv)
echo "PG_PW=$PG_PW"
echo "NEXTAUTH=$NEXTAUTH"
echo "ADMIN_OID=$ADMIN_OID"
```
Save `PG_PW` and `NEXTAUTH` somewhere safe (KeePass, 1Password) — we paste
them into Key Vault in step B.

### A4. Deploy infrastructure with Bicep
```bash
az deployment group create \
  --resource-group bsc-prod-rg \
  --name bsc-prod-bootstrap \
  --template-file infra/main.bicep \
  --parameters @infra/main.parameters.prod.json \
  --parameters pgAdminPassword="$PG_PW" adminObjectId="$ADMIN_OID"
```

This provisions ~16 resources (VNet, Postgres, Redis, Storage, Key Vault, ACR,
Log Analytics, App Insights, ACA Environment, two Container Apps, two ACA
Jobs). Expect ~12-20 minutes.

### A5. Read deployment outputs
```bash
az deployment group show -g bsc-prod-rg -n bsc-prod-bootstrap \
  --query 'properties.outputs' -o json
```

Note the values you'll reference later (`acrLoginServer`, `keyVaultName`,
`postgresHost`, `redisHostname`, `storageAccountName`).

---

## Phase B — Bootstrap image + secrets (~15 min)

### B1. Build the first image directly via ACR Tasks
```bash
ACR=$(az deployment group show -g bsc-prod-rg -n bsc-prod-bootstrap \
  --query 'properties.outputs.acrLoginServer.value' -o tsv | cut -d. -f1)
az acr build --registry "$ACR" --image bsc:bootstrap --file Dockerfile .
```
ACR Tasks does the multi-stage build server-side, so no local Docker required.

### B2. Populate Key Vault secrets
```bash
KV=$(az deployment group show -g bsc-prod-rg -n bsc-prod-bootstrap \
  --query 'properties.outputs.keyVaultName.value' -o tsv)
PG_HOST=$(az deployment group show -g bsc-prod-rg -n bsc-prod-bootstrap \
  --query 'properties.outputs.postgresHost.value' -o tsv)
REDIS=$(az deployment group show -g bsc-prod-rg -n bsc-prod-bootstrap \
  --query 'properties.outputs.redisHostname.value' -o tsv)
SA=$(az deployment group show -g bsc-prod-rg -n bsc-prod-bootstrap \
  --query 'properties.outputs.storageAccountName.value' -o tsv)

REDIS_KEY=$(az redis list-keys -g bsc-prod-rg -n bsc-prod-redis --query primaryKey -o tsv)
SA_CONN=$(az storage account show-connection-string -g bsc-prod-rg -n "$SA" --query connectionString -o tsv)
AI_CONN=$(az monitor app-insights component show -g bsc-prod-rg -a bsc-prod-ai --query connectionString -o tsv)

# Mandatory
az keyvault secret set --vault-name "$KV" -n database-url \
  --value "postgresql://bscadmin:$PG_PW@$PG_HOST:6432/bsc?sslmode=require&pgbouncer=true&connection_limit=5"
az keyvault secret set --vault-name "$KV" -n redis-url           --value "rediss://:$REDIS_KEY@$REDIS:6380"
az keyvault secret set --vault-name "$KV" -n azure-storage-conn  --value "$SA_CONN"
az keyvault secret set --vault-name "$KV" -n nextauth-secret     --value "$NEXTAUTH"
az keyvault secret set --vault-name "$KV" -n appinsights-conn    --value "$AI_CONN"

# Optional (set to '' to silence the SDKs; replace later)
az keyvault secret set --vault-name "$KV" -n resend-api-key      --value ''
az keyvault secret set --vault-name "$KV" -n smtp-pass           --value ''
az keyvault secret set --vault-name "$KV" -n twilio-auth-token   --value ''
```

### B3. Force a Container App revision so the new secrets resolve
```bash
az containerapp update -g bsc-prod-rg -n bsc-prod-web    --revision-suffix kvinit
az containerapp update -g bsc-prod-rg -n bsc-prod-worker --revision-suffix kvinit
```

### B4. Generate the initial Prisma migration locally
The schema is committed but the generated `init_postgres` migration folder is
not (it must be authored against a real Postgres). One-off:
```bash
docker run -d --name bsc-pg-init -p 5432:5432 \
  -e POSTGRES_USER=bsc -e POSTGRES_PASSWORD=bsc -e POSTGRES_DB=bsc postgres:16

DATABASE_URL="postgresql://bsc:bsc@localhost:5432/bsc?schema=public" \
  npx prisma migrate dev --name init_postgres

git add prisma/migrations
git commit -m "chore(db): initial postgres migration"
git push
docker stop bsc-pg-init && docker rm bsc-pg-init
```
Now the migration exists in git and the `bsc-prod-migrate` job has something
to apply.

### B5. Apply migrations
```bash
EXEC=$(az containerapp job start -g bsc-prod-rg -n bsc-prod-migrate --query name -o tsv)
az containerapp job execution show -g bsc-prod-rg -n bsc-prod-migrate \
  --job-execution-name "$EXEC" --query 'properties.status' -o tsv
# Re-run until status = Succeeded
```

### B6. Tail the web logs while the app starts
```bash
az containerapp logs show -g bsc-prod-rg -n bsc-prod-web --follow --tail 100
```
You should see `Ready in <ms>` from Next, no env-validation errors, and an
`Application Insights enabled` line from `instrumentation.ts`.

### B7. Smoke
```bash
WEB=$(az containerapp show -g bsc-prod-rg -n bsc-prod-web \
  --query properties.configuration.ingress.fqdn -o tsv)
curl -fsS "https://$WEB/api/health"
```

---

## Phase C — Wire Azure DevOps (~30 min)

### C1. Create the project + connect this repo
- Sign in to `https://dev.azure.com/<your-org>`.
- Create a new private Project named `bsc-logistics` (or reuse an existing one).
- Connect this repo:
  - **Option A (Azure Repos)**: import via Repos → Files → Import a repository.
  - **Option B (GitHub)**: install the Azure Pipelines GitHub App on this
    repo and add a "GitHub" service connection (one-click OAuth).

### C2. Install required marketplace extensions
At organization level, install:
- *(Pre-installed in most orgs)* **Azure CLI** (publisher: Microsoft).
- *(Optional)* **Replace Tokens** by Guillaume Rouchon — only if you decide
  to template the Bicep parameter file from a variable group.

### C3. Create the Workload-Identity-Federation Service Connection
Project Settings → Service connections → New → **Azure Resource Manager** →
**Workload identity federation (automatic)**:
- Subscription: pick your target sub.
- Resource group: `bsc-prod-rg` (limits blast radius).
- Service connection name: **`bsc-prod-azure`** (must match `azure-pipelines.yml`).
- Grant access permission to all pipelines: yes.

### C4. Create the Variable Group `bsc-prod-vars`
Pipelines → Library → Variable groups → `+ Variable group`:
| Name             | Value                                    |
|------------------|------------------------------------------|
| `ACR_NAME`       | `<acr-name>` (without `.azurecr.io`)     |
| `ACR_LOGIN_SERVER` | `<acr-name>.azurecr.io`                |
| `RG_NAME`        | `bsc-prod-rg`                            |
| `AZ_SUBSCRIPTION`| `<subscription-id>`                      |

(Optional) Toggle **Link secrets from an Azure key vault**, point at
`bsc-prod-kv`, and select any secrets you want exposed to the pipeline (e.g.
for tooling that needs them at build time — *not* required for the deploy
because runtime secrets resolve via Container App `secretref:` already).

### C5. Register the `production` Environment
Pipelines → Environments → New → name **`production`** (must match
`azure-pipelines.yml`). Open it → Approvals and checks → Add a
**required-reviewer** check listing the people who may approve releases.

### C6. Create the pipeline
Pipelines → New pipeline → choose your repo → "Existing Azure Pipelines YAML
file" → `/azure-pipelines.yml` → Save (do **not** run yet).

### C7. First run
Run the pipeline manually from the UI. Watch the stages:
1. **CI** — npm ci / lint / typecheck.
2. **BuildPush** — `az acr build` pushes `bsc:<BuildId>` and `bsc:latest`.
3. **Deploy** — pauses for your approval; then runs the migration job and
   updates the two Container Apps + the cron Job.
4. **Smoke** — curls `/api/health`.

After this run succeeds, the `main` trigger takes over and every push
auto-promotes through the pipeline (still gated by the approval).

---

## Phase D — Functional smoke (~20 min)

Verify every critical user flow on production. Easiest as a checklist:

- [ ] **Health** — `curl https://<web>/api/health` returns 200.
- [ ] **Login** — sign in with the seeded admin user.
- [ ] **Create customer** — confirm DB write + the row appears on the list.
- [ ] **Create quotation → send to customer** — email lands in QUOTE_INBOX or
      Resend dashboard.
- [ ] **Live chat across replicas** — open the same quotation page in two
      browser sessions, post a message in one, confirm it appears in the
      other within ~1s. *(Validates the Redis Pub/Sub refactor.)*
- [ ] **Driver POD upload** — upload a photo from the driver app, confirm the
      blob lands in the `pods` container in Azure Storage Explorer.
- [ ] **Cron** — `az containerapp job execution list -g bsc-prod-rg -n bsc-prod-cron`
      shows recent successful runs; check that `expireQuotations` and
      `refreshOverdueInvoices` actually flipped status on test rows.
- [ ] **App Insights traces** — open
      `Azure Portal → bsc-prod-ai → Live metrics` and confirm RPS / failures.

---

## Phase E — Production hardening (~1-2 h)

Do these once the smoke is green and you have a maintenance window.

### E1. Lock down public network access
- **Postgres**: already `publicNetworkAccess: 'Disabled'` in the Bicep.
- **Redis**: edit `infra/modules/redis.bicep` → `publicNetworkAccess: 'Disabled'`,
  add a `Microsoft.Network/privateEndpoints` resource bound to `pe-subnet`,
  redeploy.
- **Storage**: edit `infra/modules/storage.bicep` → `publicNetworkAccess: 'Disabled'`,
  add a private endpoint, redeploy.
- **Key Vault**: edit `infra/modules/keyvault.bicep` → `publicNetworkAccess: 'Disabled'`,
  add a private endpoint, redeploy.
- **ACR**: optional — keep public for ACA Tasks unless you also move builds
  inside the VNet via ACR Tasks Premium.

### E2. Backups
- Set `geoRedundantBackup: 'Enabled'` on the Postgres module and re-deploy.
- Verify daily backups: Portal → bsc-prod-pg → Backup and restore → confirm a
  recovery point exists every 24h.
- Storage soft-delete is already at 30 days from the Bicep.

### E3. Application Insights alerts
Portal → Application Insights → Alerts → New alert rule:
| Signal                                | Condition                  |
|---------------------------------------|----------------------------|
| Failed requests                       | > 5% over 5 min            |
| Server response time (p95)            | > 1 s over 10 min          |
| Container Apps restart count          | > 0 over 15 min            |
| Custom: `requests/duration` for Postgres | p95 > 1 s over 10 min   |
Action group: email distribution list / Slack webhook / PagerDuty.

### E4. Mapbox token restriction
Mapbox dashboard → access token → URL restriction → add `https://app.bsc.ge`
(or your final domain). Otherwise the public token in `NEXT_PUBLIC_MAPBOX_TOKEN`
is unbounded.

### E5. Custom domain + TLS (optional)
```bash
az containerapp hostname add -g bsc-prod-rg -n bsc-prod-web --hostname app.bsc.ge
# Add the asuid TXT and CNAME records in your DNS as instructed by the CLI.
az containerapp ssl bind  -g bsc-prod-rg -n bsc-prod-web --hostname app.bsc.ge --certificate <cert-id>
```

### E6. Front Door + WAF (optional, recommended)
- Create a Standard Front Door profile.
- Add the ACA FQDN as the origin.
- Attach a WAF policy with the Microsoft Default rule set.
- Update DNS to point at the Front Door endpoint.

### E7. Rotate the leaked Gmail App Password (if you used it)
The `.env` in this repo previously contained a real Gmail App Password
(`SMTP_PASS="ekvf wjgo iido pjjx"`). It's been redacted in source, but if you
ever pushed it to a remote you must:
1. Sign into the Gmail account at
   `https://myaccount.google.com/apppasswords` and **revoke** that password.
2. Generate a new App Password and put it in Key Vault as `smtp-pass`
   (already wired via `secretref` in the Bicep).
3. Optionally rewrite git history with `git filter-repo` to scrub it. Required
   if the repo is, or will be, public.

---

## Day-2 cheat sheet

| Task                          | Command / Path                                                              |
|-------------------------------|-----------------------------------------------------------------------------|
| Tail logs                     | `az containerapp logs show -g bsc-prod-rg -n bsc-prod-web --follow`         |
| Roll back to previous image   | Portal → bsc-prod-web → Revisions → activate previous revision              |
| Trigger migration manually    | `az containerapp job start -g bsc-prod-rg -n bsc-prod-migrate`              |
| Scale web manually            | `az containerapp update --min-replicas 2 --max-replicas 10 ...`             |
| Snapshot DB                   | Portal → bsc-prod-pg → Backup and restore → restore-as-new                  |
| Inspect Key Vault audit       | `az monitor activity-log list --resource-id $(az keyvault show -n $KV --query id -o tsv)` |
| Update a secret               | `az keyvault secret set --vault-name $KV -n <name> --value <value>` then restart the app |
| Live metrics                  | Portal → bsc-prod-ai → Live metrics                                         |
