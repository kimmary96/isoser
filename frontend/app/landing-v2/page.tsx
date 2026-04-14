"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useState } from "react";

type TickerItem = {
  tone: "red" | "orange" | "amber" | "green";
  text: string;
};

type DdayCard = {
  deadline: string;
  title: string;
  source: string;
  tone: "red" | "orange" | "amber";
  urgent?: boolean;
};

type ProgramCard = {
  source: string;
  deadline: string;
  deadlineTone: "red" | "orange" | "amber" | "green";
  title: string;
  tags: string[];
  category: string;
  subsidy?: string;
  match: number;
  borderTone: "urgent" | "warm" | "calm" | "ad";
  ad?: boolean;
  primaryLabel: string;
};

type CompareCard = {
  title: string;
  deadline: string;
  deadlineTone: "red" | "amber" | "muted";
  subsidy: string;
  duration: string;
  outcome: string;
  match: number;
  winner?: boolean;
};

type FlowStep = {
  step: string;
  title: string;
  description: string;
  tone: "blue" | "amber" | "orange" | "green";
};

const tickerItems: TickerItem[] = [
  { tone: "red", text: "D-1 · K-디지털 풀스택 개발자 과정 · HRD넷" },
  { tone: "orange", text: "D-3 · 청년 AI 데이터 인턴십 2기 · 고용24" },
  { tone: "amber", text: "D-5 · 내일배움카드 AI 자동화 실무 과정 · HRD넷" },
  { tone: "amber", text: "D-7 · UX/UI 디자이너 양성과정 · 서울시" },
  { tone: "green", text: "D-12 · 경영·스타트업 실무 과정 · K-Startup" },
];

const heroCards: DdayCard[] = [
  {
    deadline: "D-1",
    title: "K-디지털 풀스택 개발자 과정",
    source: "HRD넷 · 서울",
    tone: "red",
    urgent: true,
  },
  {
    deadline: "D-3",
    title: "청년 AI 데이터 인턴십",
    source: "고용24 · 서울",
    tone: "orange",
  },
  {
    deadline: "D-7",
    title: "UX/UI 디자이너 양성과정",
    source: "서울시 · 마포구",
    tone: "amber",
  },
];

const chipOptions = [
  "전체",
  "마감임박",
  "AI·데이터",
  "IT·개발",
  "디자인",
  "경영",
  "창업",
  "서울",
  "경기",
  "온라인",
  "국비100%",
];

const programCards: ProgramCard[] = [
  {
    source: "HRD넷 · 서울 · 강남",
    deadline: "D-1",
    deadlineTone: "red",
    title: "K-디지털 풀스택 개발자 과정 6기",
    tags: ["6개월", "취업연계"],
    category: "IT·개발",
    subsidy: "국비 100%",
    match: 87,
    borderTone: "urgent",
    primaryLabel: "지원하기",
  },
  {
    source: "고용24 · 서울",
    deadline: "D-3",
    deadlineTone: "orange",
    title: "청년 AI 데이터 분석 인턴십 2기",
    tags: ["3개월"],
    category: "AI·데이터",
    subsidy: "월 200만원 지원",
    match: 72,
    borderTone: "warm",
    primaryLabel: "지원하기",
  },
  {
    source: "코드잇 스프린트 · 서울",
    deadline: "상시",
    deadlineTone: "green",
    title: "코드잇 스프린트 프론트엔드 6기",
    tags: ["5개월", "멘토링 포함"],
    category: "IT·개발",
    subsidy: "국비 80%",
    match: 65,
    borderTone: "ad",
    ad: true,
    primaryLabel: "자세히 보기",
  },
  {
    source: "서울시 · 온라인",
    deadline: "D-6",
    deadlineTone: "amber",
    title: "브랜드 디자이너 취업 연계 트랙",
    tags: ["포트폴리오", "온라인"],
    category: "디자인",
    subsidy: "국비 100%",
    match: 69,
    borderTone: "calm",
    primaryLabel: "지원하기",
  },
  {
    source: "K-Startup · 경기",
    deadline: "D-4",
    deadlineTone: "orange",
    title: "예비창업자 성장캠프 실전 과정",
    tags: ["8주", "멘토링"],
    category: "창업",
    subsidy: "국비 100%",
    match: 74,
    borderTone: "warm",
    primaryLabel: "지원하기",
  },
  {
    source: "고용24 · 하이브리드",
    deadline: "D-7",
    deadlineTone: "amber",
    title: "퍼포먼스 마케팅 취업 캠프",
    tags: ["12주", "실무 프로젝트"],
    category: "경영",
    subsidy: "국비 100%",
    match: 68,
    borderTone: "calm",
    primaryLabel: "지원하기",
  },
];

