import { CheckCircle2, Loader2, PlayCircle } from "lucide-react";

import type { ProviderName, RunResponse } from "../types";

interface RunStatusBarProps {
  state: "idle" | "running" | "completed" | "error";
  provider: ProviderName;
  run: RunResponse;
}

export function RunStatusBar({ state, provider, run }: RunStatusBarProps) {
  if (state === "running") {
    return (
      <section className="rounded-lg border border-blue-200 bg-blue-50 p-3 shadow-panel">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-white">
              <Loader2 className="h-5 w-5 animate-spin" />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-primary">Run in progress</div>
              <p className="mt-1 text-xs text-slate-700">
                Planning actions, inspecting schema, generating SQL, and reading observations.
              </p>
            </div>
          </div>
          <span className="hidden rounded-md bg-white px-2 py-1 text-xs font-medium text-primary sm:inline-block">
            {provider}
          </span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-blue-100">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-primary" />
        </div>
      </section>
    );
  }

  if (state === "completed" && run.completed) {
    return (
      <section className="flex items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50 p-3 shadow-panel">
        <div className="flex min-w-0 items-center gap-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-success">Run completed</div>
            <p className="mt-1 text-xs text-slate-700">
              {run.trace.length} trace steps, {run.generated_sql.length} SQL statement
              {run.generated_sql.length === 1 ? "" : "s"}, {run.latency_ms} ms.
            </p>
          </div>
        </div>
        <span className="hidden rounded-md bg-white px-2 py-1 text-xs font-medium text-success sm:inline-block">
          {run.model}
        </span>
      </section>
    );
  }

  if (state === "error") {
    return (
      <section className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-danger shadow-panel">
        Run stopped before a grounded answer. Check the trace details and observation errors.
      </section>
    );
  }

  return (
    <section className="flex items-center gap-3 rounded-lg border border-line bg-card p-3 shadow-panel">
      <PlayCircle className="h-5 w-5 shrink-0 text-primary" />
      <div>
        <div className="text-sm font-semibold text-ink">Ready to run</div>
        <p className="mt-1 text-xs text-muted">
          Press Run to create a new trace, SQL statement, result table, and grounded answer.
        </p>
      </div>
    </section>
  );
}
