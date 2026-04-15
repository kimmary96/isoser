import os
import time
from pathlib import Path

import cowork_watcher


def test_approval_target_defaults_to_inbox(tmp_path: Path) -> None:
    approval = tmp_path / "TASK-TEST.ok"
    approval.write_text("approved_by: user\n", encoding="utf-8")

    assert cowork_watcher.approval_target_from_file(str(approval)) == "inbox"


def test_approval_target_reads_remote_target(tmp_path: Path) -> None:
    approval = tmp_path / "TASK-TEST.ok"
    approval.write_text("target: remote\n", encoding="utf-8")

    assert cowork_watcher.approval_target_from_file(str(approval)) == "remote"


def test_missing_frontmatter_creates_review_and_dispatch(tmp_path: Path, monkeypatch) -> None:
    packets_dir = tmp_path / "packets"
    reviews_dir = tmp_path / "reviews"
    dispatch_dir = tmp_path / "dispatch"
    approvals_dir = tmp_path / "approvals"
    inbox_dir = tmp_path / "inbox"
    remote_dir = tmp_path / "remote"

    for directory in [packets_dir, reviews_dir, dispatch_dir, approvals_dir, inbox_dir, remote_dir]:
        directory.mkdir(parents=True, exist_ok=True)

    packet = packets_dir / "TASK-TEST-PACKET.md"
    packet.write_text(
        "\n".join(
            [
                "---",
                "id: TASK-TEST-PACKET",
                "status: queued",
                "type: feature",
                "---",
                "",
                "# Goal",
                "",
                "Incomplete frontmatter test.",
            ]
        ),
        encoding="utf-8",
    )

    monkeypatch.setattr(cowork_watcher, "COWORK_PACKETS_DIR", str(packets_dir))
    monkeypatch.setattr(cowork_watcher, "COWORK_REVIEWS_DIR", str(reviews_dir))
    monkeypatch.setattr(cowork_watcher, "COWORK_DISPATCH_DIR", str(dispatch_dir))
    monkeypatch.setattr(cowork_watcher, "COWORK_APPROVALS_DIR", str(approvals_dir))
    monkeypatch.setattr(cowork_watcher, "TASKS_INBOX_DIR", str(inbox_dir))
    monkeypatch.setattr(cowork_watcher, "TASKS_REMOTE_DIR", str(remote_dir))

    cowork_watcher.handle_packet_review(str(packet))

    review_path = reviews_dir / "TASK-TEST-PACKET-review.md"
    dispatch_path = dispatch_dir / "TASK-TEST-PACKET-review-ready.md"

    assert review_path.exists()
    assert dispatch_path.exists()
    assert "missing_fields" in review_path.read_text(encoding="utf-8")
    assert "action-required" in dispatch_path.read_text(encoding="utf-8")


def test_handle_approval_moves_packet_to_remote(tmp_path: Path, monkeypatch) -> None:
    packets_dir = tmp_path / "packets"
    reviews_dir = tmp_path / "reviews"
    dispatch_dir = tmp_path / "dispatch"
    approvals_dir = tmp_path / "approvals"
    inbox_dir = tmp_path / "inbox"
    remote_dir = tmp_path / "remote"

    for directory in [packets_dir, reviews_dir, dispatch_dir, approvals_dir, inbox_dir, remote_dir]:
        directory.mkdir(parents=True, exist_ok=True)

    packet = packets_dir / "TASK-TEST-PROMOTE.md"
    packet.write_text(
        "\n".join(
            [
                "---",
                "id: TASK-TEST-PROMOTE",
                "status: queued",
                "type: feature",
                "title: Promote packet",
                "planned_at: 2026-04-15T00:00:00+09:00",
                "planned_against_commit: abc123",
                "---",
            ]
        ),
        encoding="utf-8",
    )
    review = reviews_dir / "TASK-TEST-PROMOTE-review.md"
    review.write_text("# ready review\n", encoding="utf-8")

    approval = approvals_dir / "TASK-TEST-PROMOTE.ok"
    approval.write_text("target: remote\n", encoding="utf-8")

    monkeypatch.setattr(cowork_watcher, "COWORK_PACKETS_DIR", str(packets_dir))
    monkeypatch.setattr(cowork_watcher, "COWORK_REVIEWS_DIR", str(reviews_dir))
    monkeypatch.setattr(cowork_watcher, "COWORK_DISPATCH_DIR", str(dispatch_dir))
    monkeypatch.setattr(cowork_watcher, "COWORK_APPROVALS_DIR", str(approvals_dir))
    monkeypatch.setattr(cowork_watcher, "TASKS_INBOX_DIR", str(inbox_dir))
    monkeypatch.setattr(cowork_watcher, "TASKS_REMOTE_DIR", str(remote_dir))

    cowork_watcher.handle_approval(str(packet))

    assert packet.exists()
    assert (remote_dir / "TASK-TEST-PROMOTE.md").exists()
    assert (dispatch_dir / "TASK-TEST-PROMOTE-promoted.md").exists()


