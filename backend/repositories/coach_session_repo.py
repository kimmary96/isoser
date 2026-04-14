"""Supabase-backed repository for Coach AI session persistence."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping

import httpx
from fastapi import HTTPException

from utils.supabase_admin import build_service_headers, get_supabase_admin_settings

SELECT_COLUMNS = ",".join(
    [
        "id",
        "user_id",
        "job_title",
        "section_type",
        "activity_description",
        "iteration_count",
        "last_feedback",
        "last_suggestions",
        "selected_suggestion_index",
        "suggestion_type",
        "last_structure_diagnosis",
        "missing_elements",
        "created_at",
        "updated_at",
    ]
)


class CoachSessionRepoError(RuntimeError):
    """Raised when coach session persistence fails."""


@dataclass(slots=True)
class CoachSessionRecord:
    """Normalized coach session row."""

    id: str
    user_id: str
    job_title: str
    section_type: str
    activity_description: str
    iteration_count: int
    last_feedback: str | None
    last_suggestions: list[dict[str, Any]]
    selected_suggestion_index: int | None
    suggestion_type: str | None
    last_structure_diagnosis: dict[str, Any]
    missing_elements: list[str]
    created_at: str
    updated_at: str

    @classmethod
    def from_row(cls, row: Mapping[str, Any]) -> CoachSessionRecord:
        """Build a typed record from a Supabase row."""

        last_suggestions = row.get("last_suggestions")
        structure_diagnosis = row.get("last_structure_diagnosis")
        missing_elements = row.get("missing_elements")

        return cls(
            id=str(row["id"]),
            user_id=str(row["user_id"]),
            job_title=str(row.get("job_title") or ""),
            section_type=str(row.get("section_type") or ""),
            activity_description=str(row.get("activity_description") or ""),
            iteration_count=int(row.get("iteration_count") or 1),
            last_feedback=str(row["last_feedback"]) if row.get("last_feedback") is not None else None,
            last_suggestions=last_suggestions if isinstance(last_suggestions, list) else [],
            selected_suggestion_index=(
                int(row["selected_suggestion_index"])
                if row.get("selected_suggestion_index") is not None
                else None
            ),
            suggestion_type=str(row["suggestion_type"]) if row.get("suggestion_type") is not None else None,
            last_structure_diagnosis=(
                structure_diagnosis
                if isinstance(structure_diagnosis, dict)
                else {}
            ),
            missing_elements=missing_elements if isinstance(missing_elements, list) else [],
            created_at=str(row.get("created_at") or ""),
            updated_at=str(row.get("updated_at") or ""),
        )

    def restore_conversation(self) -> list[dict[str, str]]:
        """Rebuild the last coach exchange from the persisted session state."""

        history: list[dict[str, str]] = []
        if self.activity_description:
            history.append({"role": "user", "content": self.activity_description})
        if self.last_feedback:
            history.append({"role": "assistant", "content": self.last_feedback})
        return history


class CoachSessionRepo:
    """CRUD helpers for the `coach_sessions` Supabase table."""

    def __init__(
        self,
        *,
        supabase_url: str,
        service_role_key: str,
        timeout_seconds: float = 10.0,
    ) -> None:
        self._endpoint = f"{supabase_url.rstrip('/')}/rest/v1/coach_sessions"
        self._service_role_key = service_role_key
        self._timeout_seconds = timeout_seconds

    @classmethod
    def from_env(cls) -> CoachSessionRepo | None:
        """Create a repository instance from environment variables when configured."""

        try:
            settings = get_supabase_admin_settings()
        except HTTPException:
            return None

        return cls(
            supabase_url=settings.url,
            service_role_key=settings.service_role_key,
            timeout_seconds=settings.timeout_seconds,
        )

    def _headers(self, *, prefer: str | None = None) -> dict[str, str]:
        return build_service_headers(self._service_role_key, prefer=prefer)

    async def _request(
        self,
        method: str,
        *,
        params: Mapping[str, str] | None = None,
        payload: Mapping[str, Any] | None = None,
        prefer: str | None = None,
    ) -> Any:
        async with httpx.AsyncClient(timeout=self._timeout_seconds, trust_env=False) as client:
            response = await client.request(
                method,
                self._endpoint,
                params=params,
                json=payload,
                headers=self._headers(prefer=prefer),
            )

        if response.is_success:
            if not response.content:
                return None
            return response.json()

        detail = response.text
        try:
            body = response.json()
        except ValueError:
            body = None
        if isinstance(body, dict):
            detail = str(body.get("message") or body.get("hint") or body.get("details") or detail)

        raise CoachSessionRepoError(
            f"Supabase coach_sessions {method} failed ({response.status_code}): {detail}"
        )

    async def create_session(
        self,
        *,
        user_id: str,
        job_title: str,
        section_type: str,
        activity_description: str,
        session_id: str | None = None,
        selected_suggestion_index: int | None = None,
        suggestion_type: str | None = None,
    ) -> CoachSessionRecord:
        """Create a new coach session row."""

        payload: dict[str, Any] = {
            "user_id": user_id,
            "job_title": job_title,
            "section_type": section_type,
            "activity_description": activity_description,
            "iteration_count": 1,
            "last_feedback": None,
            "last_suggestions": [],
            "selected_suggestion_index": selected_suggestion_index,
            "suggestion_type": suggestion_type,
            "last_structure_diagnosis": {},
            "missing_elements": [],
        }
        if session_id:
            payload["id"] = session_id

        rows = await self._request(
            "POST",
            payload=payload,
            prefer="return=representation",
        )
        if not isinstance(rows, list) or not rows:
            raise CoachSessionRepoError("Supabase returned no coach session row on create")
        return CoachSessionRecord.from_row(rows[0])

    async def get_session(self, session_id: str, user_id: str) -> CoachSessionRecord | None:
        """Return a single session scoped to the given user."""

        rows = await self._request(
            "GET",
            params={
                "select": SELECT_COLUMNS,
                "id": f"eq.{session_id}",
                "user_id": f"eq.{user_id}",
                "limit": "1",
            },
        )
        if not isinstance(rows, list) or not rows:
            return None
        return CoachSessionRecord.from_row(rows[0])

    async def get_user_sessions(
        self,
        user_id: str,
        *,
        limit: int = 20,
    ) -> list[CoachSessionRecord]:
        """Return recent sessions for a user."""

        rows = await self._request(
            "GET",
            params={
                "select": SELECT_COLUMNS,
                "user_id": f"eq.{user_id}",
                "order": "updated_at.desc",
                "limit": str(limit),
            },
        )
        if not isinstance(rows, list):
            return []
        return [CoachSessionRecord.from_row(row) for row in rows]

    async def update_session(
        self,
        session_id: str,
        user_id: str,
        *,
        job_title: str,
        section_type: str,
        activity_description: str,
        iteration_count: int,
        last_feedback: str,
        last_suggestions: list[dict[str, Any]],
        selected_suggestion_index: int | None,
        suggestion_type: str | None,
        last_structure_diagnosis: dict[str, Any],
        missing_elements: list[str],
    ) -> CoachSessionRecord:
        """Update the latest session state after a coach response."""

        payload = {
            "job_title": job_title,
            "section_type": section_type,
            "activity_description": activity_description,
            "iteration_count": iteration_count,
            "last_feedback": last_feedback,
            "last_suggestions": last_suggestions,
            "selected_suggestion_index": selected_suggestion_index,
            "suggestion_type": suggestion_type,
            "last_structure_diagnosis": last_structure_diagnosis,
            "missing_elements": missing_elements,
        }

        rows = await self._request(
            "PATCH",
            params={
                "select": SELECT_COLUMNS,
                "id": f"eq.{session_id}",
                "user_id": f"eq.{user_id}",
            },
            payload=payload,
            prefer="return=representation",
        )
        if not isinstance(rows, list) or not rows:
            raise CoachSessionRepoError("Supabase returned no coach session row on update")
        return CoachSessionRecord.from_row(rows[0])

    async def restore_conversation(self, session_id: str, user_id: str) -> list[dict[str, str]]:
        """Restore the latest user/assistant exchange for a saved session."""

        session = await self.get_session(session_id, user_id)
        if session is None:
            return []
        return session.restore_conversation()


def get_coach_session_repo() -> CoachSessionRepo | None:
    """Return a repo instance when Supabase persistence is configured."""

    return CoachSessionRepo.from_env()


__all__ = [
    "CoachSessionRecord",
    "CoachSessionRepo",
    "CoachSessionRepoError",
    "get_coach_session_repo",
]
