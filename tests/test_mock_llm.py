from __future__ import annotations

from datapilot.csv_store import CsvStore
from datapilot.harness import AgentHarness
from datapilot.llm import MockLLM


def test_mock_llm_runs_demo_sales_flow() -> None:
    store = CsvStore()
    store.add_csv("sales", "examples/sales.csv")
    harness = AgentHarness(llm=MockLLM(), store=store)

    result = harness.ask("Which customers generated the most revenue?")

    assert result.completed
    assert result.answer.startswith("The top revenue customers are Nimbus Finance")
    assert [entry.action for entry in result.new_entries] == [
        "update_plan",
        "inspect_schema",
        "profile_data",
        "query_csv",
        "finish",
    ]
    query_entry = result.new_entries[3]
    assert query_entry.executed_sql is not None
    assert query_entry.row_count == 8
    assert query_entry.duration_ms is not None
