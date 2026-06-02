import type { SchemaColumn } from "../types";

interface SchemaTableProps {
  schema: SchemaColumn[];
}

export function SchemaTable({ schema }: SchemaTableProps) {
  return (
    <section className="min-h-0">
      <h3 className="mb-2 text-xs font-semibold uppercase text-muted">Schema</h3>
      <div className="max-h-64 max-w-full overflow-auto rounded-md border border-line">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 bg-slate-50 text-muted">
            <tr>
              <th className="border-b border-line px-3 py-2 font-medium">Column</th>
              <th className="border-b border-line px-3 py-2 font-medium">Type</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {schema.map((column) => (
              <tr key={column.name} className="border-b border-line last:border-b-0">
                <td className="px-3 py-2 font-medium text-ink">{column.name}</td>
                <td className="px-3 py-2 font-mono text-muted">{column.type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
