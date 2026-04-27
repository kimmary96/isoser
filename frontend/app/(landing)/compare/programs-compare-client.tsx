"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment, useEffect, useMemo, useState } from "react";

import { cx, iso } from "@/components/ui/isoser-ui";
import { getProgramCompareRelevance } from "@/lib/api/app";
import { formatProgramCostLabel, getProgramId } from "@/lib/program-display";
import type { ProgramCardItem, ProgramRelevanceItem } from "@/lib/types";

import { COMPARE_COPY } from "./compare-copy";
import { CompareRelevanceSection } from "./compare-relevance-section";
import {
  CompareSectionHeader,
  ValueCell,
  compareSections,
} from "./compare-table-sections";
import { normalizeTextList } from "./compare-formatters";
import {
  getDeadlineLabel,
  getDeadlineTone,
  getLinkHref,
  type CompareProgram,
} from "./compare-value-getters";
import ProgramSelectModal from "./program-select-modal";

type ProgramsCompareClientProps = {
  initialSlots: Array<CompareProgram | null>;
  canonicalIds: string[];
  needsNormalization: boolean;
  suggestions: ProgramCardItem[];
  suggestionsError: string | null;
  isLoggedIn: boolean;
  initialBookmarkedItems: ProgramCardItem[];
};

function getWinnerIndex(slots: Array<CompareProgram | null>): number {
  let winnerIndex = -1;
  let winnerDaysLeft = Number.POSITIVE_INFINITY;

  slots.forEach((program, index) => {
    if (!program || typeof program.days_left !== "number") return;
    if (program.days_left < winnerDaysLeft) {
      winnerIndex = index;
      winnerDaysLeft = program.days_left;
    }
  });

  return winnerIndex;
}

function getRelevanceWinnerIndex(
  slots: Array<CompareProgram | null>,
  relevanceItems: Record<string, ProgramRelevanceItem>
): number {
  let winnerIndex = -1;
  let winnerScore = -1;

  slots.forEach((program, index) => {
    const programId = typeof program?.id === "string" ? program.id : "";
    const score = programId ? relevanceItems[programId]?.relevance_score : undefined;
    if (typeof score !== "number" || Number.isNaN(score)) return;
    if (score > winnerScore) {
      winnerIndex = index;
      winnerScore = score;
    }
  });

  return winnerIndex;
}

