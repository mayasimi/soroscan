"use client";

import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import {
  fetchEventsForExport,
} from "@/components/ingest/graphql";
import {
  toDateTimeInputValue,
  validateDateRange,
} from "@/components/ingest/formatters";
import styles from "@/components/ingest/ingest-terminal.module.css";
import type { EventRecord, ExportFilters, ExportFormat } from "@/components/ingest/types";

const EVENTS_PAGE_SIZE = 1000;
const EXPORT_CHUNK_SIZE = 5000;
const PARQUET_FORMAT: ExportFormat = "parquet";

interface ColumnDef {
  key: string;
  label: string;
  value: (event: EventRecord) => unknown;
}

const COLUMN_DEFS: ColumnDef[] = [
  { key: "contractId", label: "Contract", value: (event) => event.contractId },
  { key: "contractName", label: "Contract Name", value: (event) => event.contractName },
  { key: "eventType", label: "Type", value: (event) => event.eventType },
  { key: "ledger", label: "Ledger", value: (event) => event.ledger },
  { key: "eventIndex", label: "Event Index", value: (event) => event.eventIndex },
  { key: "timestamp", label: "Timestamp", value: (event) => event.timestamp },
  { key: "txHash", label: "Tx Hash", value: (event) => event.txHash },
  { key: "payloadHash", label: "Payload Hash", value: (event) => event.payloadHash ?? "" },
  {
    key: "validationStatus",
    label: "Validation",
    value: (event) => event.validationStatus ?? "",
  },
  { key: "schemaVersion", label: "Schema", value: (event) => event.schemaVersion ?? "" },
  { key: "payload", label: "Data", value: (event) => event.payload },
];

const DEFAULT_COLUMNS = [
  "contractId",
  "eventType",
  "ledger",
  "eventIndex",
  "timestamp",
  "payload",
];

interface ProgressState {
  message: string;
  percent: number;
}

interface ExportEventsModalProps {
  isOpen: boolean;
  onClose: () => void;
  contractId: string;
  initialFilters: ExportFilters;
  onStatus?: (message: string, isError?: boolean) => void;
}

interface PapaLike {
  unparse: (rows: Record<string, unknown>[], options: { columns: string[] }) => string;
}

interface JsZipLike {
  file: (name: string, content: Blob | string) => void;
  generateAsync: (options: { type: "blob" }) => Promise<Blob>;
}

interface ArrowLike {
  tableFromJSON: (rows: Record<string, unknown>[]) => unknown;
  tableToIPC?: (table: unknown, mode: "stream") => unknown;
}

interface ParquetLike {
  writeParquet?: (table: unknown) => Uint8Array | Blob;
  Table?: {
    fromIPCStream: (stream: unknown) => unknown;
  };
}

interface ParquetModuleLike extends ParquetLike {
  default?: (() => Promise<void>) | ParquetLike;
}

const importCache: {
  papa: Promise<PapaLike> | null;
  zip: Promise<new () => JsZipLike> | null;
  arrow: Promise<ArrowLike> | null;
  parquet: Promise<ParquetModuleLike> | null;
} = {
  papa: null,
  zip: null,
  arrow: null,
  parquet: null,
};

let parquetReady = false;

async function importFromUrl<T>(url: string): Promise<T> {
  const importedModule = (await import(
    /* webpackIgnore: true */ url
  )) as unknown;
  return importedModule as T;
}

