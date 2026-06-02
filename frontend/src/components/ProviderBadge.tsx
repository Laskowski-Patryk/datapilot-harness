import { CheckCircle2, CloudOff } from "lucide-react";

import type { ProviderName } from "../types";

interface ProviderBadgeProps {
  provider: ProviderName;
  apiAvailable: boolean;
}

export function ProviderBadge({ provider, apiAvailable }: ProviderBadgeProps) {
  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm">
      {apiAvailable ? (
        <CheckCircle2 className="h-4 w-4 text-success" />
      ) : (
        <CloudOff className="h-4 w-4 text-warning" />
      )}
      <span className="font-medium text-ink">{provider}</span>
      <span className="text-muted">{apiAvailable ? "API" : "static"}</span>
    </div>
  );
}
