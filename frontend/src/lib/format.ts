export function formatNumber(value: unknown): string {
  if (typeof value === "number") {
    return new Intl.NumberFormat("en-US").format(value);
  }
  return String(value ?? "-");
}

export function formatCurrency(value: unknown): string {
  if (typeof value === "number") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  }
  return String(value ?? "-");
}

export function formatCell(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  if (typeof value === "number") {
    if (Math.abs(value) < 1 && value !== 0) {
      return `${Math.round(value * 1000) / 10}%`;
    }
    return formatNumber(value);
  }
  return String(value);
}

export function formatDuration(value?: number | null): string {
  if (typeof value !== "number") {
    return "-";
  }
  return `${value} ms`;
}
