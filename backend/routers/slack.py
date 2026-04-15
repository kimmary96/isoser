from __future__ import annotations

import hashlib
import hmac
import os
import time
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import PlainTextResponse


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


@router.post("/commands/cowork-approve", response_class=PlainTextResponse)
async def slack_cowork_approve(request: Request) -> PlainTextResponse:
    body = await request.body()
    _verify_slack_signature(
        body=body,
        timestamp=request.headers.get("X-Slack-Request-Timestamp"),
        signature=request.headers.get("X-Slack-Signature"),
    )

    form = await request.form()
    if str(form.get("ssl_check", "")).strip() == "1":
        return PlainTextResponse("ok")

    allowed_user_ids = _get_allowed_user_ids()
    if not allowed_user_ids:
        raise HTTPException(status_code=503, detail="SLACK_APPROVER_USER_IDS is not configured")

    user_id = str(form.get("user_id", "")).strip()
    user_name = str(form.get("user_name", "")).strip()
    if user_id not in allowed_user_ids:
        raise HTTPException(status_code=403, detail="Slack user is not allowed to approve")

    task_id, target = _parse_command_text(str(form.get("text", "")))
    packet_path = _packet_path_for(task_id)
    review_path = _review_path_for(task_id)

    if not packet_path.exists():
        raise HTTPException(status_code=404, detail=f"Packet not found for {task_id}")
    if not review_path.exists():
        raise HTTPException(status_code=409, detail=f"Review not found for {task_id}")
    if _packet_needs_review(packet_path, review_path):
        raise HTTPException(status_code=409, detail=f"Review is stale for {task_id}")
    if _promoted_dispatch_path_for(task_id).exists():
        return PlainTextResponse(f"{task_id} is already promoted.")

    approval_path = _write_approval_marker(
        task_id=task_id,
        target=target,
        user_id=user_id,
        user_name=user_name,
    )
    return PlainTextResponse(
        f"Approved {task_id} for {target}. Marker created at {approval_path.relative_to(REPO_ROOT).as_posix()}."
    )
