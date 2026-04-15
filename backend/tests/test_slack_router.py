from __future__ import annotations

import hashlib
import hmac
import time
from urllib.parse import urlencode

from routers import slack


def _build_signature(secret: str, timestamp: str, body: bytes) -> str:
    base_string = f"v0:{timestamp}:{body.decode('utf-8')}"
    return "v0=" + hmac.new(
        secret.encode("utf-8"),
        base_string.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def test_parse_command_text_defaults_to_inbox() -> None:
    task_id, target = slack._parse_command_text("TASK-TEST")

    assert task_id == "TASK-TEST"
    assert target == "inbox"


def test_parse_command_text_reads_remote_target() -> None:
    task_id, target = slack._parse_command_text("TASK-TEST remote")

    assert task_id == "TASK-TEST"
    assert target == "remote"


def test_slack_cowork_approve_creates_approval_marker(client, tmp_path, monkeypatch) -> None:
    packets_dir = tmp_path / "cowork" / "packets"
    reviews_dir = tmp_path / "cowork" / "reviews"
    approvals_dir = tmp_path / "cowork" / "approvals"
    dispatch_dir = tmp_path / "cowork" / "dispatch"

    for directory in [packets_dir, reviews_dir, approvals_dir, dispatch_dir]:
        directory.mkdir(parents=True, exist_ok=True)

    packet = packets_dir / "TASK-TEST.md"
    packet.write_text("---\nid: TASK-TEST\nplanned_at: 2026-04-15T10:00:00+09:00\nplanned_against_commit: abc123\nstatus: draft\ntype: feature\ntitle: test\n---\n", encoding="utf-8")
    review = reviews_dir / "TASK-TEST-review.md"
    review.write_text("# latest review\n", encoding="utf-8")
    review.touch()
    packet.touch()
    review.touch()

    monkeypatch.setattr(slack, "COWORK_PACKETS_DIR", packets_dir)
    monkeypatch.setattr(slack, "COWORK_REVIEWS_DIR", reviews_dir)
    monkeypatch.setattr(slack, "COWORK_APPROVALS_DIR", approvals_dir)
    monkeypatch.setattr(slack, "COWORK_DISPATCH_DIR", dispatch_dir)
    monkeypatch.setenv("SLACK_SIGNING_SECRET", "test-secret")
    monkeypatch.setenv("SLACK_APPROVER_USER_IDS", "U123")

    payload = {
        "user_id": "U123",
        "user_name": "tester",
        "text": "TASK-TEST remote",
    }
    body = urlencode(payload).encode("utf-8")
    timestamp = str(int(time.time()))
    signature = _build_signature("test-secret", timestamp, body)

    response = client.post(
        "/slack/commands/cowork-approve",
        content=body,
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "X-Slack-Request-Timestamp": timestamp,
            "X-Slack-Signature": signature,
        },
    )

    assert response.status_code == 200
    assert "Approved TASK-TEST for remote" in response.text
    approval_path = approvals_dir / "TASK-TEST.ok"
    assert approval_path.exists()
    approval_body = approval_path.read_text(encoding="utf-8")
    assert "approved_by: slack:U123" in approval_body
    assert "target: remote" in approval_body


def test_slack_cowork_approve_rejects_stale_review(client, tmp_path, monkeypatch) -> None:
    packets_dir = tmp_path / "cowork" / "packets"
    reviews_dir = tmp_path / "cowork" / "reviews"
    approvals_dir = tmp_path / "cowork" / "approvals"
    dispatch_dir = tmp_path / "cowork" / "dispatch"

    for directory in [packets_dir, reviews_dir, approvals_dir, dispatch_dir]:
        directory.mkdir(parents=True, exist_ok=True)

    packet = packets_dir / "TASK-STALE.md"
    packet.write_text("---\nid: TASK-STALE\nplanned_at: 2026-04-15T10:00:00+09:00\nplanned_against_commit: abc123\nstatus: draft\ntype: feature\ntitle: stale\n---\n", encoding="utf-8")
    review = reviews_dir / "TASK-STALE-review.md"
    review.write_text("# old review\n", encoding="utf-8")
    stale_timestamp = time.time() - 10
    review.touch()
    import os
    os.utime(review, (stale_timestamp, stale_timestamp))
    packet.touch()

    monkeypatch.setattr(slack, "COWORK_PACKETS_DIR", packets_dir)
    monkeypatch.setattr(slack, "COWORK_REVIEWS_DIR", reviews_dir)
    monkeypatch.setattr(slack, "COWORK_APPROVALS_DIR", approvals_dir)
    monkeypatch.setattr(slack, "COWORK_DISPATCH_DIR", dispatch_dir)
    monkeypatch.setenv("SLACK_SIGNING_SECRET", "test-secret")
    monkeypatch.setenv("SLACK_APPROVER_USER_IDS", "U123")

    payload = {
        "user_id": "U123",
        "user_name": "tester",
        "text": "TASK-STALE",
    }
    body = urlencode(payload).encode("utf-8")
    timestamp = str(int(time.time()))
    signature = _build_signature("test-secret", timestamp, body)

    response = client.post(
        "/slack/commands/cowork-approve",
        content=body,
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "X-Slack-Request-Timestamp": timestamp,
            "X-Slack-Signature": signature,
        },
    )

    assert response.status_code == 409
    assert "Review is stale" in response.text
