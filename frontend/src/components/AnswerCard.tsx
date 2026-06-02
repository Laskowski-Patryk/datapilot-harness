import { CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";

interface AnswerCardProps {
  answer: string;
  plan: string[];
  model: string;
}

type AnswerBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "ordered-list"; items: string[] }
  | { kind: "unordered-list"; items: string[] };

function normalizeAnswer(answer: string) {
  return answer
    .replace(/\r\n/g, "\n")
    .replace(/\s+(?=\d+\.\s+)/g, "\n")
    .trim();
}

function parseAnswer(answer: string): AnswerBlock[] {
  const lines = normalizeAnswer(answer)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const blocks: AnswerBlock[] = [];

  for (const line of lines) {
    const orderedMatch = line.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      const previous = blocks[blocks.length - 1];
      if (previous?.kind === "ordered-list") {
        previous.items.push(orderedMatch[1]);
      } else {
        blocks.push({ kind: "ordered-list", items: [orderedMatch[1]] });
      }
      continue;
    }

    const unorderedMatch = line.match(/^[*-]\s+(.*)$/);
    if (unorderedMatch) {
      const previous = blocks[blocks.length - 1];
      if (previous?.kind === "unordered-list") {
        previous.items.push(unorderedMatch[1]);
      } else {
        blocks.push({ kind: "unordered-list", items: [unorderedMatch[1]] });
      }
      continue;
    }

    blocks.push({ kind: "paragraph", text: line });
  }

  return blocks;
}

function renderInlineMarkdown(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={`${part}-${index}`} className="font-semibold text-ink">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

export function AnswerCard({ answer, plan, model }: AnswerCardProps) {
  const answerBlocks = parseAnswer(answer);

  return (
    <section className="rounded-lg border border-line bg-card p-4 shadow-panel">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-success">
            <CheckCircle2 className="h-4 w-4" />
            Final answer
          </div>
          <div className="mt-3 space-y-3 text-sm leading-6 text-ink">
            {answerBlocks.map((block, index) => {
              if (block.kind === "ordered-list") {
                return (
                  <ol
                    key={`ordered-${index}`}
                    className="list-decimal space-y-1.5 pl-5 marker:font-mono marker:text-xs marker:text-primary"
                  >
                    {block.items.map((item) => (
                      <li key={item} className="pl-1">
                        {renderInlineMarkdown(item)}
                      </li>
                    ))}
                  </ol>
                );
              }

              if (block.kind === "unordered-list") {
                return (
                  <ul key={`unordered-${index}`} className="list-disc space-y-1.5 pl-5">
                    {block.items.map((item) => (
                      <li key={item} className="pl-1">
                        {renderInlineMarkdown(item)}
                      </li>
                    ))}
                  </ul>
                );
              }

              return <p key={`paragraph-${index}`}>{renderInlineMarkdown(block.text)}</p>;
            })}
          </div>
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
