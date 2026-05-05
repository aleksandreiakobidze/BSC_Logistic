// Azure Cache for Redis, Standard C1 (1 GB, replication, ~99.9% SLA).
// TLS only on 6380. Used for:
//   - BullMQ worker queues
//   - SSE Pub/Sub fan-out across web replicas (lib/quotation-events.ts)

@description('Cache name')
param name string

@description('Location')
param location string

@description('SKU name (Basic | Standard | Premium)')
param skuName string = 'Basic'

@description('SKU family (C = Standard/Basic, P = Premium)')
param family string = 'C'

@description('SKU capacity (Basic C0 = 250 MB, C1 = 1 GB; Standard C1 = 1 GB w/ HA)')
param capacity int = 0

@description('Tags')
param tags object = {}

resource redis 'Microsoft.Cache/redis@2024-04-01-preview' = {
  name: name
  location: location
  tags: tags
  properties: {
    sku: {
      name: skuName
      family: family
      capacity: capacity
    }
    enableNonSslPort: false
    minimumTlsVersion: '1.2'
    redisConfiguration: {
      'maxmemory-policy': 'allkeys-lru'
    }
    publicNetworkAccess: 'Enabled' // tighten to 'Disabled' once private endpoint is wired
  }
}

output id string = redis.id
output hostName string = redis.properties.hostName
output sslPort int = redis.properties.sslPort
@secure()
output primaryKey string = redis.listKeys().primaryKey
