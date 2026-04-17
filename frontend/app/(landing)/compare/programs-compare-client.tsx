"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { getProgramCompareRelevance } from "@/lib/api/app";
import type { CompareMeta, CompareStatus, Program } from "@/lib/types";
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

type HurdleValue = {
  label: string;
  status: CompareStatus;
  note?: string;
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
  if (!startDate || !endDate) return "정보 없음";
  return `${formatDateLabel(startDate)} ~ ${formatDateLabel(endDate)}`;
}

function getText(value: string | null | undefined): string {
  return typeof value === "string" && value.trim() ? value.trim() : "정보 없음";
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

function isCompareStatus(value: unknown): value is CompareStatus {
  return value === "pass" || value === "warn" || value === "block";
}

function resolveBooleanHurdle(
  value: boolean | CompareStatus | null | undefined,
  labels: { pass: string; warn: string; block?: string }
): HurdleValue | null {
  if (typeof value === "boolean") {
    return value ? { label: labels.warn, status: "warn" } : { label: labels.pass, status: "pass" };
  }

  if (isCompareStatus(value)) {
    return {
      label: value === "pass" ? labels.pass : value === "warn" ? labels.warn : labels.block || labels.warn,
      status: value,
    };
  }

  return null;
}

function getCodingSkillHurdle(value: CompareMeta["coding_skill_required"]): HurdleValue | null {
  if (!value) return null;
  if (value === "none" || value === "pass") return { label: "제한 없음", status: "pass" };
  if (value === "basic" || value === "warn") return { label: "기초 필요", status: "warn" };
  if (value === "required" || value === "block") return { label: "사전 학습 필수", status: "block" };
  return typeof value === "string" ? { label: value, status: "warn" } : null;
}

function getEmploymentInsuranceHurdle(value: CompareMeta["employment_insurance"]): HurdleValue | null {
  if (typeof value === "boolean") {
    return value ? { label: "확인 필요", status: "warn" } : { label: "제한 없음", status: "pass" };
  }

  if (isCompareStatus(value)) {
    return {
      label: value === "pass" ? "제한 없음" : value === "warn" ? "확인 필요" : "지원 전 해결 필요",
      status: value,
    };
  }

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (["none", "no", "pass", "무관"].includes(normalized)) {
    return { label: "제한 없음", status: "pass" };
  }
  if (["block", "restricted"].includes(normalized)) {
    return { label: "지원 전 해결 필요", status: "block" };
  }
  return { label: value.trim(), status: "warn" };
}

function getPortfolioHurdle(value: CompareMeta["portfolio_required"]): HurdleValue | null {
  const hurdle = resolveBooleanHurdle(value, {
    pass: "불필요",
    warn: "제출 필요",
    block: "제출 필수",
  });

  if (!hurdle || hurdle.status === "pass") {
    return hurdle;
  }

  return {
    ...hurdle,
    note: "이소서에서 바로 만들 수 있습니다",
  };
}

function getHurdle(meta: CompareMeta | null | undefined, key: string): HurdleValue | null {
  if (!meta) return null;

  switch (key) {
    case "coding_skill_required":
      return getCodingSkillHurdle(meta.coding_skill_required);
    case "naeilbaeumcard_required":
      return resolveBooleanHurdle(meta.naeilbaeumcard_required, { pass: "불필요", warn: "발급 필요" });
    case "employment_insurance":
      return getEmploymentInsuranceHurdle(meta.employment_insurance);
    case "portfolio_required":
      return getPortfolioHurdle(meta.portfolio_required);
    case "interview_required":
      return resolveBooleanHurdle(meta.interview_required, { pass: "없음", warn: "있음" });
    default:
      return null;
  }
}

function getHurdleClassName(status: CompareStatus): string {
  if (status === "pass") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "warn") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

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
            최대 3개 프로그램을 나란히 놓고 기본 정보, 모집 대상, 지원 허들, 커리큘럼을 한 번에 비교하세요.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full border border-blue-300/30 bg-blue-400/10 px-3 py-1 text-blue-200">개발자 대상 포함</span>
            <span className="rounded-full border border-violet-300/30 bg-violet-400/10 px-3 py-1 text-violet-200">비개발자 대상 포함</span>
            <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-emerald-200">로그인 시 관련도 분석 제공</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <section className="mb-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 lg:flex-row lg:items-center">
          <div className="shrink-0 rounded-lg bg-[#0A0F1E] px-3 py-2 text-xs font-semibold text-white">허들 표시</div>
          <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-green-500" />조건 충족 가능</div>
          <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />확인 필요</div>
          <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-rose-500" />지원 불가</div>
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
              const meta = program?.compare_meta;
              const programId = typeof program?.id === "string" ? program.id : "";
              const tags = [getDeadlineLabel(program?.days_left), meta?.target_group || null, meta?.subsidy_rate || null]
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
            {[
              ["국비 지원율", "subsidy_rate"],
              ["수업 방식", "teaching_method"],
              ["취업 연계", "employment_connection"],
            ].map(([label, key]) => (
              <div key={key} className="row contents">
                <div className="border-b border-r border-slate-200 bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600">{label}</div>
                {slots.map((program, index) => (
                  <ValueCell key={`${key}-${program?.id ?? index}`} winner={winnerIndex === index} empty={!program}>
                    {program ? getText(program.compare_meta?.[key as keyof CompareMeta] as string | null | undefined) : "정보 없음"}
                  </ValueCell>
                ))}
              </div>
            ))}

            {sectionHeader("모집 대상", "bg-violet-50 text-violet-700")}
            {[
              ["주요 대상", "target_group"],
              ["연령 제한", "age_restriction"],
              ["학력 요건", "education_requirement"],
              ["재직자 지원", "employment_restriction"],
              ["경력 조건", "experience_requirement"],
            ].map(([label, key]) => (
              <div key={key} className="row contents">
                <div className="border-b border-r border-slate-200 bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600">{label}</div>
                {slots.map((program, index) => (
                  <ValueCell key={`${key}-${program?.id ?? index}`} winner={winnerIndex === index} empty={!program}>
                    {program ? getText(program.compare_meta?.[key as keyof CompareMeta] as string | null | undefined) : "정보 없음"}
                  </ValueCell>
                ))}
              </div>
            ))}

            {sectionHeader("지원 허들", "bg-amber-50 text-amber-800", "빨간 항목은 지원 전 반드시 해결 필요")}
            {[
              ["사전 코딩 실력", "coding_skill_required"],
              ["국민내일배움카드", "naeilbaeumcard_required"],
              ["고용보험 이력", "employment_insurance"],
              ["포트폴리오 제출", "portfolio_required"],
              ["면접 / 코딩테스트", "interview_required"],
            ].map(([label, key]) => (
              <div key={key} className="row contents">
                <div className="border-b border-r border-slate-200 bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600">{label}</div>
                {slots.map((program, index) => {
                  const hurdle = getHurdle(program?.compare_meta, key);
                  return (
                    <ValueCell
                      key={`${key}-${program?.id ?? index}`}
                      winner={winnerIndex === index}
                      empty={!program || !hurdle}
                      extraClassName="flex flex-col items-start gap-2"
                    >
                      {program && hurdle ? (
                        <>
                          <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold ${getHurdleClassName(hurdle.status)}`}>
                            {hurdle.label}
                          </span>
                          {hurdle.note ? (
                            <Link href="/dashboard/resume" className="text-xs text-orange-500 hover:text-orange-600">
                              {hurdle.note}
                            </Link>
                          ) : null}
                        </>
                      ) : (
                        "정보 없음"
                      )}
                    </ValueCell>
                  );
                })}
              </div>
            ))}

            {sectionHeader("커리큘럼", "bg-blue-50 text-blue-700")}
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
              <div className="border-b border-r border-slate-200 bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600">수료 후 목표 직무</div>
              {slots.map((program, index) => (
                <ValueCell key={`target-job-${program?.id ?? index}`} winner={winnerIndex === index} empty={!program}>
                  {program ? getText(program.compare_meta?.target_job) : "정보 없음"}
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
                {program ? (
                  <>
                    {program.application_url ? (
                      <a
                        href={program.application_url}
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
                ) : (
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
            <h2 className="text-lg font-semibold">로그인하면 나의 허들 항목을 AI가 자동 판단해드립니다</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">관련도 분석은 로그인 시 바로 계산되며, 지원 허들 자동 판단은 후속 범위로 남겨둡니다.</p>
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
