// =============================================================================
// BSC Logistics — production stack (Azure Container Apps)
// =============================================================================
// Single resource group, single environment (production).
//
//   Web (bsc-web)        ┐
//   Worker (bsc-worker)  ├─ Container Apps in a VNet-injected ACA Environment
//   Migrate Job          │     (bsc-migrate, manual trigger)
//   Cron Job             │     (bsc-cron, every 15 minutes)
//                        │
//   Postgres Flex        ├─ private endpoint, public access disabled
//   Cache for Redis      ├─ private endpoint
//   Storage Account      ├─ private endpoint, two containers
//   Key Vault            ├─ RBAC, ACA MIs granted Secrets User
//   Container Registry   ├─ ACA MIs granted AcrPull
//   App Insights + LAW   ┘
//
// Deploy:
//   az group create -n bsc-prod-rg -l westeurope
//   az deployment group create -g bsc-prod-rg \
//     -f infra/main.bicep -p infra/main.parameters.prod.json \
//     -p pgAdminPassword='<paste-strong-password>'
// =============================================================================

targetScope = 'resourceGroup'

@description('Location for all resources')
param location string = resourceGroup().location

@description('Short app name. Used as a stem for resource names.')
param appName string = 'bsc'

@description('Environment label appended to resource names (prod / staging).')
param envName string = 'prod'

@description('Postgres admin login (16 char max, lowercase, no @).')
param pgAdminLogin string = 'bscadmin'

@description('Postgres admin password. Generate strong, store in Key Vault.')
@secure()
param pgAdminPassword string

@description('Object ID of the principal (you) granted Key Vault Administrator.')
param adminObjectId string = ''

@description('Container image tag to deploy initially. ACR builds bootstrap image.')
param initialImageTag string = 'bootstrap'

@description('Tags applied to every resource.')
param tags object = {
  app: 'bsc-logistics'
  env: 'production'
  managedBy: 'bicep'
}

// -- Computed names ----------------------------------------------------------
var prefix = toLower('${appName}-${envName}')
var prefixCompact = toLower('${appName}${envName}')
var acrName = '${prefixCompact}acr${uniqueString(resourceGroup().id)}'
var pgName = '${prefix}-pg'
var redisName = '${prefix}-redis'
var storageName = take('${prefixCompact}st${uniqueString(resourceGroup().id)}', 24)
var kvName = take('${prefix}-kv-${uniqueString(resourceGroup().id)}', 24)
var lawName = '${prefix}-law'
var aiName = '${prefix}-ai'
var acaEnvName = '${prefix}-env'
var vnetName = '${prefix}-vnet'

// -- Networking --------------------------------------------------------------
module network 'modules/network.bicep' = {
  name: 'network'
  params: {
    name: vnetName
    location: location
    tags: tags
  }
}

// -- Observability -----------------------------------------------------------
module observability 'modules/appInsights.bicep' = {
  name: 'observability'
  params: {
    workspaceName: lawName
    appInsightsName: aiName
    location: location
    tags: tags
  }
}

// -- ACR ---------------------------------------------------------------------
module acr 'modules/acr.bicep' = {
  name: 'acr'
  params: {
    name: acrName
    location: location
    tags: tags
  }
}

// -- Key Vault ---------------------------------------------------------------
module keyvault 'modules/keyvault.bicep' = {
  name: 'keyvault'
  params: {
    name: kvName
    location: location
    tenantId: subscription().tenantId
    adminObjectId: adminObjectId
    tags: tags
  }
}

// -- Storage -----------------------------------------------------------------
module storage 'modules/storage.bicep' = {
  name: 'storage'
  params: {
    name: storageName
    location: location
    tags: tags
  }
}

// -- Postgres Flex -----------------------------------------------------------
module postgres 'modules/postgres.bicep' = {
  name: 'postgres'
  params: {
    serverName: pgName
    location: location
    adminLogin: pgAdminLogin
    adminPassword: pgAdminPassword
    delegatedSubnetId: network.outputs.dbSubnetId
    privateDnsZoneId: network.outputs.pgDnsZoneId
    tags: tags
  }
  dependsOn: [
    network
  ]
}

// -- Redis -------------------------------------------------------------------
module redis 'modules/redis.bicep' = {
  name: 'redis'
  params: {
    name: redisName
    location: location
    tags: tags
  }
}

// -- ACA Environment ---------------------------------------------------------
module acaEnv 'modules/containerAppsEnv.bicep' = {
  name: 'acaEnv'
  params: {
    name: acaEnvName
    location: location
    infrastructureSubnetId: network.outputs.acaSubnetId
    workspaceCustomerId: observability.outputs.workspaceCustomerId
    workspaceSharedKey: observability.outputs.workspaceSharedKey
    tags: tags
  }
}

// -- Container Apps + Jobs ---------------------------------------------------
module containerApps 'modules/containerApps.bicep' = {
  name: 'containerApps'
  params: {
    appNamePrefix: prefix
    location: location
    environmentId: acaEnv.outputs.environmentId
    acrLoginServer: acr.outputs.loginServer
    acrId: acr.outputs.acrId
    keyVaultName: keyvault.outputs.name
    keyVaultUri: keyvault.outputs.vaultUri
    storageAccountId: storage.outputs.storageId
    appInsightsConnectionString: observability.outputs.appInsightsConnectionString
    initialImage: '${acr.outputs.loginServer}/${appName}:${initialImageTag}'
    tags: tags
  }
}

// -- Outputs -----------------------------------------------------------------
output acrLoginServer string = acr.outputs.loginServer
output keyVaultName string = keyvault.outputs.name
output webFqdn string = containerApps.outputs.webFqdn
output postgresHost string = postgres.outputs.fqdn
output redisHostname string = redis.outputs.hostName
output storageAccountName string = storage.outputs.name
