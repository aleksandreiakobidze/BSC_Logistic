// Azure Container Registry (Basic). Admin user disabled — pull happens via
// the Container App's system-assigned managed identity (granted AcrPull).

@description('ACR name (3-50 lowercase alphanumeric)')
param name string

@description('Location')
param location string

@description('Tags')
param tags object = {}

resource acr 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false
    publicNetworkAccess: 'Enabled'
    networkRuleBypassOptions: 'AzureServices'
  }
}

output acrId string = acr.id
output loginServer string = acr.properties.loginServer
output name string = acr.name
