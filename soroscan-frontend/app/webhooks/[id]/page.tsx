"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, FlaskConical, Trash2, Eye, EyeOff } from "lucide-react"
import { Navbar } from "@/components/terminal/landing/Navbar"
import { Footer } from "@/components/terminal/landing/Footer"
import { Card } from "@/components/terminal/Card"
import { Button } from "@/components/terminal/Button"
import { Modal } from "@/components/terminal/Modal"
import { DeliveryLog } from "./components/DeliveryLog"
import { MOCK_WEBHOOKS, MOCK_DELIVERY_LOGS } from "../mock-data"
import type { Webhook, WebhookStatus } from "../types"

function StatusBadge({ status }: { status: WebhookStatus }) {
  const map: Record<WebhookStatus, { dot: string; text: string }> = {
    ACTIVE:    { dot: "bg-terminal-green animate-pulse", text: "text-terminal-green" },
    SUSPENDED: { dot: "bg-terminal-warning",             text: "text-terminal-warning" },
    FAILED:    { dot: "bg-terminal-danger animate-pulse", text: "text-terminal-danger" },
  }
  const { dot, text } = map[status]
  return (
    <span className={`inline-flex items-center gap-2 text-sm font-bold ${text}`}>
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      {status}
    </span>
  )
}

function InfoRow({ label, value, mono = true }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-2 border-b border-terminal-green/10 last:border-0">
      <dt className="text-[10px] text-terminal-gray tracking-widest w-36 shrink-0">{label}</dt>
      <dd className={`text-sm break-all ${mono ? "font-terminal-mono text-terminal-green" : "text-terminal-gray"}`}>
        {value}
      </dd>
    </div>
  )
}

