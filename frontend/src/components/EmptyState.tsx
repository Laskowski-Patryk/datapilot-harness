interface EmptyStateProps {
  title: string;
  body: string;
}

export function EmptyState({ title, body }: EmptyStateProps) {
  return (
    <section className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-sm text-muted">{body}</p>
    </section>
  );
}
