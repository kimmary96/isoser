"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { ProgramDeadlineBadge } from "@/components/programs/program-deadline-badge";
import { ProgramProviderBrand } from "@/components/programs/program-provider-brand";
import { cx, iso } from "@/components/ui/isoser-ui";
import { getDashboardBookmarks, searchComparePrograms } from "@/lib/api/app";
import {
  formatProgramCostLabel,
  getProgramId,
  getProgramTrainingModeLabel,
} from "@/lib/program-display";
import type { ProgramCardItem, ProgramCardSummary } from "@/lib/types";

import { COMPARE_COPY } from "./compare-copy";

type ProgramSelectModalProps = {
  open: boolean;
  slotIndex: number | null;
  selectedProgramIds: string[];
  initialBookmarkedItems: ProgramCardItem[];
  onClose: () => void;
  onSelectProgram: (programId: string) => void;
};

type ModalTab = "bookmarks" | "search";

function normalizeCardTags(value: string[] | string | null | undefined): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function getMetaTags(program: ProgramCardSummary, includeBookmarkedTag: boolean): string[] {
  const trainingMode = getProgramTrainingModeLabel(program);
  const costLabel = formatProgramCostLabel(program);
  const tags = [
    program.category,
    trainingMode,
    costLabel,
    includeBookmarkedTag ? COMPARE_COPY.suggestionReasons.bookmark : null,
    program.support_type ?? null,
    ...normalizeCardTags(program.tags).slice(0, 2),
  ];

  const filteredTags = tags.filter((tag): tag is string => Boolean(tag && tag !== "정보 없음"));
  return filteredTags.filter((tag, index) => filteredTags.indexOf(tag) === index).slice(0, 5);
}

