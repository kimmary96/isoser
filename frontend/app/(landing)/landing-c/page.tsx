import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";

import { getProgramCount, listPrograms } from "@/lib/api/backend";
import { getSiteUrl } from "@/lib/seo";
import type { Program, ProgramListParams } from "@/lib/types";

import {
  getProgramCompareHref,
  getProgramDeadline,
  getProgramDeadlineTone,
  getProgramDetailHref,
  getProgramScore,
  normalizeTextList,
} from "../landing-a/_shared";

export const metadata: Metadata = {
  title: "이소서 - 취업 지원 탐색부터 서류 준비까지",
  description:
    "흩어진 공공 취업 지원 정보를 탐색하고, 비교와 AI 추천, 서류 준비 흐름까지 연결하는 이소서 랜딩 페이지.",
  alternates: {
    canonical: "/landing-c",
  },
  openGraph: {
    title: "이소서 - 취업 지원 탐색부터 서류 준비까지",
    description:
      "공공 취업 지원 프로그램 탐색, 비교, 추천 캘린더, 문서 워크플로우를 하나로 연결합니다.",
    type: "website",
    url: getSiteUrl("/landing-c"),
  },
};

type LandingCSearchParams = {
  q?: string | string[];
  chip?: string | string[];
};

type LandingCPageProps = {
  searchParams: Promise<LandingCSearchParams>;
};

const themeVars = {
  "--ink": "#0A1325",
  "--sub": "#5B6E8A",
  "--muted": "#9DB0CC",
  "--indigo": "oklch(0.38 0.14 265)",
  "--indigo-hi": "oklch(0.44 0.14 265)",
  "--teal": "oklch(0.52 0.10 196)",
  "--surface": "#F4F7FB",
  "--surface-strong": "#E8EEF8",
  "--border": "#D8E3F2",
  "--red": "#EF4444",
  "--amber": "#F59E0B",
  "--green": "#22C55E",
} as CSSProperties;

const chips = ["전체", "마감임박", "AI·데이터", "IT·개발", "디자인", "경영", "창업", "서울", "경기", "온라인", "국비100%"];

const chipCategoryMap: Record<string, string> = {
  "AI·데이터": "AI·데이터",
  "IT·개발": "IT·개발",
  디자인: "디자인",
  경영: "경영·마케팅",
  창업: "창업",
};

const chipRegionMap: Record<string, string[]> = {
  서울: ["서울"],
  경기: ["경기"],
  온라인: ["온라인"],
};

const tickerItems = [
  "D-1 · K-디지털 풀스택 개발자 과정 · HRD넷",
  "D-3 · 청년 AI 데이터 인턴십 · 고용24",
  "D-5 · 포트폴리오 디자인 트랙 · 서울시",
  "D-7 · 퍼포먼스 마케팅 취업캠프 · 고용24",
];

const workflowCards = [
  {
    title: "PDF에서 바로 시작",
    body: "기존 이력서 PDF를 올리면 이름, 연락처, 경력, 프로젝트를 한 번에 정리합니다.",
    preview: "pdf",
  },
  {
    title: "성과 저장소로 자산화",
    body: "회사경력, 프로젝트, 대외활동을 흩어지지 않게 보관하고 필요할 때 다시 조합합니다.",
    preview: "activity",
  },
  {
    title: "공고 매칭 분석",
    body: "지원 공고와 내 경험을 비교해 강점, 부족 키워드, 추천 활동을 바로 확인합니다.",
    preview: "match",
  },
  {
    title: "문서 저장과 PDF 출력",
    body: "선택한 활동으로 이력서를 만들고 문서 저장소에서 다시 꺼내 PDF로 내보냅니다.",
    preview: "resume",
  },
] as const;

const journeySteps = [
  ["A", "탐색", "지원 가능 공고를 공공기관별 원문 대신 공통된 구조로 확인합니다."],
  ["B", "판단", "비교 화면과 관련도 정보로 지금 지원할 공고를 줄여갑니다."],
  ["C", "준비", "로그인 후 프로필과 성과저장소를 연결해 서류 초안과 맞춤 추천을 받습니다."],
  ["D", "실행", "대시보드에서 매치 분석과 문서 편집을 마치고 지원으로 넘어갑니다."],
];

