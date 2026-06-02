from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class TraceEntry:
    step: int
    action: str
    reason: str
    observation: dict[str, Any]
    duration_ms: int | None = None
    error: str | None = None
    executed_sql: str | None = None
    row_count: int | None = None


@dataclass
class TraceRecorder:
    entries: list[TraceEntry] = field(default_factory=list)

    def add(
        self,
        step: int,
        action: str,
        reason: str,
        observation: dict[str, Any],
        duration_ms: int | None = None,
    ) -> None:
        data = observation.get("data", {})
        error = data.get("error") if not observation.get("ok", False) else None
        self.entries.append(
            TraceEntry(
                step=step,
                action=action,
                reason=reason,
                observation=observation,
                duration_ms=duration_ms,
                error=error,
                executed_sql=data.get("executed_sql"),
                row_count=data.get("row_count"),
            )
        )