def test_stale_review_blocks_promotion(tmp_path: Path, monkeypatch) -> None:
    packets_dir = tmp_path / "packets"
    reviews_dir = tmp_path / "reviews"
    dispatch_dir = tmp_path / "dispatch"
    approvals_dir = tmp_path / "approvals"
    inbox_dir = tmp_path / "inbox"
    remote_dir = tmp_path / "remote"

    for directory in [packets_dir, reviews_dir, dispatch_dir, approvals_dir, inbox_dir, remote_dir]:
        directory.mkdir(parents=True, exist_ok=True)

    packet = packets_dir / "TASK-TEST-STALE.md"
    packet.write_text(
        "\n".join(
            [
                "---",
                "id: TASK-TEST-STALE",
                "status: queued",
                "type: feature",
                "title: Stale review test",
                "planned_at: 2026-04-15T00:00:00+09:00",
                "planned_against_commit: abc123",
                "---",
            ]
        ),
        encoding="utf-8",
    )

    review = reviews_dir / "TASK-TEST-STALE-review.md"
    review.write_text("# old review\n", encoding="utf-8")
    approval = approvals_dir / "TASK-TEST-STALE.ok"
    approval.write_text("target: inbox\n", encoding="utf-8")

    monkeypatch.setattr(cowork_watcher, "COWORK_PACKETS_DIR", str(packets_dir))
    monkeypatch.setattr(cowork_watcher, "COWORK_REVIEWS_DIR", str(reviews_dir))
    monkeypatch.setattr(cowork_watcher, "COWORK_DISPATCH_DIR", str(dispatch_dir))
    monkeypatch.setattr(cowork_watcher, "COWORK_APPROVALS_DIR", str(approvals_dir))
    monkeypatch.setattr(cowork_watcher, "TASKS_INBOX_DIR", str(inbox_dir))
    monkeypatch.setattr(cowork_watcher, "TASKS_REMOTE_DIR", str(remote_dir))

    stale_timestamp = time.time() - 10
    os.utime(review, (stale_timestamp, stale_timestamp))
    packet.touch()

    cowork_watcher.handle_approval(str(packet))

    assert not (inbox_dir / "TASK-TEST-STALE.md").exists()
    assert (dispatch_dir / "TASK-TEST-STALE-approval-blocked-stale-review.md").exists()


def test_format_slack_dispatch_message_contains_core_fields() -> None:
    message = cowork_watcher.format_slack_dispatch_message(
        task_id="TASK-TEST",
        stage="review-ready",
        lines=[
            "# Dispatch: TASK-TEST",
            "",
            "stage: review-ready",
            "status: pending-approval",
            "packet: `cowork/packets/TASK-TEST.md`",
            "review: `cowork/reviews/TASK-TEST-review.md`",
            "- next_step: reviewer reads the review and creates `cowork/approvals/<task-id>.ok` when approved",
        ],
    )

    assert "task: `TASK-TEST`" in message
    assert "stage: `review-ready`" in message
    assert "status: pending-approval" in message
    assert "packet: `cowork/packets/TASK-TEST.md`" in message
    assert "review: `cowork/reviews/TASK-TEST-review.md`" in message
    assert "approval: create `cowork/approvals/<task-id>.ok`" in message
    assert "slack approve: `/isoser-approve TASK-TEST inbox`" in message


def test_startup_warning_messages_warns_when_slack_webhook_missing(monkeypatch) -> None:
    monkeypatch.setattr(cowork_watcher, "SLACK_WEBHOOK_URL", "")

    warnings = cowork_watcher.startup_warning_messages()

    assert len(warnings) == 1
    assert "SLACK_WEBHOOK_URL" in warnings[0]
