# datapilot-harness

`datapilot-harness` to MVP Codex-style data harness dla CSV i DuckDB. To nie jest chatbot do CSV: agent nie odpowiada od razu, tylko iteruje przez plan, strukturalne akcje, bezpieczne narzedzia, obserwacje i trace.

Glowny przeplyw:

```text
User question
  -> Agent Harness
  -> LLM returns structured JSON action
  -> Python validates action
  -> Python executes safe tool
  -> Observation goes back to LLM
  -> LLM continues or finishes
```

## Instalacja

```bash
uv sync
```

Skonfiguruj `.env`:

```env
OPENROUTER_API_KEY=sk-or-xxx
OPENROUTER_MODEL=openai/gpt-4o-mini
```

## Przyklad

```bash
uv run python -m datapilot "Sprawdz top klientow po revenue i trend miesieczny" --csv sales=examples/sales.csv
```

Mozesz podac wiele CSV:

```bash
uv run python -m datapilot "Porownaj zrodla" --csv sales=examples/sales.csv --csv users=examples/users.csv
```

Nazwa zrodla po lewej stronie `=` jest nazwa widoku w DuckDB i musi pasowac do regexu:

```text
^[A-Za-z_][A-Za-z0-9_]*$
```

## Przykladowy trace

```text
Step 1: update_plan
Step 2: inspect_schema
Step 3: profile_data
Step 4: query_csv
Step 5: query_csv
Step 6: finish
```

CLI wypisuje ostatni plan, trace krok po kroku przez `rich.Panel` oraz finalna odpowiedz agenta.

## Security

- SELECT only
- allowed tables only
- limit 50
- no mutation statements
- errors go to trace
- SQL is parsed with `sqlglot` using the DuckDB dialect
- CSV paths are passed through the DuckDB Python API, not interpolated into SQL

## Testy i lint

```bash
uv run pytest
uv run ruff check .
```

## Roadmap

- SQL connector
- ToolRegistry
- MCP adapter
- web UI
- export to CSV/Markdown
