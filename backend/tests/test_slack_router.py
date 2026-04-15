from __future__ import annotations

import hashlib
import hmac
import json
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


def test_slack_cowork_approve_writes_shared_approval_request(client, tmp_path, monkeypatch) -> None:
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
    monkeypatch.setenv("SLACK_SIGNING_SECRET", "test-secret")
    monkeypatch.setenv("SLACK_APPROVER_USER_IDS", "U123")
    created: dict[str, str] = {}

    def fake_write_approval_request(*, task_id: str, target: str, user_id: str, user_name: str, source: str) -> str:
        created["task_id"] = task_id
        created["target"] = target
        created["user_id"] = user_id
        created["user_name"] = user_name
        created["source"] = source
        return "cowork_approvals:TASK-TEST"

    monkeypatch.setattr(slack, "_write_approval_request", fake_write_approval_request)

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
    assert "승인 처리 완료" in response.text
    assert "원격 큐" in response.text
    assert "cowork_approvals:TASK-TEST" in response.text
    assert created == {
        "task_id": "TASK-TEST",
        "target": "remote",
        "user_id": "U123",
        "user_name": "tester",
        "source": "slack-interactivity",
    }


def test_slack_cowork_approve_shows_user_id_when_not_allowlisted(client, tmp_path, monkeypatch) -> None:
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
    monkeypatch.setenv("SLACK_SIGNING_SECRET", "test-secret")
    monkeypatch.setenv("SLACK_APPROVER_USER_IDS", "U999")

    payload = {
        "user_id": "U123",
        "user_name": "tester",
        "text": "TASK-TEST",
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
    assert "U123" in response.text


def test_slack_cowork_interactivity_approves_remote(client, tmp_path, monkeypatch) -> None:
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
    monkeypatch.setenv("SLACK_SIGNING_SECRET", "test-secret")
    monkeypatch.setenv("SLACK_APPROVER_USER_IDS", "U123")
    monkeypatch.setattr(
        slack,
        "_write_approval_request",
        lambda **kwargs: "cowork_approvals:TASK-TEST",
    )

    payload = {
        "user": {"id": "U123", "username": "tester"},
        "actions": [
            {
                "action_id": "cowork_approve_remote",
                "value": json.dumps({"task_id": "TASK-TEST", "target": "remote"}),
            }
        ],
    }
    body = urlencode({"payload": json.dumps(payload)}).encode("utf-8")
    timestamp = str(int(time.time()))
    signature = _build_signature("test-secret", timestamp, body)

    response = client.post(
        "/slack/interactivity/cowork-review",
        content=body,
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "X-Slack-Request-Timestamp": timestamp,
            "X-Slack-Signature": signature,
        },
    )

    assert response.status_code == 200
    assert "승인 처리 완료" in response.text
    assert "원격 큐" in response.text
    assert "cowork_approvals:TASK-TEST" in response.text


def test_slack_cowork_interactivity_rejects_review(client, tmp_path, monkeypatch) -> None:
    packets_dir = tmp_path / "cowork" / "packets"
    reviews_dir = tmp_path / "cowork" / "reviews"
    approvals_dir = tmp_path / "cowork" / "approvals"
    dispatch_dir = tmp_path / "cowork" / "dispatch"

    for directory in [packets_dir, reviews_dir, approvals_dir, dispatch_dir]:
        directory.mkdir(parents=True, exist_ok=True)

    packet = packets_dir / "TASK-TEST.md"
    packet.write_text("---\nid: TASK-TEST\nplanned_at: 2026-04-15T10:00:00+09:00\nplanned_against_commit: abc123\nstatus: draft\ntype: feature\ntitle: test\n---\n", encoding="utf-8")

    monkeypatch.setattr(slack, "COWORK_PACKETS_DIR", packets_dir)
    monkeypatch.setattr(slack, "COWORK_REVIEWS_DIR", reviews_dir)
    monkeypatch.setattr(slack, "COWORK_DISPATCH_DIR", dispatch_dir)
    monkeypatch.setenv("SLACK_SIGNING_SECRET", "test-secret")
    monkeypatch.setenv("SLACK_APPROVER_USER_IDS", "U123")

    payload = {
        "user": {"id": "U123", "username": "tester"},
        "actions": [
            {
                "action_id": "cowork_reject",
                "value": json.dumps({"task_id": "TASK-TEST"}),
            }
        ],
    }
    body = urlencode({"payload": json.dumps(payload)}).encode("utf-8")
    timestamp = str(int(time.time()))
    signature = _build_signature("test-secret", timestamp, body)

    response = client.post(
        "/slack/interactivity/cowork-review",
        content=body,
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "X-Slack-Request-Timestamp": timestamp,
            "X-Slack-Signature": signature,
        },
    )

    assert response.status_code == 200
    assert "거절 처리 완료" in response.text
    assert (dispatch_dir / "TASK-TEST-review-rejected.md").exists()


