import { Database, Rows3 } from "lucide-react";

import { CsvUpload } from "./CsvUpload";
import { SchemaTable } from "./SchemaTable";
import { formatNumber } from "../lib/format";
import type { SourceSummary } from "../types";

interface DataSourcePanelProps {
  sources: SourceSummary[];
  selectedSourceName: string;
  onSelectSource: (source: string) => void;
  onUpload: (file: File, sourceName?: string) => Promise<void>;
  apiAvailable: boolean;
}

export function DataSourcePanel({
  sources,
  selectedSourceName,
  onSelectSource,
  onUpload,
  apiAvailable,
}: DataSourcePanelProps) {
  const selectedSource = sources.find((source) => source.source === selectedSourceName) ?? sources[0];
  const profileColumns = selectedSource?.profile?.columns.slice(0, 5) ?? [];

  return (
    <div className="flex h-full min-h-[640px] w-full min-w-0 max-w-full flex-col gap-4 overflow-hidden rounded-lg border border-line bg-card p-4 shadow-panel">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-ink">Data Sources</h2>
          <p className="mt-1 text-xs text-muted">{apiAvailable ? "Live DuckDB store" : "Static demo"}</p>
        </div>
        <Database className="h-5 w-5 text-primary" />
      </div>

      <CsvUpload onUpload={onUpload} disabled={!apiAvailable} />

      <div className="space-y-2">
        {sources.map((source) => {
          const selected = source.source === selectedSourceName;
          return (
            <button
              key={source.source}
              className={`w-full min-w-0 rounded-md border px-3 py-3 text-left transition ${
                selected
                  ? "border-primary bg-blue-50"
                  : "border-line bg-white hover:border-slate-300"
              }`}
              onClick={() => onSelectSource(source.source)}
              type="button"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-sm font-semibold text-ink">
                  {source.source}
                </span>
                <span className="hidden rounded-md bg-slate-100 px-2 py-1 text-xs text-muted sm:inline-block">
                  CSV
                </span>
              </div>
              <div className="mt-2 flex items-center gap-4 text-xs text-muted">
                <span>{formatNumber(source.row_count)} rows</span>
                <span>{source.column_count} columns</span>
              </div>
            </button>
          );
        })}
      </div>

      {selectedSource ? (
        <>
          <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="min-w-0 rounded-md border border-line bg-slate-50 p-3">
              <div className="flex items-center gap-2 text-xs text-muted">
                <Rows3 className="h-4 w-4" />
                Row count
              </div>
              <div className="mt-1 text-lg font-semibold text-ink">
                {formatNumber(selectedSource.row_count)}
              </div>
            </div>
            <div className="min-w-0 rounded-md border border-line bg-slate-50 p-3">
              <div className="text-xs text-muted">Columns</div>
              <div className="mt-1 text-lg font-semibold text-ink">
                {selectedSource.column_count}
              </div>
            </div>
          </div>

          <SchemaTable schema={selectedSource.schema} />

          <section className="min-h-0">
            <h3 className="mb-2 text-xs font-semibold uppercase text-muted">Profile</h3>
            <div className="max-h-48 space-y-2 overflow-auto pr-1">
              {profileColumns.map((column) => (
                <div key={column.name} className="min-w-0 rounded-md border border-line bg-white p-3">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-ink">{column.name}</span>
                    <span className="hidden font-mono text-muted sm:inline">{column.type}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted">
                    <span>nulls {column.null_count}</span>
                    <span>distinct {column.approx_distinct_count}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