function takeFirst(value?: string | string[]): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function normalizeChip(value?: string | string[]): string {
  const chip = takeFirst(value).trim();
  return chips.includes(chip) ? chip : "전체";
}

function normalizeKeyword(value?: string | string[]): string {
  return takeFirst(value).trim();
}

function buildProgramParams(activeChip: string, keyword: string): ProgramListParams {
  const params: ProgramListParams = {
    q: keyword || undefined,
    sort: "deadline",
    limit: 6,
  };

  if (activeChip === "마감임박") {
    params.recruiting_only = true;
    return params;
  }

  const category = chipCategoryMap[activeChip];
  if (category) {
    params.category = category;
    return params;
  }

  const regions = chipRegionMap[activeChip];
  if (regions) {
    params.regions = regions;
    return params;
  }

  if (activeChip === "국비100%") {
    params.q = keyword ? `${keyword} 국비 100%` : "국비 100%";
  }

  return params;
}

function sourceLabel(program: Program): string {
  return [program.source || program.provider, program.location].filter(Boolean).join(" · ") || "프로그램 정보";
}

function ProgramCard({ program }: { program: Program }) {
  const chips = [...normalizeTextList(program.tags), ...normalizeTextList(program.skills)].slice(0, 3);
  const score = Math.max(0, Math.min(getProgramScore(program), 100));
  const urgent = typeof program.days_left === "number" && program.days_left <= 3;

  return (
    <article
      className={`flex min-h-[360px] flex-col rounded-[22px] border bg-white p-6 shadow-[0_18px_46px_rgba(10,19,37,0.06)] transition hover:-translate-y-1 hover:shadow-[0_26px_64px_rgba(10,19,37,0.1)] ${
        urgent ? "border-[rgba(239,68,68,0.32)]" : "border-[var(--border)]"
      }`}
    >
      <div className="flex items-start justify-between gap-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">{sourceLabel(program)}</p>
          <h3 className="mt-3 text-lg font-extrabold leading-7 tracking-[-0.03em] text-[var(--ink)]">
            {program.title || "제목 미정"}
          </h3>
        </div>
        <div className={`shrink-0 text-xl font-black tracking-[-0.05em] ${getProgramDeadlineTone(program)}`}>
          {getProgramDeadline(program)}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <span className="rounded-full bg-[var(--surface-strong)] px-3 py-1 text-xs font-bold text-[var(--indigo)]">
          {program.category || "카테고리 미분류"}
        </span>
        {chips.map((chip) => (
          <span key={`${program.id}-${chip}`} className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--sub)]">
            {chip}
          </span>
        ))}
      </div>

      <p className="mt-5 line-clamp-3 text-sm leading-7 text-[var(--sub)]">
        {program.summary || program.description || "프로그램 요약이 아직 등록되지 않았습니다."}
      </p>

      <div className="mt-auto pt-6">
        <div className="mb-2 flex items-center justify-between text-xs font-bold text-[var(--sub)]">
          <span>이소서 관련도</span>
          <span>{score}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-strong)]">
          <div className="h-full rounded-full bg-[linear-gradient(90deg,var(--indigo),var(--teal))]" style={{ width: `${score}%` }} />
        </div>

        <div className="mt-6 flex gap-2">
          <Link href={getProgramDetailHref(program)} className="flex-1 rounded-full bg-[var(--ink)] px-4 py-3 text-center text-sm font-extrabold text-white transition hover:bg-[var(--indigo)]">
            자세히 보기
          </Link>
          <Link href={getProgramCompareHref(program)} className="rounded-full border border-[var(--border)] px-5 py-3 text-sm font-extrabold text-[var(--ink)] transition hover:border-[var(--indigo)] hover:text-[var(--indigo)]">
            비교
          </Link>
        </div>
      </div>
    </article>
  );
}

