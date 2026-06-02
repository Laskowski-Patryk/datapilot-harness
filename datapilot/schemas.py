from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class AgentAction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: Literal[
        "update_plan",
        "inspect_schema",
        "profile_data",
        "query_csv",
        "repair_query",
        "finish",
    ]

    source: str = Field(
        description="Source/table name. Empty string if not needed.",
    )

    sql: str = Field(
        description="SQL query for query_csv/repair_query. Empty string if not needed.",
    )

    plan: list[str] = Field(
        description="Current short plan as a list of steps. Empty if not updating plan.",
    )

    answer: str = Field(
        description="Final answer in Polish. Empty unless action=finish.",
    )

    reason: str = Field(
        description="Short reason why this action is needed.",
    )
