import { formatCell } from "../lib/format";
import type { ResultTableData } from "../types";

interface ResultTableProps {
  table: ResultTableData;
}

export function ResultTable({ table }: ResultTableProps) {
  return (
    <section className="rounded-lg border border-line bg-card p-4 shadow-panel">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">Result Table</h2>
        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-muted">
          {table.rows.length} rows
        </span>
      </div>
      <div className="overflow-auto rounded-md border border-line">
        <table className="w-full min-w-[680px] border-collapse text-left text-xs">
          <thead className="bg-slate-50 text-muted">
            <tr>
              {table.columns.map((column) => (
                <th key={column} className="border-b border-line px-3 py-2 font-semibold">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white">
            {table.rows.map((row, rowIndex) => (
              <tr key={`${table.title}-${rowIndex}`} className="border-b border-line last:border-b-0">
                {table.columns.map((column) => (
                  <td key={column} className="px-3 py-2 text-ink">
                    {formatCell(row[column])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
