// Storage Account (Standard LRS, StorageV2) with two blob containers:
//   - uploads (custom-field files, invoice logos)
//   - pods    (driver POD photos, signed delivery proofs)
// Soft delete (30d) on blobs and containers. Public network access stays
// Enabled here for the bootstrap; flip to Disabled in Phase 6 hardening
// once the private endpoint is in place.

@description('Storage account name (3-24 lowercase alphanumeric)')
param name string

@description('Location')
param location string

@description('Tags')
param tags object = {}

resource sa 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: true
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Allow'
    }
    supportsHttpsTrafficOnly: true
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: sa
  name: 'default'
  properties: {
    deleteRetentionPolicy: {
      enabled: true
      days: 30
    }
    containerDeleteRetentionPolicy: {
      enabled: true
      days: 30
    }
    isVersioningEnabled: false
  }
}

resource uploadsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'uploads'
  properties: {
    publicAccess: 'None'
  }
}

resource podsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'pods'
  properties: {
    publicAccess: 'None'
  }
}

output storageId string = sa.id
output name string = sa.name
output blobEndpoint string = sa.properties.primaryEndpoints.blob
