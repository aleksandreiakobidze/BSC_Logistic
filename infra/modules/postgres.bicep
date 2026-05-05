// Azure Database for PostgreSQL Flexible Server, GP D2ds_v5, PG16.
// Delegated subnet means the server is reachable only via VNet (no public
// endpoint). PgBouncer is enabled via server config so the client conn limit
// (per replica) can stay low (5) even with many app instances.

@description('Server name (lowercase alphanumeric + hyphens)')
param serverName string

@description('Location')
param location string

@description('Postgres admin login (16 char max)')
param adminLogin string

@description('Postgres admin password')
@secure()
param adminPassword string

@description('Resource ID of the delegated subnet')
param delegatedSubnetId string

@description('Resource ID of the privatelink DNS zone for postgres')
param privateDnsZoneId string

@description('SKU name')
param skuName string = 'Standard_B1ms'

@description('SKU tier (Burstable for B-series, GeneralPurpose for D-series)')
param skuTier string = 'Burstable'

@description('Storage size in GB')
param storageSizeGB int = 32

@description('Backup retention in days')
param backupRetentionDays int = 7

@description('Geo-redundant backup')
param geoRedundantBackup string = 'Disabled'

@description('Tags')
param tags object = {}

resource pg 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: serverName
  location: location
  tags: tags
  sku: {
    name: skuName
    tier: skuTier
  }
  properties: {
    version: '16'
    administratorLogin: adminLogin
    administratorLoginPassword: adminPassword
    storage: {
      storageSizeGB: storageSizeGB
      autoGrow: 'Enabled'
    }
    backup: {
      backupRetentionDays: backupRetentionDays
      geoRedundantBackup: geoRedundantBackup
    }
    network: {
      delegatedSubnetResourceId: delegatedSubnetId
      privateDnsZoneArmResourceId: privateDnsZoneId
      publicNetworkAccess: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
    authConfig: {
      passwordAuth: 'Enabled'
      activeDirectoryAuth: 'Enabled'
      tenantId: subscription().tenantId
    }
  }
}

// Create the application database
resource bscDb 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: pg
  name: 'bsc'
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// PgBouncer is only available on GP/MO tiers; on B-series we connect direct
// and rely on the lower per-replica `connection_limit` in the DATABASE_URL.
// When you upgrade the SKU later, re-add the pgbouncer.enabled / pool_mode
// configs and switch the URL to port 6432 + `?pgbouncer=true`.

resource cfgPgTrgm 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2024-08-01' = {
  parent: pg
  name: 'azure.extensions'
  properties: {
    value: 'PG_TRGM,UUID-OSSP,CITEXT'
    source: 'user-override'
  }
}

output id string = pg.id
output fqdn string = pg.properties.fullyQualifiedDomainName
output databaseName string = bscDb.name
