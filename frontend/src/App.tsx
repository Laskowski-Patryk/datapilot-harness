import { useEffect, useMemo, useRef, useState } from "react";

import { AppShell } from "./components/AppShell";
import { AnswerCard } from "./components/AnswerCard";
import { DataSourcePanel } from "./components/DataSourcePanel";
import { EmptyState } from "./components/EmptyState";
import { ErrorBanner } from "./components/ErrorBanner";
import { HeaderBar } from "./components/HeaderBar";
import { QuestionBox } from "./components/QuestionBox";
import { ResultTable } from "./components/ResultTable";
import { RunStatusBar } from "./components/RunStatusBar";
import { SamplePrompts } from "./components/SamplePrompts";
import { SqlViewer } from "./components/SqlViewer";
import { TraceDetails } from "./components/TraceDetails";
import { TraceTimeline } from "./components/TraceTimeline";
import { createRunStream, fetchConfig, fetchHealth, fetchSources, uploadSource } from "./lib/api";
import { samplePrompts, staticRun, staticSource } from "./demo/staticRun";
import type {
  ConfigResponse,
  ProviderName,
  ResultTableData,
  RunResponse,
  RunStreamEvent,
  SourceSummary,
  TraceStep,
} from "./types";

const fallbackConfig: ConfigResponse = {
  default_provider: "mock",
  providers: ["mock", "openrouter"],
  default_model: "mock-agent",
  api_mode: "static-demo",
};

async function waitForMinimumRun(startedAt: number, minimumMs = 650) {
  const elapsed = performance.now() - startedAt;
  if (elapsed < minimumMs) {
    await new Promise((resolve) => window.setTimeout(resolve, minimumMs - elapsed));
  }
}

