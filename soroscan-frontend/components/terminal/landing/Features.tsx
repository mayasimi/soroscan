"use client"

import * as React from "react"
import { Card } from "../Card"
import { Zap, Database, GitBranch, Webhook, Globe, Code2 } from "lucide-react"

const FEATURES = [
  {
    icon: <Code2 size={18} className="text-terminal-green" />,
    title: "SOROBAN_NATIVE",
    body: "Rust smart contract with admin-controlled indexer whitelist and standardised event emission protocols for any Soroban contract.",
    delay: "fade-in-up-1",
  },
  {
    icon: <Database size={18} className="text-terminal-green" />,
    title: "DJANGO_BACKEND",
    body: "Production-ready REST API with Django Rest Framework and robust PostgreSQL storage — built for high-throughput event ingestion.",
    delay: "fade-in-up-2",
  },
  {
    icon: <Zap size={18} className="text-terminal-green" />,
    title: "GRAPHQL_PLAYGROUND",
    body: "Flexible event queries with Strawberry GraphQL. Filter by contract ID, event type, ledger range, or timestamp window.",
    delay: "fade-in-up-3",
  },
  {
    icon: <Webhook size={18} className="text-terminal-green" />,
    title: "WEBHOOK_SUBSCRIPTIONS",
    body: "Real-time event push notifications with HMAC-signed payloads, powered by Celery workers and Redis message brokers.",
    delay: "fade-in-up-4",
  },
  {
    icon: <Globe size={18} className="text-terminal-green" />,
    title: "HORIZON_INTEGRATION",
    body: "Seamlessly stream ledger events directly from Stellar's Horizon API using optimised stellar-sdk polling workers.",
    delay: "fade-in-up-5",
  },
  {
    icon: <GitBranch size={18} className="text-terminal-green" />,
    title: "DEVELOPER_FIRST",
    body: "SDK clients for Python, TypeScript, and Rust. OpenAPI docs at /api/docs/. ReDoc at /api/redoc/. Zero lock-in.",
    delay: "fade-in-up-6",
  },
]

export function Features() {
  return (
    <section className="space-y-8">
      <div className="flex items-center gap-4">
        <h2 className="text-2xl font-bold text-terminal-green whitespace-nowrap font-terminal-mono">
          [SYSTEM_CAPABILITIES]
        </h2>
        <div className="h-[2px] w-full bg-terminal-green/20" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {FEATURES.map((f) => (
          <div key={f.title} className={f.delay}>
            <Card title={f.title} className="h-full hover:shadow-glow-green transition-shadow duration-300">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  {f.icon}
                  <span className="text-[10px] text-terminal-gray tracking-widest">{f.title}</span>
                </div>
                <p className="text-sm leading-relaxed text-terminal-gray">{f.body}</p>
              </div>
            </Card>
          </div>
        ))}
      </div>
    </section>
  )
}
