from __future__ import annotations

import json
import time
from dataclasses import dataclass
from typing import Any, Iterator, Literal, Protocol, TypedDict

from pydantic import ValidationError

from datapilot.csv_store import CsvStore
from datapilot.prompts import SYSTEM_PROMPT
from datapilot.schemas import AgentAction
from datapilot.trace import TraceEntry, TraceRecorder


class LLMClient(Protocol):
    def complete(self, messages: list[dict[str, str]]) -> str:
        raise NotImplementedError


class AgentStreamEvent(TypedDict, total=False):
    event: Literal["run_started", "step_started", "step_finished", "run_finished", "error"]
    step: int
    action: str
    reason: str
    status: Literal["running", "success", "error"]
    duration_ms: int | None
    executed_sql: str | None
    row_count: int | None
    observation: dict[str, Any]
    error: str | None
    completed: bool
    answer: str
    plan: list[str]
    question: str
    max_steps: int


@dataclass
class AgentResult:
    completed: bool
    answer: str
    plan: list[str]
    trace: TraceRecorder
    new_entries: list[TraceEntry]


class AgentHarness:
    def __init__(self, llm: LLMClient, store: CsvStore, max_steps: int = 8) -> None:
        self.llm = llm
        self.store = store
        self.max_steps = max_steps
        self.trace = TraceRecorder()
        self.current_plan: list[str] = []
        self.has_successful_query_result = False
        self.last_error = ""
        self.messages: list[dict[str, str]] = [{"role": "system", "content": SYSTEM_PROMPT}]
        self.turn_count = 0

    def run(self, question: str) -> AgentResult:
        return self.ask(question)

    def stream(self, question: str) -> Iterator[AgentStreamEvent]:
        started_at = time.perf_counter()
        self.turn_count += 1
        self.messages.append({"role": "user", "content": self._dump_json(self._question_payload(question))})

        yield {
            "event": "run_started",
            "status": "running",
            "question": question,
            "max_steps": self.max_steps,
        }

        try:
            for _ in range(self.max_steps):
                step = len(self.trace.entries) + 1
                yield {
                    "event": "step_started",
                    "step": step,
                    "action": "pending",
                    "reason": "Waiting for the model to choose the next action.",
                    "status": "running",
                    "observation": {},
                }

                raw_content = self.llm.complete(self.messages)
                action = self._parse_action(raw_content)

                if action is None:
                    observation = self._error_observation(
                        "LLM returned invalid JSON or an action that does not match the schema.",
                        {
                            "raw_content": raw_content,
                            "validation_error": self.last_error,
                        },
                    )
                    self.trace.add(
                        step=step,
                        action="invalid_action",
                        reason="Invalid LLM output.",
                        observation=observation,
                    )
                    self.messages.append({"role": "assistant", "content": raw_content})
                    self.messages.append({"role": "user", "content": self._dump_json(observation)})
                    yield self._stream_event_from_trace_entry(self.trace.entries[-1])
                    continue

                self.messages.append({"role": "assistant", "content": raw_content})
                yield {
                    "event": "step_started",
                    "step": step,
                    "action": action.action,
                    "reason": action.reason,
                    "status": "running",
                    "executed_sql": action.sql or None,
                    "observation": {},
                }

                step_started_at = time.perf_counter()
                observation = self._execute_action(action)
                duration_ms = int((time.perf_counter() - step_started_at) * 1000)
                self.trace.add(
                    step=step,
                    action=action.action,
                    reason=action.reason,
                    observation=observation,
                    duration_ms=duration_ms,
                )
                self.messages.append({"role": "user", "content": self._dump_json(observation)})

                yield self._stream_event_from_trace_entry(self.trace.entries[-1])

                if action.action == "finish" and observation["ok"]:
                    yield {
                        "event": "run_finished",
                        "status": "success",
                        "completed": True,
                        "answer": action.answer,
                        "plan": self.current_plan,
                        "duration_ms": int((time.perf_counter() - started_at) * 1000),
                    }
                    return

            yield {
                "event": "run_finished",
                "status": "error",
                "completed": False,
                "answer": f"The agent did not finish within the {self.max_steps}-step limit.",
                "plan": self.current_plan,
                "duration_ms": int((time.perf_counter() - started_at) * 1000),
            }
        except Exception as exc:
            yield {
                "event": "error",
                "status": "error",
                "error": str(exc),
                "duration_ms": int((time.perf_counter() - started_at) * 1000),
            }

    def ask(self, question: str) -> AgentResult:
        self.turn_count += 1
        trace_start = len(self.trace.entries)
        self.messages.append({"role": "user", "content": self._dump_json(self._question_payload(question))})

        for _ in range(self.max_steps):
            step = len(self.trace.entries) + 1
            raw_content = self.llm.complete(self.messages)
            action = self._parse_action(raw_content)

            if action is None:
                observation = self._error_observation(
                    "LLM returned invalid JSON or an action that does not match the schema.",
                    {
                        "raw_content": raw_content,
                        "validation_error": self.last_error,
                    },
                )
                self.trace.add(
                    step=step,
                    action="invalid_action",
                    reason="Invalid LLM output.",
                    observation=observation,
                )
                self.messages.append({"role": "assistant", "content": raw_content})
                self.messages.append({"role": "user", "content": self._dump_json(observation)})
                continue

            self.messages.append({"role": "assistant", "content": raw_content})
            started_at = time.perf_counter()
            observation = self._execute_action(action)
            duration_ms = int((time.perf_counter() - started_at) * 1000)
            self.trace.add(
                step=step,
                action=action.action,
                reason=action.reason,
                observation=observation,
                duration_ms=duration_ms,
            )
            self.messages.append({"role": "user", "content": self._dump_json(observation)})

            if action.action == "finish" and observation["ok"]:
                return AgentResult(
                    completed=True,
                    answer=action.answer,
                    plan=self.current_plan,
                    trace=self.trace,
                    new_entries=self.trace.entries[trace_start:],
                )

        return AgentResult(
            completed=False,
            answer=f"The agent did not finish within the {self.max_steps}-step limit.",
            plan=self.current_plan,
            trace=self.trace,
            new_entries=self.trace.entries[trace_start:],
        )

    def _question_payload(self, question: str) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "turn": self.turn_count,
            "available_sources": sorted(self.store.allowed_tables),
            "conversation_context": {
                "current_plan": self.current_plan,
                "has_successful_query_result": self.has_successful_query_result,
                "last_error": self.last_error,
            },
            "constraints": {
                "max_steps": self.max_steps,
                "sql_dialect": "duckdb",
                "readonly": True,
                "row_limit": 50,
            },
        }
        if self.turn_count == 1:
            payload["question"] = question
        else:
            payload["follow_up_question"] = question
        return payload

    def _parse_action(self, raw_content: str) -> AgentAction | None:
        try:
            payload = json.loads(raw_content)
            return AgentAction.model_validate(payload)
        except (json.JSONDecodeError, ValidationError) as exc:
            self.last_error = str(exc)
            return None

    def _execute_action(self, action: AgentAction) -> dict[str, Any]:
        try:
            if action.action == "update_plan":
                self.current_plan = action.plan
                return self._observation(
                    "plan",
                    {
                        "accepted_plan": self.current_plan,
                    },
                )

            if action.action == "inspect_schema":
                return self._observation("schema", self.store.inspect_schema(action.source))

            if action.action == "profile_data":
                return self._observation("profile", self.store.profile_data(action.source))

            if action.action in {"query_csv", "repair_query"}:
                repaired_from_error = self.last_error if action.action == "repair_query" else ""
                data = self.store.query(action.sql)
                self.has_successful_query_result = True
                self.last_error = ""
                if action.action == "repair_query":
                    data["repaired_from_error"] = repaired_from_error
                return self._observation("query_result", data)

            if action.action == "finish":
                if not self.has_successful_query_result:
                    return self._error_observation(
                        "finish requires at least one successful query_csv or repair_query result."
                    )
                if not action.answer.strip():
                    return self._error_observation("finish requires a non-empty answer.")
                return self._observation("plan", {"status": "finished"})

        except Exception as exc:
            self.last_error = str(exc)
            return self._error_observation(str(exc), {"action": action.model_dump()})

        return self._error_observation(f"Unsupported action: {action.action}")

    @staticmethod
    def _observation(observation_type: str, data: dict[str, Any]) -> dict[str, Any]:
        return {
            "observation_type": observation_type,
            "ok": True,
            "data": data,
        }

    @staticmethod
    def _error_observation(error: str, data: dict[str, Any] | None = None) -> dict[str, Any]:
        payload = dict(data or {})
        payload["error"] = error
        return {
            "observation_type": "error",
            "ok": False,
            "data": payload,
        }

    @staticmethod
    def _dump_json(payload: dict[str, Any]) -> str:
        return json.dumps(payload, ensure_ascii=False)

    @staticmethod
    def _stream_event_from_trace_entry(entry: TraceEntry) -> AgentStreamEvent:
        return {
            "event": "step_finished",
            "step": entry.step,
            "action": entry.action,
            "reason": entry.reason,
            "status": "error" if entry.error else "success",
            "duration_ms": entry.duration_ms,
            "executed_sql": entry.executed_sql,
            "row_count": entry.row_count,
            "observation": entry.observation,
            "error": entry.error,
        }
