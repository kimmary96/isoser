from __future__ import annotations

import os
import re
import subprocess
from datetime import datetime
from typing import Callable, Optional


def ensure_directories_exist(directories: list[str]) -> None:
    for directory in directories:
        os.makedirs(directory, exist_ok=True)


def _read_lock_pid(lock_path: str) -> Optional[int]:
    if not os.path.exists(lock_path):
        return None

    try:
        with open(lock_path, "r", encoding="utf-8") as file:
            for raw_line in file:
                line = raw_line.strip()
                if not line.startswith("pid="):
                    continue
                try:
                    return int(line.split("=", 1)[1].strip())
                except ValueError:
                    return None
    except OSError:
        return None

    return None


def _is_pid_running(pid: int) -> bool:
    if pid <= 0:
        return False

    try:
        os.kill(pid, 0)
    except OSError:
        return False
    return True


def acquire_lock_file(lock_path: str) -> Optional[int]:
    try:
        return os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError:
        stale_pid = _read_lock_pid(lock_path)
        if stale_pid is not None and not _is_pid_running(stale_pid):
            try:
                os.remove(lock_path)
            except OSError:
                return None
            try:
                return os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            except FileExistsError:
                return None
        return None


def write_lock_file(lock_handle: int) -> None:
    payload = (
        f"pid={os.getpid()}\n"
        f"started_at={datetime.now().isoformat(timespec='seconds')}\n"
    )
    os.write(lock_handle, payload.encode("utf-8"))
    os.fsync(lock_handle)


def release_lock_file(lock_handle: Optional[int], lock_path: str) -> None:
    if lock_handle is None:
        return

    try:
        os.close(lock_handle)
    finally:
        if os.path.exists(lock_path):
            os.remove(lock_path)


def extract_frontmatter(text: str) -> dict[str, str]:
    if not text.startswith("---\n"):
        return {}

    end_index = text.find("\n---\n", 4)
    if end_index == -1:
        return {}

    metadata: dict[str, str] = {}
    frontmatter = text[4:end_index]
    for raw_line in frontmatter.splitlines():
        line = raw_line.strip()
        if not line or ":" not in line:
            continue
        key, value = line.split(":", 1)
        metadata[key.strip()] = value.strip()
    return metadata


def read_markdown(path: str) -> str:
    with open(path, "r", encoding="utf-8") as file:
        return file.read()


def write_markdown(path: str, body: str) -> None:
    with open(path, "w", encoding="utf-8") as file:
        file.write(body.rstrip() + "\n")


def read_task_metadata(task_path: str, required_fields: tuple[str, ...]) -> tuple[dict[str, str], list[str]]:
    metadata = extract_frontmatter(read_markdown(task_path))
    missing_fields = [field for field in required_fields if not metadata.get(field)]
    return metadata, missing_fields


def sanitize_task_id(raw_value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", raw_value).strip("-")
    return cleaned or "unknown-task"


def current_head(project_path: str) -> str:
    result = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=project_path,
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout.strip()


def resolve_cli_command(candidates: tuple[Optional[str], ...]) -> str:
    for candidate in candidates:
        if candidate and os.path.exists(candidate):
            return candidate
    raise FileNotFoundError("Unable to resolve Codex CLI executable.")


def parse_token_count(output: str) -> Optional[int]:
    match = re.search(r"tokens used\s+([\d,]+)", output, flags=re.IGNORECASE | re.MULTILINE)
    if not match:
        return None
    return int(match.group(1).replace(",", ""))


def move_file_with_retries(
    src: str,
    dst: str,
    *,
    attempts: int,
    delay_seconds: float,
    path_exists: Callable[[str], bool],
    replace_file: Callable[[str, str], None],
    sleep: Callable[[float], None],
) -> None:
    last_error: Optional[PermissionError] = None
    for _ in range(attempts):
        try:
            if path_exists(dst):
                raise FileExistsError(f"Destination already exists: {dst}")
            replace_file(src, dst)
            return
        except PermissionError as error:
            last_error = error
            sleep(delay_seconds)

    if last_error is not None:
        raise last_error
