from __future__ import annotations

from sqlglot import exp, parse

BLOCKED_EXPRESSIONS = (
    exp.Insert,
    exp.Update,
    exp.Delete,
    exp.Drop,
    exp.Alter,
    exp.Create,
    exp.Command,
)


def validate_readonly_select(sql: str, allowed_tables: set[str]) -> str:
    clean_sql = sql.strip().rstrip(";").strip()
    if not clean_sql:
        raise ValueError("SQL query is empty.")

    statements = parse(clean_sql, read="duckdb")
    if len(statements) != 1:
        raise ValueError("Only a single SQL statement is allowed.")

    statement = statements[0]
    if not isinstance(statement, exp.Select):
        raise ValueError("Only SELECT statements are allowed.")

    for node_type in BLOCKED_EXPRESSIONS:
        if list(statement.find_all(node_type)):
            raise ValueError(f"Blocked SQL expression: {node_type.__name__}")

    used_tables = {table.name for table in statement.find_all(exp.Table) if table.name}
    if not used_tables:
        raise ValueError("Query must use at least one table.")

    unknown_tables = used_tables - allowed_tables
    if unknown_tables:
        raise ValueError(
            f"Query references unknown table(s): {sorted(unknown_tables)}. "
            f"Allowed tables: {sorted(allowed_tables)}"
        )

    return statement.sql(dialect="duckdb")
