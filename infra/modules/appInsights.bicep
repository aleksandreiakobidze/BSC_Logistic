// Log Analytics Workspace + Application Insights (workspace-based).
// Used by ACA Environment for container logs and by the app's
// `instrumentation.ts` for traces / metrics.

@description('Log Analytics workspace name')
param workspaceName string

@description('App Insights component name')
param appInsightsName string

@description('Location')
param location string

@description('Tags')
param tags object = {}

resource law 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: workspaceName
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
    workspaceCapping: {
      dailyQuotaGb: 1
    }
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
  }
}

resource ai 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: law.id
    IngestionMode: 'LogAnalytics'
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

output workspaceId string = law.id
output workspaceCustomerId string = law.properties.customerId
output workspaceSharedKey string = law.listKeys().primarySharedKey
output appInsightsId string = ai.id
output appInsightsConnectionString string = ai.properties.ConnectionString
output appInsightsInstrumentationKey string = ai.properties.InstrumentationKey
