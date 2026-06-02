import type { ConfigResponse, ProviderName, RunResponse, SourceSummary } from "../types";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchHealth(): Promise<{ status: string }> {
  return request("/api/health");
}

export async function fetchConfig(): Promise<ConfigResponse> {
  return request("/api/config");
}

export async function fetchSources(): Promise<SourceSummary[]> {
  return request("/api/sources");
}

export async function uploadSource(file: File, sourceName?: string): Promise<SourceSummary> {
  const formData = new FormData();
  formData.append("file", file);
  if (sourceName?.trim()) {
    formData.append("source_name", sourceName.trim());
  }
  return request("/api/sources/upload", {
    method: "POST",
    body: formData,
  });
}

export async function createRun(payload: {
  question: string;
  sources: string[];
  provider: ProviderName;
}): Promise<RunResponse> {
  return request("/api/runs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}
