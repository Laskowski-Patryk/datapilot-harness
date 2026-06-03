from __future__ import annotations

import json
import os
import time
from typing import Any

import httpx

from datapilot.schemas import AgentAction

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL = "deepseek/deepseek-v4-flash"
DEFAULT_MOCK_PROCESSING_DELAY_MS = 2500


class OpenRouterLLM:
    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        timeout: float = 60.0,
    ) -> None:
        self.api_key = api_key or os.getenv("OPENROUTER_API_KEY", "")
        self.model = model or os.getenv("OPENROUTER_MODEL", DEFAULT_MODEL)
        self.timeout = timeout

    def complete(self, messages: list[dict[str, str]]) -> str:
        if not self.api_key:
            raise RuntimeError(
                "OPENROUTER_API_KEY is not set. Add it to .env or the environment."
            )

        payload: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": 0,
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": "AgentAction",
                    "strict": True,
                    "schema": AgentAction.model_json_schema(),
                },
            },
        }
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        with httpx.Client(timeout=self.timeout) as client:
            response = client.post(OPENROUTER_URL, headers=headers, json=payload)

        if response.status_code >= 400:
            raise RuntimeError(
                f"OpenRouter API error {response.status_code}: {response.text}"
            )

        data = response.json()
        try:
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise RuntimeError(f"OpenRouter response did not contain message content: {data}") from exc

        if not isinstance(content, str) or not content.strip():
            raise RuntimeError(f"OpenRouter returned empty message content: {data}")
        return content


