import type { Metadata } from "next"
import "../styles/landing.css"
import { Navbar } from "@/components/terminal/landing/Navbar"
import { Footer } from "@/components/terminal/landing/Footer"
import { Card } from "@/components/terminal/Card"
import {
  Zap, Database, GitBranch, Webhook, Globe, Code2,
  Shield, Clock, BarChart2, Layers
} from "lucide-react"

export const metadata: Metadata = {
  title: "Features",
  description:
    "Explore SoroScan's full feature set — GraphQL API, REST API, Webhooks, real-time indexing, SDKs, and more for Soroban smart contracts.",
}

const FEATURE_GROUPS = [
  {
    group: "INDEXING_ENGINE",
    features: [
      {
        icon: <Globe size={20} className="text-terminal-green" />,
        title: "Horizon Integration",
        body: "Continuously streams ledger close events from Stellar's Horizon API using optimised stellar-sdk polling workers. Zero missed events guaranteed.",
      },
      {
        icon: <Clock size={20} className="text-terminal-green" />,
        title: "Real-Time Processing",
        body: "End-to-end latency under 100ms from ledger close to queryable event. Events are persisted to PostgreSQL with full ACID guarantees.",
      },
      {
        icon: <Shield size={20} className="text-terminal-green" />,
        title: "Contract Whitelist",
        body: "Admin-controlled whitelist prevents abuse. Register any Soroban contract ID and SoroScan starts indexing its events within seconds.",
      },
    ],
  },
  {
    group: "QUERY_LAYER",
    features: [
      {
        icon: <Zap size={20} className="text-terminal-green" />,
        title: "GraphQL Playground",
        body: "Strawberry GraphQL schema lets you filter by contract ID, event type, ledger range, timestamp, or any combination. Pagination included.",
      },
      {
        icon: <Database size={20} className="text-terminal-green" />,
        title: "REST API",
        body: "Django Rest Framework REST API with full OpenAPI 3.0 docs at /api/docs/ and ReDoc at /api/redoc/. JSON responses, cursor-based paging.",
      },
      {
        icon: <Webhook size={20} className="text-terminal-green" />,
        title: "Webhook Subscriptions",
        body: "Subscribe to contract events via HTTPS callback. Payloads are HMAC-SHA256 signed. Celery-powered retry queue with exponential backoff.",
      },
    ],
  },
  {
    group: "DEVELOPER_TOOLING",
    features: [
      {
        icon: <Code2 size={20} className="text-terminal-green" />,
        title: "SDK — Python",
        body: "Async-first Python SDK. pip install soroscan. Full type hints, automatic retries, and support for both REST and GraphQL endpoints.",
      },
      {
        icon: <GitBranch size={20} className="text-terminal-green" />,
        title: "SDK — TypeScript",
        body: "npm install @soroscan/sdk. Works in browser and Node.js. Auto-generated typed client from OpenAPI spec for zero breaking changes.",
      },
      {
        icon: <Layers size={20} className="text-terminal-green" />,
        title: "SDK — Rust",
        body: "Cargo crate for native Soroban contract authors. Stream events directly in your indexer without leaving the Rust ecosystem.",
      },
    ],
  },
]

const COMPARISON = [
  { feature: "Event indexing", soroscan: "✓ Managed", manual: "✗ DIY polling" },
  { feature: "GraphQL API",    soroscan: "✓ Built-in", manual: "✗ Build your own" },
  { feature: "REST API",       soroscan: "✓ Built-in", manual: "✗ Build your own" },
  { feature: "Webhooks",       soroscan: "✓ Built-in", manual: "✗ Build your own" },
  { feature: "SDK clients",    soroscan: "✓ 3 languages", manual: "✗ None" },
  { feature: "Infrastructure", soroscan: "✓ Zero-ops",  manual: "✗ Self-managed" },
  { feature: "Missed events",  soroscan: "✓ Guaranteed none", manual: "✗ Possible" },
  { feature: "Setup time",     soroscan: "✓ < 5 minutes", manual: "✗ Days / weeks" },
]

