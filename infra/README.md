# BSC Logistics — Azure infrastructure

Bicep IaC for the production stack. One resource group, one environment.

```
infra/
├── main.bicep                          # root deployment
├── main.parameters.prod.json           # production parameter file
└── modules/
    ├── network.bicep                   # VNet, subnets, private DNS zones
    ├── appInsights.bicep               # Log Analytics + App Insights
    ├── acr.bicep                       # Container Registry (Basic, MI pull)
    ├── keyvault.bicep                  # Key Vault (RBAC mode)
    ├── storage.bicep                   # Storage Account + uploads/pods containers
    ├── postgres.bicep                  # PG Flex (D2ds_v5, PG16, PgBouncer)
    ├── redis.bicep                     # Cache for Redis (Standard C1)
    ├── containerAppsEnv.bicep          # ACA Environment (VNet-injected)
    └── containerApps.bicep             # bsc-web, bsc-worker, bsc-migrate, bsc-cron
```

## 0. Prerequisites

- Azure CLI ≥ 2.55. Login + select subscription:
  ```bash
  az login
  az account set --subscription <subscription-id>
  ```
- A user with `Owner` (or `Contributor` + `User Access Administrator`) on the
  subscription so RBAC role assignments can be created.
- `az bicep upgrade` to latest.

## 1. Resource group

```bash
az group create --name bsc-prod-rg --location westeurope
```

Adjust `--location` if you want a different region — also update
`main.parameters.prod.json::location`.

## 2. Generate a strong Postgres admin password

Stored only in Key Vault, never in source control. Easiest:

```bash
PG_PW=$(openssl rand -base64 24 | tr -d '/+=')$RANDOM
echo "Postgres admin password: $PG_PW"     # save it temporarily
```

## 3. Get your AAD object ID (for KV admin role)

```bash
ADMIN_OID=$(az ad signed-in-user show --query id -o tsv)
```

## 4. Deploy infra

```bash
az deployment group create \
  --resource-group bsc-prod-rg \
  --name bsc-prod-bootstrap \
  --template-file infra/main.bicep \
  --parameters @infra/main.parameters.prod.json \
  --parameters pgAdminPassword="$PG_PW" adminObjectId="$ADMIN_OID"
```

Outputs to capture from the deployment:
- `acrLoginServer` (e.g. `bscprodacr1234.azurecr.io`)
- `keyVaultName`
- `webFqdn` (will be empty until first image is built — see step 6)
- `postgresHost`
- `redisHostname`
- `storageAccountName`

## 5. Push a bootstrap image to ACR

The Container Apps fail to start until the image they reference exists. Build
& push directly with ACR Tasks (no local Docker required):

```bash
ACR_NAME=$(az deployment group show -g bsc-prod-rg -n bsc-prod-bootstrap \
  --query 'properties.outputs.acrLoginServer.value' -o tsv | cut -d. -f1)
az acr build --registry "$ACR_NAME" --image bsc:bootstrap .
```

Now restart the apps to pick up the bootstrap image:
```bash
az containerapp revision restart -g bsc-prod-rg -n bsc-prod-web   --revision $(az containerapp revision list -g bsc-prod-rg -n bsc-prod-web   --query '[0].name' -o tsv)
az containerapp revision restart -g bsc-prod-rg -n bsc-prod-worker --revision $(az containerapp revision list -g bsc-prod-rg -n bsc-prod-worker --query '[0].name' -o tsv)
```

## 6. Populate Key Vault secrets

The deployment created the vault with RBAC and granted you (`adminObjectId`) the
Administrator role. Set every secret the apps reference:

