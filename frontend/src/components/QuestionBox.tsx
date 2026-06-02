import { Play } from "lucide-react";

import type { ProviderName } from "../types";

interface QuestionBoxProps {
  question: string;
  provider: ProviderName;
  providers: ProviderName[];
  isRunning: boolean;
  onQuestionChange: (question: string) => void;
  onProviderChange: (provider: ProviderName) => void;
  onRun: () => void;
}

export function QuestionBox({
  question,
  provider,
  providers,
  isRunning,
  onQuestionChange,
  onProviderChange,
  onRun,
}: QuestionBoxProps) {
  return (
    <section className="rounded-lg border border-line bg-card p-4 shadow-panel">
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <label className="min-w-0 flex-1">
          <span className="text-xs font-semibold uppercase text-muted">Question</span>
          <textarea
            className="mt-2 min-h-24 w-full resize-y rounded-md border border-line bg-white px-3 py-3 text-sm leading-6 text-ink"
            value={question}
            onChange={(event) => onQuestionChange(event.target.value)}
          />
        </label>
        <div className="flex flex-col gap-2 md:w-40">
          <label className="text-xs font-semibold uppercase text-muted" htmlFor="provider-select">
            Provider
          </label>
          <select
            id="provider-select"
            className="rounded-md border border-line bg-white px-3 py-2 text-sm font-medium text-ink"
            value={provider}
            onChange={(event) => onProviderChange(event.target.value as ProviderName)}
          >
            {providers.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={isRunning}
            onClick={onRun}
            type="button"
          >
            <Play className="h-4 w-4" />
            {isRunning ? "Running" : "Run"}
          </button>
        </div>
      </div>
    </section>
  );
}
