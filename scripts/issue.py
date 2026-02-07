#!/usr/bin/env python3
"""Lightweight JSONL issue tracker helper.

Usage:
  python scripts/issue.py create --id ID --title "Title" [--epic EPIC]
  python scripts/issue.py close --id ID [--epic EPIC]
  python scripts/issue.py list [--epic EPIC] [--status STATUS] [--all]
  python scripts/issue.py summary
  python scripts/issue.py validate [--epic EPIC]
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Iterable, List, Dict, Any, Optional
import subprocess


ALLOWED_STATUS = {"todo", "doing", "done"}
ALLOWED_TYPE = {"bug", "feature", "chore", "docs", "spike"}
ALLOWED_PRIORITY = {"low", "med", "high", "urgent"}


@dataclass
class IssueFile:
    path: Path
    issues: List[Dict[str, Any]]


def repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def issues_dir() -> Path:
    return repo_root() / "issues"


def epic_path(epic: str) -> Path:
    return issues_dir() / f"{epic}.jsonl"


def read_issues(path: Path) -> IssueFile:
    issues: List[Dict[str, Any]] = []
    if path.exists():
        with path.open("r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                issues.append(json.loads(line))
    return IssueFile(path=path, issues=issues)


def write_issues(issue_file: IssueFile) -> None:
    issue_file.path.parent.mkdir(parents=True, exist_ok=True)
    with issue_file.path.open("w", encoding="utf-8") as f:
        for issue in issue_file.issues:
            f.write(json.dumps(issue, ensure_ascii=True))
            f.write("\n")


def parse_list(value: Optional[str]) -> Optional[List[str]]:
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    return [item.strip() for item in value.split(",") if item.strip()]


def ensure_unique_id(issue_file: IssueFile, issue_id: str) -> None:
    if any(issue.get("id") == issue_id for issue in issue_file.issues):
        raise ValueError(f"Issue id '{issue_id}' already exists in {issue_file.path.name}.")


def build_issue(args: argparse.Namespace) -> Dict[str, Any]:
    issue: Dict[str, Any] = {
        "id": args.id,
        "title": args.title,
        "status": args.status or "todo",
        "created": date.today().isoformat(),
    }
    if args.type:
        issue["type"] = args.type
    if args.priority:
        issue["priority"] = args.priority
    if args.depends_on:
        issue["depends_on"] = args.depends_on
    if args.owner:
        issue["owner"] = args.owner
    if args.tags:
        issue["tags"] = args.tags
    if args.notes:
        issue["notes"] = args.notes
    return issue


def cmd_create(args: argparse.Namespace) -> int:
    path = epic_path(args.epic)
    issue_file = read_issues(path)
    ensure_unique_id(issue_file, args.id)

    if args.status and args.status not in ALLOWED_STATUS:
        raise ValueError(f"Invalid status '{args.status}'. Allowed: {sorted(ALLOWED_STATUS)}")
    if args.type and args.type not in ALLOWED_TYPE:
        raise ValueError(f"Invalid type '{args.type}'. Allowed: {sorted(ALLOWED_TYPE)}")
    if args.priority and args.priority not in ALLOWED_PRIORITY:
        raise ValueError(f"Invalid priority '{args.priority}'. Allowed: {sorted(ALLOWED_PRIORITY)}")

    issue = build_issue(args)
    issue_file.issues.append(issue)
    write_issues(issue_file)
    print(f"Created issue '{args.id}' in {path}")
    return 0


def git_commit_close(path: Path, issue_id: str, title: str) -> None:
    subprocess.run(["git", "add", str(path)], check=True)
    msg = f"Close issue {issue_id}: {title}" if title else f"Close issue {issue_id}"
    subprocess.run(["git", "commit", "-m", msg], check=True)


def cmd_close(args: argparse.Namespace) -> int:
    path = epic_path(args.epic)
    issue_file = read_issues(path)
    for issue in issue_file.issues:
        if issue.get("id") == args.id:
            issue["status"] = "done"
            issue["updated"] = date.today().isoformat()
            write_issues(issue_file)
            git_commit_close(path, args.id, issue.get("title", ""))
            print(f"Closed issue '{args.id}' in {path}")
            return 0
    raise ValueError(f"Issue id '{args.id}' not found in {path.name}.")


def validate_issue_fields(issue: Dict[str, Any]) -> List[str]:
    errors: List[str] = []
    if "id" not in issue or not isinstance(issue.get("id"), str) or not issue.get("id"):
        errors.append("missing or invalid 'id'")
    if "title" not in issue or not isinstance(issue.get("title"), str) or not issue.get("title"):
        errors.append("missing or invalid 'title'")
    status = issue.get("status")
    if status not in ALLOWED_STATUS:
        errors.append(f"invalid status '{status}'")
    if "type" in issue and issue["type"] not in ALLOWED_TYPE:
        errors.append(f"invalid type '{issue['type']}'")
    if "priority" in issue and issue["priority"] not in ALLOWED_PRIORITY:
        errors.append(f"invalid priority '{issue['priority']}'")
    if "depends_on" in issue:
        if not isinstance(issue["depends_on"], list) or not all(isinstance(x, str) for x in issue["depends_on"]):
            errors.append("invalid 'depends_on' (must be array of strings)")
    return errors


def find_cycles(graph: Dict[str, List[str]]) -> List[List[str]]:
    cycles: List[List[str]] = []
    visited: Dict[str, str] = {}

    def dfs(node: str, stack: List[str]) -> None:
        visited[node] = "visiting"
        stack.append(node)
        for dep in graph.get(node, []):
            state = visited.get(dep)
            if state == "visiting":
                cycle_start = stack.index(dep)
                cycles.append(stack[cycle_start:] + [dep])
            elif state != "visited":
                dfs(dep, stack)
        stack.pop()
        visited[node] = "visited"

    for node in graph:
        if visited.get(node) is None:
            dfs(node, [])
    return cycles


def validate_file(path: Path) -> List[str]:
    issue_file = read_issues(path)
    errors: List[str] = []
    ids = [issue.get("id") for issue in issue_file.issues]
    if len(set(ids)) != len(ids):
        errors.append("duplicate issue ids")

    id_set = {i for i in ids if isinstance(i, str)}
    graph: Dict[str, List[str]] = {}

    for idx, issue in enumerate(issue_file.issues):
        prefix = f"{path.name} line {idx + 1}"
        for err in validate_issue_fields(issue):
            errors.append(f"{prefix}: {err}")
        issue_id = issue.get("id")
        deps = issue.get("depends_on", []) or []
        if isinstance(issue_id, str):
            graph[issue_id] = deps
        for dep in deps:
            if dep == issue_id:
                errors.append(f"{prefix}: depends_on contains itself")
            elif dep not in id_set:
                errors.append(f"{prefix}: depends_on references missing id '{dep}'")

    for cycle in find_cycles(graph):
        errors.append(f"{path.name}: dependency cycle detected: {' -> '.join(cycle)}")

    return errors


def cmd_validate(args: argparse.Namespace) -> int:
    if args.epic:
        paths = [epic_path(args.epic)]
    else:
        paths = sorted(issues_dir().glob("*.jsonl"))
    if not paths:
        print("No issue files found.")
        return 0

    all_errors: List[str] = []
    for path in paths:
        all_errors.extend(validate_file(path))

    if all_errors:
        print("Validation errors:")
        for err in all_errors:
            print(f"- {err}")
        return 1

    print("All issue files validated successfully.")
    return 0


def cmd_list(args: argparse.Namespace) -> int:
    if args.all:
        paths = sorted(issues_dir().glob("*.jsonl"))
        if not paths:
            print("No issue files found.")
            return 0
        rows = []
        for path in paths:
            issue_file = read_issues(path)
            for issue in issue_file.issues:
                if args.status and issue.get("status") != args.status:
                    continue
                rows.append((path.stem, issue))
        if not rows:
            print("No issues found.")
            return 0
        for epic, issue in rows:
            issue_id = issue.get("id", "")
            status = issue.get("status", "")
            title = issue.get("title", "")
            print(f"{epic}\t{issue_id}\t[{status}] {title}")
        return 0

    path = epic_path(args.epic)
    issue_file = read_issues(path)
    issues = issue_file.issues
    if args.status:
        issues = [i for i in issues if i.get("status") == args.status]
    if not issues:
        print("No issues found.")
        return 0
    for issue in issues:
        issue_id = issue.get("id", "")
        status = issue.get("status", "")
        title = issue.get("title", "")
        print(f"{issue_id}\t[{status}] {title}")
    return 0


def summarize_status(issues: List[Dict[str, Any]]) -> str:
    statuses = {issue.get("status") for issue in issues}
    if not issues:
        return "todo"
    if statuses <= {"done"}:
        return "done"
    if "doing" in statuses:
        return "in-progress"
    if "done" in statuses and "todo" in statuses:
        return "in-progress"
    if "todo" in statuses:
        return "todo"
    return "todo"


def cmd_summary(_: argparse.Namespace) -> int:
    paths = sorted(issues_dir().glob("*.jsonl"))
    if not paths:
        print("No issue files found.")
        return 0
    rows = []
    for path in paths:
        issue_file = read_issues(path)
        status = summarize_status(issue_file.issues)
        counts = {"todo": 0, "doing": 0, "done": 0}
        for issue in issue_file.issues:
            s = issue.get("status")
            if s in counts:
                counts[s] += 1
        rows.append(
            (
                path.stem,
                status,
                counts["todo"],
                counts["doing"],
                counts["done"],
                len(issue_file.issues),
            )
        )
    print("epic\tstatus\ttodo\tdoing\tdone\ttotal")
    for row in rows:
        epic, status, todo, doing, done, total = row
        print(f"{epic}\t{status}\t{todo}\t{doing}\t{done}\t{total}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="JSONL issue tracker helper")
    sub = parser.add_subparsers(dest="command", required=True)

    p_create = sub.add_parser("create", help="create a new issue")
    p_create.add_argument("--epic", default="default")
    p_create.add_argument("--id", required=True)
    p_create.add_argument("--title", required=True)
    p_create.add_argument("--status", choices=sorted(ALLOWED_STATUS))
    p_create.add_argument("--type", choices=sorted(ALLOWED_TYPE))
    p_create.add_argument("--priority", choices=sorted(ALLOWED_PRIORITY))
    p_create.add_argument("--depends-on", dest="depends_on", type=parse_list)
    p_create.add_argument("--owner")
    p_create.add_argument("--tags", type=parse_list)
    p_create.add_argument("--notes")
    p_create.set_defaults(func=cmd_create)

    p_close = sub.add_parser("close", help="close an issue and commit")
    p_close.add_argument("--epic", default="default")
    p_close.add_argument("--id", required=True)
    p_close.set_defaults(func=cmd_close)

    p_validate = sub.add_parser("validate", help="validate issues")
    p_validate.add_argument("--epic")
    p_validate.set_defaults(func=cmd_validate)

    p_list = sub.add_parser("list", help="list issues")
    p_list.add_argument("--epic", default="default")
    p_list.add_argument("--status", choices=sorted(ALLOWED_STATUS))
    p_list.add_argument("--all", action="store_true", help="list issues across all epics")
    p_list.set_defaults(func=cmd_list)

    p_summary = sub.add_parser("summary", help="summarize epics")
    p_summary.set_defaults(func=cmd_summary)

    return parser


def main(argv: Iterable[str]) -> int:
    parser = build_parser()
    args = parser.parse_args(list(argv))
    try:
        return args.func(args)
    except subprocess.CalledProcessError as e:
        print(f"Command failed: {e}", file=sys.stderr)
        return e.returncode
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
