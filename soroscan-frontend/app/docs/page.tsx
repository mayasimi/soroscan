import type { Metadata } from "next"
import "../styles/landing.css"
import { Navbar } from "@/components/terminal/landing/Navbar"
import { Footer } from "@/components/terminal/landing/Footer"
import { CodeSnippet } from "@/components/terminal/landing/CodeSnippet"
import { Card } from "@/components/terminal/Card"
import { Button } from "@/components/terminal/Button"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "SoroScan documentation — quick start guide, API overview, and SDK examples for Soroban event indexing on Stellar.",
}

const QUICK_STEPS = [
  {
    step: "01",
    title: "GET_API_KEY",
    body: "Register at the SoroScan API portal to generate your API key. Keys are scoped per project and rate-limited by plan.",
    code: "curl https://soroscan.io/api/auth/token \\\n  -H 'Content-Type: application/json' \\\n  -d '{\"email\": \"you@example.com\"}'",
    lang: "bash" as const,
  },
  {
    step: "02",
    title: "REGISTER_CONTRACT",
    body: "Whitelist your Soroban contract address. SoroScan will begin polling Horizon for events emitted by your contract.",
    code: "curl -X POST https://soroscan.io/api/contracts/ \\\n  -H 'Authorization: Bearer sk_live_...' \\\n  -d '{\"contract_id\": \"CABC...9X4Z\", \"label\": \"my-amm\"}'",
    lang: "bash" as const,
  },
  {
    step: "03",
    title: "QUERY_EVENTS",
    body: "Immediately start querying indexed events via REST, GraphQL, or subscribe to real-time webhooks.",
    code: "curl 'https://soroscan.io/api/events/?contract_id=CABC...9X4Z&limit=10' \\\n  -H 'Authorization: Bearer sk_live_...'",
    lang: "bash" as const,
  },
]

const PY_SDK = `from soroscan import SoroScanClient

client = SoroScanClient(api_key="sk_live_...")

events = await client.events.list(
    contract_id="CABC...9X4Z",
    event_type="SWAP_COMPLETE",
    limit=50,
)

for event in events:
    print(event.ledger, event.data)`

const TS_SDK = `import { SoroScanClient } from "@soroscan/sdk"

const client = new SoroScanClient({ apiKey: "sk_live_..." })

const { events } = await client.events.list({
  contractId: "CABC...9X4Z",
  limit: 50,
})

events.forEach(e => console.log(e.ledger, e.data))`

const GQL_EXAMPLE = `query GetEvents {
  events(
    contractId: "CABC...9X4Z"
    eventType: "SWAP_COMPLETE"
    limit: 10
  ) {
    ledger
    timestamp
    eventType
    contractId
    data
  }
}`

