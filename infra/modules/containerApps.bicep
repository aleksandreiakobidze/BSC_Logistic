// Container Apps + Jobs.
//   - bsc-web      : external HTTP/2 ingress, autoscale 1..5 on concurrent reqs
//   - bsc-worker   : no ingress, autoscale 1..3 on Redis list length
//   - bsc-migrate  : ACA Job, manual trigger -> `prisma migrate deploy`
//   - bsc-cron     : ACA Job, schedule */15 * * * * -> cron-maintenance.ts
//
// Each app has a system-assigned MI granted:
//   - AcrPull on the registry (so it can pull the image)
//   - Key Vault Secrets User on the vault (so secret refs resolve)
//   - Storage Blob Data Contributor on the storage account (uploads/pods rw)

@description('Prefix for app names (e.g. bsc-prod -> bsc-prod-web)')
param appNamePrefix string

@description('Location')
param location string

@description('ACA Managed Environment resource ID')
param environmentId string

@description('ACR login server (e.g. bscprodacr.azurecr.io)')
param acrLoginServer string

@description('ACR resource ID')
param acrId string

@description('Key Vault name (used to construct secret references)')
param keyVaultName string

@description('Key Vault URI (e.g. https://bsc-prod-kv.vault.azure.net/)')
param keyVaultUri string

@description('Storage account resource ID for RBAC role assignment')
param storageAccountId string

@description('Application Insights connection string')
param appInsightsConnectionString string

@description('Container image (registry/repo:tag) to deploy initially')
param initialImage string

@description('Tags')
param tags object = {}

// Names
var webName = '${appNamePrefix}-web'
var workerName = '${appNamePrefix}-worker'
var migrateName = '${appNamePrefix}-migrate'
var cronName = '${appNamePrefix}-cron'

// Existing references for RBAC scoping
resource acr 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' existing = {
  name: last(split(acrId, '/'))
}

resource kv 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: last(split(storageAccountId, '/'))
}

// Built-in role IDs
var roleAcrPull = '7f951dda-4ed3-4680-a7ca-43fe172d538d'
var roleKvSecretsUser = '4633458b-17de-408a-b874-0445c86b69e6'
var roleStorageBlobContrib = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'

