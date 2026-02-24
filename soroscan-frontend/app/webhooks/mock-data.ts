import type { Webhook, DeliveryLog } from "./types"

export const MOCK_WEBHOOKS: Webhook[] = [
  {
    id: "wh_001",
    url: "https://api.myapp.io/hooks/soroban",
    eventTypes: ["SWAP_COMPLETE", "LIQUIDITY_ADD"],
    contractFilter: "CABC...9X4Z",
    status: "ACTIVE",
    createdAt: "2026-02-10T09:12:00Z",
    lastDelivery: "2026-02-23T22:34:01Z",
    lastStatusCode: 200,
    successRate: 98.7,
    secret: "whsec_a1b2c3d4e5f6",
    totalDeliveries: 1543,
  },
  {
    id: "wh_002",
    url: "https://webhook.site/abc123def456",
    eventTypes: ["ALL"],
    status: "ACTIVE",
    createdAt: "2026-02-14T15:00:00Z",
    lastDelivery: "2026-02-23T22:31:45Z",
    lastStatusCode: 200,
    successRate: 100,
    secret: "whsec_b2c3d4e5f6a1",
    totalDeliveries: 289,
  },
  {
    id: "wh_003",
    url: "https://events.defiprotocol.org/soroscan",
    eventTypes: ["VAULT_DEPOSIT", "YIELD_CLAIMED"],
    contractFilter: "CGHI...F7K1",
    status: "SUSPENDED",
    createdAt: "2026-01-28T11:30:00Z",
    lastDelivery: "2026-02-21T08:10:15Z",
    lastStatusCode: 503,
    successRate: 74.2,
    secret: "whsec_c3d4e5f6a1b2",
    totalDeliveries: 802,
  },
  {
    id: "wh_004",
    url: "https://hooks.internal.corp/blockchain-events",
    eventTypes: ["GOV_PROPOSAL"],
    status: "FAILED",
    createdAt: "2026-02-01T08:00:00Z",
    lastDelivery: "2026-02-23T20:55:00Z",
    lastStatusCode: 404,
    successRate: 12.1,
    secret: "whsec_d4e5f6a1b2c3",
    totalDeliveries: 33,
  },
  {
    id: "wh_005",
    url: "https://realtime.indexer.finance/soroscan-events",
    eventTypes: ["ORACLE_UPDATE", "STAKING_LOCK", "SWAP_COMPLETE"],
    status: "ACTIVE",
    createdAt: "2026-02-18T19:45:00Z",
    lastDelivery: "2026-02-23T22:33:58Z",
    lastStatusCode: 200,
    successRate: 99.1,
    secret: "whsec_e5f6a1b2c3d4",
    totalDeliveries: 412,
  },
]

function buildLogs(webhookId: string, count: number): DeliveryLog[] {
  const eventTypes = ["SWAP_COMPLETE", "LIQUIDITY_ADD", "VAULT_DEPOSIT", "GOV_PROPOSAL", "YIELD_CLAIMED", "ORACLE_UPDATE", "STAKING_LOCK"] as const
  const contracts = ["CABC...9X4Z", "CDEF...2B8Y", "CGHI...F7K1", "CJKL...A9S0"]
  const statusCodes = [200, 200, 200, 200, 200, 201, 400, 422, 500, 503, 404]
  const errors: Record<number, string> = {
    400: "Bad Request: unexpected payload schema",
    422: "Unprocessable Entity: missing contractId field",
    500: "Internal Server Error: database timeout",
    503: "Service Unavailable: endpoint temporarily down",
    404: "Not Found: webhook endpoint no longer exists",
  }

  const base = new Date("2026-02-23T22:35:00Z").getTime()

  return Array.from({ length: count }, (_, i) => {
    const code = statusCodes[i % statusCodes.length]
    const ts = new Date(base - i * 137_000).toISOString()
    return {
      id: `log_${webhookId}_${i}`,
      webhookId,
      timestamp: ts,
      statusCode: code,
      responseTimeMs: Math.floor(Math.random() * 800 + 50),
      attempt: code >= 400 && i % 7 === 0 ? 2 : 1,
      errorMessage: code >= 400 ? errors[code] : undefined,
      eventType: eventTypes[i % eventTypes.length],
      contractId: contracts[i % contracts.length],
    }
  })
}

export const MOCK_DELIVERY_LOGS: DeliveryLog[] = [
  ...buildLogs("wh_001", 42),
  ...buildLogs("wh_002", 18),
  ...buildLogs("wh_003", 25),
  ...buildLogs("wh_004", 12),
  ...buildLogs("wh_005", 30),
]
