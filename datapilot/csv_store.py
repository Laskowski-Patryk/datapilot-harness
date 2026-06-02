from __future__ import annotations

import datetime as dt
import re
from pathlib import Path
from typing import Any

import duckdb

from datapilot.sql_validate import validate_readonly_select

SOURCE_NAME_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def validate_source_name(name: str) -> str:
    if not SOURCE_NAME_RE.fullmatch(name):
        raise ValueError(
            f"Invalid source name {name!r}. Use a name matching {SOURCE_NAME_RE.pattern}."
        )
    return name


def quote_identifier(identifier: str) -> str:
    return f'"{identifier.replace(chr(34), chr(34) * 2)}"'


def json_safe(value: Any) -> Any:
    if isinstance(value, dt.datetime | dt.date | dt.time):
        return value.isoformat()
    if isinstance(value, dt.timedelta):
        return str(value)
    if isinstance(value, dict):
        return {str(key): json_safe(item) for key, item in value.items()}
    if isinstance(value, list | tuple):
        return [json_safe(item) for item in value]
    return value


class CsvStore:
    def __init__(self) -> None:
        self.connection = duckdb.connect(database=":memory:")
        self.sources: dict[str, Path] = {}

    @property
    def allowed_tables(self) -> set[str]:
        return set(self.sources)

    def add_csv(self, name: str, path: str) -> None:
        safe_name = validate_source_name(name)
        csv_path = Path(path)
        if not csv_path.exists():
            raise FileNotFoundError(f"CSV file not found: {csv_path}")

        self.connection.read_csv(str(csv_path)).create_view(safe_name, replace=True)
        self.sources[safe_name] = csv_path

    def inspect_schema(self, name: str) -> dict[str, Any]:
        source = self._require_source(name)
        rows = self.connection.execute(
            f"DESCRIBE SELECT * FROM {quote_identifier(source)}"
        ).fetchall()
        columns = [
            {
                "name": row[0],
                "type": row[1],
                "nullable": str(row[2]).upper() != "NO",
            }
            for row in rows
        ]
        sample_rows = self._query_rows(
            f"SELECT * FROM {quote_identifier(source)} LIMIT 5",
        )
        return {
            "source": source,
            "file_path": str(self.sources[source]),
            "columns": columns,
            "sample_rows": sample_rows,
        }

    def profile_data(self, name: str) -> dict[str, Any]:
        source = self._require_source(name)
        schema = self.inspect_schema(source)
        row_count = self.connection.execute(
            f"SELECT COUNT(*) FROM {quote_identifier(source)}"
        ).fetchone()[0]

        columns = []
        for column in schema["columns"]:
            column_name = column["name"]
            column_type = column["type"]
            quoted_column = quote_identifier(column_name)
            null_count, approx_distinct_count = self.connection.execute(
                "SELECT "
                f"SUM(CASE WHEN {quoted_column} IS NULL THEN 1 ELSE 0 END), "
                f"approx_count_distinct({quoted_column}) "
                f"FROM {quote_identifier(source)}"
            ).fetchone()

            profile: dict[str, Any] = {
                "name": column_name,
                "type": column_type,
                "null_count": int(null_count or 0),
                "approx_distinct_count": int(approx_distinct_count or 0),
            }

            if self._is_text_or_category(column_type, profile["approx_distinct_count"]):
                profile["sample_values"] = [
                    row[0]
                    for row in self.connection.execute(
                        f"SELECT DISTINCT {quoted_column} FROM {quote_identifier(source)} "
                        f"WHERE {quoted_column} IS NOT NULL LIMIT 5"
                    ).fetchall()
                ]
            else:
                min_value, max_value = self.connection.execute(
                    f"SELECT MIN({quoted_column}), MAX({quoted_column}) "
                    f"FROM {quote_identifier(source)}"
                ).fetchone()
                profile["min"] = json_safe(min_value)
                profile["max"] = json_safe(max_value)

            columns.append(json_safe(profile))

        return {
            "source": source,
            "row_count": int(row_count),
            "columns": columns,
        }

    def query(self, sql: str) -> dict[str, Any]:
        clean_sql = validate_readonly_select(sql, self.allowed_tables)
        executed_sql = f"SELECT * FROM ({clean_sql}) AS q LIMIT 50"
        rows = self._query_rows(executed_sql)
        return {
            "executed_sql": executed_sql,
            "row_count": len(rows),
            "rows": rows,
        }

    def _query_rows(self, sql: str) -> list[dict[str, Any]]:
        cursor = self.connection.execute(sql)
        columns = [description[0] for description in cursor.description]
        return [
            {column: json_safe(value) for column, value in zip(columns, row, strict=True)}
            for row in cursor.fetchall()
        ]

    def _require_source(self, name: str) -> str:
        source = validate_source_name(name)
        if source not in self.sources:
            raise ValueError(f"Unknown source {source!r}. Available: {sorted(self.sources)}")
        return source

    @staticmethod
    def _is_text_or_category(column_type: str, distinct_count: int) -> bool:
        normalized = column_type.upper()
        if any(
            token in normalized
            for token in (
                "INT",
                "DOUBLE",
                "FLOAT",
                "DECIMAL",
                "NUMERIC",
                "DATE",
                "TIME",
                "TIMESTAMP",
            )
        ):
            return False
        if any(token in normalized for token in ("CHAR", "TEXT", "STRING", "VARCHAR")):
            return True
        return distinct_count <= 20