const compareCards: CompareCard[] = [
  {
    title: "K-디지털 풀스택 개발자 과정",
    deadline: "D-1 · 내일 마감",
    deadlineTone: "red",
    subsidy: "100% 전액",
    duration: "6개월",
    outcome: "취업연계",
    match: 87,
    winner: true,
  },
  {
    title: "코드잇 스프린트 프론트엔드",
    deadline: "상시 모집",
    deadlineTone: "muted",
    subsidy: "80%",
    duration: "5개월",
    outcome: "멘토링 포함",
    match: 65,
  },
  {
    title: "패스트캠퍼스 데이터 부트캠프",
    deadline: "D-12",
    deadlineTone: "amber",
    subsidy: "70%",
    duration: "4개월",
    outcome: "기업 프로젝트",
    match: 71,
  },
];

const flowSteps: FlowStep[] = [
  {
    step: "01",
    title: "정보 탐색",
    description: "국비 교육, 청년 인턴십, 취창업 지원 사업을 한 화면에서 탐색합니다.",
    tone: "blue",
  },
  {
    step: "02",
    title: "AI 맞춤 추천",
    description: "내 프로필과 관심 분야를 기반으로 관련도 높은 순서로 정렬합니다.",
    tone: "amber",
  },
  {
    step: "03",
    title: "서류 즉시 생성",
    description: "이력서와 포트폴리오 초안을 바로 생성해 제출 준비를 줄입니다.",
    tone: "orange",
  },
  {
    step: "04",
    title: "바로 지원",
    description: "마감 전 필요한 서류를 정리하고 바로 지원 흐름으로 연결합니다.",
    tone: "green",
  },
];

const tickerLoop = [...tickerItems, ...tickerItems];

const toneClassMap: Record<TickerItem["tone"], string> = {
  red: "bg-[rgba(255,255,255,0.28)]",
  orange: "bg-[rgba(255,255,255,0.22)]",
  amber: "bg-[rgba(255,255,255,0.18)]",
  green: "bg-[rgba(255,255,255,0.18)]",
};

