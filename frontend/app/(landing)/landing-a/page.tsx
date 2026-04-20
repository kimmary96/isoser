import type { Metadata } from "next";
import {
  LandingACtaSection,
  LandingAComparisonSection,
  LandingAFilterBar,
  LandingAFooter,
  LandingAFlowSection,
  LandingAHeroSection,
  LandingANavBar,
  LandingAProgramsSection,
  LandingATickerBar,
} from "./_components";
import { chipOptions } from "./_content";
import { landingAStyles, landingAThemeVars } from "./_styles";
import AdSlot from "@/components/AdSlot";
import { getProgramCount, listPrograms } from "@/lib/api/backend";
import { getSiteUrl } from "@/lib/seo";
import type { Program, ProgramListParams } from "@/lib/types";

export const metadata: Metadata = {
  title: "이소서 - 국가 취업 지원 정보 허브",
  description:
    "국비 교육과 취업 지원 프로그램을 탐색하고, 비교와 AI 코치 도구로 다음 지원 행동까지 이어지는 이소서 메인 랜딩 페이지.",
  alternates: {
    canonical: "/landing-a",
  },
  openGraph: {
    title: "이소서 - 국가 취업 지원 정보 허브",
    description:
      "국비 교육과 취업 지원 프로그램을 탐색하고, 비교와 AI 코치 도구로 다음 지원 행동까지 이어지는 이소서 메인 랜딩 페이지.",
    type: "website",
    url: getSiteUrl("/landing-a"),
  },
};

type LandingASearchParams = {
  q?: string | string[];
  chip?: string | string[];
};

type LandingAPageProps = {
  searchParams: Promise<LandingASearchParams>;
};

const CHIP_CATEGORY_MAP: Record<string, string> = {
  "AI·데이터": "AI·데이터",
  "IT·개발": "IT·개발",
  디자인: "디자인",
  경영: "경영·마케팅",
  창업: "창업",
};

const CHIP_REGION_MAP: Record<string, string[]> = {
  서울: ["서울"],
  경기: ["경기"],
  온라인: ["온라인"],
};

function takeFirst(value?: string | string[]): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function normalizeChip(value?: string | string[]): string {
  const chip = takeFirst(value).trim();
  return chipOptions.includes(chip) ? chip : "전체";
}

function normalizeKeyword(value?: string | string[]): string {
  return takeFirst(value).trim();
}

function buildLandingAParams(activeChip: string, keyword: string): ProgramListParams {
  const params: ProgramListParams = {
    q: keyword || undefined,
    sort: "deadline",
    limit: 6,
  };

  if (activeChip === "마감임박") {
    params.recruiting_only = true;
    return params;
  }

  const category = CHIP_CATEGORY_MAP[activeChip];
  if (category) {
    params.category = category;
    return params;
  }

  const regions = CHIP_REGION_MAP[activeChip];
  if (regions) {
    params.regions = regions;
    return params;
  }

  if (activeChip === "국비100%") {
    params.q = keyword ? `${keyword} 국비 100%` : "국비 100%";
  }

  return params;
}

export default async function LandingAPage({ searchParams }: LandingAPageProps) {
  const resolvedSearchParams = await searchParams;
  const activeChip = normalizeChip(resolvedSearchParams.chip);
  const keyword = normalizeKeyword(resolvedSearchParams.q);
  const programParams = buildLandingAParams(activeChip, keyword);

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

  return (
    <main className="min-h-screen bg-[var(--surface)] text-[var(--ink)]" style={landingAThemeVars}>
      <LandingATickerBar />
      <LandingANavBar />
      <LandingAHeroSection featuredPrograms={programs.slice(0, 3)} totalCount={totalCount} />
      <LandingAFilterBar activeChip={activeChip} keyword={keyword} />
      <LandingAProgramsSection
        programs={programs}
        totalCount={totalCount}
        activeChip={activeChip}
        keyword={keyword}
        error={error}
      />
      <LandingAComparisonSection />
      <LandingAFlowSection />
      <LandingACtaSection />
      <div className="px-5 pb-12 sm:px-8 lg:px-12">
        <AdSlot
          slotId="landing-a-footer-banner"
          className="mx-auto w-full max-w-6xl overflow-hidden rounded-3xl border border-[var(--border)] bg-white/80 px-4 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.06)]"
        />
      </div>
      <LandingAFooter />

      <style>{landingAStyles}</style>
    </main>
  );
}
