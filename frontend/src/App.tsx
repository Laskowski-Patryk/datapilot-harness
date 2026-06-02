import { useEffect, useMemo, useState } from "react";

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
import { createRun, fetchConfig, fetchHealth, fetchSources, uploadSource } from "./lib/api";
import { samplePrompts, staticRun, staticSource } from "./demo/staticRun";
import type { ConfigResponse, ProviderName, RunResponse, SourceSummary, TraceStep } from "./types";

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

export default function App() {
  const [sources, setSources] = useState<SourceSummary[]>([staticSource]);
  const [selectedSourceName, setSelectedSourceName] = useState(staticSource.source);
  const [run, setRun] = useState<RunResponse>(staticRun);
  const [selectedStep, setSelectedStep] = useState<TraceStep>(staticRun.trace[3]);
  const [question, setQuestion] = useState(samplePrompts[0]);
  const [provider, setProvider] = useState<ProviderName>("mock");
  const [config, setConfig] = useState<ConfigResponse>(fallbackConfig);
  const [apiAvailable, setApiAvailable] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [runState, setRunState] = useState<"idle" | "running" | "completed" | "error">(
    "completed",
  );
  const [error, setError] = useState<string | null>(null);

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

  async function handleRun() {
    if (!question.trim()) {
      setError("Question cannot be empty.");
      return;
    }
    setError(null);
    setRunState("running");
    setIsRunning(true);
    const startedAt = performance.now();
    try {
      if (!apiAvailable) {
        const demoRun = {
          ...staticRun,
          question,
          run_id: `static-${Date.now()}`,
          provider,
        };
        await waitForMinimumRun(startedAt);
        setRun(demoRun);
        setSelectedStep(demoRun.trace[demoRun.trace.length - 2] ?? demoRun.trace[0]);
        setRunState("completed");
        return;
      }
      const response = await createRun({
        question,
        sources: selectedSource ? [selectedSource.source] : [],
        provider,
      });
      await waitForMinimumRun(startedAt);
      setRun(response);
      setSelectedStep(response.trace[response.trace.length - 2] ?? response.trace[0]);
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
          <AnswerCard answer={run.answer} plan={run.plan} model={run.model} />
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
            onSelectStep={setSelectedStep}
          />
          <TraceDetails step={selectedStep} />
        </aside>
      }
    />
  );
}
