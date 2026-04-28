from __future__ import annotations

from pathlib import Path

from scripts import create_task_packet


def test_build_packet_includes_current_head_and_optional_fingerprint(tmp_path: Path, monkeypatch) -> None:
    tracked = tmp_path / "README.md"
    tracked.write_text("hello\n", encoding="utf-8")
    monkeypatch.setattr(create_task_packet, "current_head", lambda _project_path: "abc123")

    packet = create_task_packet.build_packet(
        project_path=str(tmp_path),
        task_id="TASK-TEST",
        title="Test packet",
        task_type="feature",
        priority="medium",
        planned_by="claude",
        created_by="claude",
        execution_path="local",
        supervisor_spec=False,
        files=["README.md"],
    )

    assert "planned_against_commit: abc123" in packet
    assert "planned_files: README.md" in packet
    assert "planned_worktree_fingerprint:" in packet


def test_create_task_packet_main_writes_output_file(tmp_path: Path, monkeypatch) -> None:
    tracked = tmp_path / "README.md"
    tracked.write_text("hello\n", encoding="utf-8")
    output_path = tmp_path / "tasks" / "inbox" / "TASK-TEST.md"
    monkeypatch.setattr(create_task_packet, "current_head", lambda _project_path: "abc123")
    monkeypatch.setattr(
        "sys.argv",
        [
            "create_task_packet.py",
            "--project-path",
            str(tmp_path),
            "--task-id",
            "TASK-TEST",
            "--title",
            "Test packet",
            "--output",
            str(output_path),
            "--files",
            "README.md",
        ],
    )

    exit_code = create_task_packet.main()

    assert exit_code == 0
    body = output_path.read_text(encoding="utf-8")
    assert "id: TASK-TEST" in body
    assert "planned_against_commit: abc123" in body
