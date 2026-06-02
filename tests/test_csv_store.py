from __future__ import annotations

from datapilot.csv_store import CsvStore


def test_csv_store_registers_and_queries_sales_csv() -> None:
    store = CsvStore()
    store.add_csv("sales", "examples/sales.csv")

    schema = store.inspect_schema("sales")
    assert schema["source"] == "sales"
    assert {column["name"] for column in schema["columns"]} == {
        "order_id",
        "order_date",
        "customer",
        "account_tier",
        "industry",
        "region",
        "country",
        "product_line",
        "plan",
        "channel",
        "seats",
        "contract_months",
        "discount_pct",
        "revenue",
        "renewal_status",
    }

    profile = store.profile_data("sales")
    assert profile["row_count"] == 30

    result = store.query(
        "SELECT customer, SUM(revenue) AS total_revenue "
        "FROM sales GROUP BY customer ORDER BY total_revenue DESC"
    )
    assert result["row_count"] == 8
    assert isinstance(result["rows"], list)
    assert result["rows"][0]["customer"] == "Nimbus Finance"