const ASCII_ARCH = `
  ┌─────────────────────────────────────────────────────┐
  │              STELLAR NETWORK (Horizon API)          │
  └───────────────────────┬─────────────────────────────┘
                          │  ledger close events
  ┌─────────────────────────────────────────────────────┐
  │         SOROSCAN INDEXER (Django + Celery)          │
  │  ┌─────────────┐  ┌──────────────┐  ┌────────────┐ │
  │  │ Event Poller│→ │   Parser     │→ │  Postgres  │ │
  │  └─────────────┘  └──────────────┘  └─────┬──────┘ │
  └─────────────────────────────────────────────┼───────┘
                                               │ queryable events
              ┌────────────┬──────────────┬────┴───────────┐
              │  REST API  │  GraphQL API │  Webhook Queue │
              └────────────┴──────────────┴────────────────┘
`

export default function FeaturesPage() {
  return (
    <div className="min-h-screen font-terminal-mono selection:bg-terminal-green selection:text-terminal-black">
      <Navbar />

      <main className="container mx-auto px-6 md:px-8 py-12 md:py-16 space-y-20 max-w-6xl">

        {/* Page header */}
        <div className="space-y-4">
          <div className="text-[10px] text-terminal-cyan tracking-widest">[FEATURES_SHOWCASE]</div>
          <h1 className="text-4xl md:text-5xl font-bold text-terminal-green font-terminal-mono">
            SYSTEM_CAPABILITIES
          </h1>
          <p className="text-terminal-gray text-sm md:text-base max-w-xl leading-relaxed">
            A complete event indexing stack for Soroban smart contracts — from raw ledger events to
            queryable APIs and real-time push notifications.
          </p>
        </div>

        {/* Feature groups */}
        {FEATURE_GROUPS.map((group) => (
          <section key={group.group} className="space-y-8">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold text-terminal-green whitespace-nowrap">
                [{group.group}]
              </h2>
              <div className="h-[2px] w-full bg-terminal-green/20" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {group.features.map((f) => (
                <Card key={f.title} title={f.title.toUpperCase().replace(/ /g, "_")} className="h-full hover:shadow-glow-green transition-shadow duration-300">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 mb-1">
                      {f.icon}
                      <span className="text-terminal-green text-xs font-bold">{f.title}</span>
                    </div>
                    <p className="text-sm leading-relaxed text-terminal-gray">{f.body}</p>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        ))}

        {/* Comparison table */}
        <section className="space-y-8">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-terminal-green whitespace-nowrap">
              [VS_MANUAL_INDEXING]
            </h2>
            <div className="h-[2px] w-full bg-terminal-green/20" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-terminal-green/20">
                  <th className="text-left py-3 px-4 text-terminal-gray text-[10px] tracking-widest">FEATURE</th>
                  <th className="text-left py-3 px-4 text-terminal-green text-[10px] tracking-widest">SOROSCAN</th>
                  <th className="text-left py-3 px-4 text-terminal-danger text-[10px] tracking-widest">MANUAL_INDEXER</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr key={row.feature} className={`border-b border-terminal-green/10 ${i % 2 === 0 ? "bg-terminal-green/2" : ""}`}>
                    <td className="py-2.5 px-4 text-terminal-gray text-[11px]">{row.feature}</td>
                    <td className="py-2.5 px-4 text-terminal-green text-[11px]">{row.soroscan}</td>
                    <td className="py-2.5 px-4 text-terminal-danger text-[11px]">{row.manual}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Architecture diagram */}
        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-terminal-green whitespace-nowrap">
              [ARCHITECTURE]
            </h2>
            <div className="h-[2px] w-full bg-terminal-green/20" />
          </div>
          <div className="flex items-center gap-2 mb-2">
            <BarChart2 size={14} className="text-terminal-cyan" />
            <span className="text-[10px] text-terminal-gray tracking-widest">SYSTEM_ARCHITECTURE_OVERVIEW</span>
          </div>
          <pre className="text-[11px] md:text-xs text-terminal-green/80 font-terminal-mono overflow-x-auto border border-terminal-green/20 p-4 leading-relaxed bg-black/30">
            {ASCII_ARCH}
          </pre>
        </section>

      </main>

      <div className="container mx-auto px-6 md:px-8 max-w-6xl pb-16">
        <Footer />
      </div>

      {/* Background deco */}
      <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden opacity-20">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,65,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,65,0.03)_1px,transparent_1px)] bg-size-[40px_40px]" />
      </div>
    </div>
  )
}