// =============================================================================
// bsc-web
// =============================================================================
resource webApp 'Microsoft.App/containerApps@2024-10-02-preview' = {
  name: webName
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    environmentId: environmentId
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 3000
        // Next.js standalone (`node server.js`) only speaks HTTP/1.1, so envoy
        // must auto-negotiate (http2 forces gRPC-style framing and breaks the
        // upstream connection with "protocol error").
        transport: 'auto'
        allowInsecure: false
        traffic: [
          { latestRevision: true, weight: 100 }
        ]
        corsPolicy: {
          allowedOrigins: [ '*' ]
        }
      }
      registries: [
        {
          server: acrLoginServer
          identity: 'system'
        }
      ]
      secrets: [
        { name: 'database-url',         keyVaultUrl: '${keyVaultUri}secrets/database-url',         identity: 'system' }
        { name: 'redis-url',            keyVaultUrl: '${keyVaultUri}secrets/redis-url',            identity: 'system' }
        { name: 'azure-storage-conn',   keyVaultUrl: '${keyVaultUri}secrets/azure-storage-conn',   identity: 'system' }
        { name: 'nextauth-secret',      keyVaultUrl: '${keyVaultUri}secrets/nextauth-secret',      identity: 'system' }
        { name: 'resend-api-key',       keyVaultUrl: '${keyVaultUri}secrets/resend-api-key',       identity: 'system' }
        { name: 'smtp-pass',            keyVaultUrl: '${keyVaultUri}secrets/smtp-pass',            identity: 'system' }
        { name: 'twilio-auth-token',    keyVaultUrl: '${keyVaultUri}secrets/twilio-auth-token',    identity: 'system' }
        { name: 'appinsights-conn',     keyVaultUrl: '${keyVaultUri}secrets/appinsights-conn',     identity: 'system' }
      ]
    }
    template: {
      containers: [
        {
          name: 'web'
          image: initialImage
          resources: {
            cpu: json('1.0')
            memory: '2Gi'
          }
          command: [ 'node', 'server.js' ]
          env: [
            { name: 'NODE_ENV',                              value: 'production' }
            { name: 'PORT',                                  value: '3000' }
            { name: 'HOSTNAME',                              value: '0.0.0.0' }
            { name: 'NEXT_TELEMETRY_DISABLED',               value: '1' }
            { name: 'AZURE_STORAGE_CONTAINER',               value: 'uploads' }
            { name: 'DATABASE_URL',                          secretRef: 'database-url' }
            { name: 'REDIS_URL',                             secretRef: 'redis-url' }
            { name: 'AZURE_STORAGE_CONNECTION_STRING',       secretRef: 'azure-storage-conn' }
            { name: 'NEXTAUTH_SECRET',                       secretRef: 'nextauth-secret' }
            { name: 'AUTH_SECRET',                           secretRef: 'nextauth-secret' }
            { name: 'RESEND_API_KEY',                        secretRef: 'resend-api-key' }
            { name: 'SMTP_PASS',                             secretRef: 'smtp-pass' }
            { name: 'TWILIO_AUTH_TOKEN',                     secretRef: 'twilio-auth-token' }
            { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', secretRef: 'appinsights-conn' }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/api/health'
                port: 3000
              }
              periodSeconds: 30
              initialDelaySeconds: 20
              failureThreshold: 3
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/api/health?READINESS=true'
                port: 3000
              }
              periodSeconds: 10
              initialDelaySeconds: 10
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 2
        rules: [
          {
            name: 'http-concurrency'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
}

// =============================================================================
// bsc-worker (BullMQ consumer)
// =============================================================================
resource workerApp 'Microsoft.App/containerApps@2024-10-02-preview' = {
  name: workerName
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    environmentId: environmentId
    configuration: {
      activeRevisionsMode: 'Single'
      registries: [
        {
          server: acrLoginServer
          identity: 'system'
        }
      ]
      secrets: [
        { name: 'database-url',         keyVaultUrl: '${keyVaultUri}secrets/database-url',         identity: 'system' }
        { name: 'redis-url',            keyVaultUrl: '${keyVaultUri}secrets/redis-url',            identity: 'system' }
        { name: 'azure-storage-conn',   keyVaultUrl: '${keyVaultUri}secrets/azure-storage-conn',   identity: 'system' }
        { name: 'nextauth-secret',      keyVaultUrl: '${keyVaultUri}secrets/nextauth-secret',      identity: 'system' }
        { name: 'resend-api-key',       keyVaultUrl: '${keyVaultUri}secrets/resend-api-key',       identity: 'system' }
        { name: 'smtp-pass',            keyVaultUrl: '${keyVaultUri}secrets/smtp-pass',            identity: 'system' }
        { name: 'twilio-auth-token',    keyVaultUrl: '${keyVaultUri}secrets/twilio-auth-token',    identity: 'system' }
        { name: 'appinsights-conn',     keyVaultUrl: '${keyVaultUri}secrets/appinsights-conn',     identity: 'system' }
      ]
    }
    template: {
      containers: [
        {
          name: 'worker'
          image: initialImage
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          command: [ 'node', 'node_modules/tsx/dist/cli.mjs', 'workers/index.ts' ]
          env: [
            { name: 'NODE_ENV',                              value: 'production' }
            { name: 'AZURE_STORAGE_CONTAINER',               value: 'uploads' }
            { name: 'DATABASE_URL',                          secretRef: 'database-url' }
            { name: 'REDIS_URL',                             secretRef: 'redis-url' }
            { name: 'AZURE_STORAGE_CONNECTION_STRING',       secretRef: 'azure-storage-conn' }
            { name: 'NEXTAUTH_SECRET',                       secretRef: 'nextauth-secret' }
            { name: 'RESEND_API_KEY',                        secretRef: 'resend-api-key' }
            { name: 'SMTP_PASS',                             secretRef: 'smtp-pass' }
            { name: 'TWILIO_AUTH_TOKEN',                     secretRef: 'twilio-auth-token' }
            { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', secretRef: 'appinsights-conn' }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 1
        rules: [
          {
            name: 'redis-list'
            custom: {
              type: 'redis'
              metadata: {
                listName: 'bull:notifications:wait'
                listLength: '10'
                addressFromEnv: 'REDIS_URL'
              }
            }
          }
        ]
      }
    }
  }
}

// =============================================================================
// bsc-migrate (ACA Job, manual trigger)
// =============================================================================
resource migrateJob 'Microsoft.App/jobs@2024-10-02-preview' = {
  name: migrateName
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    environmentId: environmentId
    configuration: {
      triggerType: 'Manual'
      replicaTimeout: 1800
      replicaRetryLimit: 1
      manualTriggerConfig: {
        parallelism: 1
        replicaCompletionCount: 1
      }
      registries: [
        {
          server: acrLoginServer
          identity: 'system'
        }
      ]
      secrets: [
        { name: 'database-url', keyVaultUrl: '${keyVaultUri}secrets/database-url', identity: 'system' }
      ]
    }
    template: {
      containers: [
        {
          name: 'migrate'
          image: initialImage
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          // Wrapped in /bin/sh -c so we can roll back a known-failed migration
          // (P3009 recovery) before re-running deploy. The first part is a
          // safe no-op when nothing is in failed state.
          command: [ '/bin/sh' ]
          args: [
            '-c'
            'npx prisma migrate resolve --rolled-back 20260505142640_init_postgres || true && npx prisma migrate deploy'
          ]
          env: [
            { name: 'NODE_ENV',     value: 'production' }
            { name: 'DATABASE_URL', secretRef: 'database-url' }
          ]
        }
      ]
    }
  }
}

// =============================================================================
// bsc-cron (ACA Job, every 15 minutes)
// =============================================================================
resource cronJob 'Microsoft.App/jobs@2024-10-02-preview' = {
  name: cronName
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    environmentId: environmentId
    configuration: {
      triggerType: 'Schedule'
      replicaTimeout: 600
      replicaRetryLimit: 1
      scheduleTriggerConfig: {
        cronExpression: '*/15 * * * *'
        parallelism: 1
        replicaCompletionCount: 1
      }
      registries: [
        {
          server: acrLoginServer
          identity: 'system'
        }
      ]
      secrets: [
        { name: 'database-url', keyVaultUrl: '${keyVaultUri}secrets/database-url', identity: 'system' }
        { name: 'redis-url',    keyVaultUrl: '${keyVaultUri}secrets/redis-url',    identity: 'system' }
      ]
    }
    template: {
      containers: [
        {
          name: 'cron'
          image: initialImage
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          command: [ 'node', 'node_modules/tsx/dist/cli.mjs', 'scripts/cron-maintenance.ts' ]
          env: [
            { name: 'NODE_ENV',     value: 'production' }
            { name: 'DATABASE_URL', secretRef: 'database-url' }
            { name: 'REDIS_URL',    secretRef: 'redis-url' }
          ]
        }
      ]
    }
  }
}

// =============================================================================
// Role assignments (one per identity per role per scope)
// =============================================================================

// Web -> AcrPull
resource webAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, webApp.id, roleAcrPull)
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleAcrPull)
    principalId: webApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}
// Worker -> AcrPull
resource workerAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, workerApp.id, roleAcrPull)
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleAcrPull)
    principalId: workerApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}
