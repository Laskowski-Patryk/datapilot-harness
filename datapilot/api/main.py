from __future__ import annotations

import shutil
import tempfile
import time
import uuid
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field

from datapilot.csv_store import CsvStore, validate_source_name
from datapilot.harness import AgentHarness
from datapilot.llm import MockLLM, OpenRouterLLM
from datapilot.trace import TraceEntry

load_dotenv()


class SchemaColumn(BaseModel):
    name: str
    type: str
    nullable: bool


class SourceSummary(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    source: str
    row_count: int
    column_count: int
    columns_schema: list[SchemaColumn] = Field(alias="schema")
    sample_rows: list[dict[str, Any]]
    profile: dict[str, Any] | None = None


class TraceStepResponse(BaseModel):
    step: int
    action: str
    reason: str
    status: str
    duration_ms: int | None = None
    executed_sql: str | None = None
    row_count: int | None = None
    observation: dict[str, Any]
    error: str | None = None


class ResultTable(BaseModel):
    title: str
    columns: list[str]
    rows: list[dict[str, Any]]


class RunRequest(BaseModel):
    question: str = Field(min_length=1)
    sources: list[str] = Field(default_factory=list)
    provider: str = "mock"


class RunResponse(BaseModel):
    run_id: str
    completed: bool
    provider: str
    model: str
    question: str
    answer: str
    plan: list[str]
    trace: list[TraceStepResponse]
    result_tables: list[ResultTable]
    generated_sql: list[str]
    latency_ms: int


class ConfigResponse(BaseModel):
    default_provider: str
    providers: list[str]
    default_model: str
    api_mode: str


class WorkbenchState:
    def __init__(self) -> None:
        self.store = CsvStore()
        self.upload_dir = Path(tempfile.gettempdir()) / "datapilot-harness-uploads"
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        self.runs: dict[str, RunResponse] = {}

    def load_example_sources(self) -> None:
        sales_path = Path(__file__).resolve().parents[2] / "examples" / "sales.csv"
        if sales_path.exists() and "sales" not in self.store.sources:
            self.store.add_csv("sales", str(sales_path))

    def source_summary(self, source: str) -> SourceSummary:
        schema = self.store.inspect_schema(source)
        profile = self.store.profile_data(source)
        columns = [SchemaColumn(**column) for column in schema["columns"]]
        return SourceSummary(
            source=source,
            row_count=profile["row_count"],
            column_count=len(columns),
            columns_schema=columns,
            sample_rows=schema["sample_rows"],
            profile=profile,
        )

    def list_sources(self) -> list[SourceSummary]:
        return [self.source_summary(source) for source in sorted(self.store.allowed_tables)]

    def register_upload(self, upload: UploadFile, source_name: str | None) -> SourceSummary:
        if not upload.filename:
            raise HTTPException(status_code=400, detail="Uploaded file must have a filename.")
        name = validate_source_name(source_name or self._name_from_filename(upload.filename))
        target = self.upload_dir / f"{name}-{uuid.uuid4().hex}.csv"
        with target.open("wb") as handle:
            shutil.copyfileobj(upload.file, handle)
        if target.stat().st_size == 0:
            target.unlink(missing_ok=True)
            raise HTTPException(status_code=400, detail="Uploaded CSV is empty.")
        self.store.add_csv(name, str(target))
        return self.source_summary(name)

    @staticmethod
    def _name_from_filename(filename: str) -> str:
        stem = Path(filename).stem.strip().lower()
        cleaned = "".join(char if char.isalnum() else "_" for char in stem).strip("_")
        if not cleaned:
            return "uploaded_csv"
        if cleaned[0].isdigit():
            cleaned = f"csv_{cleaned}"
        return cleaned


def create_app(*, preload_examples: bool = True) -> FastAPI:
    app = FastAPI(title="DataPilot Workbench API")
    state = WorkbenchState()
    if preload_examples:
        state.load_example_sources()
    app.state.workbench = state

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:4173",
            "http://127.0.0.1:4173",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/api/config", response_model=ConfigResponse)
    def config() -> ConfigResponse:
        return ConfigResponse(
            default_provider="mock",
            providers=["mock", "openrouter"],
            default_model="mock-agent",
            api_mode="in-memory",
        )

    @app.post("/api/sources/upload", response_model=SourceSummary)
    def upload_source(
        file: UploadFile = File(...),
        source_name: str | None = Form(default=None),
    ) -> SourceSummary:
        try:
            return state.register_upload(file, source_name)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.get("/api/sources", response_model=list[SourceSummary])
    def list_sources() -> list[SourceSummary]:
        return state.list_sources()

    @app.post("/api/runs", response_model=RunResponse)
    def create_run(request: RunRequest) -> RunResponse:
        sources = request.sources or sorted(state.store.allowed_tables)
        if not sources:
            raise HTTPException(status_code=400, detail="Upload or load at least one CSV source.")
        missing = sorted(set(sources) - state.store.allowed_tables)
        if missing:
            raise HTTPException(status_code=400, detail=f"Unknown source(s): {missing}")

        provider = request.provider.lower()
        llm = build_llm(provider)
        harness = AgentHarness(llm=llm, store=state.store)

        started_at = time.perf_counter()
        try:
            result = harness.run(request.question)
        except RuntimeError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        latency_ms = int((time.perf_counter() - started_at) * 1000)
        run_id = uuid.uuid4().hex
        response = RunResponse(
            run_id=run_id,
            completed=result.completed,
            provider=provider,
            model=getattr(llm, "model", "unknown"),
            question=request.question,
            answer=result.answer,
            plan=result.plan,
            trace=[trace_entry_to_response(entry) for entry in result.new_entries],
            result_tables=result_tables_from_trace(result.new_entries),
            generated_sql=[
                entry.executed_sql for entry in result.new_entries if entry.executed_sql
            ],
            latency_ms=latency_ms,
        )
        state.runs[run_id] = response
        return response

    @app.get("/api/runs/{run_id}", response_model=RunResponse)
    def get_run(run_id: str) -> RunResponse:
        try:
            return state.runs[run_id]
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Run not found.") from exc

    return app


def build_llm(provider: str) -> MockLLM | OpenRouterLLM:
    if provider == "mock":
        return MockLLM()
    if provider == "openrouter":
        return OpenRouterLLM()
    raise HTTPException(status_code=400, detail=f"Unsupported provider: {provider}")


def trace_entry_to_response(entry: TraceEntry) -> TraceStepResponse:
    return TraceStepResponse(
        step=entry.step,
        action=entry.action,
        reason=entry.reason,
        status="error" if entry.error else "success",
        duration_ms=entry.duration_ms,
        executed_sql=entry.executed_sql,
        row_count=entry.row_count,
        observation=entry.observation,
        error=entry.error,
    )


def result_tables_from_trace(entries: list[TraceEntry]) -> list[ResultTable]:
    tables: list[ResultTable] = []
    for entry in entries:
        data = entry.observation.get("data", {})
        rows = data.get("rows")
        if not isinstance(rows, list):
            continue
        dict_rows = [row for row in rows if isinstance(row, dict)]
        columns = list(dict_rows[0]) if dict_rows else []
        tables.append(
            ResultTable(
                title=f"Step {entry.step} result",
                columns=columns,
                rows=dict_rows,
            )
        )
    return tables


app = create_app()
