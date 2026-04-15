from __future__ import annotations

from pathlib import Path

from scripts import compute_task_fingerprint


def test_compute_task_fingerprint_prints_raw_hash(tmp_path: Path, capsys, monkeypatch) -> None:
    tracked = tmp_path / "backend" / "routers" / "programs.py"
    tracked.parent.mkdir(parents=True, exist_ok=True)
    tracked.write_text("print('ok')\n", encoding="utf-8")

    monkeypatch.setattr(
        "sys.argv",
        [
            "compute_task_fingerprint.py",
            "--project-path",
            str(tmp_path),
            "backend/routers/programs.py",
        ],
    )

    exit_code = compute_task_fingerprint.main()

    assert exit_code == 0
    output = capsys.readouterr().out.strip()
    assert len(output) == 64


def test_compute_task_fingerprint_prints_frontmatter_lines(tmp_path: Path, capsys, monkeypatch) -> None:
    tracked = tmp_path / "README.md"
    tracked.write_text("hello\n", encoding="utf-8")

    monkeypatch.setattr(
        "sys.argv",
        [
            "compute_task_fingerprint.py",
            "--project-path",
            str(tmp_path),
            "--frontmatter",
            "README.md",
        ],
    )

    exit_code = compute_task_fingerprint.main()

    assert exit_code == 0
    output = capsys.readouterr().out
    assert "planned_files: README.md" in output
    assert "planned_worktree_fingerprint:" in output
