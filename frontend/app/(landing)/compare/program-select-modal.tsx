"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { getDashboardBookmarks, searchComparePrograms } from "@/lib/api/app";
import {
  formatProgramDeadlineCountdown,
  getProgramId,
  toProgramSelectSummaries,
  type ProgramSelectCardProgram,
} from "@/lib/program-display";
import type { ProgramSelectSummary } from "@/lib/types";

type ProgramSelectModalProps = {
  open: boolean;
  slotIndex: number | null;
  selectedProgramIds: string[];
  isLoggedIn: boolean;
  onClose: () => void;
  onSelectProgram: (programId: string) => void;
};

type ModalTab = "bookmarks" | "search";

function getMetaTags(program: ProgramSelectCardProgram, includeBookmarkedTag: boolean): string[] {
  const tags = [
    program.category,
    formatProgramDeadlineCountdown(program.days_left),
    includeBookmarkedTag ? "찜한 프로그램" : null,
    program.support_type ?? null,
  ];

  return tags.filter((tag): tag is string => Boolean(tag && tag !== "정보 없음"));
}

function ProgramListCard({
  program,
  alreadyAdded,
  includeBookmarkedTag,
  onSelect,
}: {
  program: ProgramSelectCardProgram;
  alreadyAdded: boolean;
  includeBookmarkedTag: boolean;
  onSelect: (programId: string) => void;
}) {
  const programId = getProgramId(program);
  const tags = getMetaTags(program, includeBookmarkedTag);

  return (
    <article
      className={`flex items-start justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-4 transition ${
        alreadyAdded ? "opacity-45" : "bg-white"
      }`}
    >
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          {program.source || program.provider || "출처 미상"}
        </p>
        <h3 className="mt-1 text-[13px] font-semibold leading-5 text-slate-950">
          {program.title || "제목 미정"}
        </h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.length > 0 ? (
            tags.map((tag) => (
              <span
                key={`${programId}-${tag}`}
                className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600"
              >
                {tag}
              </span>
            ))
          ) : (
            <span className="text-[11px] text-slate-400">태그 정보 없음</span>
          )}
        </div>
      </div>
      {alreadyAdded ? (
        <span className="shrink-0 pt-1 text-xs font-semibold text-slate-500">추가됨</span>
      ) : (
        <button
          type="button"
          onClick={() => onSelect(programId)}
          className="shrink-0 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-600 transition hover:bg-orange-500 hover:text-white"
        >
          + 추가
        </button>
      )}
    </article>
  );
}