// Migrate -> AcrPull
resource migrateAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, migrateJob.id, roleAcrPull)
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleAcrPull)
    principalId: migrateJob.identity.principalId
    principalType: 'ServicePrincipal'
  }
}
// Cron -> AcrPull
resource cronAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, cronJob.id, roleAcrPull)
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleAcrPull)
    principalId: cronJob.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// Web -> KV Secrets User
resource webKvSecrets 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(kv.id, webApp.id, roleKvSecretsUser)
  scope: kv
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleKvSecretsUser)
    principalId: webApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}
// Worker -> KV Secrets User
resource workerKvSecrets 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(kv.id, workerApp.id, roleKvSecretsUser)
  scope: kv
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleKvSecretsUser)
    principalId: workerApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}
// Migrate -> KV Secrets User
resource migrateKvSecrets 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(kv.id, migrateJob.id, roleKvSecretsUser)
  scope: kv
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleKvSecretsUser)
    principalId: migrateJob.identity.principalId
    principalType: 'ServicePrincipal'
  }
}
// Cron -> KV Secrets User
resource cronKvSecrets 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(kv.id, cronJob.id, roleKvSecretsUser)
  scope: kv
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleKvSecretsUser)
    principalId: cronJob.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// Web -> Storage Blob Data Contributor
resource webStorage 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, webApp.id, roleStorageBlobContrib)
  scope: storage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleStorageBlobContrib)
    principalId: webApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}
// Worker -> Storage Blob Data Contributor
resource workerStorage 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, workerApp.id, roleStorageBlobContrib)
  scope: storage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleStorageBlobContrib)
    principalId: workerApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// Outputs --------------------------------------------------------------------
output webName string = webApp.name
output webFqdn string = webApp.properties.configuration.ingress.fqdn
output workerName string = workerApp.name
output migrateJobName string = migrateJob.name
output cronJobName string = cronJob.name
