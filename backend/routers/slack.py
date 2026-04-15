from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
from pathlib import Path
from urllib import error as urllib_error
from urllib import request as urllib_request

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from fastapi.responses import JSONResponse, PlainTextResponse


router = APIRouter(prefix="/slack", tags=["slack"])

REPO_ROOT = Path(__file__).resolve().parents[2]
COWORK_PACKETS_DIR = REPO_ROOT / "cowork" / "packets"
COWORK_REVIEWS_DIR = REPO_ROOT / "cowork" / "reviews"
COWORK_APPROVALS_DIR = REPO_ROOT / "cowork" / "approvals"
COWORK_DISPATCH_DIR = REPO_ROOT / "cowork" / "dispatch"
SLACK_REQUEST_TOLERANCE_SECONDS = 60 * 5


def _get_signing_secret() -> str:
    return os.getenv("SLACK_SIGNING_SECRET", "").strip()


def _get_allowed_user_ids() -> set[str]:
    raw = os.getenv("SLACK_APPROVER_USER_IDS", "").strip()
    return {part.strip() for part in raw.split(",") if part.strip()}


def _verify_slack_signature(
    *,
    body: bytes,
    timestamp: str | None,
    signature: str | None,
) -> None:
    signing_secret = _get_signing_secret()
    if not signing_secret:
        raise HTTPException(status_code=503, detail="SLACK_SIGNING_SECRET is not configured")

    if not timestamp or not signature:
        raise HTTPException(status_code=401, detail="Missing Slack signature headers")

    try:
        request_ts = int(timestamp)
    except ValueError as error:
        raise HTTPException(status_code=401, detail="Invalid Slack timestamp") from error

    if abs(int(time.time()) - request_ts) > SLACK_REQUEST_TOLERANCE_SECONDS:
        raise HTTPException(status_code=401, detail="Expired Slack request")

    base_string = f"v0:{timestamp}:{body.decode('utf-8')}"
    expected_signature = "v0=" + hmac.new(
        signing_secret.encode("utf-8"),
        base_string.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected_signature, signature):
        raise HTTPException(status_code=401, detail="Invalid Slack signature")


def _parse_command_text(raw_text: str) -> tuple[str, str]:
    parts = [part.strip() for part in raw_text.split() if part.strip()]
    if not parts:
        raise HTTPException(
            status_code=400,
            detail="Usage: /isoser-approve <TASK-ID> [inbox|remote]",
        )

    task_id = parts[0]
    target = "inbox"
    if len(parts) >= 2:
        candidate = parts[1].lower()
        if candidate not in {"inbox", "remote"}:
            raise HTTPException(
                status_code=400,
                detail="Target must be inbox or remote",
            )
        target = candidate
    return task_id, target


def _packet_path_for(task_id: str) -> Path:
    return COWORK_PACKETS_DIR / f"{task_id}.md"


def _review_path_for(task_id: str) -> Path:
    return COWORK_REVIEWS_DIR / f"{task_id}-review.md"


def _approval_path_for(task_id: str) -> Path:
    return COWORK_APPROVALS_DIR / f"{task_id}.ok"


def _promoted_dispatch_path_for(task_id: str) -> Path:
    return COWORK_DISPATCH_DIR / f"{task_id}-promoted.md"


def _rejected_dispatch_path_for(task_id: str) -> Path:
    return COWORK_DISPATCH_DIR / f"{task_id}-review-rejected.md"


def _packet_needs_review(packet_path: Path, review_path: Path) -> bool:
    if not review_path.exists():
        return True
    return packet_path.stat().st_mtime > review_path.stat().st_mtime


def _write_approval_marker(*, task_id: str, target: str, user_id: str, user_name: str) -> Path:
    approval_path = _approval_path_for(task_id)
    body = "\n".join(
        [
            f"approved_by: slack:{user_id}",
            f"approved_by_name: {user_name or user_id}",
            f"approved_at: {time.strftime('%Y-%m-%dT%H:%M:%S%z')}",
            f"target: {target}",
            "source: slack-slash-command",
        ]
    )
    approval_path.write_text(body.rstrip() + "\n", encoding="utf-8")
    return approval_path


def _slack_message(message: str, status_code: int = 200) -> PlainTextResponse:
    return PlainTextResponse(message, status_code=status_code)


