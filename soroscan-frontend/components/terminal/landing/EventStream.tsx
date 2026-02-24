"use client"

import * as React from "react"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../Table"

const INITIAL_EVENTS = [
  { ts: "2026-02-23T21:59:01", contract: "CABC...9X4Z", type: "LIQUIDITY_ADD",  status: "PROCESSED", statusClass: "text-terminal-green" },
  { ts: "2026-02-23T21:58:55", contract: "CDEF...2B8Y", type: "SWAP_COMPLETE",  status: "PROCESSED", statusClass: "text-terminal-green" },
  { ts: "2026-02-23T21:58:48", contract: "CGHI...F7K1", type: "VAULT_DEPOSIT",  status: "INGESTING", statusClass: "text-terminal-warning" },
  { ts: "2026-02-23T21:58:30", contract: "CJKL...A9S0", type: "GOV_PROPOSAL",  status: "PROCESSED", statusClass: "text-terminal-green" },
  { ts: "2026-02-23T21:58:12", contract: "CMNO...L2T8", type: "YIELD_CLAIMED", status: "PROCESSED", statusClass: "text-terminal-green" },
]

const NEW_EVENTS = [
  { ts: "2026-02-23T22:00:04", contract: "CPQR...X1Z9", type: "STAKING_LOCK",  status: "PROCESSED", statusClass: "text-terminal-green" },
  { ts: "2026-02-23T22:00:11", contract: "CSTU...W3Y7", type: "ORACLE_UPDATE", status: "INGESTING", statusClass: "text-terminal-warning" },
]

type EventRow = typeof INITIAL_EVENTS[number]

export function EventStream() {
  const [events, setEvents] = React.useState<EventRow[]>(INITIAL_EVENTS)
  const newIdx = React.useRef(0)

  // Simulate a new event arriving every 3 seconds
  React.useEffect(() => {
    const interval = setInterval(() => {
      const next = NEW_EVENTS[newIdx.current % NEW_EVENTS.length]
      newIdx.current += 1
      setEvents((prev) => [next, ...prev.slice(0, 7)])
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <section className="space-y-8">
      {/* Problem / Solution narrative */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border border-terminal-green/20 p-6 md:p-8 relative">
        <div className="scanline-overlay" />
        <div>
          <div className="text-[10px] text-terminal-danger tracking-widest mb-2 font-terminal-mono">[PROBLEM]</div>
          <h3 className="text-xl font-bold text-terminal-danger mb-3 font-terminal-mono">NO_THE_GRAPH_FOR_SOROBAN</h3>
          <p className="text-terminal-gray text-sm leading-relaxed">
            Developers building on Stellar&apos;s Soroban smart contracts have no reliable way to
            index or query on-chain events. Building custom indexers means managing infrastructure,
            dealing with ledger polling, and writing brittle parsers — just to answer &quot;what events did my contract emit?&quot;
          </p>
        </div>
        <div>
          <div className="text-[10px] text-terminal-green tracking-widest mb-2 font-terminal-mono">[SOLUTION]</div>
          <h3 className="text-xl font-bold text-terminal-green mb-3 font-terminal-mono">SOROSCAN_IS_THE_FIX</h3>
          <p className="text-terminal-gray text-sm leading-relaxed">
            SoroScan provides a managed event indexing service — connect your contract, define your
            event schema, and immediately query events via GraphQL or REST. Webhook subscriptions
            push events to your backend in real-time. No infrastructure. No polling. No complexity.
          </p>
        </div>
      </div>

      {/* Live event table */}
      <div className="flex items-center gap-4">
        <h2 className="text-2xl font-bold text-terminal-green whitespace-nowrap font-terminal-mono">
          [LIVE_EVENT_STREAM]
        </h2>
        <div className="h-[2px] w-full bg-terminal-green/20" />
        <span className="flex items-center gap-1.5 text-[10px] text-terminal-green whitespace-nowrap font-terminal-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-terminal-green animate-pulse" /> LIVE
        </span>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>TIMESTAMP</TableHead>
              <TableHead>CONTRACT_ID</TableHead>
              <TableHead>EVENT_TYPE</TableHead>
              <TableHead>STATUS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((ev, i) => (
              <TableRow key={`${ev.ts}-${i}`} className={i === 0 ? "animate-[fadeInUp_0.4s_ease_forwards]" : ""}>
                <TableCell className="text-[11px] whitespace-nowrap">{ev.ts}</TableCell>
                <TableCell className="text-terminal-cyan font-terminal-mono text-[11px]">{ev.contract}</TableCell>
                <TableCell className="text-[11px]">{ev.type}</TableCell>
                <TableCell className={`${ev.statusClass} text-[11px]`}>{ev.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