def test_slack_cowork_interactivity_acknowledges_fast_when_response_url_present(
    client, tmp_path, monkeypatch
) -> None:
    packets_dir = tmp_path / "cowork" / "packets"
    reviews_dir = tmp_path / "cowork" / "reviews"
    approvals_dir = tmp_path / "cowork" / "approvals"
    dispatch_dir = tmp_path / "cowork" / "dispatch"

    for directory in [packets_dir, reviews_dir, approvals_dir, dispatch_dir]:
        directory.mkdir(parents=True, exist_ok=True)

    packet = packets_dir / "TASK-TEST.md"
    packet.write_text(
        "---\nid: TASK-TEST\nplanned_at: 2026-04-15T10:00:00+09:00\nplanned_against_commit: abc123\nstatus: draft\ntype: feature\ntitle: test\n---\n",
        encoding="utf-8",
    )
    review = reviews_dir / "TASK-TEST-review.md"
    review.write_text("# latest review\n", encoding="utf-8")
    review.touch()
    packet.touch()
    review.touch()

    monkeypatch.setattr(slack, "COWORK_PACKETS_DIR", packets_dir)
    monkeypatch.setattr(slack, "COWORK_REVIEWS_DIR", reviews_dir)
    monkeypatch.setenv("SLACK_SIGNING_SECRET", "test-secret")
    monkeypatch.setenv("SLACK_APPROVER_USER_IDS", "U123")
    monkeypatch.setattr(
        slack,
        "_write_approval_request",
        lambda **kwargs: "cowork_approvals:TASK-TEST",
    )

    posted: dict[str, str] = {}

    def fake_post_to_response_url(
        response_url: str,
        *,
        message: str,
        replace_original: bool = False,
        response_type: str = "ephemeral",
    ) -> None:
        posted["response_url"] = response_url
        posted["message"] = message
        posted["response_type"] = response_type

    monkeypatch.setattr(slack, "_post_to_slack_response_url", fake_post_to_response_url)

    payload = {
        "user": {"id": "U123", "username": "tester"},
        "response_url": "https://example.com/slack-response",
        "actions": [
            {
                "action_id": "cowork_approve_inbox",
                "value": json.dumps({"task_id": "TASK-TEST", "target": "inbox"}),
            }
        ],
    }
    body = urlencode({"payload": json.dumps(payload)}).encode("utf-8")
    timestamp = str(int(time.time()))
    signature = _build_signature("test-secret", timestamp, body)

    response = client.post(
        "/slack/interactivity/cowork-review",
        content=body,
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "X-Slack-Request-Timestamp": timestamp,
            "X-Slack-Signature": signature,
        },
    )

    assert response.status_code == 200
    assert "처리 중" in response.text
    assert posted["response_url"] == "https://example.com/slack-response"
    assert posted["response_type"] == "in_channel"
    assert "승인 처리 완료" in posted["message"]
    assert "cowork_approvals:TASK-TEST" in posted["message"]
