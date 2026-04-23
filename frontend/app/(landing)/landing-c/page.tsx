import type { Metadata } from "next";

import { LandingHeader } from "@/components/landing/LandingHeader";
import { listProgramsPage } from "@/lib/api/backend";
import { buildProgramFilterParams } from "@/lib/program-filters";
import { getSiteUrl } from "@/lib/seo";
import type { Program } from "@/lib/types";

import { LandingCHeroSection } from "./_hero";
import { LandingCOpportunityFeed } from "./_program-feed";
import { getLiveBoardPrograms, orderOpportunityPrograms } from "./_program-utils";
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

export default async function LandingCPage({ searchParams }: LandingCPageProps) {
  const resolvedSearchParams = await searchParams;
  const activeChip = normalizeChip(resolvedSearchParams.chip);
  const keyword = normalizeKeyword(resolvedSearchParams.q);
  const programParams = buildProgramFilterParams(activeChip, keyword, 48);

  let programs: Program[] = [];
  let liveBoardPrograms: Program[] = [];
  let error: string | null = null;

  try {
    const [programsPage, liveBoardPage] = await Promise.all([
      listProgramsPage({
        ...programParams,
        scope: programParams.q ? "all" : "default",
      }),
      listProgramsPage({
        sort: "default",
        recruiting_only: true,
        limit: 72,
        scope: "default",
      }),
    ]);
    programs = programsPage.items;
    liveBoardPrograms = liveBoardPage.items;
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "프로그램 정보를 불러오지 못했습니다.";
  }

  const heroPrograms = getLiveBoardPrograms(liveBoardPrograms);
  const opportunityPrograms = orderOpportunityPrograms(programs, { activeChip });

  return (
    <main className="min-h-screen bg-[var(--surface)] text-[var(--ink)]" style={landingCThemeVars}>
      <LandingHeader />
      <LandingCHeroSection heroPrograms={heroPrograms} />
      <LandingCOpportunityFeed activeChip={activeChip} keyword={keyword} programs={opportunityPrograms} error={error} />
      <LandingCBackupHeroSection />
      <LandingCWorkflowSection />
      <LandingCCircularFlowSection />
      <LandingCFinalCtaSection />
      <LandingCFooter />
    </main>
  );
}