function createPendingRun(question: string, provider: ProviderName): RunResponse {
  return {
    run_id: `pending-${Date.now()}`,
    completed: false,
    provider,
    model: "streaming",
    question,
    answer: "",
    plan: [],
    trace: [],
    result_tables: [],
    generated_sql: [],
    latency_ms: 0,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function observationData(observation: Record<string, unknown>) {
  return isRecord(observation.data) ? observation.data : {};
}

function tableFromStep(step: TraceStep): ResultTableData | null {
  const rows = observationData(step.observation).rows;
  if (!Array.isArray(rows)) {
    return null;
  }
  const dictRows = rows.filter(isRecord);
  const columns = dictRows[0] ? Object.keys(dictRows[0]) : [];
  return {
    title: `Step ${step.step} result`,
    columns,
    rows: dictRows,
  };
}

function resultTablesFromTrace(trace: TraceStep[]) {
  return trace.flatMap((step) => {
    const table = tableFromStep(step);
    return table ? [table] : [];
  });
}

function generatedSqlFromTrace(trace: TraceStep[]) {
  return trace.flatMap((step) => (step.executed_sql ? [step.executed_sql] : []));
}

function planFromTrace(trace: TraceStep[], fallback: string[]) {
  for (const step of [...trace].reverse()) {
    const acceptedPlan = observationData(step.observation).accepted_plan;
    if (isStringArray(acceptedPlan)) {
      return acceptedPlan;
    }
  }
  return fallback;
}

function mergeTraceStep(current: TraceStep, next: TraceStep): TraceStep {
  const hasObservation = Object.keys(next.observation).length > 0;
  return {
    ...current,
    ...next,
    action: next.action || current.action,
    reason: next.reason || current.reason,
    duration_ms: next.duration_ms ?? current.duration_ms ?? null,
    executed_sql: next.executed_sql ?? current.executed_sql ?? null,
    row_count: next.row_count ?? current.row_count ?? null,
    observation: hasObservation ? next.observation : current.observation,
    error: next.error !== undefined ? next.error : current.error ?? null,
  };
}

function applyTraceStep(run: RunResponse, nextStep: TraceStep): RunResponse {
  const existingIndex = run.trace.findIndex((step) => step.step === nextStep.step);
  const trace =
    existingIndex >= 0
      ? run.trace.map((step, index) =>
          index === existingIndex ? mergeTraceStep(step, nextStep) : step,
        )
      : [...run.trace, nextStep];

  return {
    ...run,
    trace,
    plan: planFromTrace(trace, run.plan),
    generated_sql: generatedSqlFromTrace(trace),
    result_tables: resultTablesFromTrace(trace),
  };
}

function traceStepFromStreamEvent(event: RunStreamEvent): TraceStep | null {
  if (typeof event.step !== "number" || !event.action) {
    return null;
  }
  return {
    step: event.step,
    action: event.action,
    reason: event.reason ?? "",
    status: event.status ?? (event.event === "step_finished" ? "success" : "running"),
    duration_ms: event.duration_ms ?? null,
    executed_sql: event.executed_sql ?? null,
    row_count: event.row_count ?? null,
    observation: event.observation ?? {},
    error: event.error ?? null,
  };
}

function preferredSelectedStep(trace: TraceStep[]) {
  return trace[trace.length - 2] ?? trace[trace.length - 1] ?? null;
}

function preferredSelectedStepNumber(trace: TraceStep[]) {
  return preferredSelectedStep(trace)?.step ?? null;
}

export default function App() {
  const [sources, setSources] = useState<SourceSummary[]>([staticSource]);
  const [selectedSourceName, setSelectedSourceName] = useState(staticSource.source);
  const [run, setRun] = useState<RunResponse>(staticRun);
  const [selectedStepNumber, setSelectedStepNumber] = useState<number | null>(
    staticRun.trace[3]?.step ?? null,
  );
  const [question, setQuestion] = useState(samplePrompts[0]);
  const [provider, setProvider] = useState<ProviderName>("mock");
  const [config, setConfig] = useState<ConfigResponse>(fallbackConfig);
  const [apiAvailable, setApiAvailable] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [runState, setRunState] = useState<"idle" | "running" | "completed" | "error">(
    "completed",
  );
  const [error, setError] = useState<string | null>(null);
  const autoFollowTraceRef = useRef(true);

  useEffect(() => {
    async function boot() {
      try {
        await fetchHealth();
        const [nextConfig, nextSources] = await Promise.all([fetchConfig(), fetchSources()]);
        setConfig(nextConfig);
        setProvider(nextConfig.default_provider);
        setApiAvailable(true);
        if (nextSources.length > 0) {
          const preferredSource =
            nextSources.find((source) => source.source === "sales") ?? nextSources[0];
          setSources(nextSources);
          setSelectedSourceName(preferredSource.source);
        }
      } catch {
        setApiAvailable(false);
        setSources([staticSource]);
        setSelectedSourceName(staticSource.source);
      }
    }
    void boot();
  }, []);

  const selectedSource = useMemo(
    () => sources.find((source) => source.source === selectedSourceName) ?? sources[0],
    [selectedSourceName, sources],
  );

  const selectedStep = useMemo(
    () => run.trace.find((step) => step.step === selectedStepNumber) ?? null,
    [run.trace, selectedStepNumber],
  );

  function handleSelectStep(step: TraceStep) {
    autoFollowTraceRef.current = false;
    setSelectedStepNumber(step.step);
  }

  async function handleRun() {
    if (!question.trim()) {
      setError("Question cannot be empty.");
      return;
    }
    setError(null);
    setRunState("running");
    setIsRunning(true);
    autoFollowTraceRef.current = true;
    setSelectedStepNumber(null);
    const startedAt = performance.now();
    try {
      if (!apiAvailable) {
        const demoRun = {
          ...staticRun,
          question,
          run_id: `static-${Date.now()}`,
          provider,
        };
        setRun(createPendingRun(question, provider));
        await waitForMinimumRun(startedAt);
        setRun(demoRun);
        setSelectedStepNumber(preferredSelectedStepNumber(demoRun.trace));
        setRunState("completed");
        return;
      }
      setRun(createPendingRun(question, provider));
      const response = await createRunStream(
        {
          question,
          sources: selectedSource ? [selectedSource.source] : [],
          provider,
        },
        (event) => {
          if (event.event === "run_started") {
            setRun((currentRun) => ({
              ...currentRun,
              run_id: event.run_id ?? currentRun.run_id,
              provider: event.provider ?? currentRun.provider,
              model: event.model ?? currentRun.model,
            }));
            return;
          }

          if (event.event === "step_started" || event.event === "step_finished") {
            const step = traceStepFromStreamEvent(event);
            if (step) {
              setRun((currentRun) => applyTraceStep(currentRun, step));
              if (autoFollowTraceRef.current) {
                setSelectedStepNumber(step.step);
              }
            }
            return;
          }

          if (event.event === "run_finished") {
            if (event.run) {
              setRun(event.run);
              if (autoFollowTraceRef.current) {
                setSelectedStepNumber(preferredSelectedStepNumber(event.run.trace));
              }
            }
            return;
          }

          if (event.event === "error") {
            setError(event.error ?? "Run failed.");
            if (event.run) {
              setRun(event.run);
              if (autoFollowTraceRef.current) {
                setSelectedStepNumber(preferredSelectedStepNumber(event.run.trace));
              }
            }
          }
        },
      );
      await waitForMinimumRun(startedAt);
      setRun(response);
      if (autoFollowTraceRef.current) {
        setSelectedStepNumber(preferredSelectedStepNumber(response.trace));
      }
      setRunState(response.completed ? "completed" : "error");
    } catch (runError) {
      await waitForMinimumRun(startedAt);
      setError(runError instanceof Error ? runError.message : "Run failed.");
      setRunState("error");
    } finally {
      setIsRunning(false);
    }
  }

  async function handleUpload(file: File, sourceName?: string) {
    setError(null);
    try {
      const source = await uploadSource(file, sourceName);
      setSources((currentSources) => [
        source,
        ...currentSources.filter((item) => item.source !== source.source),
      ]);
      setSelectedSourceName(source.source);
      setApiAvailable(true);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    }
  }

  return (
    <AppShell
      left={
        <DataSourcePanel
          sources={sources}
          selectedSourceName={selectedSourceName}
          onSelectSource={setSelectedSourceName}
          onUpload={handleUpload}
          apiAvailable={apiAvailable}
        />
      }
      center={
        <main className="flex min-h-0 flex-1 flex-col gap-4 lg:pb-4">
          <HeaderBar
            config={config}
            apiAvailable={apiAvailable}
            provider={provider}
            onProviderChange={setProvider}
            latencyMs={run.latency_ms}
          />
          {error ? <ErrorBanner message={error} /> : null}
          <QuestionBox
            question={question}
            provider={provider}
            providers={config.providers}
            isRunning={isRunning}
            onQuestionChange={setQuestion}
            onProviderChange={setProvider}
            onRun={handleRun}
          />
          <SamplePrompts
            prompts={samplePrompts}
            activePrompt={question}
            onSelectPrompt={setQuestion}
          />
          <RunStatusBar state={runState} provider={provider} run={run} />
          {run.answer ? (
            <AnswerCard answer={run.answer} plan={run.plan} model={run.model} />
          ) : (
            <EmptyState
              title="Final answer pending"
              body="The agent is still working through the trace."
            />
          )}
          {run.result_tables[0] ? (
            <ResultTable table={run.result_tables[0]} />
          ) : (
            <EmptyState title="No result table" body="The current run did not return tabular rows." />
          )}
          <SqlViewer sql={run.generated_sql} run={run} />
        </main>
      }
      right={
        <aside className="flex h-full min-h-0 flex-col gap-4">
          <TraceTimeline
            steps={run.trace}
            selectedStep={selectedStep}
            onSelectStep={handleSelectStep}
          />
          <TraceDetails step={selectedStep} />
        </aside>
      }
    />
  );
}
