// Key Vault with RBAC authorization. Optional admin object ID is granted
// "Key Vault Administrator" so a human can populate secrets via the portal.
// Container App managed identities get "Key Vault Secrets User" wired in
// the containerApps module via roleAssignments.

@description('Vault name (3-24 chars, lowercase letters/numbers/hyphens)')
param name string

@description('Location')
param location string

@description('AAD tenant ID')
param tenantId string

@description('Object ID of the principal granted Key Vault Administrator. Pass empty to skip.')
param adminObjectId string = ''

@description('Tags')
param tags object = {}

resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    tenantId: tenantId
    sku: {
      name: 'standard'
      family: 'A'
    }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: true
    publicNetworkAccess: 'Enabled' // tighten to 'Disabled' once private endpoint is wired
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Allow'
    }
  }
}

// Built-in role: Key Vault Administrator
var kvAdminRoleId = '00482a5a-887f-4fb3-b363-3b7fe8e74483'

resource kvAdminAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(adminObjectId)) {
  name: guid(kv.id, adminObjectId, kvAdminRoleId)
  scope: kv
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', kvAdminRoleId)
    principalId: adminObjectId
    principalType: 'User'
  }
}

output id string = kv.id
output name string = kv.name
output vaultUri string = kv.properties.vaultUri
