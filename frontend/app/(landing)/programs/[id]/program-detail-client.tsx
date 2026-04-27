"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import AdSlot from "@/components/AdSlot";
import { cx, iso } from "@/components/ui/isoser-ui";
import { trackProgramDetailView } from "@/lib/api/app";
import type { ProgramDetail } from "@/lib/types";

import ProgramBookmarkButton from "../program-bookmark-button";

type ProgramDetailClientProps = {
  program: ProgramDetail;
  isLoggedIn: boolean;
  initialBookmarked?: boolean;
};

type DetailSection = {
  id: string;
  label: string;
  eyebrow: string;
  title: string;
  body: ReactNode;
};

function textList(value: string[] | null | undefined): string[] {
  return Array.isArray(value)
    ? value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean)
    : [];
}

function uniqueTextList(items: string[]): string[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const normalized = item.trim();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function formatDateLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function formatDateRange(startDate: string | null | undefined, endDate: string | null | undefined): string | null {
  if (!startDate && !endDate) return null;
  return `${formatDateLabel(startDate) || "시작일 미정"} - ${formatDateLabel(endDate) || "종료일 미정"}`;
}

function formatMoney(value: number | null | undefined): string | null {
  if (typeof value !== "number") return null;
  if (value === 0) return "무료";
  return `${value.toLocaleString("ko-KR")}원`;
}

function formatSelfPayLabel(value: number | null | undefined, trainingFee: number | null | undefined): string | null {
  if (typeof value !== "number") return null;
  if (typeof trainingFee === "number" && trainingFee > 0 && value >= trainingFee) {
    return "자부담금 정보 확인 필요";
  }
  return formatMoney(value);
}

function joinNonEmpty(values: Array<string | number | null | undefined>, separator = " · "): string | null {
  const items = values
    .map((value) => (value === null || value === undefined ? "" : String(value).trim()))
    .filter(Boolean);
  return items.length ? items.join(separator) : null;
}

function formatDaysLeft(value: number | null | undefined): string | null {
  if (typeof value !== "number") return null;
  if (value < 0) return "마감";
  if (value === 0) return "D-Day";
  return `D-${value}`;
}

function getDeadlineState(value: string | null | undefined): { label: string; subLabel: string | null; active: boolean } {
  if (!value) {
    return { label: "일정 확인", subLabel: null, active: false };
  }

  const deadline = new Date(value);
  if (Number.isNaN(deadline.getTime())) {
    return { label: "마감일", subLabel: value, active: false };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);
  const daysLeft = Math.floor((deadline.getTime() - today.getTime()) / 86400000);
  const formatted = deadline.toLocaleDateString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit" });

  if (daysLeft < 0) return { label: "마감", subLabel: formatted, active: false };
  if (daysLeft === 0) return { label: "D-Day", subLabel: formatted, active: true };
  return { label: `D-${daysLeft}`, subLabel: formatted, active: true };
}

function getInitials(program: ProgramDetail): string {
  const source = program.provider || program.organizer || program.title || "이소서";
  return source.trim().slice(0, 2);
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

const sectionIconById: Record<string, string> = {
  "sec-overview": "▣",
  "sec-org": "한",
  "sec-schedule": "▦",
  "sec-target": "◎",
  "sec-outcomes": "↗",
  "sec-fee": "₩",
  "sec-apply": "✓",
  "sec-career": "◆",
  "sec-notice": "!",
  "sec-detail-meta": "i",
  "sec-curriculum": "▤",
  "sec-reviews": "★",
  "sec-qna": "?",
};

function SectionCard({ section }: { section: DetailSection }) {
  return (
    <section id={section.id} className={cx("scroll-mt-36 overflow-hidden rounded-3xl", iso.softPanel)}>
      <div className="flex items-center gap-4 border-b border-slate-100 px-6 py-5 sm:px-7">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-sm font-black text-orange-700">
          {sectionIconById[section.id] || "•"}
        </span>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">{section.eyebrow}</p>
          <h2 className="mt-0.5 text-xl font-semibold tracking-tight text-slate-950">{section.title}</h2>
        </div>
      </div>
      <div className="px-6 py-6 sm:px-7">{section.body}</div>
    </section>
  );
}

function AccordionList({ items }: { items: Array<{ title: string; content: ReactNode }> }) {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        return (
          <div key={`${item.title}-${index}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? -1 : index)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
            >
              <span className="text-sm font-semibold text-slate-900">{item.title}</span>
              <span className="text-sm font-semibold text-slate-500">{isOpen ? "접기" : "열기"}</span>
            </button>
            {isOpen ? <div className="border-t border-slate-200 bg-white px-5 py-4 text-sm leading-7 text-slate-700">{item.content}</div> : null}
          </div>
        );
      })}
    </div>
  );
}

function FactGrid({ facts }: { facts: Array<[string, string]> }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {facts.map(([label, value]) => (
        <div key={label} className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-4">
          <dt className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</dt>
          <dd className="mt-2 text-sm font-semibold leading-6 text-slate-900">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ChipList({ items }: { items: string[] }) {
  const uniqueItems = uniqueTextList(items);

  return (
    <div className="flex flex-wrap gap-2">
      {uniqueItems.map((item) => (
        <span key={item} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
          {item}
        </span>
      ))}
    </div>
  );
}

function getRecordText(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return null;
}

export default function ProgramDetailClient({
  program,
  isLoggedIn,
  initialBookmarked = false,
}: ProgramDetailClientProps) {
  const trackedProgramIdRef = useRef<string | null>(null);
  const [shareStatus, setShareStatus] = useState<"idle" | "copied" | "failed">("idle");
  const eligibility = textList(program.eligibility);
  const tags = textList(program.tags);
  const techStack = textList(program.tech_stack);
  const displayCategories = textList(program.display_categories);
  const extractedKeywords = textList(program.extracted_keywords);
  const certifications = textList(program.certifications);
  const curriculum = textList(program.curriculum);
  const recommendedFor = textList(program.recommended_for);
  const learningOutcomes = textList(program.learning_outcomes);
  const careerSupport = textList(program.career_support);
  const faq = useMemo(
    () => (Array.isArray(program.faq) ? program.faq.filter((item) => item.question && item.answer) : []),
    [program.faq]
  );
  const reviews = useMemo(() => (Array.isArray(program.reviews) ? program.reviews : []), [program.reviews]);
  const applicationPeriod = formatDateRange(program.application_start_date, program.application_end_date);
  const programPeriod = formatDateRange(program.program_start_date, program.program_end_date);
  const feeLabel = formatMoney(program.fee);
  const supportAmountLabel = formatSelfPayLabel(program.support_amount, program.fee);
  const categoryLabel = joinNonEmpty([displayCategories.join(", ") || null, program.category_detail, program.category]);
  const ncsLabel = joinNonEmpty([program.ncs_name, program.ncs_code]);
  const participationLabel = joinNonEmpty([program.participation_time, program.participation_time_text]);
  const ratingDetailLabel = joinNonEmpty([
    program.rating_display || program.rating,
    program.rating_raw ? `원점수 ${program.rating_raw}` : null,
    typeof program.rating_normalized === "number" && typeof program.rating_scale === "number"
      ? `${program.rating_normalized}/${program.rating_scale}`
      : null,
  ]);
  const deadlineState = getDeadlineState(program.application_end_date);
  const externalLink = program.source_url;

  const sections = useMemo<DetailSection[]>(() => {
    const nextSections: DetailSection[] = [];
    const overviewFacts = [
      ["지역", program.location],
      ["운영기관 원천", program.source],
      ["과정 분류", categoryLabel],
      ["NCS", ncsLabel],
      ["운영 방식", program.teaching_method],
      ["참여 시간", participationLabel],
      ["선발 절차", program.selection_process_label],
      ["지원 유형", program.support_type],
      ["만족도", ratingDetailLabel],
      ["후기 수", typeof program.review_count === "number" ? `${program.review_count}개` : null],
      ["모집 정원", typeof program.capacity_total === "number" ? `${program.capacity_total}명` : null],
    ].filter((entry): entry is [string, string] => Boolean(entry[1]));

    if (program.description || overviewFacts.length || tags.length || techStack.length || extractedKeywords.length) {
      nextSections.push({
        id: "sec-overview",
        label: "프로그램 요약",
        eyebrow: "Overview",
        title: "프로그램 요약",
        body: (
          <div className="space-y-5">
            {program.description ? <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{program.description}</p> : null}
            {overviewFacts.length ? <FactGrid facts={overviewFacts} /> : null}
            {tags.length || techStack.length || extractedKeywords.length ? (
              <ChipList items={[...tags, ...techStack, ...extractedKeywords].slice(0, 16)} />
            ) : null}
          </div>
        ),
      });
    }

    const orgFacts = [
      ["운영 기관", program.provider],
      ["주관/담당", program.organizer],
      ["지역", program.location],
      ["담당자", program.manager_name],
      ["전화", program.phone],
      ["이메일", program.email],
    ].filter((entry): entry is [string, string] => Boolean(entry[1]));
    if (orgFacts.length) {
      nextSections.push({
        id: "sec-org",
        label: "교육기관 정보",
        eyebrow: "Institution",
        title: "교육기관 정보",
        body: <FactGrid facts={orgFacts} />,
      });
    }

    const scheduleFacts = [
      ["신청 기간", applicationPeriod],
      ["교육 기간", programPeriod],
      ["일정 요약", program.schedule_text],
      ["운영 방식", program.teaching_method],
      ["참여 시간", participationLabel],
      ["상세 마감", formatDateLabel(program.deadline)],
      ["잔여 정원", typeof program.capacity_remaining === "number" ? `${program.capacity_remaining}명` : null],
    ].filter((entry): entry is [string, string] => Boolean(entry[1]));
    if (scheduleFacts.length) {
      nextSections.push({
        id: "sec-schedule",
        label: "일정 & 수업",
        eyebrow: "Schedule",
        title: "일정 & 수업",
        body: <FactGrid facts={scheduleFacts} />,
      });
    }

    if (recommendedFor.length) {
      nextSections.push({
        id: "sec-target",
        label: "추천 대상",
        eyebrow: "Target",
        title: "추천 대상",
        body: (
          <ol className="space-y-3">
            {recommendedFor.map((item, index) => (
              <li key={`${item}-${index}`} className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white">
                  {index + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        ),
      });
    }

    if (learningOutcomes.length) {
      nextSections.push({
        id: "sec-outcomes",
        label: "학습 목표",
        eyebrow: "Outcomes",
        title: "학습 목표",
        body: <ChipList items={learningOutcomes} />,
      });
    }

    const feeFacts = [
      ["훈련비", feeLabel],
      ["자부담금", supportAmountLabel],
      ["비용 유형", program.cost_type],
      ["지원 유형", program.support_type],
    ].filter((entry): entry is [string, string] => Boolean(entry[1]));
    if (feeFacts.length || certifications.length) {
      nextSections.push({
        id: "sec-fee",
        label: "훈련비 & 자부담금",
        eyebrow: "Fee",
        title: "훈련비 & 자부담금",
        body: (
          <div className="space-y-5">
            {feeFacts.length ? <FactGrid facts={feeFacts} /> : null}
            {certifications.length ? <ChipList items={certifications} /> : null}
          </div>
        ),
      });
    }

    const applicationFacts = [
      ["신청 방법", program.application_method],
      ["선발 절차", program.selection_process_label],
      ["신청 마감", formatDateLabel(program.application_end_date)],
      ["공고 원천", program.source],
    ].filter((entry): entry is [string, string] => Boolean(entry[1]));
    if (eligibility.length || applicationFacts.length || externalLink) {
      nextSections.push({
        id: "sec-apply",
        label: "지원 자격 & 절차",
        eyebrow: "Application",
        title: "지원 자격 & 절차",
        body: (
          <div className="space-y-4">
            {applicationFacts.length ? <FactGrid facts={applicationFacts} /> : null}
            {eligibility.length ? (
              <ul className="space-y-2 text-sm leading-7 text-slate-700">
                {eligibility.map((item, index) => (
                  <li key={`${item}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    {item}
                  </li>
                ))}
              </ul>
            ) : null}
            {externalLink ? (
              <a href={externalLink} target="_blank" rel="noreferrer" className={cx("inline-flex rounded-full px-5 py-3 text-sm font-semibold", iso.primaryButton)}>
                신청 페이지로 이동
              </a>
            ) : null}
          </div>
        ),
      });
    }

    if (careerSupport.length || program.job_placement_rate) {
      nextSections.push({
        id: "sec-career",
        label: "취업 지원",
        eyebrow: "Career",
        title: "취업 지원",
        body: (
          <div className="space-y-4">
            {program.job_placement_rate ? <FactGrid facts={[["취업률", program.job_placement_rate]]} /> : null}
            {careerSupport.length ? <ChipList items={careerSupport} /> : null}
          </div>
        ),
      });
    }

    if (program.ai_matching_summary || program.event_banner) {
      nextSections.push({
        id: "sec-notice",
        label: "추가 안내",
        eyebrow: "Notice",
        title: "추가 안내",
        body: (
          <div className="space-y-3 text-sm leading-7 text-slate-700">
            {program.ai_matching_summary ? <p className={cx("rounded-2xl px-5 py-4", iso.darkBand)}>{program.ai_matching_summary}</p> : null}
            {program.event_banner ? <p className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">{program.event_banner}</p> : null}
          </div>
        ),
      });
    }

    const detailFacts = [
      ["공고 ID", program.id ? String(program.id) : null],
      ["운영기관 원천", program.source],
      ["과정 분류", categoryLabel],
      ["NCS", ncsLabel],
      ["비용 유형", program.cost_type],
      ["참여 시간", participationLabel],
      ["신청 방법", program.application_method],
      ["선발 절차", program.selection_process_label],
      ["모집 상태", formatDaysLeft(program.days_left)],
      ["마감일", formatDateLabel(program.deadline)],
      ["만족도", ratingDetailLabel],
      ["후기 수", typeof program.review_count === "number" ? `${program.review_count}개` : null],
    ].filter((entry): entry is [string, string] => Boolean(entry[1]));
    if (detailFacts.length) {
      nextSections.push({
        id: "sec-detail-meta",
        label: "상세 정보",
        eyebrow: "Details",
        title: "상세 정보",
        body: <FactGrid facts={detailFacts} />,
      });
    }

    if (curriculum.length) {
      nextSections.push({
        id: "sec-curriculum",
        label: "커리큘럼",
        eyebrow: "Curriculum",
        title: "커리큘럼",
        body: <AccordionList items={curriculum.map((item, index) => ({ title: `${index + 1}. ${item.slice(0, 36)}`, content: item }))} />,
      });
    }

    if (reviews.length) {
      nextSections.push({
        id: "sec-reviews",
        label: "후기",
        eyebrow: "Reviews",
        title: "수강 후기",
        body: (
          <div className="grid gap-4 md:grid-cols-2">
            {reviews.map((review, index) => {
              const text = getRecordText(review, ["text", "content", "review", "comment"]);
              const author = getRecordText(review, ["author", "name", "user"]);
              const rating = getRecordText(review, ["rating", "score"]);
              return text ? (
                <article key={`${text}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  {rating ? <p className="text-xs font-bold text-amber-600">{rating}</p> : null}
                  <p className="mt-2 text-sm leading-7 text-slate-700">{text}</p>
                  {author ? <p className="mt-4 text-xs font-semibold text-slate-500">{author}</p> : null}
                </article>
              ) : null;
            })}
          </div>
        ),
      });
    }

    if (faq.length) {
      nextSections.push({
        id: "sec-qna",
        label: "Q&A",
        eyebrow: "Q&A",
        title: "자주 묻는 질문",
        body: <AccordionList items={faq.map((item) => ({ title: item.question, content: item.answer }))} />,
      });
    }

    return nextSections;
  }, [
    applicationPeriod,
    careerSupport,
    categoryLabel,
    certifications,
    curriculum,
    eligibility,
    externalLink,
    extractedKeywords,
    faq,
    feeLabel,
    learningOutcomes,
    ncsLabel,
    participationLabel,
    program,
    programPeriod,
    ratingDetailLabel,
    recommendedFor,
    reviews,
    supportAmountLabel,
    tags,
    techStack,
  ]);

  const [activeSectionId, setActiveSectionId] = useState(sections[0]?.id || "");
  const topTabs = sections.filter((section) => ["sec-overview", "sec-curriculum", "sec-reviews", "sec-qna"].includes(section.id));
  const sidebarFacts = [
    ["기간", programPeriod],
    ["지역", program.location],
    ["훈련비", feeLabel],
    ["자부담금", supportAmountLabel],
    ["운영 방식", program.teaching_method],
    ["참여 시간", participationLabel],
    ["잔여 정원", typeof program.capacity_remaining === "number" ? `${program.capacity_remaining}명` : null],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
  const heroFacts = [
    ["모집 마감", deadlineState.subLabel || deadlineState.label],
    ["교육 기간", programPeriod],
    ["수업 형태", program.teaching_method],
    ["훈련비", feeLabel],
    ["자부담금", supportAmountLabel],
    ["잔여 정원", typeof program.capacity_remaining === "number" ? `${program.capacity_remaining}명` : null],
  ].filter((entry): entry is [string, string] => Boolean(entry[1])).slice(0, 5);
  const heroBadges = [program.support_type, deadlineState.active ? "모집 중" : deadlineState.label, program.location].filter(
    (item): item is string => Boolean(item)
  );

  useEffect(() => {
    const programId = typeof program.id === "string" || typeof program.id === "number" ? String(program.id) : "";
    if (!programId || trackedProgramIdRef.current === programId) {
      return;
    }

    trackedProgramIdRef.current = programId;
    void trackProgramDetailView(programId).catch(() => {
      trackedProgramIdRef.current = null;
    });
  }, [program.id]);

  useEffect(() => {
    if (!sections.length) return;
    const handleScroll = () => {
      let current = sections[0].id;
      for (const section of sections) {
        const element = document.getElementById(section.id);
        if (element && window.scrollY >= element.offsetTop - 180) {
          current = section.id;
        }
      }
      setActiveSectionId(current);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [sections]);

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareStatus("copied");
    } catch {
      setShareStatus("failed");
    }
  }

  return (
    <main className={iso.page}>
      <section className={cx("border-b border-white/70", iso.glassPanel)}>
        <div className="border-b border-white/70 bg-white/65">
          <div className="mx-auto flex h-11 max-w-7xl items-center gap-2 px-6 text-xs text-slate-400">
            <Link href="/" className="font-medium text-slate-500 transition hover:text-slate-950">
              이소서
            </Link>
            <span>/</span>
            <Link href="/programs" className="font-medium text-slate-500 transition hover:text-slate-950">
              프로그램 허브
            </Link>
            <span>/</span>
            <span className="truncate font-semibold text-slate-900">{program.title || "프로그램 상세"}</span>
          </div>
        </div>
        <div className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,#f8fafc_0%,#eef3f8_58%,#e7eef8_100%)]" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.22] [background-image:linear-gradient(#d8e3f2_0.5px,transparent_0.5px),linear-gradient(90deg,#d8e3f2_0.5px,transparent_0.5px)] [background-size:40px_40px]" />
          <Link href="/programs" className="relative z-10 mx-auto block max-w-7xl px-6 py-4 text-sm font-semibold text-slate-500 transition hover:text-slate-950">
            프로그램 목록으로
          </Link>
          <div className="relative z-10 mx-auto grid max-w-7xl gap-8 px-6 pb-0 pt-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
          <div className="flex aspect-[4/3] items-center justify-center rounded-3xl border border-white/70 bg-gradient-to-br from-[#071a36] via-[#094cb2] to-[#1d4ed8] text-5xl font-black text-white shadow-xl">
            {getInitials(program)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              {heroBadges.map((badge, index) => (
                <span key={`${badge}-${index}`} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
                  {badge}
                </span>
              ))}
            </div>
            <h1 className="mt-4 max-w-4xl text-3xl font-black leading-tight tracking-tight text-slate-950 sm:text-4xl">
              {program.title || "제목 미정"}
            </h1>
            {program.provider || program.organizer ? (
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {program.provider ? <strong className="font-semibold text-orange-700">{program.provider}</strong> : null}
                {program.provider && program.organizer ? " · " : null}
                {program.organizer}
              </p>
            ) : null}
            {heroFacts.length ? (
              <dl className="mt-8 grid overflow-hidden rounded-t-3xl border border-b-0 border-white/70 bg-white/80 sm:grid-cols-2 lg:grid-cols-5">
                {heroFacts.map(([label, value]) => (
                  <div key={label} className="border-b border-r border-slate-200 px-5 py-4 last:border-r-0 sm:border-b-0">
                    <dt className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{label}</dt>
                    <dd className="mt-2 text-sm font-black text-slate-950">{value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
          </div>
        </div>
      </section>

      {topTabs.length ? (
        <nav className="sticky top-[100px] z-20 border-b border-white/70 bg-white/92 backdrop-blur">
          <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-6">
            {topTabs.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => scrollToSection(section.id)}
                className={`h-12 shrink-0 border-b-2 px-4 text-sm font-semibold transition ${
                  activeSectionId === section.id ? "border-orange-600 text-orange-700" : "border-transparent text-slate-500 hover:text-slate-950"
                }`}
              >
                {section.label}
              </button>
            ))}
          </div>
        </nav>
      ) : null}

      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="min-w-0 space-y-5">
          {sections.map((section) => (
            <SectionCard key={section.id} section={section} />
          ))}
          <AdSlot
            slotId="program-detail-bottom-banner"
            className="overflow-hidden rounded-3xl border border-white/70 bg-white/80 px-3 py-3"
          />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-40">
          <section className={cx("overflow-hidden rounded-3xl", iso.softPanel)}>
            <div className={cx("relative overflow-hidden px-6 py-5", iso.darkBand)}>
              <div className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full bg-orange-400/20 blur-2xl" />
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${deadlineState.active ? "bg-emerald-400/15 text-emerald-200" : "bg-white/10 text-slate-200"}`}>
                {deadlineState.active ? "모집 중" : deadlineState.label}
              </span>
              <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">모집 마감</p>
              <p className="mt-1 text-3xl font-black tracking-tight">{deadlineState.subLabel || deadlineState.label}</p>
              {program.schedule_text ? <p className="mt-2 text-sm leading-6 text-white/65">{program.schedule_text}</p> : null}
            </div>
            <div className="px-6 py-5">
              {sidebarFacts.length ? (
                <dl className="divide-y divide-slate-100">
                  {sidebarFacts.map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-4 py-3 text-sm">
                      <dt className="text-slate-500">{label}</dt>
                      <dd className="text-right font-semibold text-slate-900">{value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {externalLink ? (
                <a href={externalLink} target="_blank" rel="noreferrer" className={cx("mt-4 inline-flex w-full justify-center rounded-full px-5 py-3 text-sm font-bold", iso.primaryButton)}>
                  신청 페이지 바로가기
                </a>
              ) : null}
              <div className="mt-3 grid grid-cols-2 gap-2">
                {program.id ? (
                  <ProgramBookmarkButton
                    programId={String(program.id)}
                    isLoggedIn={isLoggedIn}
                    initialBookmarked={initialBookmarked}
                    className="h-auto w-auto rounded-full px-4 py-2.5 text-sm font-bold"
                    showLabel
                  />
                ) : null}
                <button
                  type="button"
                  onClick={handleShare}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:border-slate-300"
                >
                  공유
                </button>
              </div>
              <p className="mt-2 min-h-5 text-center text-xs font-medium text-slate-500" aria-live="polite">
                {shareStatus === "copied"
                  ? "상세 페이지 링크가 복사되었습니다."
                  : shareStatus === "failed"
                    ? "링크 복사에 실패했습니다. 주소창의 URL을 복사해 주세요."
                    : ""}
              </p>
            </div>
          </section>

        </aside>
      </div>
    </main>
  );
}
