# datapilot-harness

`datapilot-harness` is a small Codex-style agent runtime for retrieving and analyzing tabular data from CSV files through DuckDB.

This is not a CSV chatbot. The agent does not answer immediately. It plans, chooses a structured action, executes a safe Python tool, reads the observation, repairs mistakes when needed, and only finishes when it has enough evidence.

The project is intentionally compact, typed, and easy to inspect. It is designed as a portfolio-grade demo of how an agent harness can be built without LangChain, LlamaIndex, LangGraph, embeddings, vector databases, or a web UI.

## Why It Exists

Modern data agents need more than a prompt wrapped around a file upload. They need:

- typed actions instead of free-form tool calls
- a visible trace of every decision and observation
- SQL validation before execution
- safe table allow-listing
- recovery from broken queries
- clear separation between planning, tool execution, and final answers

`datapilot-harness` demonstrates those ideas in a focused MVP.

## Architecture

```text
User question
  -> Agent Harness
  -> LLM returns structured JSON action
  -> Python validates action
  -> Python executes a safe tool
  -> Observation goes back to the LLM
  -> LLM continues or finishes
```

Supported actions:

- `update_plan`
- `inspect_schema`
- `profile_data`
- `query_csv`
- `repair_query`
- `finish`

## Stack

- Python 3.11+
- uv
- DuckDB
- httpx
- pydantic
- python-dotenv
- sqlglot
- rich
- pytest
- ruff

## Installation

```bash
uv sync
```

Create a `.env` file:

```env
OPENROUTER_API_KEY=sk-or-xxx
OPENROUTER_MODEL=openai/gpt-4o-mini
```

## Example

```bash
uv run python -m datapilot "Which customers generated the most revenue, and is there a monthly growth trend?" --csv sales=examples/sales.csv
```

You can register multiple CSV sources:

```bash
uv run python -m datapilot "Compare revenue quality across the available sources" --csv sales=examples/sales.csv --csv users=examples/users.csv
```

The source name on the left side of `=` becomes the DuckDB view name and must match:

```text
^[A-Za-z_][A-Za-z0-9_]*$
```

## Demo Dataset

The included `examples/sales.csv` is a synthetic B2B SaaS revenue dataset with customer, industry, region, product line, plan, channel, seats, discount, revenue, contract length, and renewal status.

It is intentionally more realistic than a tiny toy CSV, while still being small enough to understand in a demo or LinkedIn post.

## Example Trace

```text
Step 1: update_plan
Step 2: inspect_schema
Step 3: profile_data
Step 4: query_csv
Step 5: query_csv
Step 6: finish
```

The CLI prints the latest plan, a step-by-step trace through `rich.Panel`, and the final answer.

## Safety

- SELECT only
- allowed tables only
- enforced result limit of 50 rows
- no mutation statements
- SQL parsed with `sqlglot` using the DuckDB dialect
- CSV paths passed through the DuckDB Python API, not interpolated into SQL
- tool errors captured as observations and shown in the trace

## Tests And Lint

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

## Positioning

This repository is a practical showcase of agent engineering: structured LLM output, typed runtime validation, safe tool execution, observable traces, and data-grounded final answers.
