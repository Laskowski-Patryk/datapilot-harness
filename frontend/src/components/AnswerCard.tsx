import { CheckCircle2 } from "lucide-react";

interface AnswerCardProps {
  answer: string;
  plan: string[];
  model: string;
}

export function AnswerCard({ answer, plan, model }: AnswerCardProps) {
  return (
    <section className="rounded-lg border border-line bg-card p-4 shadow-panel">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-success">
            <CheckCircle2 className="h-4 w-4" />
            Final answer
          </div>
          <p className="mt-3 text-sm leading-6 text-ink">{answer}</p>
        </div>
        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-muted">
          {model}
        </span>
      </div>
      <div className="mt-4 border-t border-line pt-3">
        <div className="text-xs font-semibold uppercase text-muted">Plan</div>
        <ol className="mt-2 grid gap-2 text-sm text-muted md:grid-cols-2">
          {plan.map((item, index) => (
            <li key={item} className="flex gap-2">
              <span className="font-mono text-xs text-primary">{index + 1}</span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