export function ExportEventsModal({
  isOpen,
  onClose,
  contractId,
  initialFilters,
  onStatus,
}: ExportEventsModalProps) {
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(
    new Set(DEFAULT_COLUMNS),
  );
  const [since, setSince] = useState<string>("");
  const [until, setUntil] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState<ProgressState>({
    message: "Waiting to start export.",
    percent: 0,
  });

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setFormat("csv");
    setSelectedColumns(new Set(DEFAULT_COLUMNS));
    setSince(toDateTimeInputValue(initialFilters.since));
    setUntil(toDateTimeInputValue(initialFilters.until));
    setError("");
    setIsSubmitting(false);
    setProgress({ message: "Waiting to start export.", percent: 0 });
  }, [isOpen, initialFilters.since, initialFilters.until]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  const selectionSummary = useMemo(() => {
    const typeLabel = initialFilters.eventTypes.length
      ? `${initialFilters.eventTypes.length} selected event type(s)`
      : "all event types";
    return `Exporting ${typeLabel} with ${selectedColumns.size} column(s).`;
  }, [initialFilters.eventTypes.length, selectedColumns.size]);

  if (!isOpen) {
    return null;
  }

  const toggleColumn = (columnKey: string) => {
    setSelectedColumns((current) => {
      const next = new Set(current);
      if (next.has(columnKey)) {
        next.delete(columnKey);
      } else {
        next.add(columnKey);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!selectedColumns.size) {
      setError("Select at least one column.");
      return;
    }

    const validationError = validateDateRange(since, until);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      updateProgress(setProgress, "Fetching events...", 5);

      const rows = await fetchRowsForExport({
        contractId,
        eventTypes: initialFilters.eventTypes,
        since: since ? new Date(since).toISOString() : null,
        until: until ? new Date(until).toISOString() : null,
        onProgress: (message, percent) => updateProgress(setProgress, message, percent),
      });

      if (!rows.length) {
        throw new Error("No events matched the selected filters.");
      }

      updateProgress(setProgress, `Preparing ${format.toUpperCase()} file...`, 70);

      const timestamp = buildTimestamp();
      const baseName = buildBaseFileName(contractId, timestamp);
      const payload = await buildExportPayload({
        rows,
        format,
        selectedColumns: Array.from(selectedColumns),
        baseName,
        onProgress: (message, percent) => updateProgress(setProgress, message, percent),
      });

      downloadBlob(payload.filename, payload.mimeType, payload.content);
      updateProgress(setProgress, `Downloaded ${payload.filename}`, 100);
      onStatus?.(`Exported ${rows.length} events to ${payload.filename}`);

      window.setTimeout(() => {
        onClose();
      }, 400);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "Export failed.";
      setError(message);
      updateProgress(setProgress, "Export failed.", 0);
      onStatus?.(message, true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={styles.exportModalOverlay}
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <section className={styles.exportModal} role="dialog" aria-modal="true" aria-labelledby="export-modal-title">
        <header className={styles.exportModalHead}>
          <h3 id="export-modal-title" className={styles.exportModalTitle}>Export Events</h3>
          <button
            type="button"
            className={styles.modalIconBtn}
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close export modal"
          >
            x
          </button>
        </header>

        <div className={styles.exportModalBody}>
          <label className={styles.fieldLabel} htmlFor="export-format">Format</label>
          <select
            id="export-format"
            className={styles.fieldInput}
            value={format}
            onChange={(event) => setFormat(event.target.value as ExportFormat)}
            disabled={isSubmitting}
          >
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
            <option value="parquet">Parquet</option>
          </select>

          <p className={styles.fieldLabel}>Columns</p>
          <div className={styles.columnGrid} role="group" aria-label="Choose export columns">
            {COLUMN_DEFS.map((column) => (
              <label key={column.key} className={styles.columnOption}>
                <input
                  type="checkbox"
                  checked={selectedColumns.has(column.key)}
                  onChange={() => toggleColumn(column.key)}
                  disabled={isSubmitting}
                />
                <span>{column.label}</span>
              </label>
            ))}
          </div>

          <div className={styles.exportDateGrid}>
            <div>
              <label className={styles.fieldLabel} htmlFor="export-since">Date Range From</label>
              <input
                id="export-since"
                type="datetime-local"
                className={styles.fieldInput}
                value={since}
                onChange={(event) => setSince(event.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label className={styles.fieldLabel} htmlFor="export-until">Date Range To</label>
              <input
                id="export-until"
                type="datetime-local"
                className={styles.fieldInput}
                value={until}
                onChange={(event) => setUntil(event.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <p className={styles.summary}>{selectionSummary}</p>
          {error && (
            <p className={`${styles.status} ${styles.error}`} role="alert">
              {error}
            </p>
          )}

          <div className={styles.progressBox}>
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: `${progress.percent}%` }} />
            </div>
            <p className={styles.summary}>{progress.message}</p>
          </div>
        </div>

        <footer className={styles.exportModalActions}>
          <button
            type="button"
            className={`${styles.btn} ${styles.secondaryBtn}`}
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.btn}
            onClick={() => {
              void handleSubmit();
            }}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Exporting..." : "Export"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function updateProgress(
  setProgress: Dispatch<SetStateAction<ProgressState>>,
  message: string,
  percent: number,
): void {
  setProgress({
    message,
    percent: Math.max(0, Math.min(100, percent)),
  });
}

async function fetchRowsForExport({
  contractId,
  eventTypes,
  since,
  until,
  onProgress,
}: {
  contractId: string;
  eventTypes: string[];
  since: string | null;
  until: string | null;
  onProgress: (message: string, percent: number) => void;
}): Promise<EventRecord[]> {
  const normalizedTypes = eventTypes.length ? eventTypes : [null];
  const collectedRows: EventRecord[] = [];

  for (let typeIndex = 0; typeIndex < normalizedTypes.length; typeIndex += 1) {
    const eventType = normalizedTypes[typeIndex];
    let offset = 0;

    while (true) {
      const rows = await fetchEventsForExport({
        contractId,
        eventType,
        limit: EVENTS_PAGE_SIZE,
        offset,
        since,
        until,
      });

      if (!rows.length) {
        break;
      }

      collectedRows.push(...rows);
      offset += rows.length;

      const typeLabel = eventType || "all events";
      onProgress(
        `Fetched ${collectedRows.length} events (${typeLabel}).`,
        Math.min(60, 10 + Math.floor(collectedRows.length / 200)),
      );

      if (rows.length < EVENTS_PAGE_SIZE) {
        break;
      }
    }
  }

  return collectedRows;
}

async function buildExportPayload({
  rows,
  format,
  selectedColumns,
  baseName,
  onProgress,
}: {
  rows: EventRecord[];
  format: ExportFormat;
  selectedColumns: string[];
  baseName: string;
  onProgress: (message: string, percent: number) => void;
}): Promise<{ filename: string; mimeType: string; content: Blob | string }> {
  if (rows.length <= EXPORT_CHUNK_SIZE) {
    const filename = `${baseName}.${format}`;
    const single = await serializeChunk({ rows, selectedColumns, format });
    return {
      filename,
      mimeType: single.mimeType,
      content: single.content,
    };
  }

  const ZipClass = await getZipModule();
  const zip = new ZipClass();
  const chunks = splitRows(rows, EXPORT_CHUNK_SIZE);

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const partNumber = String(index + 1).padStart(3, "0");
    const partName = `${baseName}_part${partNumber}.${format}`;

    const serialized = await serializeChunk({ rows: chunk, selectedColumns, format });
    zip.file(partName, serialized.content);

    const completion = 70 + Math.floor(((index + 1) / chunks.length) * 25);
    onProgress(`Prepared chunk ${index + 1}/${chunks.length}.`, completion);
  }

  const archive = await zip.generateAsync({ type: "blob" });
  return {
    filename: `${baseName}.zip`,
    mimeType: "application/zip",
    content: archive,
  };
}

async function serializeChunk({
  rows,
  selectedColumns,
  format,
}: {
  rows: EventRecord[];
  selectedColumns: string[];
  format: ExportFormat;
}): Promise<{ content: Blob | string; mimeType: string }> {
  if (format === "csv") {
    return buildCsvChunk(rows, selectedColumns);
  }

  if (format === "json") {
    return buildJsonChunk(rows, selectedColumns);
  }

  if (format === PARQUET_FORMAT) {
    return buildParquetChunk(rows, selectedColumns);
  }

  throw new Error(`Unsupported export format: ${format}`);
}

async function buildCsvChunk(
  rows: EventRecord[],
  selectedColumns: string[],
): Promise<{ content: string; mimeType: string }> {
  const papa = await getPapaModule();
  const projected = rows.map((row) => projectRow(row, selectedColumns, "csv"));
  const csv = papa.unparse(projected, {
    columns: selectedColumns,
  });

  return {
    content: csv,
    mimeType: "text/csv;charset=utf-8",
  };
}

function buildJsonChunk(
  rows: EventRecord[],
  selectedColumns: string[],
): { content: string; mimeType: string } {
  const projected = rows.map((row) => projectRow(row, selectedColumns, "json"));
  return {
    content: JSON.stringify(projected, null, 2),
    mimeType: "application/json",
  };
}

async function buildParquetChunk(
  rows: EventRecord[],
  selectedColumns: string[],
): Promise<{ content: Blob; mimeType: string }> {
  const [arrowModule, parquetModuleRaw] = await Promise.all([getArrowModule(), getParquetModule()]);

  const parquetModule: ParquetLike =
    parquetModuleRaw.writeParquet !== undefined
      ? parquetModuleRaw
      : ((parquetModuleRaw.default as ParquetLike | undefined) ?? parquetModuleRaw);

  const parquetInit =
    typeof parquetModuleRaw.default === "function"
      ? (parquetModuleRaw.default as () => Promise<void>)
      : null;

  if (!parquetReady && parquetInit) {
    await parquetInit();
    parquetReady = true;
  }

  const projected = rows.map((row) => projectRow(row, selectedColumns, "parquet"));
  const arrowTable = arrowModule.tableFromJSON(projected);

  let parquetBytes: Uint8Array | Blob | undefined;

  if (
    typeof parquetModule.writeParquet === "function" &&
    parquetModule.Table?.fromIPCStream &&
    arrowModule.tableToIPC
  ) {
    const arrowStream = arrowModule.tableToIPC(arrowTable, "stream");
    const parquetTable = parquetModule.Table.fromIPCStream(arrowStream);
    parquetBytes = parquetModule.writeParquet(parquetTable);
  } else if (typeof parquetModule.writeParquet === "function") {
    parquetBytes = parquetModule.writeParquet(arrowTable);
  }

  if (!parquetBytes) {
    throw new Error("Parquet export is unavailable in this browser runtime.");
  }

  return {
    content:
      parquetBytes instanceof Blob
        ? parquetBytes
        : new Blob([Uint8Array.from(parquetBytes)], { type: "application/octet-stream" }),
    mimeType: "application/octet-stream",
  };
}

function projectRow(
  row: EventRecord,
  selectedColumns: string[],
  format: "csv" | "json" | "parquet",
): Record<string, unknown> {
  const projected: Record<string, unknown> = {};

  selectedColumns.forEach((columnKey) => {
    const def = COLUMN_DEFS.find((item) => item.key === columnKey);
    if (!def) {
      return;
    }

    let value = def.value(row);

    if (columnKey === "payload" && format !== "json") {
      value = JSON.stringify(value ?? {});
    }

    projected[columnKey] = value;
  });

  return projected;
}

function splitRows(rows: EventRecord[], chunkSize: number): EventRecord[][] {
  const chunks: EventRecord[][] = [];
  for (let start = 0; start < rows.length; start += chunkSize) {
    chunks.push(rows.slice(start, start + chunkSize));
  }
  return chunks;
}

function buildBaseFileName(contractId: string, timestamp: string): string {
  const safeContractId = sanitizeFilePart(contractId);
  return `events_${safeContractId}_${timestamp}`;
}

function sanitizeFilePart(value: string): string {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "_");
}

function buildTimestamp(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const hour = String(now.getUTCHours()).padStart(2, "0");
  const minute = String(now.getUTCMinutes()).padStart(2, "0");
  const second = String(now.getUTCSeconds()).padStart(2, "0");
  return `${year}${month}${day}_${hour}${minute}${second}`;
}

function downloadBlob(filename: string, mimeType: string, content: Blob | string): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function getPapaModule(): Promise<PapaLike> {
  if (!importCache.papa) {
    const url = "https://cdn.jsdelivr.net/npm/papaparse@5.4.1/+esm";
    importCache.papa = importFromUrl<{ unparse?: PapaLike["unparse"]; default?: PapaLike }>(url).then(
      (module) => {
        const candidate =
          module.unparse !== undefined
            ? ({ unparse: module.unparse } as PapaLike)
            : module.default;

        if (!candidate || typeof candidate.unparse !== "function") {
          throw new Error("CSV export library did not load correctly.");
        }

        return candidate;
      },
    );
  }

  return importCache.papa;
}

async function getZipModule(): Promise<new () => JsZipLike> {
  if (!importCache.zip) {
    const url = "https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm";
    importCache.zip = importFromUrl<{ default?: new () => JsZipLike }>(url).then((module) => {
      const candidate = module.default;
      if (!candidate || typeof candidate !== "function") {
        throw new Error("ZIP export library did not load correctly.");
      }
      return candidate;
    });
  }

  return importCache.zip;
}

async function getArrowModule(): Promise<ArrowLike> {
  if (!importCache.arrow) {
    const url = "https://cdn.jsdelivr.net/npm/apache-arrow@15.0.2/+esm";
    importCache.arrow = importFromUrl<ArrowLike & { default?: ArrowLike }>(url).then((module) => {
      const candidate =
        typeof module.tableFromJSON === "function" ? module : module.default;

      if (!candidate || typeof candidate.tableFromJSON !== "function") {
        throw new Error("Parquet export failed to load Arrow helpers.");
      }

      return candidate;
    });
  }

  return importCache.arrow;
}

async function getParquetModule(): Promise<ParquetModuleLike> {
  if (!importCache.parquet) {
    const url = "https://cdn.jsdelivr.net/npm/parquet-wasm@0.7.1/esm/parquet_wasm.js";
    importCache.parquet = importFromUrl<ParquetModuleLike>(url);
  }

  return importCache.parquet;
}
