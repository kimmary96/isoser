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


def test_handle_approval_consumes_remote_shared_request(tmp_path: Path, monkeypatch) -> None:
    packets_dir = tmp_path / "packets"
    reviews_dir = tmp_path / "reviews"
    dispatch_dir = tmp_path / "dispatch"
    approvals_dir = tmp_path / "approvals"
    inbox_dir = tmp_path / "inbox"
    remote_dir = tmp_path / "remote"

    for directory in [packets_dir, reviews_dir, dispatch_dir, approvals_dir, inbox_dir, remote_dir]:
        directory.mkdir(parents=True, exist_ok=True)

    packet = packets_dir / "TASK-TEST-REMOTE-APPROVAL.md"
    packet.write_text(
        "\n".join(
            [
                "---",
                "id: TASK-TEST-REMOTE-APPROVAL",
                "status: queued",
                "type: feature",
                "title: Shared approval queue test",
                "planned_at: 2026-04-15T00:00:00+09:00",
                "planned_against_commit: abc123",
                "---",
            ]
        ),
        encoding="utf-8",
    )
    review = reviews_dir / "TASK-TEST-REMOTE-APPROVAL-review.md"
    review.write_text("# ready review\n", encoding="utf-8")

    consumed: list[tuple[str, str, str]] = []

    monkeypatch.setattr(cowork_watcher, "COWORK_PACKETS_DIR", str(packets_dir))
    monkeypatch.setattr(cowork_watcher, "COWORK_REVIEWS_DIR", str(reviews_dir))
    monkeypatch.setattr(cowork_watcher, "COWORK_DISPATCH_DIR", str(dispatch_dir))
    monkeypatch.setattr(cowork_watcher, "COWORK_APPROVALS_DIR", str(approvals_dir))
    monkeypatch.setattr(cowork_watcher, "TASKS_INBOX_DIR", str(inbox_dir))
    monkeypatch.setattr(cowork_watcher, "TASKS_REMOTE_DIR", str(remote_dir))
    monkeypatch.setattr(
        cowork_watcher,
        "fetch_requested_remote_approval",
        lambda task_id: {
            "task_id": task_id,
            "target": "inbox",
            "approved_by": "slack:U123",
            "approved_by_name": "tester",
            "approved_at": "2026-04-15T17:30:00+09:00",
            "source": "slack-interactivity",
        },
    )
    monkeypatch.setattr(
        cowork_watcher,
        "mark_remote_approval_state",
        lambda task_id, *, state, note: consumed.append((task_id, state, note)),
    )

    cowork_watcher.handle_approval(str(packet))

    assert (inbox_dir / "TASK-TEST-REMOTE-APPROVAL.md").exists()
    assert (approvals_dir / "TASK-TEST-REMOTE-APPROVAL.ok").exists()
    assert consumed == [
        ("TASK-TEST-REMOTE-APPROVAL", "consumed", "promoted to inbox"),
    ]


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


def test_review_ready_resets_old_approval_and_promoted_state(tmp_path: Path, monkeypatch) -> None:
    packets_dir = tmp_path / "packets"
    reviews_dir = tmp_path / "reviews"
    dispatch_dir = tmp_path / "dispatch"
    approvals_dir = tmp_path / "approvals"
    inbox_dir = tmp_path / "inbox"
    remote_dir = tmp_path / "remote"

    for directory in [packets_dir, reviews_dir, dispatch_dir, approvals_dir, inbox_dir, remote_dir]:
        directory.mkdir(parents=True, exist_ok=True)

    packet = packets_dir / "TASK-TEST-RESET.md"
    packet.write_text(
        "\n".join(
            [
                "---",
                "id: TASK-TEST-RESET",
                "status: queued",
                "type: feature",
                "title: Reset stale approval state",
                "planned_at: 2026-04-15T00:00:00+09:00",
                "planned_against_commit: abc123",
                "---",
            ]
        ),
        encoding="utf-8",
    )

    review = reviews_dir / "TASK-TEST-RESET-review.md"
    review.write_text("# ready review\n", encoding="utf-8")
    approval = approvals_dir / "TASK-TEST-RESET.ok"
    approval.write_text("target: inbox\n", encoding="utf-8")
    promoted = dispatch_dir / "TASK-TEST-RESET-promoted.md"
    promoted.write_text("stage: promoted\n", encoding="utf-8")

    monkeypatch.setattr(cowork_watcher, "COWORK_PACKETS_DIR", str(packets_dir))
    monkeypatch.setattr(cowork_watcher, "COWORK_REVIEWS_DIR", str(reviews_dir))
    monkeypatch.setattr(cowork_watcher, "COWORK_DISPATCH_DIR", str(dispatch_dir))
    monkeypatch.setattr(cowork_watcher, "COWORK_APPROVALS_DIR", str(approvals_dir))
    monkeypatch.setattr(cowork_watcher, "TASKS_INBOX_DIR", str(inbox_dir))
    monkeypatch.setattr(cowork_watcher, "TASKS_REMOTE_DIR", str(remote_dir))
    monkeypatch.setattr(cowork_watcher, "current_head", lambda: "abc123")
    monkeypatch.setattr(cowork_watcher, "run_codex_review", lambda *_args, **_kwargs: (0, None))
    monkeypatch.setattr(cowork_watcher, "append_review_metadata", lambda *args, **kwargs: None)
    monkeypatch.setattr(cowork_watcher, "notify_slack_for_dispatch", lambda **kwargs: None)

    stale_timestamp = time.time() - 10
    os.utime(review, (stale_timestamp, stale_timestamp))
    packet.touch()

    cowork_watcher.handle_packet_review(str(packet))

    assert not approval.exists()
    assert not promoted.exists()
    assert (dispatch_dir / "TASK-TEST-RESET-review-ready.md").exists()


