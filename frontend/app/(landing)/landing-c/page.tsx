import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";

import { listPrograms } from "@/lib/api/backend";
import {
  getProgramCompareHref,
  getProgramDeadline,
  getProgramDeadlineTone,
  getProgramDetailHref,
} from "@/components/landing/program-card-helpers";
import { PROGRAM_FILTER_CHIPS, buildProgramFilterParams } from "@/lib/program-filters";
import { DASHBOARD_RECOMMEND_CALENDAR, ONBOARDING_RESUME_IMPORT, getLoginHref } from "@/lib/routes";
import { getSiteUrl } from "@/lib/seo";
import type { Program } from "@/lib/types";

import { LandingHeader } from "@/components/landing/LandingHeader";

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
  "--blue": "#2B6FF2",
  "--sky": "#8FC2FF",
  "--fire": "#F97316",
  "--fire-lo": "#EA580C",
  "--surface": "#F4F7FB",
  "--surface-strong": "#E8EEF8",
  "--border": "#D8E3F2",
  "--red": "#EF4444",
  "--amber": "#F59E0B",
  "--green": "#22C55E",
} as CSSProperties;

const chips = PROGRAM_FILTER_CHIPS;
const OPPORTUNITY_FEED_SIZE = 6;
const SEOUL_DISTRICTS = [
  "강남",
  "강동",
  "강북",
  "강서",
  "관악",
  "광진",
  "구로",
  "금천",
  "노원",
  "도봉",
  "동대문",
  "동작",
  "마포",
  "서대문",
  "서초",
  "성동",
  "성북",
  "송파",
  "양천",
  "영등포",
  "용산",
  "은평",
  "종로",
  "중구",
  "중랑",
] as const;

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

const circularFlowSteps = [
  {
    step: "01",
    title: "프로그램 탐색",
    description: "마감, 지역, 관심 분야를 기준으로 지원 가능한 공고를 확인합니다.",
  },
  {
    step: "02",
    title: "이력/활동 등록",
    description: "관심 분야와 활동 이력을 연결해 추천 기준을 만듭니다.",
  },
  {
    step: "03",
    title: "맞춤 추천",
    description: "프로필과 일정에 맞는 프로그램을 추천 캘린더로 정리합니다.",
  },
  {
    step: "04",
    title: "지원 문서 생성",
    description: "선택한 공고에 맞춰 이력서와 포트폴리오 초안을 준비합니다.",
  },
  {
    step: "05",
    title: "참여 성과 저장",
    description: "활동 결과와 STAR 경험을 성과저장소에 남깁니다.",
  },
  {
    step: "06",
    title: "다음 추천/취업 준비 재사용",
    description: "쌓인 이력 데이터를 다음 추천과 면접 준비에 다시 씁니다.",
  },
] as const;

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

function sourceLabel(program: Program): string {
  return [program.source || program.provider, locationLabel(program)].filter(Boolean).join(" · ") || "프로그램 정보";
}

function providerLabel(program: Program): string {
  if (program.provider) {
    return program.provider;
  }

  const source = program.source?.toLowerCase();
  if (source === "sesac") {
    return "청년취업사관학교 SeSAC";
  }
  if (source?.includes("work24") || program.source === "고용24") {
    return "고용24";
  }

  return program.source || "운영 기관 확인 필요";
}

function normalizeMetaText(value: string | boolean | null | undefined): string | null {
  if (typeof value === "boolean") {
    return value ? "필수" : null;
  }

  const text = value?.trim();
  return text ? text : null;
}

function formatWon(value: string | number | null | undefined): string | null {
  const amount = parseMetricNumber(value);
  if (amount === null) {
    return null;
  }

  if (amount === 0) {
    return "무료";
  }

  return `${amount.toLocaleString("ko-KR")}원`;
}

function trainingFeeLabel(program: Program): string {
  return formatWon(program.cost) || normalizeMetaText(program.compare_meta?.subsidy_rate) || "확인 필요";
}