export default function WebhookDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [webhook, setWebhook] = React.useState<Webhook | undefined>(
    () => MOCK_WEBHOOKS.find((w) => w.id === id)
  )
  const [logs] = React.useState(() => MOCK_DELIVERY_LOGS.filter((l) => l.webhookId === id))
  const [testing, setTesting] = React.useState(false)
  const [testResult, setTestResult] = React.useState<{ ok: boolean; code: number; ms: number } | null>(null)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [secretVisible, setSecretVisible] = React.useState(false)

  if (!webhook) {
    return (
      <div className="min-h-screen font-terminal-mono flex flex-col items-center justify-center gap-4 text-terminal-green">
        <div className="text-4xl">[ ! ]</div>
        <div>WEBHOOK_NOT_FOUND</div>
        <Link href="/webhooks">
          <Button variant="secondary" size="sm">← BACK_TO_LIST</Button>
        </Link>
      </div>
    )
  }

  const handleTest = () => {
    setTesting(true)
    setTestResult(null)
    const start = Date.now()
    setTimeout(() => {
      const ok = Math.random() > 0.2
      setTestResult({ ok, code: ok ? 200 : 503, ms: Date.now() - start })
      setTesting(false)
    }, 1400)
  }

  const handleDelete = () => {
    setWebhook(undefined)
    setDeleteOpen(false)
    router.push("/webhooks")
  }

  return (
    <div className="min-h-screen font-terminal-mono selection:bg-terminal-green selection:text-terminal-black">
      <Navbar />

      <main className="container mx-auto px-6 md:px-8 py-10 md:py-14 space-y-8 max-w-5xl">

        {/* Back + breadcrumb */}
        <div className="flex items-center gap-3 text-xs text-terminal-gray">
          <Link href="/webhooks" className="inline-flex items-center gap-1.5 hover:text-terminal-green transition-colors">
            <ArrowLeft size={12} />
            [WEBHOOKS_LIST]
          </Link>
          <span className="opacity-40">/</span>
          <span className="text-terminal-cyan truncate max-w-[200px]">{webhook.id.toUpperCase()}</span>
        </div>

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 justify-between">
          <div className="space-y-2">
            <div className="text-[10px] text-terminal-cyan tracking-widest">[WEBHOOK_DETAIL]</div>
            <h1 className="text-2xl md:text-3xl font-bold text-terminal-green break-all">{webhook.url}</h1>
            <StatusBadge status={webhook.status} />
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleTest}
              disabled={testing}
              className="gap-1.5"
            >
              <FlaskConical size={13} />
              {testing ? "SENDING..." : "TEST_WEBHOOK"}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setDeleteOpen(true)}
              className="gap-1.5"
            >
              <Trash2 size={13} />
              DELETE
            </Button>
          </div>
        </div>

        {/* Test result */}
        {testResult && (
          <div className={`border px-4 py-3 text-sm flex items-center gap-3 ${
            testResult.ok ? "border-terminal-green text-terminal-green" : "border-terminal-danger text-terminal-danger"
          }`}>
            <span className="text-lg">{testResult.ok ? "✓" : "✗"}</span>
            <span>
              {testResult.ok ? "TEST_OK" : "TEST_FAILED"} — HTTP {testResult.code} in {testResult.ms}ms
            </span>
          </div>
        )}

        {/* Info card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <Card title="WEBHOOK_CONFIGURATION" className="h-full">
              <dl>
                <InfoRow label="WEBHOOK_ID"     value={webhook.id} />
                <InfoRow label="ENDPOINT_URL"   value={webhook.url} />
                <InfoRow label="STATUS"         value={<StatusBadge status={webhook.status} />} />
                <InfoRow label="EVENT_TYPES"    value={
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {webhook.eventTypes.map((t) => (
                      <span key={t} className="text-[9px] border border-terminal-green/30 px-1 text-terminal-gray">{t}</span>
                    ))}
                  </div>
                } />
                <InfoRow label="CONTRACT_FILTER" value={webhook.contractFilter ?? "ALL_CONTRACTS"} />
                <InfoRow label="CREATED_AT"    value={new Date(webhook.createdAt).toLocaleString("en-GB")} mono={false} />
                <InfoRow label="LAST_DELIVERY" value={webhook.lastDelivery ? new Date(webhook.lastDelivery).toLocaleString("en-GB") : "NEVER"} mono={false} />
                <InfoRow
                  label="SIGNING_SECRET"
                  value={
                    <span className="flex items-center gap-2">
                      <span className="font-terminal-mono text-xs">
                        {secretVisible ? webhook.secret : "•".repeat(webhook.secret.length)}
                      </span>
                      <button
                        onClick={() => setSecretVisible((v) => !v)}
                        className="text-terminal-cyan hover:text-terminal-green transition-colors"
                        title={secretVisible ? "Hide secret" : "Reveal secret"}
                      >
                        {secretVisible ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                    </span>
                  }
                />
              </dl>
            </Card>
          </div>

          {/* Stats card */}
          <div className="grid grid-cols-2 md:grid-cols-1 gap-4">
            <Card title="DELIVERY_STATS">
              <div className="space-y-4">
                <div>
                  <div className="text-2xl font-bold text-terminal-green">{webhook.totalDeliveries.toLocaleString()}</div>
                  <div className="text-[10px] text-terminal-gray tracking-widest">TOTAL_DELIVERIES</div>
                </div>
                <div>
                  <div className={`text-2xl font-bold ${webhook.successRate >= 90 ? "text-terminal-green" : webhook.successRate >= 60 ? "text-terminal-warning" : "text-terminal-danger"}`}>
                    {webhook.successRate.toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-terminal-gray tracking-widest">SUCCESS_RATE</div>
                </div>
                {webhook.lastStatusCode && (
                  <div>
                    <div className={`text-2xl font-bold ${webhook.lastStatusCode < 300 ? "text-terminal-green" : "text-terminal-danger"}`}>
                      HTTP {webhook.lastStatusCode}
                    </div>
                    <div className="text-[10px] text-terminal-gray tracking-widest">LAST_STATUS</div>
                  </div>
                )}
              </div>
            </Card>

            <Card title="LOGS_SUMMARY">
              <div className="space-y-2 text-[11px] text-terminal-gray">
                <div className="flex justify-between">
                  <span>2xx</span>
                  <span className="text-terminal-green">{logs.filter((l) => l.statusCode < 300).length}</span>
                </div>
                <div className="flex justify-between">
                  <span>4xx</span>
                  <span className="text-terminal-warning">{logs.filter((l) => l.statusCode >= 400 && l.statusCode < 500).length}</span>
                </div>
                <div className="flex justify-between">
                  <span>5xx</span>
                  <span className="text-terminal-danger">{logs.filter((l) => l.statusCode >= 500).length}</span>
                </div>
                <div className="flex justify-between border-t border-terminal-green/10 pt-2 mt-2">
                  <span>Total in view</span>
                  <span>{logs.length}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Delivery logs */}
        <DeliveryLog logs={logs} />

      </main>

      {/* Footer */}
      <div className="container mx-auto px-6 md:px-8 max-w-5xl pb-12">
        <Footer />
      </div>

      {/* Background deco */}
      <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden opacity-20">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,65,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,65,0.03)_1px,transparent_1px)] bg-size-[40px_40px]" />
      </div>

      {/* Delete confirmation */}
      <Modal isOpen={deleteOpen} onClose={() => setDeleteOpen(false)} title="CONFIRM_DELETE">
        <div className="space-y-5">
          <p className="text-sm text-terminal-gray">
            Permanently delete this webhook? This cannot be undone.
          </p>
          <div className="border border-terminal-danger/30 p-3 text-xs text-terminal-danger/80 space-y-1">
            <div className="font-bold">{webhook.url}</div>
            <div>{webhook.totalDeliveries} delivery records will be removed</div>
          </div>
          <div className="flex gap-3">
            <Button variant="danger" onClick={handleDelete} className="flex-1">
              DELETE_WEBHOOK
            </Button>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
              CANCEL
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
