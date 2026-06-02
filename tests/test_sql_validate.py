from __future__ import annotations

import pytest

from datapilot.sql_validate import validate_readonly_select


def test_valid_select_passes() -> None:
    sql = validate_readonly_select(
        "SELECT customer, SUM(revenue) AS total FROM sales GROUP BY customer;",
        {"sales"},
    )
    assert "FROM sales" in sql


@pytest.mark.parametrize(
    "sql",
    [
        "DROP TABLE sales",
        "DELETE FROM sales WHERE revenue < 0",
    ],
)
def test_mutation_or_ddl_is_blocked(sql: str) -> None:
    with pytest.raises(ValueError):
        validate_readonly_select(sql, {"sales"})


def test_multiple_statements_are_blocked() -> None:
    with pytest.raises(ValueError):
        validate_readonly_select("SELECT * FROM sales; SELECT * FROM sales", {"sales"})


def test_unknown_table_is_blocked() -> None:
    with pytest.raises(ValueError):
        validate_readonly_select("SELECT * FROM users", {"sales"})


def test_query_without_table_is_blocked() -> None:
    with pytest.raises(ValueError):
        validate_readonly_select("SELECT 1", {"sales"})
