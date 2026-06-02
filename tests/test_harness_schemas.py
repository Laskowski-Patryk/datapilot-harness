from __future__ import annotations

import pytest
from pydantic import ValidationError

from datapilot.schemas import AgentAction


def valid_action_payload() -> dict[str, object]:
    return {
        "action": "inspect_schema",
        "source": "sales",
        "sql": "",
        "plan": [],
        "answer": "",
        "reason": "Need to understand available columns.",
    }


def test_agent_action_accepts_valid_action() -> None:
    action = AgentAction.model_validate(valid_action_payload())
    assert action.action == "inspect_schema"
    assert action.source == "sales"


def test_agent_action_rejects_extra_fields() -> None:
    payload = valid_action_payload()
    payload["extra"] = "not allowed"

    with pytest.raises(ValidationError):
        AgentAction.model_validate(payload)
