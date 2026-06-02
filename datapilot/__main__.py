from __future__ import annotations

import argparse
import json
from pathlib import Path

from dotenv import load_dotenv
from rich.console import Console
from rich.panel import Panel
from rich.pretty import Pretty

from datapilot.csv_store import CsvStore
from datapilot.harness import AgentHarness, AgentResult
from datapilot.llm import OpenRouterLLM
from datapilot.trace import TraceEntry


def parse_csv_arg(value: str) -> tuple[str, str]:
    if "=" not in value:
        raise argparse.ArgumentTypeError("--csv must use name=path format")
    name, path = value.split("=", 1)
    if not name or not path:
        raise argparse.ArgumentTypeError("--csv must use name=path format")
    return name, path


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m datapilot",
        description="Run a Codex-style data retrieval harness over CSV files.",
    )
    parser.add_argument("question", nargs="?", help="User question for the data agent.")
    parser.add_argument(
        "--csv",
        dest="csv_sources",
        action="append",
        type=parse_csv_arg,
        required=True,
        help="CSV source in name=path format. Can be provided multiple times.",
    )
    parser.add_argument(
        "--max-steps",
        type=int,
        default=8,
        help="Maximum number of agent steps.",
    )
    parser.add_argument(
        "--interactive",
        "-i",
        action="store_true",
        help="Keep the same agent session open for follow-up questions.",
    )
    return parser


def render_plan(console: Console, plan: list[str]) -> None:
    if plan:
        content = "\n".join(f"{index}. {step}" for index, step in enumerate(plan, start=1))
    else:
        content = "No plan was produced."
    console.print(Panel(content, title="Current plan", border_style="cyan"))


def render_trace_entry(console: Console, entry: TraceEntry) -> None:
    lines = [f"Action: {entry.action}", f"Reason: {entry.reason or '-'}"]
    if entry.executed_sql:
        lines.append(f"Executed SQL: {entry.executed_sql}")
    if entry.row_count is not None:
        lines.append(f"Row count: {entry.row_count}")
    if entry.error:
        lines.append(f"Error: {entry.error}")

    console.print(
        Panel(
            Pretty(
                {
                    "summary": lines,
                    "observation": entry.observation,
                },
                expand_all=False,
            ),
            title=f"Step {entry.step}: {entry.action}",
            border_style="yellow" if entry.error else "green",
        )
    )


def render_result(console: Console, result: AgentResult, entries: list[TraceEntry]) -> None:
    render_plan(console, result.plan)
    for entry in entries:
        render_trace_entry(console, entry)

    if not result.completed:
        console.print(
            Panel(
                json.dumps(
                    {
                        "completed": False,
                        "message": result.answer,
                    },
                    ensure_ascii=False,
                    indent=2,
                ),
                title="Result",
                border_style="red",
            )
        )
        return

    console.print(Panel(result.answer, title="Final answer", border_style="magenta"))


def ask_once(console: Console, harness: AgentHarness, question: str) -> bool:
    try:
        result = harness.ask(question)
    except Exception as exc:
        console.print(
            Panel(
                str(exc),
                title="Runtime error",
                border_style="red",
            )
        )
        return False

    render_result(console, result, result.new_entries)
    return result.completed


def main() -> None:
    load_dotenv()
    args = build_parser().parse_args()
    console = Console()

    store = CsvStore()
    for name, raw_path in args.csv_sources:
        path = Path(raw_path)
        store.add_csv(name, str(path))

    llm = OpenRouterLLM()
    harness = AgentHarness(llm=llm, store=store, max_steps=args.max_steps)

    if not args.question and not args.interactive:
        console.print(Panel("Provide a question or use --interactive.", title="CLI error"))
        raise SystemExit(1)

    first_question = args.question
    if args.interactive and not first_question:
        first_question = console.input("[bold cyan]Question[/]: ").strip()

    if not first_question:
        console.print(Panel("Question cannot be empty.", title="CLI error"))
        raise SystemExit(1)

    completed = ask_once(console, harness, first_question)
    if not completed and not args.interactive:
        raise SystemExit(1)

    while args.interactive:
        follow_up = console.input("[bold cyan]Follow-up[/] (or 'exit'): ").strip()
        if follow_up.lower() in {"exit", "quit", "q"}:
            break
        if not follow_up:
            continue
        ask_once(console, harness, follow_up)


if __name__ == "__main__":
    main()
