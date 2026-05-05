// Container Apps Environment, VNet-injected so workloads can reach the
// private endpoints for Postgres / Redis / Storage / Key Vault.

@description('ACA Environment name')
param name string

@description('Location')
param location string

@description('Resource ID of the delegated infrastructure subnet (aca-subnet)')
param infrastructureSubnetId string

@description('Log Analytics workspace customer ID')
param workspaceCustomerId string

@description('Log Analytics workspace shared key')
@secure()
param workspaceSharedKey string

@description('Tags')
param tags object = {}

resource env 'Microsoft.App/managedEnvironments@2024-10-02-preview' = {
  name: name
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: workspaceCustomerId
        sharedKey: workspaceSharedKey
      }
    }
    vnetConfiguration: {
      infrastructureSubnetId: infrastructureSubnetId
      internal: false
    }
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
  }
}

output environmentId string = env.id
output defaultDomain string = env.properties.defaultDomain
output staticIp string = env.properties.staticIp
