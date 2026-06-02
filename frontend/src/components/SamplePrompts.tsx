interface SamplePromptsProps {
  prompts: string[];
  activePrompt: string;
  onSelectPrompt: (prompt: string) => void;
}

export function SamplePrompts({ prompts, activePrompt, onSelectPrompt }: SamplePromptsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {prompts.map((prompt) => (
        <button
          key={prompt}
          className={`rounded-md border px-3 py-2 text-xs font-medium transition ${
            activePrompt === prompt
              ? "border-primary bg-blue-50 text-primary"
              : "border-line bg-white text-muted hover:border-slate-300 hover:text-ink"
          }`}
          onClick={() => onSelectPrompt(prompt)}
          type="button"
        >
          {prompt}
        </button>
      ))}
    </div>
  );
}
