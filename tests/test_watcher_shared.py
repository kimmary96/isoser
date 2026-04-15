from __future__ import annotations

from pathlib import Path

from scripts import watcher_shared


def test_acquire_lock_file_reclaims_stale_lock(tmp_path: Path, monkeypatch) -> None:
    lock_path = tmp_path / ".watcher.lock"
    lock_path.write_text("pid=999999\nstarted_at=2026-04-15T10:00:00\n", encoding="utf-8")

    monkeypatch.setattr(watcher_shared, "_is_pid_running", lambda pid: False)

    lock_handle = watcher_shared.acquire_lock_file(str(lock_path))

    try:
        assert lock_handle is not None
        watcher_shared.write_lock_file(lock_handle)
        body = lock_path.read_text(encoding="utf-8")
        assert "pid=" in body
    finally:
        watcher_shared.release_lock_file(lock_handle, str(lock_path))


def test_acquire_lock_file_keeps_live_lock(tmp_path: Path, monkeypatch) -> None:
    lock_path = tmp_path / ".watcher.lock"
    lock_path.write_text("pid=1234\nstarted_at=2026-04-15T10:00:00\n", encoding="utf-8")

    monkeypatch.setattr(watcher_shared, "_is_pid_running", lambda pid: True)

    assert watcher_shared.acquire_lock_file(str(lock_path)) is None
