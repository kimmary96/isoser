import type { Metadata } from "next";
import {
  LandingACtaSection,
  LandingAComparisonSection,
  LandingAFilterBar,
  LandingAFooter,
  LandingAHeader,
  LandingAHeroSection,
  LandingAPreviewSection,
  LandingAProgramsSection,
  LandingAStyleTag,
} from "./_components";
import { chipOptions } from "./_content";
import { landingAThemeVars } from "./_styles";
import AdSlot from "@/components/AdSlot";
import { listProgramsPage } from "@/lib/api/backend";
import { unwrapProgramListRows } from "@/lib/program-display";
import {
  buildProgramFilterParams,
  getProgramFilterChipDefinition,
  matchesProgramFilterChip,
} from "@/lib/program-filters";
import { getSiteUrl } from "@/lib/seo";
import { loadPublicFreeProgramFallbackRows } from "@/lib/server/public-programs-fallback";
import type { ProgramListRow } from "@/lib/types";

export const metadata: Metadata = {
  title: "이소서 - 취업 지원 탐색부터 서류 준비까지 연결하는 커리어 SaaS",
  description:
    "공공 취업 지원 프로그램 탐색, 비교, 맞춤 추천, 문서 준비를 하나의 흐름으로 연결하는 이소서 메인 랜딩 페이지.",
  alternates: {
    canonical: "/landing-a",
  },
  openGraph: {
    title: "이소서 - 취업 지원 탐색부터 서류 준비까지 연결하는 커리어 SaaS",
    description:
      "공공 취업 지원 프로그램 탐색, 비교, 맞춤 추천, 문서 준비를 하나의 흐름으로 연결하는 이소서 메인 랜딩 페이지.",
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

export default async function LandingAPage({ searchParams }: LandingAPageProps) {
  const resolvedSearchParams = await searchParams;
  const activeChip = normalizeChip(resolvedSearchParams.chip);
  const keyword = normalizeKeyword(resolvedSearchParams.q);
  const activeChipDefinition = getProgramFilterChipDefinition(activeChip);
  const isCostChip = activeChipDefinition?.kind === "cost";
  const programParams = buildProgramFilterParams(activeChip, keyword);

  let programs: ProgramListRow[] = [];
  let totalCount = 0;
  let error: string | null = null;

  try {
    const page = await listProgramsPage({
      ...programParams,
      scope: programParams.q ? "all" : "default",
    });
    programs = unwrapProgramListRows(page.items);
    totalCount = page.count ?? page.items.length;
    if (!keyword && isCostChip && programs.length === 0) {
      const fallbackPrograms = await loadPublicFreeProgramFallbackRows(120);
      programs = fallbackPrograms.filter((program) => matchesProgramFilterChip(program, activeChip)).slice(0, 6);
      totalCount = programs.length;
    }
  } catch (cause) {
    if (!keyword && isCostChip) {
      try {
        const fallbackPrograms = await loadPublicFreeProgramFallbackRows(120);
        const matchedPrograms = fallbackPrograms.filter((program) => matchesProgramFilterChip(program, activeChip)).slice(0, 6);
        programs = matchedPrograms;
        totalCount = matchedPrograms.length;
        error = matchedPrograms.length > 0 ? null : cause instanceof Error ? cause.message : "프로그램 정보를 불러오지 못했습니다.";
      } catch {
        error = cause instanceof Error ? cause.message : "프로그램 정보를 불러오지 못했습니다.";
      }
    } else {
      error = cause instanceof Error ? cause.message : "프로그램 정보를 불러오지 못했습니다.";
    }
  }

  if (!keyword && isCostChip) {
    const fallbackPrograms = await loadPublicFreeProgramFallbackRows(120);
    const matchedPrograms = fallbackPrograms.filter((program) => matchesProgramFilterChip(program, activeChip)).slice(0, 6);
    if (matchedPrograms.length > 0) {
      programs = matchedPrograms;
      totalCount = matchedPrograms.length;
      error = null;
    }
  }

  return (
    <main className="min-h-screen bg-[var(--surface)] text-[var(--ink)]" style={landingAThemeVars}>
      <LandingAHeader />
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
      <LandingAPreviewSection />
      <LandingACtaSection />
      <div className="px-5 pb-12 sm:px-8 lg:px-12">
        <AdSlot
          slotId="landing-a-footer-banner"
          className="mx-auto w-full max-w-6xl overflow-hidden rounded-3xl border border-[var(--border)] bg-white/80 px-4 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.06)]"
        />
      </div>
      <LandingAFooter />
      <LandingAStyleTag />
    </main>
  );
}
