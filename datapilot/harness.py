from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Protocol

from pydantic import ValidationError

from datapilot.csv_store import CsvStore
from datapilot.prompts import SYSTEM_PROMPT
from datapilot.schemas import AgentAction
from datapilot.trace import TraceRecorder


class LLMClient(Protocol):
    def complete(self, messages: list[dict[str, str]]) -> str:
        raise NotImplementedError


@dataclass
class AgentResult:
    completed: bool
    answer: str
    plan: list[str]
    trace: TraceRecorder


class AgentHarness:
    def __init__(self, llm: LLMClient, store: CsvStore, max_steps: int = 8) -> None:
        self.llm = llm
        self.store = store
        self.max_steps = max_steps
        self.trace = TraceRecorder()
        self.current_plan: list[str] = []
        self.has_successful_query_result = False
        self.last_error = ""

    def run(self, question: str) -> AgentResult:
        messages = self._initial_messages(question)

        for step in range(1, self.max_steps + 1):
            raw_content = self.llm.complete(messages)
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
                messages.append({"role": "assistant", "content": raw_content})
                messages.append({"role": "user", "content": self._dump_json(observation)})
                continue

            messages.append({"role": "assistant", "content": raw_content})
            observation = self._execute_action(action)
            self.trace.add(
                step=step,
                action=action.action,
                reason=action.reason,
                observation=observation,
            )

            if action.action == "finish" and observation["ok"]:
                return AgentResult(
                    completed=True,
                    answer=action.answer,
                    plan=self.current_plan,
                    trace=self.trace,
                )

            messages.append({"role": "user", "content": self._dump_json(observation)})

        return AgentResult(
            completed=False,
            answer=f"Agent nie zakonczyl pracy w limicie {self.max_steps} krokow.",
            plan=self.current_plan,
            trace=self.trace,
        )

    def _initial_messages(self, question: str) -> list[dict[str, str]]:
        user_payload = {
            "question": question,
            "available_sources": sorted(self.store.allowed_tables),
            "constraints": {
                "max_steps": self.max_steps,
                "sql_dialect": "duckdb",
                "readonly": True,
                "row_limit": 50,
            },
        }
        return [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": self._dump_json(user_payload)},
        ]

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
