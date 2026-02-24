"use client";

import { useState } from "react";
import { formatDateTime } from "@/components/ingest/formatters";
import type { EventRecord } from "@/components/ingest/types";
import styles from "@/components/ingest/ingest-terminal.module.css";

interface EventDetailModalProps {
  event: EventRecord;
  onClose: () => void;
}

export function EventDetailModal({ event, onClose }: EventDetailModalProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className={styles.exportModalOverlay} onClick={handleOverlayClick}>
      <div className={styles.exportModal}>
        <div className={styles.exportModalHead}>
          <h2 className={styles.exportModalTitle}>Event Details</h2>
          <button
            type="button"
            className={styles.modalIconBtn}
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <div className={styles.exportModalBody}>
          <div style={{ display: "grid", gap: "1rem" }}>
            <DetailRow
              label="Event ID"
              value={event.id}
              onCopy={() => copyToClipboard(event.id, "id")}
              copied={copied === "id"}
            />
            
            <DetailRow
              label="Contract ID"
              value={event.contractId}
              onCopy={() => copyToClipboard(event.contractId, "contract")}
              copied={copied === "contract"}
            />
            
            {event.contractName && (
              <DetailRow label="Contract Name" value={event.contractName} />
            )}
            
            <DetailRow label="Event Type" value={event.eventType} />
            
            <DetailRow label="Ledger Sequence" value={event.ledger.toString()} />
            
            <DetailRow label="Event Index" value={event.eventIndex.toString()} />
            
            <DetailRow label="Timestamp" value={formatDateTime(event.timestamp)} />
            
            <DetailRow
              label="Transaction Hash"
              value={event.txHash}
              onCopy={() => copyToClipboard(event.txHash, "tx")}
              copied={copied === "tx"}
            />
            
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.5rem",
                }}
              >
                <label className={styles.fieldLabel}>Payload</label>
                <button
                  type="button"
                  className={styles.btn}
                  style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}
                  onClick={() =>
                    copyToClipboard(JSON.stringify(event.payload, null, 2), "payload")
                  }
                >
                  {copied === "payload" ? "Copied!" : "Copy"}
                </button>
              </div>
              <pre
                style={{
                  background: "rgba(0, 0, 0, 0.3)",
                  border: "1px solid rgba(0, 212, 255, 0.3)",
                  padding: "0.75rem",
                  borderRadius: "4px",
                  overflow: "auto",
                  maxHeight: "300px",
                  fontSize: "0.8rem",
                  color: "#00d4ff",
                }}
              >
                {JSON.stringify(event.payload, null, 2)}
              </pre>
            </div>

            {event.payloadHash && (
              <DetailRow
                label="Payload Hash"
                value={event.payloadHash}
                onCopy={() => copyToClipboard(event.payloadHash!, "hash")}
                copied={copied === "hash"}
              />
            )}
            
            {event.schemaVersion && (
              <DetailRow label="Schema Version" value={event.schemaVersion} />
            )}
            
            {event.validationStatus && (
              <DetailRow label="Validation Status" value={event.validationStatus} />
            )}
          </div>
        </div>

        <div className={styles.exportModalActions}>
          <button
            type="button"
            className={`${styles.btn} ${styles.secondaryBtn}`}
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

interface DetailRowProps {
  label: string;
  value: string;
  onCopy?: () => void;
  copied?: boolean;
}

function DetailRow({ label, value, onCopy, copied }: DetailRowProps) {
  return (
    <div>
      <label className={styles.fieldLabel}>{label}</label>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <code
          style={{
            flex: 1,
            background: "rgba(0, 0, 0, 0.3)",
            border: "1px solid rgba(123, 168, 181, 0.3)",
            padding: "0.5rem",
            borderRadius: "4px",
            color: "#d6f7ff",
            wordBreak: "break-all",
            fontSize: "0.8rem",
          }}
        >
          {value}
        </code>
        {onCopy && (
          <button
            type="button"
            className={styles.btn}
            style={{ padding: "0.4rem 0.6rem", fontSize: "0.75rem" }}
            onClick={onCopy}
          >
            {copied ? "✓" : "📋"}
          </button>
        )}
      </div>
    </div>
  );
}