export default function ProgramSelectModal({
  open,
  slotIndex,
  selectedProgramIds,
  isLoggedIn,
  onClose,
  onSelectProgram,
}: ProgramSelectModalProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<ModalTab>("bookmarks");
  const [query, setQuery] = useState("");
  const [bookmarks, setBookmarks] = useState<ProgramSelectSummary[]>([]);
  const [bookmarksLoading, setBookmarksLoading] = useState(false);
  const [bookmarksError, setBookmarksError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<ProgramSelectSummary[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [bookmarksLoaded, setBookmarksLoaded] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setIsMounted(true);
    return () => {
      setIsMounted(false);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open) {
      setActiveTab("bookmarks");
      setQuery("");
      setSearchResults([]);
      setSearchError(null);
      setSearchLoading(false);
      return;
    }

    if (activeTab === "search") {
      window.setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  }, [activeTab, open]);

  useEffect(() => {
    if (!open) {
      setBookmarksLoaded(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || activeTab !== "bookmarks" || !isLoggedIn || bookmarksLoaded || bookmarksLoading) {
      return;
    }

    let cancelled = false;

    async function loadBookmarks() {
      setBookmarksLoading(true);
      setBookmarksError(null);
      try {
        const response = await getDashboardBookmarks();
        if (cancelled) return;
        setBookmarks(toProgramSelectSummaries(response.items.map((item) => item.program)));
        setBookmarksLoaded(true);
      } catch (error) {
        if (cancelled) return;
        setBookmarksError(
          error instanceof Error ? error.message : "찜한 프로그램을 불러올 수 없습니다."
        );
        setBookmarks([]);
      } finally {
        if (!cancelled) {
          setBookmarksLoading(false);
        }
      }
    }

    void loadBookmarks();

    return () => {
      cancelled = true;
    };
  }, [activeTab, bookmarksLoaded, bookmarksLoading, isLoggedIn, open]);

  useEffect(() => {
    if (!open || activeTab !== "search") return;

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setSearchLoading(true);
      setSearchError(null);
      try {
        const response = await searchComparePrograms({
          q: query.trim() || undefined,
          limit: 20,
          sort: "deadline",
          recruitingOnly: true,
        });
        if (cancelled) return;
        setSearchResults(response.items);
      } catch (error) {
        if (cancelled) return;
        setSearchError(
          error instanceof Error ? error.message : "프로그램 검색 결과를 불러오지 못했습니다."
        );
        setSearchResults([]);
      } finally {
        if (!cancelled) {
          setSearchLoading(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [activeTab, open, query]);

  if (!isMounted || !open || slotIndex === null) return null;

  const bookmarkedPrograms = bookmarks.filter((program) => Boolean(getProgramId(program)));

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-50 bg-[rgba(10,15,30,0.55)] backdrop-blur-[4px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="program-select-modal-title"
          className="flex max-h-[82vh] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          onClick={(event) => event.stopPropagation()}
          style={{ animation: "compare-modal-enter 0.2s ease-out" }}
        >
          <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 id="program-select-modal-title" className="text-base font-bold text-slate-950">
                프로그램 선택
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                비교 슬롯 {slotIndex + 1}에 추가할 프로그램을 선택하세요.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-lg leading-none text-slate-400 transition hover:bg-rose-50 hover:text-rose-500"
              aria-label="닫기"
            >
              ×
            </button>
          </div>

          <div className="border-b border-slate-100 px-5">
            <div className="flex gap-5">
              {[
                ["bookmarks", "찜한 프로그램"],
                ["search", "전체 검색"],
              ].map(([value, label]) => {
                const active = activeTab === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setActiveTab(value as ModalTab)}
                    className={`border-b-2 px-1 py-3 text-sm font-semibold transition ${
                      active
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="overflow-y-auto px-5 py-4">
            {activeTab === "bookmarks" ? (
              !isLoggedIn ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
                  <p className="text-sm font-semibold text-slate-700">
                    로그인하면 찜한 프로그램을 바로 불러올 수 있습니다
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("search")}
                    className="mt-4 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-blue-200 hover:text-blue-600"
                  >
                    전체 검색으로 찾기
                  </button>
                </div>
              ) : bookmarksLoading ? (
                <div className="flex items-center justify-center py-12 text-sm text-slate-500">
                  찜한 프로그램을 불러오는 중입니다...
                </div>
              ) : bookmarksError ? (
                <div className="flex items-center justify-center py-12 text-sm text-slate-500">
                  불러올 수 없습니다.
                </div>
              ) : bookmarkedPrograms.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-sm text-slate-500">
                  아직 찜한 프로그램이 없습니다.
                </div>
              ) : (
                <div className="space-y-3">
                  {bookmarkedPrograms.map((program) => {
                    const programId = getProgramId(program);
                    return (
                      <ProgramListCard
                        key={`bookmark-${programId}`}
                        program={program}
                        alreadyAdded={selectedProgramIds.includes(programId)}
                        includeBookmarkedTag
                        onSelect={(nextProgramId) => {
                          onSelectProgram(nextProgramId);
                          onClose();
                        }}
                      />
                    );
                  })}
                </div>
              )
            ) : (
              <div>
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="프로그램명, 카테고리, 기관 검색..."
                  className="w-full rounded-lg border border-[1.5px] border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-600"
                />
                <div className="mt-4">
                  {searchLoading ? (
                    <div className="flex items-center justify-center py-12 text-sm text-slate-500">
                      검색 중입니다...
                    </div>
                  ) : searchError ? (
                    <div className="flex items-center justify-center py-12 text-sm text-slate-500">
                      불러올 수 없습니다.
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="flex items-center justify-center py-12 text-sm text-slate-500">
                      검색 결과가 없습니다.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {searchResults.map((program) => {
                        const programId = getProgramId(program);
                        return (
                          <ProgramListCard
                            key={`search-${programId}`}
                            program={program}
                            alreadyAdded={selectedProgramIds.includes(programId)}
                            includeBookmarkedTag={false}
                            onSelect={(nextProgramId) => {
                              onSelectProgram(nextProgramId);
                              onClose();
                            }}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes compare-modal-enter {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>,
    document.body
  );
}