export default function DocsPage() {
  return (
    <div className="min-h-screen font-terminal-mono selection:bg-terminal-green selection:text-terminal-black">
      <Navbar />

      <main className="container mx-auto px-6 md:px-8 py-12 md:py-16 space-y-20 max-w-5xl">

        {/* Page header */}
        <div className="space-y-4">
          <div className="text-[10px] text-terminal-cyan tracking-widest">[DOCUMENTATION]</div>
          <h1 className="text-4xl md:text-5xl font-bold text-terminal-green font-terminal-mono">
            DOCS
          </h1>
          <p className="text-terminal-gray text-sm md:text-base max-w-xl leading-relaxed">
            Everything you need to start indexing Soroban contract events — from your first API key
            to advanced GraphQL queries and webhook subscriptions.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <a href="/api/docs/" target="_blank" rel="noopener noreferrer">
              <Button variant="primary" size="sm">SWAGGER_UI ↗</Button>
            </a>
            <a href="/api/redoc/" target="_blank" rel="noopener noreferrer">
              <Button variant="secondary" size="sm">REDOC ↗</Button>
            </a>
            <a href="https://github.com/SoroScan/soroscan" target="_blank" rel="noopener noreferrer">
              <Button variant="secondary" size="sm">GITHUB ↗</Button>
            </a>
          </div>
        </div>

        {/* Quick start */}
        <section className="space-y-8">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-terminal-green whitespace-nowrap">
              [QUICK_START]
            </h2>
            <div className="h-[2px] w-full bg-terminal-green/20" />
          </div>

          <div className="space-y-8">
            {QUICK_STEPS.map((s) => (
              <div key={s.step} className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-bold text-terminal-green/30 font-terminal-mono">{s.step}</span>
                    <span className="text-sm font-bold text-terminal-green">{s.title}</span>
                  </div>
                  <p className="text-terminal-gray text-sm leading-relaxed">{s.body}</p>
                </div>
                <CodeSnippet code={s.code} language={s.lang} />
              </div>
            ))}
          </div>
        </section>

        {/* API Overview */}
        <section className="space-y-8">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-terminal-green whitespace-nowrap">
              [API_OVERVIEW]
            </h2>
            <div className="h-[2px] w-full bg-terminal-green/20" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card title="REST_API" className="h-full">
              <div className="space-y-2 text-sm text-terminal-gray">
                <p>Full CRUD REST API built with Django Rest Framework.</p>
                <ul className="space-y-1 text-[11px] mt-3">
                  <li className="text-terminal-cyan">GET  /api/events/</li>
                  <li className="text-terminal-cyan">GET  /api/contracts/</li>
                  <li className="text-terminal-cyan">POST /api/webhooks/</li>
                  <li className="text-terminal-cyan">GET  /api/events/&#123;id&#125;/</li>
                </ul>
                <a href="/api/docs/" target="_blank" rel="noopener noreferrer" className="inline-block mt-3 text-[10px] text-terminal-green hover:underline">
                  View Swagger docs →
                </a>
              </div>
            </Card>

            <Card title="GRAPHQL_API" className="h-full">
              <div className="space-y-2 text-sm text-terminal-gray">
                <p>Flexible queries powered by Strawberry GraphQL.</p>
                <ul className="space-y-1 text-[11px] mt-3">
                  <li className="text-terminal-cyan">query events(&#123;filter&#125;)</li>
                  <li className="text-terminal-cyan">query contracts</li>
                  <li className="text-terminal-cyan">mutation createWebhook</li>
                </ul>
                <a href="/api/graphql/" target="_blank" rel="noopener noreferrer" className="inline-block mt-3 text-[10px] text-terminal-green hover:underline">
                  Open GraphQL playground →
                </a>
              </div>
            </Card>

            <Card title="WEBHOOKS" className="h-full">
              <div className="space-y-2 text-sm text-terminal-gray">
                <p>Real-time event push via signed HTTP callbacks.</p>
                <ul className="space-y-1 text-[11px] mt-3">
                  <li className="text-terminal-cyan">HMAC-SHA256 signatures</li>
                  <li className="text-terminal-cyan">Retry with backoff</li>
                  <li className="text-terminal-cyan">Delivery logs</li>
                </ul>
                <Link href="/docs#webhooks" className="inline-block mt-3 text-[10px] text-terminal-green hover:underline">
                  Webhook guide →
                </Link>
              </div>
            </Card>
          </div>
        </section>

        {/* SDK Examples */}
        <section className="space-y-8">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-terminal-green whitespace-nowrap">
              [SDK_EXAMPLES]
            </h2>
            <div className="h-[2px] w-full bg-terminal-green/20" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <div className="text-[10px] text-terminal-gray tracking-widest mb-3">Python SDK</div>
              <CodeSnippet code={PY_SDK} language="python" filename="example.py" />
            </div>
            <div>
              <div className="text-[10px] text-terminal-gray tracking-widest mb-3">TypeScript SDK</div>
              <CodeSnippet code={TS_SDK} language="typescript" filename="example.ts" />
            </div>
          </div>

          <div>
            <div className="text-[10px] text-terminal-gray tracking-widest mb-3">GraphQL Query</div>
            <CodeSnippet code={GQL_EXAMPLE} language="typescript" filename="query.graphql" className="max-w-2xl" />
          </div>
        </section>

      </main>

      <div className="container mx-auto px-6 md:px-8 max-w-5xl pb-16">
        <Footer />
      </div>

      {/* Background deco */}
      <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden opacity-20">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,65,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,65,0.03)_1px,transparent_1px)] bg-size-[40px_40px]" />
      </div>
    </div>
  )
}
