from __future__ import annotations

import argparse
from pathlib import Path

try:
    from scripts.watcher_shared import compute_worktree_fingerprint
except ImportError:
    from watcher_shared import compute_worktree_fingerprint


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Compute an optional task-packet worktree fingerprint for a set of planned files."
    )
    parser.add_argument(
        "files",
        nargs="+",
        help="Repository-relative files or directories to include in the fingerprint.",
    )
    parser.add_argument(
        "--project-path",
        default=".",
        help="Project root to resolve repository-relative file paths from. Defaults to current directory.",
    )
    parser.add_argument(
        "--frontmatter",
        action="store_true",
        help="Print packet-ready frontmatter lines instead of the raw fingerprint only.",
    )
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    project_path = str(Path(args.project_path).resolve())
    normalized_files = [item.strip().replace("\\", "/") for item in args.files if item.strip()]
    fingerprint = compute_worktree_fingerprint(project_path, normalized_files)

    if args.frontmatter:
        print(f"planned_files: {', '.join(normalized_files)}")
        print(f"planned_worktree_fingerprint: {fingerprint}")
        return 0

    print(fingerprint)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