function FeaturePreview({ type }: { type: (typeof workflowCards)[number]["preview"] }) {
  if (type === "pdf") {
    return (
      <div className="rounded-[22px] bg-[var(--surface)] p-4">
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white p-5 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-strong)] text-xl font-black text-[var(--indigo)]">
            PDF
          </div>
          <div className="mt-4 text-sm font-black text-[var(--ink)]">김이소_이력서.pdf</div>
          <div className="mt-2 text-xs font-bold text-[var(--muted)]">프로필 · 경력 · 프로젝트 추출</div>
          <div className="mt-5 space-y-2">
            {[88, 74, 92].map((width) => (
              <div key={width} className="mx-auto h-2 rounded bg-[var(--surface-strong)]" style={{ width: `${width}%` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (type === "match") {
    return (
      <div className="rounded-2xl bg-[var(--surface)] p-5">
        <div className="flex items-end justify-between">
          <div className="text-sm font-extrabold text-[var(--ink)]">매칭 점수 상세</div>
          <div className="text-4xl font-black text-[var(--indigo)]">74<span className="text-sm">점</span></div>
        </div>
        <div className="mt-5 space-y-3">
          {["직무 일치도", "경력 연관성", "학력/자격", "프로젝트"].map((label, index) => (
            <div key={label} className="grid grid-cols-[82px_1fr_34px] items-center gap-2 text-[11px] font-bold text-[var(--sub)]">
              <span>{label}</span>
              <span className="h-2 overflow-hidden rounded-full bg-white">
                <span className="block h-full rounded-full bg-[var(--indigo)]" style={{ width: `${[90, 60, 75, 80][index]}%` }} />
              </span>
              <span>{[20, 8, 1, 8][index]}점</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "resume") {
    return (
      <div className="grid gap-3 rounded-2xl bg-[var(--surface)] p-4 sm:grid-cols-[0.9fr_1.2fr]">
        <div className="space-y-2 text-[11px] font-bold">
          {["기본형", "Modern", "Minimal"].map((item, index) => (
            <div key={item} className={`rounded-lg border px-3 py-2 ${index === 0 ? "border-[var(--indigo)] text-[var(--indigo)]" : "border-[var(--border)] text-[var(--sub)]"}`}>
              {item}
            </div>
          ))}
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="mb-4 h-3 w-28 rounded bg-[var(--ink)]" />
          <div className="space-y-2">
            {[80, 56, 92, 48, 72].map((width) => (
              <div key={width} className="h-2 rounded bg-[var(--surface-strong)]" style={{ width: `${width}%` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-[var(--surface)] p-4">
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-3 w-32 rounded bg-[var(--ink)]" />
            <div className="mt-2 h-2 w-24 rounded bg-[var(--surface-strong)]" />
          </div>
          <span className="rounded-full bg-[rgba(56,189,248,0.13)] px-3 py-1 text-[10px] font-black text-[var(--indigo)]">
            저장 완료
          </span>
        </div>
        <div className="mt-5 space-y-2">
          {[92, 74, 86, 64].map((width) => (
            <div key={width} className="h-2 rounded bg-[var(--surface-strong)]" style={{ width: `${width}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function BackupHeroSection() {
  const proofItems = [
    "활동 상세 AI 코치 피드백",
    "공고 매칭 분석 저장/조회",
    "문서 저장소와 PDF 내보내기",
    "게스트 모드와 직접 입력 시작",
  ];

  return (
    <section className="relative overflow-hidden bg-[#071a36] px-5 py-16 text-white sm:px-8 lg:px-12 lg:py-20">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(43,111,242,0.32),transparent_32%),linear-gradient(120deg,#071a36_0%,#0a2146_48%,#0f172a_100%)]" />
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[28%] bg-white/5 lg:block" />
      <div className="relative mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_460px] lg:items-center">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-sky-200/90">Career Asset Workspace</p>
          <h2 className="mt-5 text-4xl font-bold leading-[1.08] tracking-[-0.04em] sm:text-5xl">
            흩어진 경력을 한 번 정리하면,<br />공고마다 다시 꺼내 쓸 수 있습니다.
          </h2>
          <p className="mt-5 max-w-xl text-[15.5px] leading-8 text-slate-200/90">
            이소서는 AI가 대신 써주는 서비스가 아니라, 내 경험을 저장하고 다듬고 조합할 수 있게 만드는 이력서 작업 공간입니다.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/dashboard/profile" className="rounded-full bg-white px-6 py-3 text-sm font-bold text-[#0a1325] transition hover:opacity-90">
              PDF 업로드로 시작하기
            </Link>
            <Link href="/onboarding" className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
              온보딩 먼저 보기
            </Link>
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {proofItems.map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm text-slate-200/85">
                <span className="h-2 w-2 shrink-0 rounded-full bg-blue-300" />
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[32px] border border-white/10 bg-white/10 p-4 shadow-[0_32px_80px_rgba(0,0,0,0.35)] backdrop-blur">
          <div className="rounded-[24px] bg-[#f6f8fc] p-5 text-[#0a1325]">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <div className="text-[9.5px] font-bold uppercase tracking-[0.22em] text-slate-400">Resume Pipeline</div>
                <div className="mt-1 text-lg font-bold">업로드 후 바로 이어지는 흐름</div>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold text-emerald-800">Live</span>
            </div>
            <div className="mt-3 rounded-[18px] bg-white p-4">
              <div className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-slate-400">Step 1</div>
              <div className="mt-2 text-[15px] font-bold">PDF에서 프로필과 활동 추출</div>
              <p className="mt-1 text-sm leading-6 text-slate-500">이름, 연락처, 경력, 프로젝트를 자동 정리</p>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[18px] bg-[#0d4fd7] p-4 text-white">
                <div className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-sky-100/80">Step 2</div>
                <div className="mt-2 text-[15px] font-bold">성과 저장소</div>
                <p className="mt-1 text-sm leading-6 text-blue-100">회사경력과 프로젝트를 한 화면에서 관리</p>
              </div>
              <div className="rounded-[18px] bg-slate-900 p-4 text-white">
                <div className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-slate-500">Step 3</div>
                <div className="mt-2 text-[15px] font-bold">공고 매칭 분석</div>
                <p className="mt-1 text-sm leading-6 text-slate-300">강점과 부족 키워드를 바로 확인</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-[18px] border border-slate-200 bg-slate-50 p-4">
              <div>
                <div className="text-[9.5px] uppercase tracking-[0.18em] text-slate-400">Final</div>
                <div className="mt-1 text-sm font-bold">문서 저장소</div>
                <p className="mt-1 text-sm text-slate-500">생성한 이력서를 저장하고 PDF로 다시 출력</p>
              </div>
              <div className="text-base font-bold">Ready to send</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default async function LandingCPage({ searchParams }: LandingCPageProps) {
  const resolvedSearchParams = await searchParams;
  const activeChip = normalizeChip(resolvedSearchParams.chip);
  const keyword = normalizeKeyword(resolvedSearchParams.q);
  const programParams = buildProgramParams(activeChip, keyword);

  let programs: Program[] = [];
  let totalCount = 0;
  let error: string | null = null;

  try {
    [programs, totalCount] = await Promise.all([
      listPrograms(programParams),
      getProgramCount({
        q: programParams.q,
        category: programParams.category,
        regions: programParams.regions,
        recruiting_only: programParams.recruiting_only,
      }),
    ]);
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "프로그램 정보를 불러오지 못했습니다.";
  }

  const heroPrograms = programs.slice(0, 3);

  return (
    <main className="min-h-screen bg-[var(--surface)] text-[var(--ink)]" style={themeVars}>
      <div className="sticky top-0 z-[240] h-9 overflow-hidden bg-[var(--indigo)] text-white">
        <div className="landing-c-ticker flex h-full min-w-max items-center">
          {[...tickerItems, ...tickerItems].map((item, index) => (
            <div key={`${item}-${index}`} className="inline-flex items-center gap-3 px-6 text-xs font-extrabold">
              <span className="h-2 w-2 rounded-full bg-[var(--amber)]" />
              {item}
              <span className="opacity-45">|</span>
            </div>
          ))}
        </div>
      </div>

      <header className="sticky top-9 z-[230] border-b border-[var(--border)] bg-white/94 px-5 py-4 backdrop-blur-xl sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-6xl items-center gap-4">
          <Link href="/landing-c" className="text-xl font-black tracking-[-0.05em]">
            <span>이소<span className="text-[var(--teal)]">서</span></span>
            <span className="hidden text-[9px] font-bold uppercase tracking-[0.28em] text-[var(--muted)] sm:block">
              Public Program Finder
            </span>
          </Link>
          <nav aria-label="랜딩 C 주요 이동" className="ml-auto hidden items-center gap-7 text-sm font-bold text-[var(--sub)] md:flex">
            <Link href="/programs" className="transition hover:text-[var(--ink)]">프로그램 탐색</Link>
            <Link href="/compare" className="transition hover:text-[var(--ink)]">비교</Link>
            <Link href="/dashboard#recommend-calendar" className="transition hover:text-[var(--ink)]">워크스페이스</Link>
          </nav>
          <Link href="/login" className="ml-auto rounded-full bg-[var(--indigo)] px-4 py-2 text-sm font-black text-white transition hover:bg-[var(--indigo-hi)] md:ml-0">
            무료로 시작하기
          </Link>
        </div>
      </header>

      <section className="bg-white px-5 py-14 sm:px-8 lg:px-12 lg:py-20">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1fr_420px] lg:items-center">
          <div>
            <div className="inline-flex rounded-lg bg-[var(--surface-strong)] px-4 py-2 text-sm font-extrabold text-[var(--indigo)]">
              <span className="mr-2 mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--teal)]" />
              PUBLIC SUPPORT PROGRAMS
            </div>
            <h1 className="mt-6 max-w-3xl text-5xl font-black leading-[1.04] tracking-[-0.06em] text-[var(--ink)] sm:text-6xl">
              흩어진 국비 지원 정보,<br />
              <span className="bg-[linear-gradient(90deg,var(--indigo),var(--teal))] bg-clip-text text-transparent">
                내 상황에 맞는 것만<br />골라드립니다
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-[var(--sub)]">
              각종 부트캠프, K-디지털, 서울 일자리까지 한곳에 모았습니다. 3가지 조건만 알려주시면 마감 임박순으로 정렬해드립니다.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/programs" className="rounded-full bg-[var(--indigo)] px-6 py-3 text-sm font-black text-white transition hover:bg-[var(--indigo-hi)]">
                지금 지원 가능한 프로그램 보기
              </Link>
              <Link href="/login" className="rounded-full border border-[var(--border)] bg-white px-6 py-3 text-sm font-black text-[var(--ink)] transition hover:border-[var(--indigo)] hover:text-[var(--indigo)]">
                로그인 후 AI 추천 받기
              </Link>
            </div>
            <div className="mt-9 grid max-w-2xl grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-[var(--surface-strong)] px-5 py-4">
                <div className="text-3xl font-black tracking-[-0.05em]">247<span className="text-lg font-bold">개</span></div>
                <div className="mt-1 text-xs font-bold text-[var(--sub)]">현재 탐색 가능한 프로그램 수</div>
              </div>
              <div className="rounded-2xl bg-[var(--surface-strong)] px-5 py-4">
                <div className="text-3xl font-black tracking-[-0.05em]">3<span className="text-lg font-bold">가지</span></div>
                <div className="mt-1 text-xs font-bold text-[var(--sub)]">상황, 수업 방식, 관심 분야</div>
              </div>
              <div className="col-span-2 rounded-2xl bg-[var(--surface-strong)] px-5 py-4 sm:col-span-1">
                <div className="text-3xl font-black tracking-[-0.05em]">1<span className="text-lg font-bold">곳</span></div>
                <div className="mt-1 text-xs font-bold text-[var(--sub)]">탐색, 비교, 추천 워크스페이스</div>
              </div>
            </div>
          </div>

          <aside className="rounded-[28px] border border-[var(--border)] bg-white p-5 shadow-[0_26px_80px_rgba(10,19,37,0.1)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--muted)]">Live Board</div>
                <div className="mt-1 text-xl font-black tracking-[-0.04em] text-[var(--ink)]">이번 주 2건 확인</div>
              </div>
              <Link href="/compare" className="rounded-full bg-[var(--surface)] px-3 py-1.5 text-xs font-black text-[var(--indigo)]">
                워크스페이스 →
              </Link>
            </div>
            <div className="space-y-3 border-t border-[var(--border)] pt-3">
              {(heroPrograms.length ? heroPrograms : programs).slice(0, 3).map((program) => (
                <Link key={`${program.id}-${program.title}`} href={getProgramDetailHref(program)} className="block rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-[var(--indigo)]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">{sourceLabel(program)}</div>
                      <div className="mt-2 text-sm font-black leading-6 text-[var(--ink)]">{program.title || "추천 프로그램"}</div>
                      <div className="mt-2 text-xs font-bold text-[var(--sub)]">{program.category || "카테고리 미분류"}</div>
                    </div>
                    <div className={`text-lg font-black ${getProgramDeadlineTone(program)}`}>{getProgramDeadline(program)}</div>
                  </div>
                </Link>
              ))}
              {programs.length === 0 && (
                <div className="rounded-[18px] border border-dashed border-[var(--border)] bg-[var(--surface)] p-5 text-sm font-bold text-[var(--sub)]">
                  프로그램 데이터를 불러오면 이 영역에 마감 임박 공고가 표시됩니다.
                </div>
              )}
            </div>
            <div className="mt-5 rounded-2xl bg-[rgba(56,189,248,0.1)] p-4 text-sm leading-7 text-[var(--sub)]">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--muted)]">Next after login</div>
              <div className="mt-2">프로필을 연결하면 탐색한 프로그램을 대시보드 추천 캘린더와 문서 생성 흐름으로 이어서 관리할 수 있습니다.</div>
            </div>
          </aside>
        </div>
      </section>

      <section className="px-5 py-14 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--indigo)]">Opportunity feed</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.05em]">지금 탐색할 프로그램을 빠르게 고릅니다</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--sub)]">
                비로그인 상태에서는 우선 공고를 탐색하고, 로그인 후에는 이 결과를 추천 캘린더와 문서 워크플로우로 이어 붙입니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/programs" className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-black text-[var(--ink)]">전체 프로그램 보기</Link>
              <Link href="/login" className="rounded-full bg-[var(--indigo)] px-4 py-2 text-sm font-black text-white">로그인 후 추천 연결</Link>
            </div>
          </div>

          <form action="/landing-c" className="mt-8 rounded-[24px] border border-[var(--border)] bg-white p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <label htmlFor="landing-c-q" className="sr-only">프로그램 검색</label>
              <input
                id="landing-c-q"
                name="q"
                type="search"
                defaultValue={keyword}
                placeholder="과정명, 기관명, 기술 검색"
                className="min-h-12 flex-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-5 text-sm font-bold outline-none placeholder:text-[var(--muted)] focus:border-[var(--indigo)]"
              />
              <button type="submit" name="chip" value={activeChip} className="min-h-12 rounded-full bg-[var(--ink)] px-5 text-sm font-black text-white">
                적용
              </button>
            </div>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {chips.map((chip) => (
                <button
                  key={chip}
                  type="submit"
                  name="chip"
                  value={chip}
                  className={`shrink-0 rounded-full border px-4 py-2 text-xs font-black transition ${
                    chip === activeChip
                      ? "border-[var(--indigo)] bg-[var(--indigo)] text-white"
                      : "border-[var(--border)] bg-white text-[var(--sub)] hover:border-[var(--indigo)] hover:text-[var(--indigo)]"
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>
          </form>

          <div className="mt-6 flex flex-col gap-2 border-b border-[var(--border)] pb-5 text-sm font-semibold text-[var(--sub)] sm:flex-row sm:items-center sm:justify-between">
            <span>현재 조건에 맞는 프로그램 {totalCount}개 중 상위 {programs.length}개를 보여드립니다.</span>
            <span>탐색 후 로그인하면 추천 캘린더와 문서 준비 흐름으로 이어집니다.</span>
          </div>

          {error ? (
            <div className="mt-8 rounded-[24px] border border-rose-200 bg-rose-50 px-6 py-10 text-sm font-bold text-rose-700">{error}</div>
          ) : programs.length === 0 ? (
            <div className="mt-8 rounded-[24px] border border-dashed border-[var(--border)] bg-white px-6 py-10 text-center text-sm font-bold text-[var(--sub)]">
              조건에 맞는 프로그램이 없습니다. 검색어나 필터를 조정해보세요.
            </div>
          ) : (
            <div className="mt-8 grid gap-5 lg:grid-cols-3">
              {programs.map((program) => (
                <ProgramCard key={`${program.id}-${program.title}`} program={program} />
              ))}
            </div>
          )}
        </div>
      </section>

      <BackupHeroSection />

      <section className="border-t border-[var(--border)] bg-white px-5 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-6xl">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.24em] text-[var(--teal)]">What Works Today</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-black leading-tight tracking-[-0.04em]">
            이미 구현된 흐름을 첫 화면에서 바로 이해할 수 있어야 합니다.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--sub)]">
            지금 제품의 설득 포인트는 미래 기능이 아니라, 이미 연결된 작업 흐름입니다.
          </p>

          <div className="mt-9 grid gap-5 lg:grid-cols-2">
            {workflowCards.map((card) => (
              <article key={card.title} className="rounded-[24px] border border-[var(--border)] bg-white p-6 shadow-[0_18px_46px_rgba(10,19,37,0.05)]">
                <div className="mb-5">
                  <h3 className="text-xl font-black tracking-[-0.04em]">{card.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-[var(--sub)]">{card.body}</p>
                </div>
                <FeaturePreview type={card.preview} />
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-6xl rounded-[28px] bg-white px-6 py-10 shadow-[0_22px_60px_rgba(10,19,37,0.06)] sm:px-8">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--indigo)]">Journey</p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.05em]">로그인 이후 연결 흐름도 랜딩에서 미리 설명합니다</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--sub)]">
            탐색만 가능한 제품처럼 보이지 않도록, 랜딩 본문에서부터 로그인 후 워크플로우를 명시적으로 보여줍니다.
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-4">
            {journeySteps.map(([letter, title, desc]) => (
              <div key={letter}>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--indigo)] text-sm font-black text-white">{letter}</div>
                <div className="mt-4 text-lg font-black tracking-[-0.03em]">{title}</div>
                <p className="mt-2 text-sm leading-7 text-[var(--sub)]">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 pb-14 sm:px-8 lg:px-12">
        <div className="relative mx-auto flex max-w-6xl flex-col gap-8 overflow-hidden rounded-[28px] bg-[var(--indigo)] px-6 py-10 text-white sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10" />
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-white/60">Final CTA</p>
            <h2 className="mt-4 text-3xl font-black leading-tight tracking-[-0.05em] sm:text-4xl">
              프로그램을 찾았다면,<br />이제 지원 준비를 같은 흐름으로 이어가면 됩니다
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/72">
              로그인 후에는 추천 프로그램 캘린더, 성과저장소, 이력서, 자기소개서, 매치 분석이 같은 제품 안에서 이어집니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/login" className="rounded-full bg-white px-6 py-3 text-sm font-black text-[var(--indigo)]">무료로 시작하기</Link>
            <Link href="/dashboard#recommend-calendar" className="rounded-full border border-white/30 px-6 py-3 text-sm font-black text-white">대시보드 미리 보기</Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--border)] bg-white px-5 py-10 text-[var(--ink)] sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-2xl font-black tracking-[-0.05em]">이소<span className="text-[var(--teal)]">서</span></div>
            <p className="mt-3 max-w-xl text-sm leading-7 text-[var(--sub)]">
              공공 취업 지원 탐색을 시작점으로, 개인화 추천과 문서 워크플로우까지 연결하는 커리어 SaaS.
            </p>
          </div>
          <div className="text-xs font-bold text-[var(--muted)]">© 2026 Isoser. Career support workspace.</div>
        </div>
      </footer>

      <style>{`
        .landing-c-ticker {
          animation: landing-c-ticker 28s linear infinite;
        }
        @keyframes landing-c-ticker {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </main>
  );
}
