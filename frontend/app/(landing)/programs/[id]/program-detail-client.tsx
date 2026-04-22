"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import AdSlot from "@/components/AdSlot";
import type { ProgramDetail } from "@/lib/types";

type ProgramDetailClientProps = {
  program: ProgramDetail;
};

type DetailSection = {
  id: string;
  label: string;
  eyebrow: string;
  title: string;
  body: ReactNode;
};

function textList(value: string[] | null | undefined): string[] {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim().length > 0) : [];
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

function SectionCard({ section }: { section: DetailSection }) {
  return (
    <section id={section.id} className="scroll-mt-36 rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-5 sm:px-7">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">{section.eyebrow}</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">{section.title}</h2>
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
        <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
          <dt className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</dt>
          <dd className="mt-2 text-sm font-semibold leading-6 text-slate-900">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ChipList({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
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

export default function ProgramDetailClient({ program }: ProgramDetailClientProps) {
  const [bookmarked, setBookmarked] = useState(false);
  const eligibility = textList(program.eligibility);
  const tags = textList(program.tags);
  const techStack = textList(program.tech_stack);
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
  const supportAmountLabel = formatMoney(program.support_amount);
  const deadlineState = getDeadlineState(program.application_end_date || program.program_end_date);
  const externalLink = program.source_url;

  const sections = useMemo<DetailSection[]>(() => {
    const nextSections: DetailSection[] = [];
    const overviewFacts = [
      ["지역", program.location],
      ["운영 방식", program.teaching_method],
      ["지원 유형", program.support_type],
      ["만족도", program.rating_display || program.rating],
      ["후기 수", typeof program.review_count === "number" ? `${program.review_count}개` : null],
      ["모집 정원", typeof program.capacity_total === "number" ? `${program.capacity_total}명` : null],
    ].filter((entry): entry is [string, string] => Boolean(entry[1]));

    if (program.description || overviewFacts.length || tags.length || techStack.length) {
      nextSections.push({
        id: "sec-overview",
        label: "프로그램 요약",
        eyebrow: "Overview",
        title: "프로그램 요약",
        body: (
          <div className="space-y-5">
            {program.description ? <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{program.description}</p> : null}
            {overviewFacts.length ? <FactGrid facts={overviewFacts} /> : null}
            {tags.length || techStack.length ? <ChipList items={[...tags, ...techStack].slice(0, 12)} /> : null}
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
              <li key={item} className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700">
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
      ["수강료", feeLabel],
      ["지원금", supportAmountLabel],
      ["지원 유형", program.support_type],
    ].filter((entry): entry is [string, string] => Boolean(entry[1]));
    if (feeFacts.length || certifications.length) {
      nextSections.push({
        id: "sec-fee",
        label: "수강료 & 지원금",
        eyebrow: "Fee",
        title: "수강료 & 지원금",
        body: (
          <div className="space-y-5">
            {feeFacts.length ? <FactGrid facts={feeFacts} /> : null}
            {certifications.length ? <ChipList items={certifications} /> : null}
          </div>
        ),
      });
    }

    if (eligibility.length || externalLink) {
      nextSections.push({
        id: "sec-apply",
        label: "지원 자격 & 절차",
        eyebrow: "Application",
        title: "지원 자격 & 절차",
        body: (
          <div className="space-y-4">
            {eligibility.length ? (
              <ul className="space-y-2 text-sm leading-7 text-slate-700">
                {eligibility.map((item) => (
                  <li key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    {item}
                  </li>
                ))}
              </ul>
            ) : null}
            {externalLink ? (
              <a href={externalLink} target="_blank" rel="noreferrer" className="inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
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
            {program.ai_matching_summary ? <p className="rounded-2xl bg-slate-950 px-5 py-4 text-white">{program.ai_matching_summary}</p> : null}
            {program.event_banner ? <p className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">{program.event_banner}</p> : null}
          </div>
        ),
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
    certifications,
    curriculum,
    eligibility,
    externalLink,
    faq,
    feeLabel,
    learningOutcomes,
    program,
    programPeriod,
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
    ["수강료", feeLabel],
    ["지원금", supportAmountLabel],
    ["운영 방식", program.teaching_method],
    ["잔여 정원", typeof program.capacity_remaining === "number" ? `${program.capacity_remaining}명` : null],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
  const heroFacts = [
    ["모집 마감", deadlineState.subLabel || deadlineState.label],
    ["교육 기간", programPeriod],
    ["수업 형태", program.teaching_method],
    ["수강료", feeLabel],
    ["잔여 정원", typeof program.capacity_remaining === "number" ? `${program.capacity_remaining}명` : null],
  ].filter((entry): entry is [string, string] => Boolean(entry[1])).slice(0, 5);
  const heroBadges = [program.support_type, deadlineState.active ? "모집 중" : deadlineState.label, program.location].filter(
    (item): item is string => Boolean(item)
  );

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

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <Link href="/programs" className="text-sm font-semibold text-slate-500 transition hover:text-slate-950">
            프로그램 목록으로
          </Link>
        </div>
        <div className="mx-auto grid max-w-7xl gap-8 px-6 pb-0 pt-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
          <div className="flex aspect-[4/3] items-center justify-center rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 via-indigo-900 to-teal-700 text-5xl font-black text-white shadow-xl">
            {getInitials(program)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              {heroBadges.map((badge) => (
                <span key={badge} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
                  {badge}
                </span>
              ))}
            </div>
            <h1 className="mt-4 max-w-4xl text-3xl font-black leading-tight tracking-tight text-slate-950 sm:text-4xl">
              {program.title || "제목 미정"}
            </h1>
            {program.provider || program.organizer ? (
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {program.provider ? <strong className="font-semibold text-teal-700">{program.provider}</strong> : null}
                {program.provider && program.organizer ? " · " : null}
                {program.organizer}
              </p>
            ) : null}
            {heroFacts.length ? (
              <dl className="mt-8 grid overflow-hidden rounded-t-3xl border border-b-0 border-slate-200 bg-slate-50 sm:grid-cols-2 lg:grid-cols-5">
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
      </section>

      {topTabs.length ? (
        <nav className="sticky top-[100px] z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-6">
            {topTabs.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => scrollToSection(section.id)}
                className={`h-12 shrink-0 border-b-2 px-4 text-sm font-semibold transition ${
                  activeSectionId === section.id ? "border-indigo-700 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-950"
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
            className="overflow-hidden rounded-3xl border border-slate-200 bg-white px-3 py-3"
          />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-40">
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="bg-slate-950 px-6 py-5 text-white">
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
                <a href={externalLink} target="_blank" rel="noreferrer" className="mt-4 inline-flex w-full justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800">
                  신청 페이지 바로가기
                </a>
              ) : null}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBookmarked((value) => !value)}
                  className={`rounded-full border px-4 py-2.5 text-sm font-bold transition ${
                    bookmarked ? "border-amber-300 bg-amber-50 text-amber-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {bookmarked ? "북마크됨" : "북마크"}
                </button>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(window.location.href)}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:border-slate-300"
                >
                  공유
                </button>
              </div>
            </div>
          </section>

          {sections.length ? (
            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
                빠른 목차
              </div>
              <div className="py-2">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => scrollToSection(section.id)}
                    className={`flex w-full items-center gap-3 border-l-2 px-5 py-2.5 text-left text-sm transition ${
                      activeSectionId === section.id
                        ? "border-indigo-700 bg-indigo-50 text-indigo-700"
                        : "border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-950"
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {section.label}
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
