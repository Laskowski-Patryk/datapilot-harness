import { AlertCircle, CheckCircle2 } from "lucide-react";

import { formatDuration } from "../lib/format";
import type { TraceStep } from "../types";

interface TraceTimelineProps {
  steps: TraceStep[];
  selectedStep: TraceStep;
  onSelectStep: (step: TraceStep) => void;
}

export function TraceTimeline({ steps, selectedStep, onSelectStep }: TraceTimelineProps) {
  return (
    <section className="flex min-h-0 flex-[1.05] flex-col rounded-lg border border-line bg-card p-4 shadow-panel">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Agent Trace</h2>
        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-muted">
          {steps.length} steps
        </span>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-auto pr-1">
        {steps.map((step) => {
          const active = selectedStep.step === step.step;
          return (
            <button
              key={`${step.step}-${step.action}`}
              className={`w-full rounded-md border p-3 text-left transition ${
                active ? "border-primary bg-blue-50" : "border-line bg-white hover:border-slate-300"
              }`}
              onClick={() => onSelectStep(step)}
              type="button"
            >
              <div className="flex items-start gap-3">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${
                    active ? "bg-primary text-white" : "bg-slate-100 text-muted"
                  }`}
                >
                  {step.step}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-ink">
                      {step.action}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs ${
                        step.status === "success"
                          ? "bg-green-50 text-success"
                          : "bg-red-50 text-danger"
                      }`}
                    >
                      {step.status === "success" ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5" />
                      )}
                      {step.status}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted">{step.reason}</p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted">
                    <span>{formatDuration(step.duration_ms)}</span>
                    {step.row_count !== null && step.row_count !== undefined ? (
                      <span>{step.row_count} rows</span>
                    ) : null}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
