"use client";

import type { MouseEvent } from "react";
import { useState } from "react";

import { getLoginHref } from "@/lib/routes";

import { useProgramBookmarkState } from "./bookmark-state-provider";

type ProgramBookmarkButtonProps = {
  programId: string;
  isLoggedIn: boolean;
  initialBookmarked?: boolean;
  className?: string;
  showLabel?: boolean;
};

export default function ProgramBookmarkButton({
  programId,
  isLoggedIn,
  initialBookmarked = false,
  className = "",
  showLabel = false,
}: ProgramBookmarkButtonProps) {
  const bookmarkState = useProgramBookmarkState();
  const [localBookmarked, setLocalBookmarked] = useState(initialBookmarked);
  const [pending, setPending] = useState(false);
  const bookmarked = programId && bookmarkState ? bookmarkState.isBookmarked(programId) : localBookmarked;

  function redirectToLogin() {
    if (typeof window === "undefined") return;
    const redirectedFrom = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.assign(getLoginHref(redirectedFrom));
  }

  async function toggleBookmark(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!programId || pending) return;
    if (!isLoggedIn) {
      redirectToLogin();
      return;
    }

    setPending(true);
    const next = !bookmarked;
    try {
      const response = await fetch(`/api/dashboard/bookmarks/${encodeURIComponent(programId)}`, {
        method: next ? "POST" : "DELETE",
      });
      if (response.ok) {
        if (bookmarkState) {
          bookmarkState.setBookmarked(programId, next);
        } else {
          setLocalBookmarked(next);
        }
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={toggleBookmark}
      aria-label={bookmarked ? "찜 해제" : "찜하기"}
      title={isLoggedIn ? undefined : "로그인 후 찜할 수 있습니다."}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-sm transition ${
        bookmarked ? "border-amber-200 bg-amber-50 text-amber-500" : "border-slate-200 bg-white text-slate-400 hover:text-amber-500"
      } ${!isLoggedIn ? "hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600" : ""} ${className}`}
    >
      {showLabel ? (bookmarked ? "북마크됨" : "북마크") : "★"}
    </button>
  );
}