class MockLLM:
    """Deterministic demo provider that drives the real harness through typed actions."""

    model = "mock-agent"

    def __init__(self, processing_delay_ms: int | None = None) -> None:
        self.step = 0
        self.processing_delay_ms = (
            processing_delay_ms
            if processing_delay_ms is not None
            else int(os.getenv("DATAPILOT_MOCK_DELAY_MS", str(DEFAULT_MOCK_PROCESSING_DELAY_MS)))
        )

    def complete(self, messages: list[dict[str, str]]) -> str:
        if self.processing_delay_ms > 0:
            time.sleep(self.processing_delay_ms / 1000)

        self.step += 1
        question = self._question_from_messages(messages)
        source = self._source_from_messages(messages)

        if self.step == 1:
            return self._dump(
                action="update_plan",
                plan=[
                    "Confirm the available CSV schema.",
                    "Profile the fields that matter for the question.",
                    "Run a focused DuckDB query over the selected source.",
                    "Ground the final answer in the returned rows.",
                ],
                reason="Set a short, auditable plan before touching the data.",
            )

        if self.step == 2:
            return self._dump(
                action="inspect_schema",
                source=source,
                reason=f"Inspect {source} before generating SQL.",
            )

        if self.step == 3:
            return self._dump(
                action="profile_data",
                source=source,
                reason="Profile row counts, distinct values, and ranges before analysis.",
            )

        if self.step == 4:
            return self._dump(
                action="query_csv",
                source=source,
                sql=self._sql_for_question(question, source),
                reason="Retrieve concrete rows that directly answer the question.",
            )

        return self._dump(
            action="finish",
            answer=self._answer_from_query(messages, question),
            reason="The query observation is sufficient to produce a grounded answer.",
        )

    @staticmethod
    def _dump(
        *,
        action: str,
        source: str = "",
        sql: str = "",
        plan: list[str] | None = None,
        answer: str = "",
        reason: str,
    ) -> str:
        return json.dumps(
            {
                "action": action,
                "source": source,
                "sql": sql,
                "plan": plan or [],
                "answer": answer,
                "reason": reason,
            }
        )

    @staticmethod
    def _question_from_messages(messages: list[dict[str, str]]) -> str:
        for message in messages:
            if message["role"] != "user":
                continue
            try:
                payload = json.loads(message["content"])
            except json.JSONDecodeError:
                continue
            question = payload.get("question") or payload.get("follow_up_question")
            if isinstance(question, str) and question.strip():
                return question
        return "Which customers generated the most revenue?"

    @staticmethod
    def _source_from_messages(messages: list[dict[str, str]]) -> str:
        for message in messages:
            if message["role"] != "user":
                continue
            try:
                payload = json.loads(message["content"])
            except json.JSONDecodeError:
                continue
            sources = payload.get("available_sources")
            if isinstance(sources, list) and sources:
                first_source = sources[0]
                if isinstance(first_source, str) and first_source:
                    return first_source
        return "sales"

    @staticmethod
    def _sql_for_question(question: str, source: str) -> str:
        normalized = question.lower()
        if "quality issue" in normalized or "data quality" in normalized:
            return (
                "SELECT COUNT(*) AS total_rows, "
                "SUM(CASE WHEN customer IS NULL OR customer = '' THEN 1 ELSE 0 END) "
                "AS missing_customer_rows, "
                "SUM(CASE WHEN revenue IS NULL OR revenue <= 0 THEN 1 ELSE 0 END) "
                "AS invalid_revenue_rows, "
                "SUM(CASE WHEN discount_pct > 0.2 THEN 1 ELSE 0 END) AS high_discount_rows, "
                "SUM(CASE WHEN renewal_status IN ('at_risk', 'churned') THEN 1 ELSE 0 END) "
                f"AS renewal_risk_rows FROM {source}"
            )
        if "month" in normalized or "trend" in normalized or "growth" in normalized:
            return (
                "SELECT strftime(CAST(order_date AS DATE), '%Y-%m') AS month, "
                "SUM(revenue) AS total_revenue, COUNT(*) AS orders, "
                "ROUND(AVG(revenue), 2) AS avg_order_revenue "
                f"FROM {source} GROUP BY 1 ORDER BY 1"
            )
        if "discount" in normalized or "renewal" in normalized or "risk" in normalized:
            return (
                "SELECT customer, region, SUM(revenue) AS total_revenue, COUNT(*) AS orders, "
                "ROUND(AVG(discount_pct), 3) AS avg_discount_pct, "
                "SUM(CASE WHEN renewal_status IN ('at_risk', 'churned') THEN 1 ELSE 0 END) "
                f"AS renewal_risk_orders FROM {source} GROUP BY customer, region "
                "HAVING AVG(discount_pct) >= 0.08 "
                "OR SUM(CASE WHEN renewal_status IN ('at_risk', 'churned') THEN 1 ELSE 0 END) > 0 "
                "ORDER BY avg_discount_pct DESC, renewal_risk_orders DESC, total_revenue DESC LIMIT 10"
            )
        if "region" in normalized or "quality" in normalized:
            return (
                "SELECT region, COUNT(*) AS orders, SUM(revenue) AS total_revenue, "
                "ROUND(AVG(discount_pct), 3) AS avg_discount_pct, "
                "SUM(CASE WHEN renewal_status = 'renewed' THEN 1 ELSE 0 END) AS renewed_orders, "
                "SUM(CASE WHEN renewal_status IN ('at_risk', 'churned') THEN 1 ELSE 0 END) "
                f"AS renewal_risk_orders FROM {source} GROUP BY region "
                "ORDER BY total_revenue DESC"
            )
        return (
            "SELECT customer, region, SUM(revenue) AS total_revenue, COUNT(*) AS orders, "
            "ROUND(AVG(discount_pct), 3) AS avg_discount_pct, "
            "SUM(CASE WHEN renewal_status IN ('at_risk', 'churned') THEN 1 ELSE 0 END) "
            f"AS renewal_risk_orders FROM {source} GROUP BY customer, region "
            "ORDER BY total_revenue DESC LIMIT 8"
        )

    @staticmethod
    def _answer_from_query(messages: list[dict[str, str]], question: str) -> str:
        rows = MockLLM._last_query_rows(messages)
        if not rows:
            return "I inspected the source but did not receive query rows to summarize."

        normalized = question.lower()
        if "quality issue" in normalized or "data quality" in normalized:
            row = rows[0]
            return (
                f"The dataset has {row['total_rows']} rows. I found "
                f"{row['missing_customer_rows']} missing customers, "
                f"{row['invalid_revenue_rows']} invalid revenue rows, "
                f"{row['high_discount_rows']} high-discount rows, and "
                f"{row['renewal_risk_rows']} rows with at-risk or churned renewal status."
            )
        if "month" in normalized or "trend" in normalized or "growth" in normalized:
            strongest = max(rows, key=lambda row: row.get("total_revenue", 0))
            first = rows[0]
            last = rows[-1]
            direction = "upward" if last["total_revenue"] >= first["total_revenue"] else "downward"
            return (
                f"Monthly revenue shows a {direction} trend from {first['month']} "
                f"(${first['total_revenue']:,}) to {last['month']} (${last['total_revenue']:,}). "
                f"The strongest month is {strongest['month']} with ${strongest['total_revenue']:,} "
                f"across {strongest['orders']} orders."
            )
        if "region" in normalized or "quality" in normalized:
            top = rows[0]
            risk_sorted = sorted(rows, key=lambda row: row.get("renewal_risk_orders", 0), reverse=True)
            riskiest = risk_sorted[0]
            return (
                f"{top['region']} leads revenue with ${top['total_revenue']:,} across "
                f"{top['orders']} orders. {riskiest['region']} has the most renewal risk rows "
                f"({riskiest['renewal_risk_orders']}), so it deserves follow-up even if revenue is strong."
            )
        if "discount" in normalized or "renewal" in normalized or "risk" in normalized:
            top = rows[0]
            return (
                f"{top['customer']} is the highest-priority discount/renewal review: "
                f"average discount is {top['avg_discount_pct']:.0%}, revenue is "
                f"${top['total_revenue']:,}, and {top['renewal_risk_orders']} row(s) are "
                "at risk or churned."
            )

        leaders = rows[:3]
        leader_text = ", ".join(
            f"{row['customer']} (${row['total_revenue']:,})" for row in leaders
        )
        return f"The top revenue customers are {leader_text}. {rows[0]['customer']} ranks first."

    @staticmethod
    def _last_query_rows(messages: list[dict[str, str]]) -> list[dict[str, Any]]:
        for message in reversed(messages):
            if message["role"] != "user":
                continue
            try:
                payload = json.loads(message["content"])
            except json.JSONDecodeError:
                continue
            if payload.get("observation_type") != "query_result":
                continue
            rows = payload.get("data", {}).get("rows")
            if isinstance(rows, list):
                return [row for row in rows if isinstance(row, dict)]
        return []
