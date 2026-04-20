"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { getProgramCompareRelevance } from "@/lib/api/app";
import type { Program } from "@/lib/types";
import type { ProgramRelevanceItem } from "@/lib/types";

import ProgramSelectModal from "./program-select-modal";

type ProgramsCompareClientProps = {
  initialSlots: Array<Program | null>;
  canonicalIds: string[];
  needsNormalization: boolean;
  suggestions: Program[];
  suggestionsError: string | null;
  isLoggedIn: boolean;
};

function normalizeTextList(value: string[] | string | null | undefined): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }

  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function formatDateLabel(value: string | null | undefined): string {
  if (!value) return "정보 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

function formatDateRange(startDate?: string | null, endDate?: string | null): string {
  if (startDate && endDate) {
    return `${formatDateLabel(startDate)} ~ ${formatDateLabel(endDate)}`;
  }
  if (startDate) {
    return `${formatDateLabel(startDate)} 시작`;
  }
  if (endDate) {
    return `${formatDateLabel(endDate)} 종료`;
  }
  return "데이터 미수집";
}

function getText(value: string | null | undefined): string {
  return typeof value === "string" && value.trim() ? value.trim() : "정보 없음";
}

function getOperationalText(value: string | null | undefined): string {
  return typeof value === "string" && value.trim() ? value.trim() : "데이터 미수집";
}

function getDeadlineLabel(daysLeft?: number | null): string {
  if (typeof daysLeft !== "number") return "정보 없음";
  if (daysLeft < 0) return "마감";
  if (daysLeft === 0) return "D-Day";
  return `D-${daysLeft}`;
}

function getDeadlineTone(daysLeft?: number | null): string {
  if (typeof daysLeft !== "number") return "text-slate-500";
  if (daysLeft <= 3) return "text-rose-600";
  if (daysLeft <= 7) return "text-orange-500";
  if (daysLeft <= 14) return "text-amber-500";
  return "text-emerald-600";
}

function formatBooleanLabel(
  value: boolean | null | undefined,
  labels: { true: string; false: string; missing: string }
): string {
  if (value === true) return labels.true;
  if (value === false) return labels.false;
  return labels.missing;
}

function getProgramSummary(program: Program | null): string {
  if (!program) return "정보 없음";
  if (typeof program.summary === "string" && program.summary.trim()) return program.summary.trim();
  if (typeof program.description === "string" && program.description.trim()) return program.description.trim();
  return "정보 없음";
}

function getProgramDescription(program: Program | null): string {
  if (!program) return "정보 없음";
  if (typeof program.description === "string" && program.description.trim()) return program.description.trim();
  return "정보 없음";
}

function getLinkHref(program: Program | null): string | null {
  if (!program) return null;
  const candidates = [program.application_url, program.source_url, program.link];
  return candidates.find((value): value is string => typeof value === "string" && value.trim().length > 0) ?? null;
}

function getLinkSummary(program: Program | null): string {
  return getLinkHref(program) ? "바로가기 가능" : "링크 없음";
}

type CompareRow = {
  label: string;
  formatter: (program: Program | null) => string;
};

function getWinnerIndex(slots: Array<Program | null>): number {
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
  slots: Array<Program | null>,
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

function ValueCell({
  children,
  winner,
  empty = false,
  extraClassName = "",
}: {
  children: React.ReactNode;
  winner: boolean;
  empty?: boolean;
  extraClassName?: string;
}) {
  return (
    <div
      className={`min-w-0 border-b border-r border-slate-200 px-4 py-3 text-sm ${
        winner ? "bg-orange-50/60" : "bg-white"
      } ${empty ? "text-slate-400" : "text-slate-700"} ${extraClassName}`}
    >
      {children}
    </div>
  );
}

function formatPercent(score: number | null | undefined): string {
  if (typeof score !== "number" || Number.isNaN(score)) return "0%";
  return `${Math.round(score * 100)}%`;
}

function ScoreBar({ score }: { score: number | null | undefined }) {
  const width = typeof score === "number" && !Number.isNaN(score) ? Math.max(0, Math.min(100, Math.round(score * 100))) : 0;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
        <span>{formatPercent(score)}</span>
      </div>
      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-[#F97316]" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export default function ProgramsCompareClient({
  initialSlots,
  canonicalIds,
  needsNormalization,
  suggestions,
  suggestionsError,
  isLoggedIn,
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
        setRelevanceItems(
          Object.fromEntries(response.items.map((item) => [item.program_id, item]))
        );
      } catch (error) {
        if (cancelled) return;
        setRelevanceItems({});
        setRelevanceError(error instanceof Error ? error.message : "관련도 데이터를 불러오지 못했습니다.");
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
      setNotice("이미 비교 중인 프로그램입니다.");
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

  const sectionHeader = (label: string, className: string, note?: string) => (
    <div className={`col-span-4 flex items-center gap-2 border-b border-slate-200 px-5 py-3 text-xs font-semibold ${className}`}>
      <span>{label}</span>
      {note ? <span className="text-[11px] font-medium text-rose-500">{note}</span> : null}
    </div>
  );

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      {notice ? (
        <div className="fixed left-1/2 top-6 z-[70] -translate-x-1/2 rounded-full bg-[#0A0F1E] px-4 py-2 text-sm font-medium text-white shadow-lg">
          {notice}
        </div>
      ) : null}

      <ProgramSelectModal
        open={modalSlotIndex !== null}
        slotIndex={modalSlotIndex}
        selectedProgramIds={canonicalIds}
        isLoggedIn={isLoggedIn}
        onClose={() => setModalSlotIndex(null)}
        onSelectProgram={(programId) => {
          if (modalSlotIndex === null) return;
          handleAddToSlot(programId, modalSlotIndex);
        }}
      />

      <div className="border-b border-white/10 bg-[#0A0F1E]">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">부트캠프 비교 분석</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            최대 3개 프로그램을 나란히 놓고 기본 정보, 운영 방식, 프로그램 개요를 현재 수집되는 데이터 기준으로 비교하세요.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full border border-slate-300/30 bg-slate-400/10 px-3 py-1 text-slate-200">현재 운영 데이터 기준 비교</span>
            <span className="rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-1 text-amber-200">일부 운영 메타는 데이터 미수집으로 표시</span>
            <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-emerald-200">로그인 시 관련도 분석 제공</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <section className="mb-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 lg:flex-row lg:items-center">
          <div className="shrink-0 rounded-lg bg-[#0A0F1E] px-3 py-2 text-xs font-semibold text-white">표기 기준</div>
          <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-slate-400" />정보 없음: 현재 컬럼 값이 비어 있음</div>
          <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />데이터 미수집: source별 운영 메타가 아직 수집되지 않음</div>
          <div className="text-xs text-slate-400 lg:ml-auto">관련도는 로그인 후 내 프로필 기준으로 계산됩니다</div>
        </section>

        <section className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
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
              const tags = [getDeadlineLabel(program?.days_left), program?.teaching_method || null, program?.support_type || null]
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
                    <p className="mt-2 text-sm font-semibold text-slate-600">프로그램 추가</p>
                    <p className="text-xs text-slate-400">찜 목록 또는 검색에서 선택</p>
                  </button>
                );
              }

              return (
                <div
                  key={programId}
                  className={`min-h-[180px] border-b border-r border-slate-200 px-4 py-5 ${
                    isWinner ? "border-t-[3px] border-t-[#F97316] bg-orange-50/60" : "bg-white"
                  }`}
                >
                  {isWinner ? (
                    <span className="mb-3 inline-flex rounded-md bg-[#F97316] px-2.5 py-1 text-[11px] font-semibold text-white">
                      나에게 가장 적합
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
                      aria-label={`${program.title || "프로그램"} 비교에서 제거`}
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
                            ? "border-orange-200 bg-orange-50 text-orange-600"
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

            {sectionHeader("기본 정보", "bg-slate-50 text-slate-600")}
            <div className="row contents">
              <div className="border-b border-r border-slate-200 bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600">마감일</div>
              {slots.map((program, index) => (
                <ValueCell key={`deadline-${program?.id ?? index}`} winner={winnerIndex === index} empty={!program}>
                  {program ? (
                    <span className={getDeadlineTone(program.days_left)}>
                      {getDeadlineLabel(program.days_left)} {program.deadline ? `· ${formatDateLabel(program.deadline)}` : ""}
                    </span>
                  ) : (
                    "정보 없음"
                  )}
                </ValueCell>
              ))}
            </div>
            <div className="row contents">
              <div className="border-b border-r border-slate-200 bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600">과정 기간</div>
              {slots.map((program, index) => (
                <ValueCell key={`period-${program?.id ?? index}`} winner={winnerIndex === index} empty={!program}>
                  {program ? formatDateRange(program.start_date, program.end_date) : "정보 없음"}
                </ValueCell>
              ))}
            </div>
            {([
              { label: "운영 기관", formatter: (program: Program | null) => getText(program?.provider) },
              { label: "지역", formatter: (program: Program | null) => getText(program?.location) },
              { label: "카테고리", formatter: (program: Program | null) => getText(program?.category) },
            ] satisfies CompareRow[]).map(({ label, formatter }) => (
              <div key={label} className="row contents">
                <div className="border-b border-r border-slate-200 bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600">{label}</div>
                {slots.map((program, index) => (
                  <ValueCell key={`${label}-${program?.id ?? index}`} winner={winnerIndex === index} empty={!program}>
                    {program ? formatter(program) : "정보 없음"}
                  </ValueCell>
                ))}
              </div>
            ))}

            {sectionHeader("운영 정보", "bg-violet-50 text-violet-700")}
            {([
              { label: "지원 유형", formatter: (program: Program | null) => getOperationalText(program?.support_type) },
              { label: "수업 방식", formatter: (program: Program | null) => getOperationalText(program?.teaching_method) },
              {
                label: "인증 여부",
                formatter: (program: Program | null) =>
                  formatBooleanLabel(program?.is_certified, { true: "인증", false: "미인증", missing: "데이터 미수집" }),
              },
              {
                label: "모집 상태",
                formatter: (program: Program | null) =>
                  formatBooleanLabel(program?.is_active, { true: "모집 중", false: "마감 또는 비활성", missing: "데이터 미수집" }),
              },
              { label: "지원 링크", formatter: (program: Program | null) => getLinkSummary(program) },
            ] satisfies CompareRow[]).map(({ label, formatter }) => (
              <div key={label} className="row contents">
                <div className="border-b border-r border-slate-200 bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600">{label}</div>
                {slots.map((program, index) => (
                  <ValueCell key={`${label}-${program?.id ?? index}`} winner={winnerIndex === index} empty={!program}>
                    {program ? formatter(program) : "정보 없음"}
                  </ValueCell>
                ))}
              </div>
            ))}

            {sectionHeader("프로그램 개요", "bg-blue-50 text-blue-700")}
            <div className="row contents">
              <div className="border-b border-r border-slate-200 bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600">한줄 요약</div>
              {slots.map((program, index) => (
                <ValueCell key={`summary-${program?.id ?? index}`} winner={winnerIndex === index} empty={!program}>
                  {program ? (
                    <span className="line-clamp-2 break-words">{getProgramSummary(program)}</span>
                  ) : (
                    "정보 없음"
                  )}
                </ValueCell>
              ))}
            </div>
            <div className="row contents">
              <div className="border-b border-r border-slate-200 bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600">상세 설명</div>
              {slots.map((program, index) => (
                <ValueCell key={`description-${program?.id ?? index}`} winner={winnerIndex === index} empty={!program}>
                  {program ? (
                    <span className="line-clamp-3 break-words">{getProgramDescription(program)}</span>
                  ) : (
                    "정보 없음"
                  )}
                </ValueCell>
              ))}
            </div>
            <div className="row contents">
              <div className="border-b border-r border-slate-200 bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600">주요 기술 스택</div>
              {slots.map((program, index) => {
                const skills = normalizeTextList(program?.skills);
                return (
                  <ValueCell key={`skills-${program?.id ?? index}`} winner={winnerIndex === index} empty={!program || skills.length === 0} extraClassName="flex flex-wrap gap-2">
                    {program && skills.length > 0 ? skills.map((skill) => (
                      <span key={`${program.id}-${skill}`} className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600">
                        {skill}
                      </span>
                    )) : "정보 없음"}
                  </ValueCell>
                );
              })}
            </div>
            <div className="row contents">
              <div className="border-b border-r border-slate-200 bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600">태그</div>
              {slots.map((program, index) => {
                const tags = normalizeTextList(program?.tags);
                return (
                  <ValueCell key={`tags-${program?.id ?? index}`} winner={winnerIndex === index} empty={!program || tags.length === 0} extraClassName="flex flex-wrap gap-2">
                    {program && tags.length > 0 ? tags.map((tag) => (
                      <span key={`${program.id}-tag-${tag}`} className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                        {tag}
                      </span>
                    )) : "정보 없음"}
                  </ValueCell>
                );
              })}
            </div>
            <div className="row contents">
              <div className="border-b border-r border-slate-200 bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600">출처</div>
              {slots.map((program, index) => (
                <ValueCell key={`source-${program?.id ?? index}`} winner={winnerIndex === index} empty={!program}>
                  {program ? getText(program.source) : "정보 없음"}
                </ValueCell>
              ))}
            </div>

            {sectionHeader("★ 나와의 관련도", "bg-[#0A0F1E] text-white")}
            <div className="row contents">
              <div className="border-b border-r border-slate-200 bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600">상태</div>
              {slots.map((program, index) => (
                <ValueCell key={`relevance-state-${program?.id ?? index}`} winner={winnerIndex === index} empty={!program}>
                  {!program ? "정보 없음" : !isLoggedIn ? (
                    <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                      로그인 후 확인
                    </span>
                  ) : relevanceLoading ? "분석 중" : relevanceError ? "불러오기 실패" : "분석 완료"}
                </ValueCell>
              ))}
            </div>
            {["종합 관련도", "기술 스택 일치도"].map((label) => (
              <div key={label} className="row contents">
                <div className="border-b border-r border-slate-200 bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600">{label}</div>
                {slots.map((program, index) => {
                  const programId = typeof program?.id === "string" ? program.id : "";
                  const item = programId ? relevanceItems[programId] : null;
                  const score = label === "종합 관련도" ? item?.relevance_score : item?.skill_match_score;
                  return (
                    <ValueCell key={`${label}-${program?.id ?? index}`} winner={winnerIndex === index} empty={!program}>
                      {!program ? "정보 없음" : !isLoggedIn ? "로그인 후 확인" : relevanceLoading ? "분석 중" : item ? <ScoreBar score={score} /> : "정보 없음"}
                    </ValueCell>
                  );
                })}
              </div>
            ))}
            <div className="row contents">
              <div className="border-b border-r border-slate-200 bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600">매칭된 스킬</div>
              {slots.map((program, index) => {
                const programId = typeof program?.id === "string" ? program.id : "";
                const item = programId ? relevanceItems[programId] : null;
                const matchedSkills = item?.matched_skills ?? [];
                return (
                  <ValueCell
                    key={`matched-skills-${program?.id ?? index}`}
                    winner={winnerIndex === index}
                    empty={!program || (!isLoggedIn && matchedSkills.length === 0)}
                    extraClassName="flex flex-wrap gap-2"
                  >
                    {!program ? "정보 없음" : !isLoggedIn ? "로그인 후 확인" : matchedSkills.length > 0 ? matchedSkills.map((skill) => (
                      <span
                        key={`${programId}-${skill}`}
                        className="rounded-md border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700"
                      >
                        {skill}
                      </span>
                    )) : "매칭된 스킬 없음"}
                  </ValueCell>
                );
              })}
            </div>

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
                        className="inline-flex items-center justify-center rounded-xl bg-[#F97316] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600"
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
                      className="inline-flex items-center justify-center rounded-xl border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm font-semibold text-orange-600 transition hover:bg-orange-100"
                    >
                      이력서 즉시 만들기
                    </Link>
                  </>
                  );
                })() : (
                  <button
                    type="button"
                    onClick={() => openAddModal(index)}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-500 transition hover:border-orange-200 hover:text-orange-600"
                  >
                    + 프로그램 추가
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="mt-7 flex flex-col gap-4 rounded-3xl border border-white/10 bg-[#0A0F1E] px-6 py-6 text-white lg:flex-row lg:items-center">
          <div className="flex-1">
            <h2 className="text-lg font-semibold">로그인하면 내 프로필 기준 관련도를 함께 볼 수 있습니다</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">기본 비교 표는 로그인 없이 확인할 수 있고, 로그인하면 관련도 분석이 추가로 계산됩니다.</p>
          </div>
          <Link href="/login" className="inline-flex items-center justify-center rounded-xl bg-[#F97316] px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600">
            Google로 무료 시작
          </Link>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">비교에 추가해볼 만한 프로그램</h2>
          <p className="mt-1 text-sm text-slate-500">현재 비교 중인 항목을 제외한 공개 프로그램을 보여줍니다.</p>

          {suggestionsError ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-5 py-6 text-sm text-slate-500">
              추천 프로그램을 불러올 수 없습니다.
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {suggestions.map((program) => {
                const tags = normalizeTextList(program.tags).slice(0, 3);
                const programId = typeof program.id === "string" ? program.id : "";
                const disabled = !programId || canonicalIds.includes(programId);

                return (
                  <article key={programId || String(program.id)} className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{program.source || "출처 미상"}</span>
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
                          : "border border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-500 hover:text-white"
                      }`}
                    >
                      + 비교에 추가
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>
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