function ProgramSelectCard({
  item,
  alreadyAdded,
  includeBookmarkedTag,
  onSelect,
}: {
  item: ProgramCardItem;
  alreadyAdded: boolean;
  includeBookmarkedTag: boolean;
  onSelect: (programId: string) => void;
}) {
  const { program } = item;
  const programId = getProgramId(program);
  const tags = getMetaTags(program, includeBookmarkedTag);
  const reason =
    item.context?.reason ||
    item.context?.relevance_reasons?.[0] ||
    program.recommendation_reasons?.[0] ||
    null;

  return (
    <article
      className={`rounded-2xl border border-slate-200 bg-white px-4 py-4 transition ${
        alreadyAdded ? "opacity-45" : "hover:border-orange-200 hover:shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <ProgramProviderBrand program={program} />
          <h3 className="mt-3 line-clamp-2 text-[14px] font-semibold leading-5 text-slate-950">
            {program.title || "제목 미정"}
          </h3>
          <p className="mt-1 truncate text-xs text-slate-500">
            {program.provider || program.source || "운영기관 정보 없음"}
          </p>
        </div>
        <ProgramDeadlineBadge program={program} className="mt-0.5" />
      </div>
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
      {reason ? <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-500">{reason}</p> : null}
      <div className="mt-4 flex justify-end">
        {alreadyAdded ? (
          <span className="shrink-0 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-500">추가됨</span>
        ) : (
          <button
            type="button"
            onClick={() => onSelect(programId)}
            className="shrink-0 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700 transition hover:bg-orange-600 hover:text-white"
          >
            비교에 추가
          </button>
        )}
      </div>
    </article>
  );
}

export default function ProgramSelectModal({
  open,
  slotIndex,
  selectedProgramIds,
  initialBookmarkedItems,
  onClose,
  onSelectProgram,
}: ProgramSelectModalProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<ModalTab>("bookmarks");
  const [query, setQuery] = useState("");
  const [bookmarks, setBookmarks] = useState<ProgramCardItem[]>(initialBookmarkedItems);
  const [bookmarksLoading, setBookmarksLoading] = useState(false);
  const [bookmarksError, setBookmarksError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<ProgramCardItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [bookmarksLoaded, setBookmarksLoaded] = useState(() => initialBookmarkedItems.length > 0);
  const [bookmarksRetryKey, setBookmarksRetryKey] = useState(0);
  const [submittedQuery, setSubmittedQuery] = useState("");
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
      setSubmittedQuery("");
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
    setBookmarks(initialBookmarkedItems);
    if (initialBookmarkedItems.length > 0) {
      setBookmarksLoaded(true);
      setBookmarksError(null);
      setBookmarksLoading(false);
    }
  }, [initialBookmarkedItems]);

  useEffect(() => {
    if (!open || activeTab !== "bookmarks" || bookmarksLoaded || bookmarksLoading) {
      return;
    }

    let cancelled = false;

    async function loadBookmarks() {
      setBookmarksLoading(true);
      setBookmarksError(null);
      try {
        const response = await getDashboardBookmarks();
        if (cancelled) return;
        setBookmarks(response.items);
        setBookmarksLoaded(true);
      } catch {
        if (cancelled) return;
        if (bookmarks.length > 0) {
          setBookmarksLoaded(true);
          setBookmarksError(null);
          return;
        }
        setBookmarksError(COMPARE_COPY.modal.bookmarks.errorTitle);
        setBookmarks([]);
        setBookmarksLoaded(true);
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
  }, [activeTab, bookmarks.length, bookmarksLoaded, bookmarksLoading, bookmarksRetryKey, open]);

  useEffect(() => {
    if (!open || activeTab !== "search") return;

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setSearchLoading(true);
      setSearchError(null);
      try {
        const response = await searchComparePrograms({
          q: submittedQuery || undefined,
          limit: 30,
          sort: submittedQuery ? "deadline" : "default",
          recruitingOnly: true,
        });
        if (cancelled) return;
        setSearchResults(response.items);
      } catch {
        if (cancelled) return;
        setSearchError(COMPARE_COPY.modal.search.error);
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
  }, [activeTab, open, submittedQuery]);

  if (!isMounted || !open || slotIndex === null) return null;

  const bookmarkedPrograms = bookmarks.filter((item) => Boolean(getProgramId(item.program)));

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
                {COMPARE_COPY.modal.title}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {COMPARE_COPY.modal.description(slotIndex + 1)}
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
                ["bookmarks", COMPARE_COPY.modal.tabs.bookmarks],
                ["search", COMPARE_COPY.modal.tabs.search],
              ].map(([value, label]) => {
                const active = activeTab === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setActiveTab(value as ModalTab)}
                    className={`border-b-2 px-1 py-3 text-sm font-semibold transition ${
                      active
                        ? "border-orange-500 text-orange-600"
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
              bookmarksLoading || (!bookmarksLoaded && !bookmarksError) ? (
                <div className="flex items-center justify-center py-12 text-sm text-slate-500">
                  {COMPARE_COPY.modal.bookmarks.loading}
                </div>
              ) : bookmarksError && /UNAUTHORIZED|로그인/.test(bookmarksError) ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
                  <p className="text-sm font-semibold text-slate-700">
                    {COMPARE_COPY.modal.bookmarks.loginTitle}
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("search")}
                    className="mt-4 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-orange-200 hover:text-orange-600"
                  >
                    {COMPARE_COPY.modal.bookmarks.searchButton}
                  </button>
                </div>
              ) : bookmarksError ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
                  <p className="text-sm font-semibold text-slate-700">
                    {COMPARE_COPY.modal.bookmarks.errorTitle}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {COMPARE_COPY.modal.bookmarks.retryDescription}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setBookmarksError(null);
                      setBookmarksLoaded(false);
                      setBookmarksLoading(false);
                      setBookmarksRetryKey((value) => value + 1);
                    }}
                    className="mt-4 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-orange-200 hover:text-orange-600"
                  >
                    {COMPARE_COPY.modal.bookmarks.retryButton}
                  </button>
                </div>
              ) : bookmarkedPrograms.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-sm text-slate-500">
                  {COMPARE_COPY.modal.bookmarks.empty}
                </div>
              ) : (
                <div className="space-y-3">
                  {bookmarkedPrograms.map((item) => {
                    const programId = getProgramId(item.program);
                    return (
                      <ProgramSelectCard
                        key={`bookmark-${programId}`}
                        item={item}
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
                <form
                  className="sticky top-0 z-10 -mx-5 border-b border-slate-100 bg-white px-5 pb-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setSubmittedQuery(query.trim());
                  }}
                >
                  <div className="flex gap-2">
                    <input
                      ref={inputRef}
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder={COMPARE_COPY.modal.search.placeholder}
                      className="min-w-0 flex-1 rounded-lg border border-[1.5px] border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-500"
                    />
                    <button
                      type="submit"
                      className={cx("shrink-0 rounded-lg px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:bg-slate-300", iso.darkButton)}
                      disabled={searchLoading}
                    >
                      검색
                    </button>
                  </div>
                </form>
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
                      {searchResults.map((item) => {
                        const programId = getProgramId(item.program);
                        return (
                          <ProgramSelectCard
                            key={`search-${programId}`}
                            item={item}
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