def _slack_interactive_message(
    message: str,
    *,
    replace_original: bool = False,
    response_type: str = "ephemeral",
) -> JSONResponse:
    return JSONResponse(
        {
            "response_type": response_type,
            "replace_original": replace_original,
            "text": message,
        }
    )


def _post_to_slack_response_url(
    response_url: str,
    *,
    message: str,
    replace_original: bool = False,
    response_type: str = "ephemeral",
) -> None:
    payload = {
        "response_type": response_type,
        "replace_original": replace_original,
        "text": message,
    }
    request = urllib_request.Request(
        response_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib_request.urlopen(request, timeout=10) as response:
            response.read()
    except (urllib_error.URLError, TimeoutError):
        # Slack follow-up failure should not break the original approval flow.
        return


def _format_action_result(*, title: str, task_id: str, lines: list[str]) -> str:
    body = [title, "", f"- 작업: `{task_id}`", *lines]
    return "\n".join(body)


def _handle_approval_action(*, task_id: str, target: str, user_id: str, user_name: str) -> str:
    packet_path = _packet_path_for(task_id)
    review_path = _review_path_for(task_id)
    target_label = "원격 큐" if target == "remote" else "로컬 inbox"

    if not packet_path.exists():
        return _format_action_result(
            title="승인 처리 실패",
            task_id=task_id,
            lines=["- 사유: packet 파일을 찾지 못했습니다."],
        )
    if not review_path.exists():
        return _format_action_result(
            title="승인 처리 실패",
            task_id=task_id,
            lines=["- 사유: review 파일을 찾지 못했습니다."],
        )
    if _packet_needs_review(packet_path, review_path):
        return _format_action_result(
            title="승인 처리 실패",
            task_id=task_id,
            lines=["- 사유: review가 stale 상태입니다.", "- 조치: review를 다시 생성한 뒤 승인하세요."],
        )
    if _promoted_dispatch_path_for(task_id).exists():
        return _format_action_result(
            title="승인 생략",
            task_id=task_id,
            lines=["- 상태: 이미 승격된 작업입니다."],
        )

    approval_path = _write_approval_marker(
        task_id=task_id,
        target=target,
        user_id=user_id,
        user_name=user_name,
    )
    return _format_action_result(
        title="승인 처리 완료",
        task_id=task_id,
        lines=[
            f"- 대상 큐: {target_label}",
            f"- 승인 파일: `{approval_path.relative_to(REPO_ROOT).as_posix()}`",
        ],
    )


def _write_rejection_dispatch(*, task_id: str, user_id: str, user_name: str) -> Path:
    dispatch_path = _rejected_dispatch_path_for(task_id)
    body = "\n".join(
        [
            f"# Dispatch: {task_id}",
            "",
            "stage: review-rejected",
            "status: rejected",
            f"packet: `cowork/packets/{task_id}.md`",
            f"review: `cowork/reviews/{task_id}-review.md`",
            f"created_at: `{time.strftime('%Y-%m-%dT%H:%M:%S%z')}`",
            f"- rejected_by: `slack:{user_name or user_id}`",
            "- note: reviewer rejected promotion from Slack action buttons",
        ]
    )
    dispatch_path.write_text(body.rstrip() + "\n", encoding="utf-8")
    return dispatch_path


def _handle_reject_action(*, task_id: str, user_id: str, user_name: str) -> str:
    packet_path = _packet_path_for(task_id)
    if not packet_path.exists():
        return _format_action_result(
            title="거절 처리 실패",
            task_id=task_id,
            lines=["- 사유: packet 파일을 찾지 못했습니다."],
        )
    dispatch_path = _write_rejection_dispatch(task_id=task_id, user_id=user_id, user_name=user_name)
    return _format_action_result(
        title="거절 처리 완료",
        task_id=task_id,
        lines=[f"- 기록 파일: `{dispatch_path.relative_to(REPO_ROOT).as_posix()}`"],
    )


def _resolve_slack_interactive_action(
    *,
    action_id: str,
    value: dict[str, object],
    user_id: str,
    user_name: str,
) -> str:
    task_id = str(value.get("task_id", "")).strip()
    target = str(value.get("target", "inbox")).strip()
    if not task_id:
        return "Task ID is missing from the Slack action."

    if action_id == "cowork_reject":
        return _handle_reject_action(task_id=task_id, user_id=user_id, user_name=user_name)

    if action_id in {"cowork_approve_inbox", "cowork_approve_remote"}:
        if target not in {"inbox", "remote"}:
            return "Target must be inbox or remote."
        return _handle_approval_action(task_id=task_id, target=target, user_id=user_id, user_name=user_name)

    return f"Unsupported Slack action `{action_id}`."


@router.post("/commands/cowork-approve", response_class=PlainTextResponse)
async def slack_cowork_approve(request: Request) -> PlainTextResponse:
    body = await request.body()
    try:
        _verify_slack_signature(
            body=body,
            timestamp=request.headers.get("X-Slack-Request-Timestamp"),
            signature=request.headers.get("X-Slack-Signature"),
        )
    except HTTPException as error:
        if error.status_code == 401:
            return _slack_message(
                "Slack signature verification failed. Check `SLACK_SIGNING_SECRET` and the Request URL.",
                status_code=200,
            )
        return _slack_message(str(error.detail), status_code=200)

    form = await request.form()
    if str(form.get("ssl_check", "")).strip() == "1":
        return PlainTextResponse("ok")

    allowed_user_ids = _get_allowed_user_ids()
    if not allowed_user_ids:
        return _slack_message(
            "Approval is not configured. Set `SLACK_APPROVER_USER_IDS` in backend env and restart the backend."
        )

    user_id = str(form.get("user_id", "")).strip()
    user_name = str(form.get("user_name", "")).strip()
    if user_id not in allowed_user_ids:
        return _slack_message(
            f"Slack user `{user_id}` is not allowed to approve. Add it to `SLACK_APPROVER_USER_IDS` and retry."
        )

    try:
        task_id, target = _parse_command_text(str(form.get("text", "")))
    except HTTPException as error:
        return _slack_message(str(error.detail))
    return _slack_message(
        _handle_approval_action(task_id=task_id, target=target, user_id=user_id, user_name=user_name)
    )


@router.post("/interactivity/cowork-review")
async def slack_cowork_interactivity(request: Request, background_tasks: BackgroundTasks) -> JSONResponse:
    body = await request.body()
    try:
        _verify_slack_signature(
            body=body,
            timestamp=request.headers.get("X-Slack-Request-Timestamp"),
            signature=request.headers.get("X-Slack-Signature"),
        )
    except HTTPException as error:
        if error.status_code == 401:
            return _slack_interactive_message(
                "Slack signature verification failed. Check `SLACK_SIGNING_SECRET` and the Interactivity Request URL."
            )
        return _slack_interactive_message(str(error.detail))

    form = await request.form()
    payload_raw = str(form.get("payload", "")).strip()
    if not payload_raw:
        return _slack_interactive_message("Missing interactive payload.")

    try:
        payload = json.loads(payload_raw)
    except json.JSONDecodeError:
        return _slack_interactive_message("Invalid interactive payload.")

    allowed_user_ids = _get_allowed_user_ids()
    if not allowed_user_ids:
        return _slack_interactive_message(
            "Approval is not configured. Set `SLACK_APPROVER_USER_IDS` in backend env and restart the backend."
        )

    user = payload.get("user") or {}
    user_id = str(user.get("id", "")).strip()
    user_name = str(user.get("username", "") or user.get("name", "")).strip()
    if user_id not in allowed_user_ids:
        return _slack_interactive_message(
            f"Slack user `{user_id}` is not allowed to approve. Add it to `SLACK_APPROVER_USER_IDS` and retry."
        )

    actions = payload.get("actions") or []
    if not actions:
        return _slack_interactive_message("No Slack action was provided.")

    action = actions[0]
    action_id = str(action.get("action_id", "")).strip()
    value_raw = str(action.get("value", "")).strip()
    try:
        value = json.loads(value_raw) if value_raw else {}
    except json.JSONDecodeError:
        return _slack_interactive_message("Invalid action value.")

    response_url = str(payload.get("response_url", "")).strip()
    if response_url:
        background_tasks.add_task(
            _post_to_slack_response_url,
            response_url,
            message=_resolve_slack_interactive_action(
                action_id=action_id,
                value=value,
                user_id=user_id,
                user_name=user_name,
            ),
            response_type="in_channel",
        )
        return _slack_interactive_message("승인 요청을 처리 중입니다. 잠시 후 결과를 다시 보냅니다.")

    return _slack_interactive_message(
        _resolve_slack_interactive_action(
            action_id=action_id,
            value=value,
            user_id=user_id,
            user_name=user_name,
        )
    )
