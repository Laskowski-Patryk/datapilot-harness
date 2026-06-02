from __future__ import annotations

import json

from datapilot.csv_store import CsvStore
from datapilot.harness import AgentHarness


class RecordingLLM:
    def __init__(self, responses: list[dict[str, object]]) -> None:
        self.responses = [json.dumps(response) for response in responses]
        self.calls: list[list[dict[str, str]]] = []

    def complete(self, messages: list[dict[str, str]]) -> str:
        self.calls.append([dict(message) for message in messages])
        return self.responses.pop(0)


def action_payload(
    action: str,
    *,
    source: str = "",
    sql: str = "",
    plan: list[str] | None = None,
    answer: str = "",
    reason: str = "Continue the analysis.",
) -> dict[str, object]:
    return {
        "action": action,
        "source": source,
        "sql": sql,
        "plan": plan or [],
        "answer": answer,
        "reason": reason,
    }


def test_harness_preserves_context_across_follow_up_questions() -> None:
    store = CsvStore()
    store.add_csv("sales", "examples/sales.csv")
    llm = RecordingLLM(
        [
            action_payload(
                "query_csv",
                sql=(
                    "SELECT customer, SUM(revenue) AS total_revenue "
                    "FROM sales GROUP BY customer ORDER BY total_revenue DESC"
                ),
            ),
            action_payload(
                "finish",
                answer="Nimbus Finance generated the most revenue.",
            ),
            action_payload(
                "finish",
                answer="The previous result showed Nimbus Finance as the top customer.",
            ),
        ]
    )
    harness = AgentHarness(llm=llm, store=store)

    first_result = harness.ask("Which customer generated the most revenue?")
    second_result = harness.ask("Remind me which customer was first.")

    assert first_result.completed
    assert second_result.completed
    assert [entry.step for entry in first_result.new_entries] == [1, 2]
    assert [entry.step for entry in second_result.new_entries] == [3]
    assert len(harness.trace.entries) == 3
    assert "Which customer generated the most revenue?" in json.dumps(llm.calls[-1])
    assert "Nimbus Finance generated the most revenue." in json.dumps(llm.calls[-1])
    assert "follow_up_question" in llm.calls[-1][-1]["content"]
