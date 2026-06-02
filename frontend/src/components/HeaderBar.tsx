import { Activity, Clock, Database } from "lucide-react";

import { ProviderBadge } from "./ProviderBadge";
import type { ConfigResponse, ProviderName } from "../types";

interface HeaderBarProps {
  config: ConfigResponse;
  apiAvailable: boolean;
  provider: ProviderName;
  onProviderChange: (provider: ProviderName) => void;
  latencyMs: number;
}

export function HeaderBar({
  config,
  apiAvailable,
  provider,
  onProviderChange,
  latencyMs,
}: HeaderBarProps) {
  return (
    <header className="rounded-lg border border-line bg-card p-5 shadow-panel">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Database className="h-4 w-4" />
            DataPilot Harness
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-ink">DataPilot Workbench</h1>
          <p className="mt-1 text-sm text-muted">Codex-style data agent for CSV/SQL analysis</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ProviderBadge provider={provider} apiAvailable={apiAvailable} />
          <label className="flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm text-muted">
            <Activity className="h-4 w-4 text-primary" />
            <select
              className="bg-transparent text-sm font-medium text-ink"
              value={provider}
              onChange={(event) => onProviderChange(event.target.value as ProviderName)}
            >
              {config.providers.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm text-muted">
            <Clock className="h-4 w-4" />
            <span>{latencyMs} ms</span>
          </div>
        </div>
      </div>
    </header>
  );
}
