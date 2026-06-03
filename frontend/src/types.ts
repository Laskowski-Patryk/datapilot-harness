export type ProviderName = "mock" | "openrouter";

export interface SchemaColumn {
  name: string;
  type: string;
  nullable: boolean;
}

export interface ProfileColumn {
  name: string;
  type: string;
  null_count: number;
  approx_distinct_count: number;
  sample_values?: string[];
  min?: string | number;
  max?: string | number;
}

export interface SourceProfile {
  source: string;
  row_count: number;
  columns: ProfileColumn[];
}

export interface SourceSummary {
  source: string;
  row_count: number;
  column_count: number;
  schema: SchemaColumn[];
  sample_rows: Record<string, unknown>[];
  profile?: SourceProfile;
}

export type TraceStatus = "running" | "success" | "error";

export interface TraceStep {
  step: number;
  action: string;
  reason: string;
  status: TraceStatus;
  duration_ms?: number | null;
  executed_sql?: string | null;
  row_count?: number | null;
  observation: Record<string, unknown>;
  error?: string | null;
}

export interface ResultTableData {
  title: string;
  columns: string[];
  rows: Record<string, unknown>[];
}

export interface RunResponse {
  run_id: string;
  completed: boolean;
  provider: ProviderName;
  model: string;
  question: string;
  answer: string;
  plan: string[];
  trace: TraceStep[];
  result_tables: ResultTableData[];
  generated_sql: string[];
  latency_ms: number;
}

export interface RunStreamEvent {
  event: "run_started" | "step_started" | "step_finished" | "run_finished" | "error";
  run_id?: string;
  provider?: ProviderName;
  model?: string;
  question?: string;
  max_steps?: number;
  step?: number;
  action?: string;
  reason?: string;
  status?: TraceStatus;
  duration_ms?: number | null;
  executed_sql?: string | null;
  row_count?: number | null;
  observation?: Record<string, unknown>;
  error?: string | null;
  completed?: boolean;
  answer?: string;
  plan?: string[];
  latency_ms?: number;
  run?: RunResponse;
}

export interface ConfigResponse {
  default_provider: ProviderName;
  providers: ProviderName[];
  default_model: string;
  api_mode: string;
}