export default function LandingV2Page() {
  const [activeChip, setActiveChip] = useState("전체");
  const [keyword, setKeyword] = useState("");

  return (
    <main
      className="min-h-screen bg-[var(--surface)] text-[var(--ink)]"
      style={
        {
          "--ink": "#0A0F1E",
          "--ink-mid": "#151E38",
          "--ink-soft": "#1F2E52",
          "--blue": "#2563EB",
          "--blue-lo": "#1D4ED8",
          "--sky": "#60A5FA",
          "--fire": "#F97316",
          "--fire-lo": "#EA580C",
          "--red": "#EF4444",
          "--amber": "#F59E0B",
          "--green": "#22C55E",
          "--surface": "#F1F5F9",
          "--white": "#FFFFFF",
          "--border": "#E2E8F0",
          "--muted": "#94A3B8",
          "--sub": "#64748B",
        } as CSSProperties
      }
    >
      <div className="sticky top-0 z-[220] h-9 overflow-hidden bg-[var(--red)] text-white">
        <div className="ticker-track flex h-full min-w-max items-center">
          {tickerLoop.map((item, index) => (
            <div key={`${item.text}-${index}`} className="ticker-item inline-flex items-center gap-3 px-6">
              <span className={`h-2 w-2 rounded-full ${toneClassMap[item.tone]}`} />
              <span className="text-[11px] font-bold tracking-[0.02em] sm:text-xs">{item.text}</span>
              <span className="opacity-50">|</span>
            </div>
          ))}
        </div>
      </div>

      <nav className="sticky top-9 z-[210] border-b border-white/10 bg-[rgba(10,15,30,0.96)] px-5 py-4 backdrop-blur-xl sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-6xl items-center gap-4">
          <div className="text-xl font-extrabold tracking-[-0.04em] text-white">
            이소<span className="text-[var(--sky)]">서</span>
          </div>
          <div className="ml-auto hidden items-center gap-7 text-sm text-white/60 md:flex">
            <Link href="/programs" className="transition hover:text-white">
              프로그램
            </Link>
            <a href="#compare" className="transition hover:text-white">
              부트캠프 비교
            </a>
            <a href="#flow" className="transition hover:text-white">
              이용 흐름
            </a>
          </div>
          <Link
            href="/login"
            className="rounded-lg bg-[var(--fire)] px-4 py-2 text-sm font-bold text-white shadow-[0_6px_24px_rgba(249,115,22,0.28)] transition hover:-translate-y-0.5 hover:bg-[var(--fire-lo)]"
          >
            무료로 시작하기
          </Link>
        </div>
      </nav>

      <section className="relative overflow-hidden bg-[var(--ink)] px-5 pb-14 pt-16 text-center sm:px-8 sm:pb-16 sm:pt-20 lg:px-12">
        <div className="hero-glow absolute inset-0" />
        <div className="relative z-10 mx-auto max-w-6xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(249,115,22,0.45)] bg-[rgba(249,115,22,0.08)] px-4 py-2 text-xs font-bold text-[#FB923C]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#FB923C]" />
            지금 23개 프로그램 마감 임박
          </div>

          <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-extrabold leading-tight tracking-[-0.06em] text-white sm:text-5xl lg:text-6xl">
            취업 지원 정보,
            <br />
            <span className="hero-gradient-blue">흩어진 채로</span> 두면
            <br />
            <span className="hero-gradient-fire">기회를 놓칩니다</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
            고용24, HRD넷, K-디지털, 서울시 일자리까지
            <br />
            AI가 내 상황에 맞는 순서로 정리해드립니다.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {heroCards.map((card) => (
              <div
                key={card.title}
                className={`rounded-2xl border bg-white/5 px-5 py-5 text-left backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-[rgba(249,115,22,0.45)] hover:bg-[rgba(249,115,22,0.08)] ${
                  card.urgent ? "border-[rgba(239,68,68,0.45)] bg-[rgba(239,68,68,0.08)]" : "border-white/10"
                }`}
              >
                <div
                  className={`text-3xl font-extrabold tracking-[-0.04em] ${
                    card.tone === "red"
                      ? "text-[#F87171]"
                      : card.tone === "orange"
                        ? "text-[#FB923C]"
                        : "text-[#FCD34D]"
                  }`}
                >
                  {card.deadline}
                </div>
                <div className="mt-3 text-sm font-bold leading-6 text-white">{card.title}</div>
                <div className="mt-2 text-xs text-[var(--muted)]">{card.source}</div>
              </div>
            ))}

            <div className="flex min-h-28 items-center justify-center rounded-2xl border border-dashed border-white/20 bg-white/5 px-5 py-5 text-sm font-medium text-[var(--muted)]">
              + 20개 더 보기
            </div>
          </div>

          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/login"
              className="rounded-xl bg-[var(--fire)] px-7 py-4 text-sm font-bold text-white shadow-[0_8px_28px_rgba(249,115,22,0.32)] transition hover:-translate-y-0.5 hover:bg-[var(--fire-lo)]"
            >
              AI 맞춤 추천 받기
            </Link>
            <Link
              href="/programs"
              className="rounded-xl border border-white/15 bg-white/[0.08] px-7 py-4 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              전체 프로그램 보기
            </Link>
          </div>
        </div>
      </section>

      <section className="sticky top-[100px] z-[160] border-b border-[var(--border)] bg-white/[0.95] px-5 py-4 shadow-[0_2px_12px_rgba(15,23,42,0.06)] backdrop-blur sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 lg:w-[320px]">
            <span className="text-sm text-[var(--muted)]">검색</span>
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="과정명, 기관명, 기술 검색"
              className="w-full border-none bg-transparent text-sm font-medium text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
            />
          </div>
          <div className="hidden h-6 w-px bg-[var(--border)] lg:block" />
          <div className="-mx-1 overflow-x-auto px-1 no-scrollbar">
            <div className="flex min-w-max gap-2">
              {chipOptions.map((chip) => {
                const active = chip === activeChip;
                const urgencyChip = chip === "마감임박";

                return (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setActiveChip(chip)}
                    className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                      active
                        ? urgencyChip
                          ? "border-[var(--fire)] bg-[var(--fire)] text-white"
                          : "border-[var(--ink)] bg-[var(--ink)] text-white"
                        : urgencyChip
                          ? "border-[rgba(249,115,22,0.35)] bg-[rgba(249,115,22,0.05)] text-[var(--fire)]"
                          : "border-[var(--border)] bg-white text-[var(--sub)] hover:border-[var(--blue)] hover:text-[var(--blue)]"
                    }`}
                  >
                    {chip}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-12 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-[-0.03em] text-[var(--ink)]">
                마감 임박 프로그램 <span className="ml-2 rounded bg-[var(--red)] px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-white">D-7 이내</span>
              </h2>
              <p className="mt-2 text-sm text-[var(--sub)]">
                정보 허브에서 바로 확인할 수 있는 주요 프로그램만 먼저 정리했습니다.
              </p>
            </div>
            <Link href="/programs" className="text-sm font-semibold text-[var(--blue)]">
              전체보기 →
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {programCards.map((card) => (
              <article
                key={`${card.title}-${card.source}`}
                className={`relative rounded-2xl border bg-white p-6 transition hover:-translate-y-1 hover:shadow-[0_10px_28px_rgba(15,23,42,0.1)] ${
                  card.borderTone === "urgent"
                    ? "border-[rgba(239,68,68,0.35)]"
                    : card.borderTone === "warm"
                      ? "border-[rgba(249,115,22,0.28)]"
                      : card.borderTone === "ad"
                        ? "border-[rgba(37,99,235,0.3)] bg-[#FAFCFF]"
                        : "border-[rgba(34,197,94,0.28)]"
                }`}
              >
                {card.ad ? (
                  <span className="absolute right-4 top-4 rounded border border-[rgba(37,99,235,0.3)] px-2 py-1 text-[10px] font-bold text-[var(--blue)]">
                    광고
                  </span>
                ) : null}

                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs text-[var(--muted)]">{card.source}</span>
                  <span
                    className={`text-lg font-extrabold tracking-[-0.04em] ${
                      card.deadlineTone === "red"
                        ? "text-[var(--red)]"
                        : card.deadlineTone === "orange"
                          ? "text-[var(--fire)]"
                          : card.deadlineTone === "amber"
                            ? "text-[var(--amber)]"
                            : "text-[var(--green)]"
                    }`}
                  >
                    {card.deadline}
                  </span>
                </div>

                <h3 className="mt-4 text-lg font-bold leading-7 tracking-[-0.02em] text-[var(--ink)]">
                  {card.title}
                </h3>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-md border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-1 text-xs font-semibold text-[var(--blue)]">
                    {card.category}
                  </span>
                  {card.subsidy ? (
                    <span className="rounded-md border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-1 text-xs font-semibold text-[var(--green)]">
                      {card.subsidy}
                    </span>
                  ) : null}
                  {card.tags.map((tag) => (
                    <span
                      key={`${card.title}-${tag}`}
                      className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-medium text-[var(--sub)]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="mt-5 flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--border)]">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,var(--blue),#818CF8)]"
                      style={{ width: `${card.match}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-[var(--blue)]">관련도 {card.match}%</span>
                </div>

                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    className="flex-1 rounded-lg bg-[var(--blue)] px-4 py-3 text-sm font-bold text-white transition hover:bg-[var(--blue-lo)]"
                  >
                    {card.primaryLabel}
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-[rgba(249,115,22,0.3)] bg-[rgba(249,115,22,0.08)] px-4 py-3 text-sm font-bold text-[var(--fire)] transition hover:bg-[var(--fire)] hover:text-white"
                  >
                    비교추가
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="compare" className="px-5 pb-12 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-[28px] bg-[var(--ink)] px-6 py-10 sm:px-8 lg:px-11">
          <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-2xl font-extrabold tracking-[-0.04em] text-white">
                부트캠프 비교 분석
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                최대 3개를 나란히 놓고 조건과 관련도를 빠르게 비교할 수 있습니다.
              </p>
            </div>
            <button
              type="button"
              className="rounded-lg bg-[var(--fire)] px-5 py-3 text-sm font-bold text-white transition hover:bg-[var(--fire-lo)]"
            >
              + 비교 추가
            </button>
          </div>

          <div className="relative z-10 mt-8 grid gap-4 lg:grid-cols-3">
            {compareCards.map((card) => (
              <article
                key={card.title}
                className={`relative rounded-2xl border px-5 pb-5 pt-6 ${
                  card.winner
                    ? "border-[rgba(249,115,22,0.5)] bg-[rgba(249,115,22,0.08)]"
                    : "border-white/10 bg-white/[0.06]"
                }`}
              >
                {card.winner ? (
                  <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--fire)] px-4 py-1 text-[10px] font-extrabold tracking-[0.08em] text-white">
                    나에게 가장 적합
                  </span>
                ) : null}
                <h3 className="text-base font-bold leading-6 text-white">{card.title}</h3>
                <div className="mt-5 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[var(--muted)]">마감</span>
                    <span
                      className={`font-semibold ${
                        card.deadlineTone === "red"
                          ? "text-[#F87171]"
                          : card.deadlineTone === "amber"
                            ? "text-[#FCD34D]"
                            : "text-white/[0.75]"
                      }`}
                    >
                      {card.deadline}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[var(--muted)]">국비 지원</span>
                    <span className={card.winner ? "font-extrabold text-[var(--fire)]" : "font-semibold text-white/[0.85]"}>
                      {card.subsidy}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[var(--muted)]">기간</span>
                    <span className="font-semibold text-white/[0.85]">{card.duration}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[var(--muted)]">특징</span>
                    <span className={card.winner ? "font-extrabold text-[var(--fire)]" : "font-semibold text-white/[0.85]"}>
                      {card.outcome}
                    </span>
                  </div>
                </div>

                <div className="mt-5 flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={card.winner ? "h-full rounded-full bg-[linear-gradient(90deg,var(--fire),#FBBF24)]" : "h-full rounded-full bg-[linear-gradient(90deg,var(--sky),#818CF8)]"}
                      style={{ width: `${card.match}%` }}
                    />
                  </div>
                  <span className={card.winner ? "text-sm font-extrabold text-[var(--fire)]" : "text-sm font-extrabold text-[var(--sky)]"}>
                    {card.match}%
                  </span>
                </div>

                <button
                  type="button"
                  className={`mt-5 w-full rounded-lg px-4 py-3 text-sm font-bold transition ${
                    card.winner
                      ? "bg-[var(--fire)] text-white hover:bg-[var(--fire-lo)]"
                      : "border border-white/12 bg-white/[0.08] text-white/80 hover:bg-white/12"
                  }`}
                >
                  {card.winner ? "지금 지원하기" : "자세히 보기"}
                </button>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="flow" className="px-5 pb-12 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-6xl rounded-[28px] border border-[var(--border)] bg-white px-6 py-10 sm:px-8 lg:px-11">
          <h2 className="text-2xl font-bold tracking-[-0.03em] text-[var(--ink)]">
            이소서로 취업 지원하는 방법
          </h2>

          <div className="mt-8 grid gap-y-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-x-0">
            {flowSteps.map((step, index) => (
              <div key={step.step} className="relative px-0 sm:px-2 lg:px-5">
                {index < flowSteps.length - 1 ? (
                  <span className="hidden lg:block absolute right-[-10px] top-4 text-2xl text-[var(--muted)]">
                    →
                  </span>
                ) : null}
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl text-sm font-extrabold tracking-[-0.03em] ${
                    step.tone === "blue"
                      ? "bg-[#EFF6FF] text-[var(--blue)]"
                      : step.tone === "amber"
                        ? "bg-[#FEF3C7] text-[var(--amber)]"
                        : step.tone === "orange"
                          ? "bg-[#FFF7ED] text-[var(--fire)]"
                          : "bg-[#F0FDF4] text-[var(--green)]"
                  }`}
                >
                  {step.step}
                </div>
                <h3 className="mt-4 text-base font-bold text-[var(--ink)]">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--sub)]">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 pb-12 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,var(--ink)_0%,var(--ink-soft)_100%)] px-6 py-10 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-11">
          <div className="relative z-10">
            <h2 className="text-3xl font-extrabold leading-tight tracking-[-0.04em] text-white">
              프로필 등록하면
              <br />
              AI가 딱 맞는 것만 골라드립니다
            </h2>
            <p className="mt-3 text-sm leading-7 text-white/[0.55]">
              성과저장소 데이터 기반 개인화 추천, 이력서·포트폴리오 초안 생성,
              <br />
              전체 기능 무료로 바로 시작할 수 있습니다.
            </p>
          </div>
          <Link
            href="/login"
            className="relative z-10 inline-flex w-full items-center justify-center rounded-xl bg-[var(--fire)] px-7 py-4 text-sm font-bold text-white shadow-[0_8px_28px_rgba(249,115,22,0.28)] transition hover:-translate-y-0.5 hover:bg-[var(--fire-lo)] lg:w-auto"
          >
            Google로 시작하기
          </Link>
        </div>
      </section>

      <footer className="bg-[var(--ink)] px-5 py-10 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 text-sm text-slate-400 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-lg font-extrabold tracking-[-0.04em] text-white">
              이소<span className="text-[var(--sky)]">서</span>
            </div>
            <p className="mt-2 text-sm text-slate-400">
              국가 취업 지원 정보 허브 · AI 추천 · 이력서·포트폴리오 생성
            </p>
          </div>
          <p>© 2026 Isoser</p>
        </div>
      </footer>

      <style jsx>{`
        .ticker-track {
          animation: ticker 28s linear infinite;
        }

        .hero-glow::before {
          content: "";
          position: absolute;
          top: -120px;
          left: 50%;
          width: 760px;
          height: 420px;
          transform: translateX(-50%);
          background: radial-gradient(ellipse, rgba(37, 99, 235, 0.22) 0%, transparent 66%);
          pointer-events: none;
        }

        .hero-glow::after {
          content: "";
          position: absolute;
          right: 10%;
          bottom: -80px;
          width: 320px;
          height: 320px;
          background: radial-gradient(circle, rgba(249, 115, 22, 0.16) 0%, transparent 62%);
          pointer-events: none;
        }

        .hero-gradient-blue {
          background: linear-gradient(90deg, #60a5fa, #818cf8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .hero-gradient-fire {
          background: linear-gradient(90deg, #fb923c, #fbbf24);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }

        @keyframes ticker {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </main>
  );
}
