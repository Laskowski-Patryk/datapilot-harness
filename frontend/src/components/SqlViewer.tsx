import { Braces, Code2 } from "lucide-react";
import { useState } from "react";

import type { RunResponse } from "../types";

interface SqlViewerProps {
  sql: string[];
  run: RunResponse;
}

export function SqlViewer({ sql, run }: SqlViewerProps) {
  const [view, setView] = useState<"sql" | "json">("sql");

  return (
    <section className="rounded-lg border border-line bg-card p-4 shadow-panel">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">Generated SQL</h2>
        <div className="flex rounded-md border border-line bg-slate-50 p-1">
          <button
            className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium ${
              view === "sql" ? "bg-white text-primary shadow-sm" : "text-muted"
            }`}
            onClick={() => setView("sql")}
            type="button"
          >
            <Code2 className="h-3.5 w-3.5" />
            SQL
          </button>
          <button
            className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium ${
              view === "json" ? "bg-white text-primary shadow-sm" : "text-muted"
            }`}
            onClick={() => setView("json")}
            type="button"
          >
            <Braces className="h-3.5 w-3.5" />
            JSON
          </button>
        </div>
      </div>
      <pre className="max-h-56 overflow-auto rounded-md border border-line bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-100">
        {view === "sql" ? sql.join("\n\n") : JSON.stringify(run, null, 2)}
      </pre>
    </section>
  );
}
