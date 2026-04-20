from __future__ import annotations

import argparse
import subprocess
from datetime import datetime
from pathlib import Path

try:
    from scripts.watcher_shared import compute_worktree_fingerprint
except ImportError:
    from watcher_shared import compute_worktree_fingerprint


def current_head(project_path: str) -> str:
    result = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=project_path,
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout.strip()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Scaffold a task packet with current HEAD and optional fingerprint fields.")
    parser.add_argument("--project-path", default=".")
    parser.add_argument("--task-id", required=True)
    parser.add_argument("--title", required=True)
    parser.add_argument("--type", default="feature")
    parser.add_argument("--priority", default="medium")
    parser.add_argument("--planned-by", default="claude")
    parser.add_argument("--created-by", default="claude")
    parser.add_argument("--execution-path", default="local", choices=["local", "github", "manual-blocked"])
    parser.add_argument("--supervisor-spec", action="store_true")
    parser.add_argument("--output", help="Write packet to this path instead of stdout.")
    parser.add_argument("--files", nargs="*", default=[])
    return parser


def build_packet(
    *,
    project_path: str,
    task_id: str,
    title: str,
    task_type: str,
    priority: str,
    planned_by: str,
    created_by: str,
    execution_path: str,
    supervisor_spec: bool,
    files: list[str],
) -> str:
    head = current_head(project_path)
    normalized_files = [item.strip().replace("\\", "/") for item in files if item.strip()]
    allowed_paths = ", ".join(normalized_files) if normalized_files else "TBD"
    lines = [
        "---",
        f"id: {task_id}",
        "status: queued",
        f"type: {task_type}",
        f"title: {title}",
        f"priority: {priority}",
        f"planned_by: {planned_by}",
        f"planned_at: {datetime.now().astimezone().isoformat(timespec='seconds')}",
        f"planned_against_commit: {head}",
    ]
    if supervisor_spec:
        lines.extend(
            [
                "spec_version: 2.0",
                f"request_id: {task_id}",
                f"created_by: {created_by}",
                f"goal: {title}",
                "background: TBD",
                "scope_in: TBD",
                "scope_out: TBD",
                "constraints: minimal-safe-change-only",
                "non_goals: none",
                "acceptance_criteria: see-body",
                "risk_level: medium",
                f"execution_path: {execution_path}",
                f"allowed_paths: {allowed_paths}",
                "blocked_paths: backend/.env, frontend/.env.local, supabase/migrations",
                "prechecks: read-current-state, inspect-touched-area",
                "implementation_steps: inspect, implement, verify",
                "tests: targeted-tests",
                f"artifacts: reports/{task_id}-result.md",
                "fallback_plan: stop-and-report",
                "rollback_plan: revert-last-task-scope",
                f"dedupe_key: {task_id}",
                "report_format: planner-supervisor-implementer-qa",
            ]
        )
    if normalized_files:
        lines.append(f"planned_files: {', '.join(normalized_files)}")
        lines.append(
            f"planned_worktree_fingerprint: {compute_worktree_fingerprint(project_path, normalized_files)}"
        )
    lines.extend(
        [
            "---",
            "# Goal",
            "",
            "Describe the intended outcome.",
            "",
            "# Constraints",
            "",
            "- Prefer minimal safe changes.",
            "- Reuse existing patterns before introducing new ones.",
            "",
            "# Acceptance Criteria",
            "",
            "1. Behavior matches the intended change.",
            "2. The touched area stays aligned with the current repository state.",
            "",
            "# Edge Cases",
            "",
            "- Missing runtime prerequisites",
            "- Dirty worktree drift in the touched files",
            "",
            "# Open Questions",
            "",
            "- None.",
        ]
    )
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    packet = build_packet(
        project_path=str(Path(args.project_path).resolve()),
        task_id=args.task_id,
        title=args.title,
        task_type=args.type,
        priority=args.priority,
        planned_by=args.planned_by,
        created_by=args.created_by,
        execution_path=args.execution_path,
        supervisor_spec=args.supervisor_spec,
        files=args.files,
    )
    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(packet, encoding="utf-8")
    else:
        print(packet, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
