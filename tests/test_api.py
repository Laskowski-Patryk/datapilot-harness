from __future__ import annotations

from fastapi.testclient import TestClient

from datapilot.api.main import create_app


def test_api_health() -> None:
    client = TestClient(create_app(preload_examples=False))

    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_api_mock_run_with_example_sales_source() -> None:
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