function hasTomorrowLearningCardRequirement(program: Program): boolean {
  const explicit = program.compare_meta?.naeilbaeumcard_required;
  if (explicit === true || explicit === "pass" || explicit === "block") {
    return true;
  }

  const text = [
    program.support_type,
    program.description,
    program.summary,
    program.compare_meta?.target_group,
  ]
    .filter(Boolean)
    .join(" ");

  return /내일배움카드|국민내일배움카드|내배카/.test(text);
}

function trainingPeriodLabel(program: Program): string {
  if (program.start_date || program.end_date) {
    return [program.start_date || "시작일 미정", program.end_date || "종료일 미정"].join(" ~ ");
  }

  const titlePeriod = extractPeriodFromTitle(program.title);
  if (titlePeriod) {
    return titlePeriod;
  }

  return program.deadline ? `모집 마감 ${program.deadline}` : "일정 확인 필요";
}

function displayTitle(program: Program): string {
  const title = program.title || "제목 미정";
  return title
    .replace(/\s*모집\s*기간\s*\d{4}[.-]\d{2}[.-]\d{2}\s*-\s*\d{4}[.-]\d{2}[.-]\d{2}\s*\d*\s*$/u, "")
    .replace(/^모집예정\s+/u, "")
    .trim() || title;
}

function extractPeriodFromTitle(title: string | null | undefined): string | null {
  const match = title?.match(/모집\s*기간\s*(\d{4})[.-](\d{2})[.-](\d{2})\s*-\s*(\d{4})[.-](\d{2})[.-](\d{2})/u);
  if (!match) {
    return null;
  }

  const [, startYear, startMonth, startDay, endYear, endMonth, endDay] = match;
  return `모집 ${startYear}-${startMonth}-${startDay} ~ ${endYear}-${endMonth}-${endDay}`;
}

function compactDistrictLocation(location: string): string {
  const normalized = location.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  const attachedDistrict = normalized.match(/^(서울특별시|서울시|서울)\s*([가-힣]+구)/u);
  if (attachedDistrict) {
    return `${attachedDistrict[1]} ${attachedDistrict[2]}`;
  }

  const tokens = normalized.split(" ");
  const districtIndex = tokens.findIndex((token) => /[가-힣]+(구|군)$/u.test(token));
  if (districtIndex >= 0) {
    return tokens.slice(0, districtIndex + 1).join(" ");
  }

  return normalized;
}

function locationLabel(program: Program): string | null {
  const location = normalizeMetaText(program.location);
  if (location) {
    if (/온라인|비대면|원격/i.test(location)) {
      return null;
    }
    return compactDistrictLocation(location);
  }

  const title = program.title || "";
  const district = SEOUL_DISTRICTS.find((name) => title.includes(name));
  return district ? `서울 ${district}구` : null;
}

function trainingModeLabel(program: Program): "온라인" | "오프라인" | "온·오프라인" | null {
  const text = [
    program.teaching_method,
    program.compare_meta?.teaching_method,
    program.application_method,
    program.location,
    program.title,
  ]
    .filter(Boolean)
    .join(" ");

  const hasOnline = /온라인|비대면|원격|zoom|줌|인터넷/i.test(text);
  const hasOffline = /오프라인|대면|집체|현장|방문/i.test(text);
  if (/혼합|온.?오프|블렌디드/i.test(text) || (hasOnline && hasOffline)) {
    return "온·오프라인";
  }
  if (hasOnline) {
    return "온라인";
  }
  if (hasOffline || locationLabel(program)) {
    return "오프라인";
  }
  return null;
}

function programTagItems(program: Program): Array<{ label: string; tone: "green" | "blue" | "amber" | "indigo" }> {
  const tags: Array<{ label: string; tone: "green" | "blue" | "amber" | "indigo" }> = [
    { label: `훈련비 ${trainingFeeLabel(program)}`, tone: "green" },
  ];

  const trainingMode = trainingModeLabel(program);
  if (trainingMode) {
    tags.push({ label: trainingMode, tone: "indigo" });
  }

  const location = locationLabel(program);
  if (location) {
    tags.push({ label: location, tone: "blue" });
  }

  if (hasTomorrowLearningCardRequirement(program)) {
    tags.push({ label: "내배카 필수", tone: "amber" });
  }

  const rating = programRatingDisplay(program);
  if (rating !== null) {
    tags.push({ label: `만족도 ${rating}`, tone: "indigo" });
  }

  return tags;
}

