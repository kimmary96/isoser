import type { Metadata } from "next";

import { LandingHeader } from "@/components/landing/LandingHeader";
import { listProgramsPage } from "@/lib/api/backend";
import { resolvePublicProgramListScope } from "@/lib/program-list-scope";
import { unwrapProgramListRows } from "@/lib/program-display";
import { buildProgramFilterParams } from "@/lib/program-filters";
import { getSiteUrl } from "@/lib/seo";
import {
  loadPublicLandingChipSnapshotRows,
  loadPublicLandingLiveBoardRows,
  loadPublicFilteredProgramFallbackRows,
  loadPublicProgramsPageFallback,
  PUBLIC_PROGRAM_BROWSE_LIMIT,
} from "@/lib/server/public-programs-fallback";
import type { ProgramListRow } from "@/lib/types";

import { LandingCHeroSection } from "./_hero";
import { LandingCOpportunityFeed } from "./_program-feed";
import { OPPORTUNITY_FEED_SIZE } from "./_content";
import { filterOpportunityPrograms, getLiveBoardPrograms, orderOpportunityPrograms } from "./_program-utils";
import { normalizeChip, normalizeKeyword } from "./_search";
import { landingCThemeVars } from "./_styles";
import {
  LandingCBackupHeroSection,
  LandingCCircularFlowSection,
  LandingCFinalCtaSection,
  LandingCFooter,
  LandingCWorkflowSection,
} from "./_support-sections";
import type { LandingCPageProps } from "./_types";

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

function mergeDistinctPrograms(...programGroups: ProgramListRow[][]): ProgramListRow[] {
  const seenIds = new Set<string>();
  const merged: ProgramListRow[] = [];

  for (const programs of programGroups) {
    for (const program of programs) {
      const programId = String(program.id ?? "").trim();
      if (!programId || seenIds.has(programId)) {
        continue;
      }
      seenIds.add(programId);
      merged.push(program);
    }
  }

  return merged;
}

export default async function LandingCPage({ searchParams }: LandingCPageProps) {
  const resolvedSearchParams = await searchParams;
  const activeChip = normalizeChip(resolvedSearchParams.chip);
  const keyword = normalizeKeyword(resolvedSearchParams.q);
  const programParams = buildProgramFilterParams(activeChip, keyword, 48);
  const scope = resolvePublicProgramListScope({ keyword });
  const shouldUseLandingSnapshot = !keyword;

  let programs: ProgramListRow[] = [];
  let liveBoardPrograms: ProgramListRow[] = [];
  let snapshotPrograms: ProgramListRow[] = [];
  let error: string | null = null;

  try {
    if (shouldUseLandingSnapshot) {
      [snapshotPrograms, liveBoardPrograms] = await Promise.all([
        loadPublicLandingChipSnapshotRows(activeChip).catch(() => []),
        loadPublicLandingLiveBoardRows().catch(() => []),
      ]);
      if (snapshotPrograms.length > 0) {
        programs = snapshotPrograms;
      } else if (activeChip === "전체") {
        const fallbackPage = await loadPublicProgramsPageFallback();
        programs = fallbackPage.programs;
        if (liveBoardPrograms.length === 0) {
          liveBoardPrograms = fallbackPage.programs;
        }
      } else {
        const fallbackPage = await loadPublicProgramsPageFallback();
        programs = filterOpportunityPrograms(fallbackPage.programs, { activeChip, keyword: "" });
        if (liveBoardPrograms.length === 0) {
          liveBoardPrograms = fallbackPage.programs;
        }
      }
    } else {
      liveBoardPrograms = await loadPublicLandingLiveBoardRows().catch(() => []);
      const programsPage = await listProgramsPage({
        ...programParams,
        scope,
      });
      const shouldUseBrowseFallback =
        activeChip === "전체" &&
        !keyword &&
        programsPage.source === "read_model" &&
        (programsPage.count ?? 0) > 0 &&
        (programsPage.count ?? 0) < PUBLIC_PROGRAM_BROWSE_LIMIT;

      if (shouldUseBrowseFallback) {
        const fallbackPage = await loadPublicProgramsPageFallback();
        programs = fallbackPage.programs;
        liveBoardPrograms = fallbackPage.programs;
      } else {
        programs = unwrapProgramListRows(programsPage.items);
      }
    }
  } catch (cause) {
    const canServeFromLandingSnapshot = snapshotPrograms.length >= OPPORTUNITY_FEED_SIZE;
    try {
      const fallbackPage = await loadPublicProgramsPageFallback();
      programs = canServeFromLandingSnapshot
        ? snapshotPrograms
        : fallbackPage.programs;
      liveBoardPrograms = fallbackPage.programs;
    } catch {
      error = cause instanceof Error ? cause.message : "프로그램 정보를 불러오지 못했습니다.";
    }
  }

  const canServeFromLandingSnapshot = snapshotPrograms.length >= OPPORTUNITY_FEED_SIZE;
  const heroPrograms = getLiveBoardPrograms(liveBoardPrograms);
  let opportunityPrograms = canServeFromLandingSnapshot && !error
    ? orderOpportunityPrograms(snapshotPrograms, { activeChip, limit: OPPORTUNITY_FEED_SIZE })
    : orderOpportunityPrograms(
        filterOpportunityPrograms(programs, { activeChip, keyword }),
        { activeChip }
      );

  if (keyword && !error && opportunityPrograms.length < OPPORTUNITY_FEED_SIZE) {
    try {
      const fallbackPrograms = await loadPublicFilteredProgramFallbackRows({
        activeChip,
        keyword,
        limit: OPPORTUNITY_FEED_SIZE * 4,
      });

      opportunityPrograms = orderOpportunityPrograms(
        filterOpportunityPrograms(mergeDistinctPrograms(programs, fallbackPrograms), { activeChip, keyword }),
        { activeChip, limit: OPPORTUNITY_FEED_SIZE }
      );
    } catch {
      // Keep the already loaded list when the supplemental fallback path is unavailable.
    }
  }

  return (
    <main className="min-h-screen bg-[var(--surface)] text-[var(--ink)]" style={landingCThemeVars}>
      <LandingHeader />
      <LandingCHeroSection heroPrograms={heroPrograms} />
      <LandingCOpportunityFeed activeChip={activeChip} programs={opportunityPrograms} error={error} />
      <LandingCBackupHeroSection />
      <LandingCWorkflowSection />
      <LandingCCircularFlowSection />
      <LandingCFinalCtaSection />
      <LandingCFooter />
    </main>
  );
}
