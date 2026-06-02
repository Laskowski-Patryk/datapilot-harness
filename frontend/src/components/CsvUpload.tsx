import { Upload } from "lucide-react";
import { useState } from "react";

interface CsvUploadProps {
  onUpload: (file: File, sourceName?: string) => Promise<void>;
  disabled: boolean;
}

export function CsvUpload({ onUpload, disabled }: CsvUploadProps) {
  const [sourceName, setSourceName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function submitUpload() {
    if (!file || disabled) {
      return;
    }
    setIsUploading(true);
    try {
      await onUpload(file, sourceName);
      setFile(null);
      setSourceName("");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-md border border-dashed border-slate-300 bg-slate-50 p-3">
      <label className="block text-xs font-medium text-muted" htmlFor="csv-file">
        Upload CSV
      </label>
      <input
        id="csv-file"
        className="mt-2 block w-full min-w-0 max-w-full text-xs text-muted file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-2 file:text-xs file:font-medium file:text-ink"
        disabled={disabled}
        type="file"
        accept=".csv,text/csv"
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
      />
      <input
        className="mt-2 w-full min-w-0 rounded-md border border-line bg-white px-3 py-2 text-sm"
        disabled={disabled}
        placeholder="source name"
        value={sourceName}
        onChange={(event) => setSourceName(event.target.value)}
      />
      <button
        className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        disabled={!file || disabled || isUploading}
        onClick={submitUpload}
        type="button"
      >
        <Upload className="h-4 w-4" />
        {isUploading ? "Uploading" : "Register source"}
      </button>
    </div>
  );
}
