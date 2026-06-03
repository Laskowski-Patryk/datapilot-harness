from __future__ import annotations

import json

from fastapi.testclient import TestClient

from datapilot.api.main import create_app


def test_api_health() -> None:
    client = TestClient(create_app(preload_examples=False))

    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_api_mock_run_with_example_sales_source(monkeypatch) -> None:
    monkeypatch.setenv("DATAPILOT_MOCK_DELAY_MS", "0")
    client = TestClient(create_app(preload_examples=True))

    response = client.post(
        "/api/runs",
        json={
            "question": "Which customers generated the most revenue?",
            "sources": ["sales"],
            "provider": "mock",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["provider"] == "mock"
    assert data["model"] == "mock-agent"
    assert data["answer"].startswith("The top revenue customers are Nimbus Finance")
    assert [entry["action"] for entry in data["trace"]] == [
        "update_plan",
        "inspect_schema",
        "profile_data",
        "query_csv",
        "finish",
    ]
    assert data["generated_sql"]
    assert data["result_tables"][0]["rows"][0]["customer"] == "Nimbus Finance"


def test_api_mock_run_stream_with_example_sales_source(monkeypatch) -> None:
    monkeypatch.setenv("DATAPILOT_MOCK_DELAY_MS", "0")
    client = TestClient(create_app(preload_examples=True))

    with client.stream(
        "POST",
        "/api/runs/stream",
        json={
            "question": "Which customers generated the most revenue?",
            "sources": ["sales"],
            "provider": "mock",
        },
    ) as response:
        assert response.status_code == 200
        events = [json.loads(line) for line in response.iter_lines() if line]

    event_names = [event["event"] for event in events]
    assert event_names[0] == "run_started"
    assert "step_started" in event_names
    assert "step_finished" in event_names
    assert event_names[-1] == "run_finished"

    started_steps = [
        event for event in events if event["event"] == "step_started" and event["action"] != "pending"
    ]
    finished_steps = [event for event in events if event["event"] == "step_finished"]
    assert [event["status"] for event in started_steps] == ["running"] * 5
    assert [event["action"] for event in finished_steps] == [
        "update_plan",
        "inspect_schema",
        "profile_data",
        "query_csv",
        "finish",
    ]

    query_finished = next(event for event in finished_steps if event["action"] == "query_csv")
    assert query_finished["executed_sql"]
    assert query_finished["row_count"] == 8
    assert query_finished["observation"]["data"]["rows"][0]["customer"] == "Nimbus Finance"

    final = events[-1]
    assert final["run"]["answer"].startswith("The top revenue customers are Nimbus Finance")
    assert final["run"]["generated_sql"]
    assert final["run"]["result_tables"][0]["rows"][0]["customer"] == "Nimbus Finance"