function parseMetricNumber(value: string | number | null | undefined): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const normalized = value?.replace(/,/g, "").match(/\d+(?:\.\d+)?/)?.[0];
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeProgramRatingDisplay(value: string | number | null | undefined): string | null {
  if (typeof value === "string" && /(^|[^\d])\.\d/u.test(value.trim())) {
    return null;
  }

  const rating = parseMetricNumber(value);
  if (rating === null || rating <= 0 || rating > 100) {
    return null;
  }

  const normalizedRating = rating <= 5 ? rating : rating / 20;
  return normalizedRating.toFixed(1);
}

function programRatingDisplay(program: Program): string | null {
  return (
    program.rating_display ||
    normalizeProgramRatingDisplay(program.rating) ||
    normalizeProgramRatingDisplay(program.compare_meta?.satisfaction_score)
  );
}

function opportunityCompletenessScore(program: Program): number {
  let score = 0;
  if (program.provider) score += 3;
  if (program.start_date || program.end_date) score += 3;
  else if (extractPeriodFromTitle(program.title) || program.deadline) score += 1;
  if (locationLabel(program)) score += 2;
  if (program.cost !== null && program.cost !== undefined) score += 1;
  if (programRatingDisplay(program) !== null) score += 1;
  return score;
}

function orderOpportunityPrograms(programs: Program[]): Program[] {
  return programs
    .map((program, index) => ({ program, index }))
    .toSorted((a, b) => {
      const scoreDiff = opportunityCompletenessScore(b.program) - opportunityCompletenessScore(a.program);
      return scoreDiff || a.index - b.index;
    })
    .map(({ program }) => program)
    .slice(0, OPPORTUNITY_FEED_SIZE);
}

const liveBoardSources = [
  {
    label: "고용24",
    matches: ["고용24", "work24"],
  },
  {
    label: "창업진흥원",
    matches: ["창업진흥원", "k-startup", "kstartup"],
  },
  {
    label: "새싹",
    matches: ["새싹", "sesac", "seoul software academy"],
  },
] as const;

function liveBoardSourceText(program: Program): string {
  return [program.source, program.provider].filter(Boolean).join(" ").toLowerCase();
}

function isLiveBoardSource(program: Program, matches: readonly string[]): boolean {
  const sourceText = liveBoardSourceText(program);
  return matches.some((keyword) => sourceText.includes(keyword.toLowerCase()));
}

function parseDeadlineTime(program: Program): number {
  const timestamp = Date.parse(String(program.deadline || program.end_date || ""));
  return Number.isNaN(timestamp) ? Number.MAX_SAFE_INTEGER : timestamp;
}

function getLiveBoardPrograms(programs: Program[]): Program[] {
  return liveBoardSources.flatMap((source) => {
    const sourcePrograms = programs
      .filter((program) => isLiveBoardSource(program, source.matches))
      .filter((program) => typeof program.days_left !== "number" || program.days_left >= 0)
      .toSorted((a, b) => parseDeadlineTime(a) - parseDeadlineTime(b));

    return sourcePrograms[0] ? [sourcePrograms[0]] : [];
  });
}