def test_format_slack_dispatch_message_contains_core_fields(monkeypatch) -> None:
    monkeypatch.setattr(cowork_watcher, "packet_title_for", lambda task_id: "테스트 비교 페이지")
    monkeypatch.setattr(cowork_watcher, "review_snapshot_for", lambda task_id: [
        "Not ready for promotion.",
        "- Frontmatter completeness: complete. Required fields `id`, `status`, `type`, `title`, `planned_at`, `planned_against_commit` are present.",
        "- Drift risk: material in the touched area even though commit drift is zero.",
    ])

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
            "- supersedes_previous_review_ready: `2026-04-15T17:00:00`",
        ],
    )

    assert "cowork 검토 알림" in message
    assert "*작업*: `TASK-TEST`" in message
    assert "*단계*: 검토 준비" in message
    assert "*제목*: 테스트 비교 페이지" in message
    assert "*상태*: 승인 대기" in message
    assert "*판정*" in message
    assert "아직 승격 준비가 되지 않았습니다." in message
    assert "*핵심 확인사항*" in message
    assert "1. 프론트매터 완성도:" in message
    assert "2. 드리프트 위험:" in message
    assert "*패킷*" not in message
    assert "*리뷰*" not in message
    assert "승인 방법" not in message
    assert "*최신본 안내*" in message
    assert "이 알림은 이전 검토 준비 메시지를 대체합니다." in message


def test_build_slack_dispatch_payload_adds_buttons_for_review_ready() -> None:
    payload = cowork_watcher.build_slack_dispatch_payload(
        task_id="TASK-TEST",
        stage="review-ready",
        lines=[
            "# Dispatch: TASK-TEST",
            "",
            "stage: review-ready",
            "status: pending-approval",
            "packet: `cowork/packets/TASK-TEST.md`",
            "review: `cowork/reviews/TASK-TEST-review.md`",
        ],
    )

    assert "blocks" in payload
    blocks = payload["blocks"]
    assert isinstance(blocks, list)
    assert len(blocks) == 3
    actions = blocks[2]["elements"]
    action_ids = [element["action_id"] for element in actions]
    assert action_ids == ["cowork_approve_inbox", "cowork_approve_remote", "cowork_reject"]


def test_build_slack_dispatch_payload_threads_followup_stage() -> None:
    payload = cowork_watcher.build_slack_dispatch_payload(
        task_id="TASK-TEST",
        stage="promoted",
        lines=[
            "# Dispatch: TASK-TEST",
            "",
            "stage: promoted",
            "target: `inbox`",
            "- slack_thread_ts: `12345.6789`",
            "- note: packet copied from cowork scratch space into an execution queue",
        ],
    )

    assert payload["thread_ts"] == "12345.6789"
    assert payload["reply_broadcast"] is False


def test_localize_review_snapshot_line_reduces_english_mixture() -> None:
    line = (
        "Not ready for promotion. Frontmatter is complete and `planned_against_commit` "
        "matches current `HEAD`, so this is not blocked by packet metadata or general repo drift. "
        "The packet is still execution-risky because its data-shape, category, deduplication, "
        "and sync-path assumptions do not match the current repository closely enough."
    )

    localized = cowork_watcher.localize_review_snapshot_line(line)

    assert "아직 승격 준비가 되지 않았습니다." in localized
    assert "프론트매터는 완전합니다" in localized
    assert "데이터 형태, 카테고리, 중복 제거, 동기화 경로 가정이" in localized
    assert "The packet is still execution-risky" not in localized


def test_write_local_approval_from_remote_preserves_slack_thread_metadata(tmp_path: Path, monkeypatch) -> None:
    approvals_dir = tmp_path / "approvals"
    approvals_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(cowork_watcher, "COWORK_APPROVALS_DIR", str(approvals_dir))

    approval_path = cowork_watcher.write_local_approval_from_remote(
        "TASK-TEST",
        {
            "approved_by": "slack:U123",
            "approved_by_name": "tester",
            "approved_at": "2026-04-15T18:00:00+09:00",
            "target": "inbox",
            "source": "slack-interactivity",
            "slack_message_ts": "12345.6789",
            "slack_channel_id": "C123",
        },
    )

    text = Path(approval_path).read_text(encoding="utf-8")
    assert "slack_message_ts: 12345.6789" in text
    assert "slack_channel_id: C123" in text


def test_startup_warning_messages_warns_when_slack_webhook_missing(monkeypatch) -> None:
    monkeypatch.setattr(cowork_watcher, "SLACK_WEBHOOK_URL", "")

    warnings = cowork_watcher.startup_warning_messages()

    assert len(warnings) == 1
    assert "SLACK_WEBHOOK_URL" in warnings[0]
