import type { TraceStep } from "../types";

interface TraceDetailsProps {
  step: TraceStep | null;
}

function statusClass(status: TraceStep["status"]) {
  if (status === "running") {
    return "bg-blue-50 text-primary";
  }
  if (status === "success") {
    return "bg-green-50 text-success";
  }
  return "bg-red-50 text-danger";
}

export function TraceDetails({ step }: TraceDetailsProps) {
  if (!step) {
    return (
      <section className="flex min-h-0 flex-1 flex-col rounded-lg border border-line bg-card p-4 shadow-panel">
        <h2 className="text-sm font-semibold text-ink">Step Details</h2>
        <div className="mt-4 rounded-md border border-dashed border-line bg-slate-50 p-4 text-sm text-muted">
          Waiting for the next agent step.
        </div>
      </section>
    );
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-lg border border-line bg-card p-4 shadow-panel">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Step Details</h2>
          <p className="mt-1 font-mono text-xs text-muted">
            {step.step}. {step.action}
          </p>
        </div>
        <span className={`rounded-md px-2 py-1 text-xs font-medium ${statusClass(step.status)}`}>
          {step.status}
        </span>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-auto pr-1">
        <div>
          <div className="text-xs font-semibold uppercase text-muted">Reason</div>
          <p className="mt-2 text-sm leading-6 text-ink">{step.reason}</p>
        </div>
        {step.executed_sql ? (
          <div>
            <div className="text-xs font-semibold uppercase text-muted">SQL</div>
            <pre className="mt-2 max-h-40 overflow-auto rounded-md border border-line bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-100">
              {step.executed_sql}
            </pre>
          </div>
        ) : null}
        <div>
          <div className="text-xs font-semibold uppercase text-muted">Observation</div>
          <pre className="mt-2 max-h-80 overflow-auto rounded-md border border-line bg-slate-50 p-3 font-mono text-xs leading-5 text-ink">
            {JSON.stringify(step.observation, null, 2)}
          </pre>
        </div>
        {step.error ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-danger">
            {step.error}
          </div>
        ) : null}
      </div>
    </section>
  );
}