function ProgramCard({ program }: { program: Program }) {
  const tagItems = programTagItems(program);

  return (
    <article
      className="flex min-h-[300px] flex-col rounded-[18px] border border-[var(--border)] bg-white p-6 shadow-[0_16px_42px_rgba(10,19,37,0.08)] transition hover:-translate-y-1 hover:shadow-[0_24px_58px_rgba(10,19,37,0.12)]"
    >
      <div>
        <h3 className="line-clamp-2 min-h-[3.5rem] text-xl font-black leading-7 tracking-[-0.04em] text-[var(--ink)]">
          <Link href={getProgramDetailHref(program)} className="transition hover:text-[var(--indigo)]">
            {displayTitle(program)}
          </Link>
        </h3>
        <p className="mt-2 line-clamp-1 text-sm font-bold text-[var(--sub)]">{providerLabel(program)}</p>
        <p className="mt-2 line-clamp-1 text-sm font-semibold text-[var(--sub)]">{trainingPeriodLabel(program)}</p>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {tagItems.map((item) => (
          <span
            key={`${program.id}-${item.label}`}
            className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${
              item.tone === "green"
                ? "bg-[rgba(16,185,129,0.12)] text-emerald-700"
                : item.tone === "amber"
                  ? "bg-[rgba(245,158,11,0.12)] text-amber-700"
                  : item.tone === "indigo"
                    ? "bg-[var(--surface-strong)] text-[var(--indigo)]"
                    : "bg-[var(--surface)] text-[var(--sub)]"
            }`}
          >
            {item.label}
          </span>
        ))}
      </div>

      <div className="mt-auto grid grid-cols-[1fr_auto] gap-2 pt-6">
        <Link
          href={getProgramDetailHref(program)}
          className="rounded-xl bg-[var(--blue)] px-4 py-3 text-center text-sm font-black text-white transition hover:bg-[var(--indigo)]"
        >
          과정 보기
        </Link>
        <Link
          href={getProgramCompareHref(program)}
          className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-center text-sm font-black text-[var(--ink)] transition hover:border-[var(--indigo)] hover:text-[var(--indigo)]"
        >
          비교
        </Link>
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
            <Link href={DASHBOARD_RECOMMEND_CALENDAR} className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
              추천 캘린더 보기
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

function CircularFlowSection() {
  return (
    <section className="px-5 pb-14 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl rounded-[28px] border border-[var(--border)] bg-white px-6 py-8 shadow-[0_22px_64px_rgba(10,19,37,0.06)] sm:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--indigo)]">Circular flow</p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.05em] text-[var(--ink)]">
            탐색한 프로그램은 다음 지원 준비로 이어집니다
          </h2>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {circularFlowSteps.map((stage) => (
            <article
              key={stage.step}
              className="flex min-h-[188px] flex-col rounded-[20px] border border-[var(--border)] bg-[var(--surface)] px-4 py-5 transition hover:border-[var(--indigo)] hover:bg-white hover:shadow-[0_16px_38px_rgba(10,19,37,0.08)]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--ink)] text-xs font-black text-white">
                {stage.step}
              </span>
              <h3 className="mt-5 text-base font-black tracking-[-0.03em] text-[var(--ink)]">{stage.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[var(--sub)]">{stage.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default async function LandingCPage({ searchParams }: LandingCPageProps) {
  const resolvedSearchParams = await searchParams;
  const activeChip = normalizeChip(resolvedSearchParams.chip);
  const keyword = normalizeKeyword(resolvedSearchParams.q);
  const programParams = buildProgramFilterParams(activeChip, keyword, 24);

  let programs: Program[] = [];
  let liveBoardPrograms: Program[] = [];
  let error: string | null = null;

  try {
    [programs, liveBoardPrograms] = await Promise.all([
      listPrograms(programParams),
      listPrograms({
        sort: "deadline",
        recruiting_only: true,
        limit: 100,
      }),
    ]);
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "프로그램 정보를 불러오지 못했습니다.";
  }

  const heroPrograms = getLiveBoardPrograms(liveBoardPrograms);
  const opportunityPrograms = orderOpportunityPrograms(programs);

  return (
    <main className="min-h-screen bg-[var(--surface)] text-[var(--ink)]" style={themeVars}>
      <LandingHeader />

      <section className="bg-white px-5 py-14 sm:px-8 lg:px-12 lg:py-20">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1fr_504px] lg:items-center">
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
              고용24, HRD넷, K-디지털, 서울시 일자리까지 한곳에 모았습니다.
              <br />
              이력과 활동을 등록하면 나에게 맞는 프로그램을 추천하고,
              <br />
              지원에 필요한 이력서·포트폴리오까지 바로 준비합니다.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/programs" className="rounded-full bg-[var(--indigo)] px-6 py-3 text-sm font-black text-white transition hover:bg-[var(--indigo-hi)]">
                지금 지원 가능한 프로그램 보기
              </Link>
              <Link
                href={getLoginHref(ONBOARDING_RESUME_IMPORT)}
                className="rounded-full border border-[var(--border)] bg-white px-6 py-3 text-sm font-black text-[var(--ink)] transition hover:border-[var(--indigo)] hover:text-[var(--indigo)]"
              >
                내 이력 등록
              </Link>
            </div>
          </div>

          <aside className="rounded-[28px] border border-[var(--border)] bg-white p-5 shadow-[0_26px_80px_rgba(10,19,37,0.1)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--muted)]">Live Board</div>
                <div className="mt-1 text-xl font-black tracking-[-0.04em] text-[var(--ink)]">추천 공고 {heroPrograms.length}건</div>
              </div>
              <Link href={DASHBOARD_RECOMMEND_CALENDAR} className="rounded-full bg-[var(--surface)] px-3 py-1.5 text-xs font-black text-[var(--indigo)]">
                워크스페이스 →
              </Link>
            </div>
            <div className="space-y-3 border-t border-[var(--border)] pt-3">
              {heroPrograms.map((program) => (
                <Link key={`${program.id}-${program.title}`} href={getProgramDetailHref(program)} className="block rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-[var(--indigo)]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">{sourceLabel(program)}</div>
                      <div className="mt-2 text-sm font-black leading-6 text-[var(--ink)]">{program.title || "추천 프로그램"}</div>
                      <div className="mt-2 text-xs font-bold text-[var(--sub)]">{program.category || "카테고리 미분류"}</div>
                    </div>
                    <div className={`min-w-[3.25rem] shrink-0 whitespace-nowrap text-right text-lg font-black ${getProgramDeadlineTone(program)}`}>
                      {getProgramDeadline(program)}
                    </div>
                  </div>
                </Link>
              ))}
              {heroPrograms.length === 0 && (
                <div className="rounded-[18px] border border-dashed border-[var(--border)] bg-[var(--surface)] p-5 text-sm font-bold text-[var(--sub)]">
                  고용24, 창업진흥원, 새싹의 모집중 공고가 있으면 이 영역에 표시됩니다.
                </div>
              )}
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

          {error ? (
            <div className="mt-8 rounded-[24px] border border-rose-200 bg-rose-50 px-6 py-10 text-sm font-bold text-rose-700">{error}</div>
          ) : opportunityPrograms.length === 0 ? (
            <div className="mt-8 rounded-[24px] border border-dashed border-[var(--border)] bg-white px-6 py-10 text-center text-sm font-bold text-[var(--sub)]">
              조건에 맞는 프로그램이 없습니다. 검색어나 필터를 조정해보세요.
            </div>
          ) : (
            <div className="mt-8 grid gap-5 lg:grid-cols-3">
              {opportunityPrograms.map((program) => (
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

      <CircularFlowSection />

      <section className="px-5 pb-14 sm:px-8 lg:px-12">
        <div className="relative mx-auto flex max-w-6xl flex-col gap-8 overflow-hidden rounded-[28px] bg-[var(--indigo)] px-6 py-10 text-white sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10" />
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-white/60">Final CTA</p>
            <h2 className="mt-4 text-3xl font-black leading-tight tracking-[-0.05em] sm:text-4xl">
              준비가 되었다면
              <br />
              이력서를 준비해 보세요.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/72">
              흩어진 경력 한 번에 정리하고, 원하는 공고에 맞춰 작성해 보세요
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={getLoginHref(DASHBOARD_RECOMMEND_CALENDAR)} className="rounded-full bg-white px-6 py-3 text-sm font-black text-[var(--indigo)]">무료로 시작하기</Link>
            <Link href={DASHBOARD_RECOMMEND_CALENDAR} className="rounded-full border border-white/30 px-6 py-3 text-sm font-black text-white">대시보드 미리 보기</Link>
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
    </main>
  );
}