```bash
KV=$(az deployment group show -g bsc-prod-rg -n bsc-prod-bootstrap \
  --query 'properties.outputs.keyVaultName.value' -o tsv)
PG_HOST=$(az deployment group show -g bsc-prod-rg -n bsc-prod-bootstrap \
  --query 'properties.outputs.postgresHost.value' -o tsv)
REDIS=$(az deployment group show -g bsc-prod-rg -n bsc-prod-bootstrap \
  --query 'properties.outputs.redisHostname.value' -o tsv)
SA_NAME=$(az deployment group show -g bsc-prod-rg -n bsc-prod-bootstrap \
  --query 'properties.outputs.storageAccountName.value' -o tsv)

REDIS_KEY=$(az redis list-keys -g bsc-prod-rg -n bsc-prod-redis --query primaryKey -o tsv)
SA_CONN=$(az storage account show-connection-string -g bsc-prod-rg -n "$SA_NAME" --query connectionString -o tsv)
NEXTAUTH_SECRET=$(openssl rand -base64 32)

# DATABASE_URL — go through PgBouncer (port 6432 on Flex Server)
az keyvault secret set --vault-name "$KV" -n database-url \
  --value "postgresql://bscadmin:$PG_PW@$PG_HOST:6432/bsc?sslmode=require&pgbouncer=true&connection_limit=5"

az keyvault secret set --vault-name "$KV" -n redis-url \
  --value "rediss://:$REDIS_KEY@$REDIS:6380"

az keyvault secret set --vault-name "$KV" -n azure-storage-conn --value "$SA_CONN"
az keyvault secret set --vault-name "$KV" -n nextauth-secret    --value "$NEXTAUTH_SECRET"

# Optional secrets — set to '' if you don't use the integration yet
az keyvault secret set --vault-name "$KV" -n resend-api-key       --value ''
az keyvault secret set --vault-name "$KV" -n smtp-pass            --value ''
az keyvault secret set --vault-name "$KV" -n twilio-auth-token    --value ''

# App Insights connection string was created during infra deploy
AI_CONN=$(az monitor app-insights component show -g bsc-prod-rg -a bsc-prod-ai --query connectionString -o tsv)
az keyvault secret set --vault-name "$KV" -n appinsights-conn     --value "$AI_CONN"
```

The Container Apps were created with `keyVaultUrl:` references; once secrets
exist, restart the apps so the secret-fetcher re-runs:

```bash
az containerapp update -g bsc-prod-rg -n bsc-prod-web    --revision-suffix kvrefresh
az containerapp update -g bsc-prod-rg -n bsc-prod-worker --revision-suffix kvrefresh
```

## 7. Run the initial migration

```bash
az containerapp job start -g bsc-prod-rg -n bsc-prod-migrate
az containerapp job execution list -g bsc-prod-rg -n bsc-prod-migrate -o table
```

Watch the logs for `Migration … applied` and an exit code of 0.

## 8. Smoke test

```bash
WEB_FQDN=$(az containerapp show -g bsc-prod-rg -n bsc-prod-web \
  --query properties.configuration.ingress.fqdn -o tsv)
curl -sS "https://$WEB_FQDN/api/health"
```

You're done. Hand the pipeline over to Azure DevOps from here on (see
`azure-pipelines.yml` at the repo root).

---

## Hardening checklist (after first successful deploy)

1. Flip `publicNetworkAccess` to `Disabled` on Postgres, Redis, Storage,
   Key Vault, and ACR. Add private endpoints into `pe-subnet` (Bicep modules
   already declare the DNS zones, just add the Microsoft.Network/privateEndpoints
   resources).
2. Set `geoRedundantBackup: Enabled` on the Postgres module and re-deploy.
3. Add App Insights alert rules:
   - Failed requests > 5% over 5 min → email ops.
   - Dependency duration p95 > 1s for Postgres.
   - Container Apps restart count > 0 in 15 min.
4. Restrict the Mapbox token in the Mapbox dashboard to your production domain.
5. Optional: bind a custom domain + TLS:
   ```bash
   az containerapp hostname add -g bsc-prod-rg -n bsc-prod-web --hostname app.bsc.ge
   az containerapp ssl bind     -g bsc-prod-rg -n bsc-prod-web --hostname app.bsc.ge --certificate <cert-id>
   ```
6. Optional: front the ACA endpoint with Azure Front Door + WAF for global
   anycast and L7 firewall.