export default function ProgramsCompareClient({
  initialSlots,
  canonicalIds,
  needsNormalization,
  suggestions,
  suggestionsError,
  isLoggedIn,
  initialBookmarkedItems,
}: ProgramsCompareClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const slots = initialSlots.slice(0, 3);
  while (slots.length < 3) slots.push(null);
  const slotIds = slots.map((program) => (typeof program?.id === "string" ? program.id : null));
  const activeCount = slots.filter(Boolean).length;
  const canonicalIdsParam = serializeSlotIds(slotIds);
  const resumeHref = isLoggedIn ? "/dashboard/resume" : "/login";
  const [relevanceItems, setRelevanceItems] = useState<Record<string, ProgramRelevanceItem>>({});
  const [relevanceLoading, setRelevanceLoading] = useState(false);
  const [relevanceError, setRelevanceError] = useState<string | null>(null);
  const [modalSlotIndex, setModalSlotIndex] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const activeProgramIds = useMemo(() => canonicalIds, [canonicalIds]);
  const relevanceWinnerIndex = getRelevanceWinnerIndex(slots, relevanceItems);
  const winnerIndex = relevanceWinnerIndex >= 0 ? relevanceWinnerIndex : getWinnerIndex(slots);

  useEffect(() => {
    if (!notice) return;

    const timeoutId = window.setTimeout(() => {
      setNotice(null);
    }, 2500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [notice]);

  useEffect(() => {
    if (!needsNormalization) return;
    const currentIds = searchParams.get("ids") ?? "";
    if (currentIds === canonicalIdsParam) return;

    const params = new URLSearchParams(searchParams.toString());
    if (canonicalIdsParam) params.set("ids", canonicalIdsParam);
    else params.delete("ids");

    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname);
  }, [canonicalIdsParam, needsNormalization, pathname, router, searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function loadRelevance() {
      if (!isLoggedIn || activeProgramIds.length === 0) {
        if (!cancelled) {
          setRelevanceItems({});
          setRelevanceError(null);
          setRelevanceLoading(false);
        }
        return;
      }

      setRelevanceLoading(true);
      setRelevanceError(null);
      try {
        const response = await getProgramCompareRelevance(activeProgramIds);
        if (cancelled) return;
        setRelevanceItems(Object.fromEntries(response.items.map((item) => [item.program_id, item])));
      } catch {
        if (cancelled) return;
        setRelevanceItems({});
        setRelevanceError(COMPARE_COPY.errors.careerFit);
      } finally {
        if (!cancelled) {
          setRelevanceLoading(false);
        }
      }
    }

    void loadRelevance();

    return () => {
      cancelled = true;
    };
  }, [activeProgramIds, isLoggedIn]);

  function replaceIds(nextIds: Array<string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    const serialized = serializeSlotIds(nextIds);
    if (serialized) params.set("ids", serialized);
    else params.delete("ids");
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname);
  }

  function handleAddToSlot(programId: string, slotIndex: number) {
    if (!programId || canonicalIds.includes(programId) || slotIndex < 0 || slotIndex > 2) return;
    const nextSlotIds = slotIds.slice();
    nextSlotIds[slotIndex] = programId;
    replaceIds(nextSlotIds);
  }

  function handleAdd(programId: string) {
    if (!programId) return;
    if (canonicalIds.includes(programId)) {
      setNotice("이미 비교 중인 과정입니다.");
      return;
    }

    const emptyIndex = slotIds.findIndex((slotId) => slotId === null);
    if (emptyIndex < 0) {
      setNotice("비교 슬롯이 가득 찼습니다.");
      return;
    }

    handleAddToSlot(programId, emptyIndex);
  }

  function handleRemove(slotIndex: number) {
    if (slotIndex < 0 || slotIndex > 2) return;
    const nextSlotIds = slotIds.slice();
    nextSlotIds[slotIndex] = null;
    replaceIds(nextSlotIds);
  }

  function openAddModal(slotIndex: number) {
    if (slotIndex < 0 || slotIndex > 2 || slotIds[slotIndex]) return;
    setModalSlotIndex(slotIndex);
  }

  return (
    <main className={iso.page}>
      {notice ? (
        <div className="fixed left-1/2 top-6 z-[70] -translate-x-1/2 rounded-full bg-[#071a36] px-4 py-2 text-sm font-medium text-white shadow-lg">
          {notice}
        </div>
      ) : null}

      <ProgramSelectModal
        open={modalSlotIndex !== null}
        slotIndex={modalSlotIndex}
        selectedProgramIds={canonicalIds}
        initialBookmarkedItems={initialBookmarkedItems}
        onClose={() => setModalSlotIndex(null)}
        onSelectProgram={(programId) => {
          if (modalSlotIndex === null) return;
          handleAddToSlot(programId, modalSlotIndex);
        }}
      />

      <div className={cx("mx-4 mt-4 overflow-hidden rounded-[32px]", iso.glassPanel)}>
        <div className={iso.headerBand}>
          <div className="mx-auto max-w-7xl px-6 py-10">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">{COMPARE_COPY.hero.title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            {COMPARE_COPY.hero.description}
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full border border-white/80 bg-white/80 px-3 py-1 text-slate-700 shadow-sm">{COMPARE_COPY.hero.badges[0]}</span>
          <span className="rounded-full border border-orange-200 bg-orange-50/90 px-3 py-1 text-orange-700 shadow-sm">{COMPARE_COPY.hero.badges[1]}</span>
            <span className="rounded-full border border-sky-200 bg-sky-50/90 px-3 py-1 text-sky-700 shadow-sm">{COMPARE_COPY.hero.badges[2]}</span>
          </div>
        </div>
      </div>

        <div className="mx-auto max-w-7xl px-6 py-8">
        <section className="mb-5 flex flex-col gap-3 rounded-[24px] border border-white/70 bg-white/75 px-5 py-4 text-sm text-slate-600 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm lg:flex-row lg:items-center">
          <div className="shrink-0 rounded-xl bg-[#e0621a] px-3 py-2 text-xs font-semibold text-white">{COMPARE_COPY.legend.title}</div>
          <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-slate-400" />{COMPARE_COPY.legend.empty}</div>
          <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />{COMPARE_COPY.legend.missing}</div>
          <div className="text-xs text-slate-400 lg:ml-auto">{COMPARE_COPY.legend.fit}</div>
        </section>

        <section className="overflow-x-auto rounded-[28px] border border-white/70 bg-white/80 shadow-[0_24px_60px_rgba(15,23,42,0.10)] backdrop-blur-sm">
          <div className="grid min-w-[980px] grid-cols-[170px_repeat(3,minmax(0,1fr))]">
            <div className="border-b border-r border-slate-200 bg-slate-100 px-4 py-5">
              <div className="text-xs font-semibold text-slate-500">비교 중</div>
              <div className="mt-1 text-2xl font-semibold text-slate-950">
                {activeCount} <span className="text-sm font-medium text-slate-500">/ 3개</span>
              </div>
            </div>

            {slots.map((program, index) => {
              const isWinner = winnerIndex === index;
              const programId = typeof program?.id === "string" ? program.id : "";
              const tags = [
                getDeadlineLabel(program?.days_left),
                program?.detail?.support_type || program?.support_type || null,
                program?.detail?.location || program?.location || null,
              ]
                .filter((item): item is string => Boolean(item && item !== "정보 없음"));

              if (!program) {
                return (
                  <button
                    key={`slot-empty-${index}`}
                    type="button"
                    onClick={() => openAddModal(index)}
                    className="flex min-h-[180px] flex-col items-center justify-center border-b border-r border-slate-200 bg-slate-100 px-4 py-5 text-center transition hover:bg-slate-50"
                  >
                    <span className="text-3xl text-slate-300">＋</span>
                    <p className="mt-2 text-sm font-semibold text-slate-600">{COMPARE_COPY.slot.addTitle}</p>
                    <p className="text-xs text-slate-400">{COMPARE_COPY.slot.addDescription}</p>
                  </button>
                );
              }

              return (
                <div
                  key={programId}
                  className={`min-h-[180px] border-b border-r border-slate-200 px-4 py-5 ${
                    isWinner ? "border-t-[3px] border-t-[#e0621a] bg-orange-50/60" : "bg-white"
                  }`}
                >
                  {isWinner ? (
                    <span className="mb-3 inline-flex rounded-md bg-[#e0621a] px-2.5 py-1 text-[11px] font-semibold text-white">
                      {COMPARE_COPY.slot.winnerBadge}
                    </span>
                  ) : null}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {program.source || "출처 미상"}
                      </p>
                      <h2 className="mt-2 text-lg font-semibold leading-6 text-slate-950">
                        {program.title || "제목 미정"}
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemove(index)}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-sm text-slate-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500"
                      aria-label={`${program.title || "과정"} 비교에서 제거`}
                    >
                      ×
                    </button>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <span
                        key={`${programId}-${tag}`}
                        className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${
                          tag.startsWith("D-") || tag === "D-Day" || tag === "마감"
                            ? "border-orange-200 bg-orange-50 text-orange-700"
                            : "border-slate-200 bg-slate-50 text-slate-600"
                        }`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}

            {compareSections.filter((section) => !section.isVisible || section.isVisible(slots)).map((section) => (
              <Fragment key={section.label}>
                <CompareSectionHeader label={section.label} className={section.className} note={section.note} />
                {section.rows.map((row) => (
                  <div key={`${section.label}-${row.label}`} className="row contents">
                    <div className="border-b border-r border-slate-200 bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600">{row.label}</div>
                    {slots.map((program, index) => (
                      <ValueCell
                        key={`${section.label}-${row.label}-${program?.id ?? index}`}
                        winner={winnerIndex === index}
                        empty={row.isEmpty ? row.isEmpty(program) : !program}
                        extraClassName={row.extraClassName ?? ""}
                      >
                        {row.render(program)}
                      </ValueCell>
                    ))}
                  </div>
                ))}
              </Fragment>
            ))}

            <CompareRelevanceSection
              slots={slots}
              winnerIndex={winnerIndex}
              isLoggedIn={isLoggedIn}
              relevanceLoading={relevanceLoading}
              relevanceError={relevanceError}
              relevanceItems={relevanceItems}
            />

            <div className="border-r border-slate-200 bg-slate-100 px-4 py-4 text-sm font-medium text-slate-600">결정하셨나요?</div>
            {slots.map((program, index) => (
              <div
                key={`cta-${program?.id ?? index}`}
                className={`flex flex-col gap-2 border-r px-4 py-4 ${winnerIndex === index ? "bg-orange-50/60" : "bg-slate-100"} border-slate-200 last:border-r-0`}
              >
                {program ? (() => {
                  const linkHref = getLinkHref(program);
                  return (
                    <>
                      {linkHref ? (
                        <a
                          href={linkHref}
                          target="_blank"
                          rel="noreferrer"
                          className={cx("inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold", iso.accentButton)}
                        >
                          지금 지원하기 →
                        </a>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="inline-flex items-center justify-center rounded-xl bg-slate-300 px-4 py-2.5 text-sm font-semibold text-white"
                        >
                          지금 지원하기 →
                        </button>
                      )}
                      <Link
                        href={resumeHref}
                        className="inline-flex items-center justify-center rounded-xl border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm font-semibold text-orange-700 transition hover:bg-orange-100"
                      >
                        이력서 즉시 만들기
                      </Link>
                    </>
                  );
                })() : (
                  <button
                    type="button"
                    onClick={() => openAddModal(index)}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-500 transition hover:border-orange-200 hover:text-orange-700"
                  >
                    + 과정 추가
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="mt-7 flex flex-col gap-4 rounded-[28px] border border-white/70 bg-white/75 px-6 py-6 text-slate-950 shadow-[0_20px_44px_rgba(15,23,42,0.08)] backdrop-blur-sm lg:flex-row lg:items-center">
          <div className="flex-1">
            <h2 className="text-lg font-semibold">{COMPARE_COPY.loginCta.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{COMPARE_COPY.loginCta.description}</p>
          </div>
          <Link href="/login" className={cx("inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold", iso.primaryButton)}>
            {COMPARE_COPY.loginCta.button}
          </Link>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{COMPARE_COPY.suggestions.title}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {COMPARE_COPY.suggestions.description}
          </p>

          {suggestionsError ? (
            <div className="mt-4 rounded-[24px] border border-white/70 bg-white/75 px-5 py-6 text-sm text-slate-500 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm">
              {COMPARE_COPY.suggestions.error}
            </div>
          ) : suggestions.length === 0 ? (
            <div className="mt-4 rounded-[24px] border border-white/70 bg-white/75 px-5 py-6 text-sm text-slate-500 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm">
              {COMPARE_COPY.suggestions.empty}
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {suggestions.map((item) => {
                const program = item.program;
                const tags = Array.from(new Set([
                  program.category,
                  formatProgramCostLabel(program),
                  ...normalizeTextList(program.tags),
                ].filter((tag): tag is string => Boolean(tag && tag !== "정보 없음")))).slice(0, 3);
                const programId = getProgramId(program);
                const disabled = !programId || canonicalIds.includes(programId);
                const suggestionReason = item.context?.reason?.trim() || COMPARE_COPY.suggestions.fallbackReason;

                return (
                  <article key={programId || String(program.id)} className="flex h-full flex-col rounded-[24px] border border-white/75 bg-white/80 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{program.source || "출처 미상"}</span>
                        <div className="mt-2 inline-flex rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                          {suggestionReason}
                        </div>
                      </div>
                      <span className={`text-sm font-semibold ${getDeadlineTone(program.days_left)}`}>{getDeadlineLabel(program.days_left)}</span>
                    </div>
                    <h3 className="mt-3 text-base font-semibold leading-6 text-slate-950">{program.title || "제목 미정"}</h3>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {tags.length > 0 ? tags.map((tag) => (
                        <span key={`${programId}-${tag}`} className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600">
                          {tag}
                        </span>
                      )) : <span className="text-xs text-slate-400">태그 정보 없음</span>}
                    </div>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => handleAdd(programId)}
                      className={`mt-5 inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                        disabled
                          ? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
                          : "border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-600 hover:text-white"
                      }`}
                    >
                      {COMPARE_COPY.suggestions.addButton}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>
        </div>
      </div>
    </main>
  );
}

function serializeSlotIds(slotIds: Array<string | null>): string {
  const normalized = slotIds.slice(0, 3);
  while (normalized.length < 3) normalized.push(null);

  let lastFilledIndex = -1;
  normalized.forEach((slotId, index) => {
    if (slotId) {
      lastFilledIndex = index;
    }
  });

  if (lastFilledIndex < 0) return "";
  return normalized
    .slice(0, lastFilledIndex + 1)
    .map((slotId) => slotId ?? "")
    .join(",");
}
