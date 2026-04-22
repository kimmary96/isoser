import type { Metadata } from "next";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { getProgramDetails, getPrograms, listPrograms } from "@/lib/api/backend";
import { getSiteUrl } from "@/lib/seo";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Program } from "@/lib/types";

import ProgramsCompareClient from "./programs-compare-client";
import type { CompareProgram } from "./compare-table-sections";

export const metadata: Metadata = {
  title: "취업 지원 프로그램 비교 | 이소서",
  description:
    "최대 3개의 취업 지원 프로그램을 한 화면에서 비교하고 일정, 지원 조건, 적합도 정보를 빠르게 검토할 수 있습니다.",
  alternates: {
    canonical: "/compare",
  },
  openGraph: {
    title: "취업 지원 프로그램 비교 | 이소서",
    description:
      "최대 3개의 취업 지원 프로그램을 한 화면에서 비교하고 일정, 지원 조건, 적합도 정보를 빠르게 검토할 수 있습니다.",
    type: "website",
    url: getSiteUrl("/compare"),
  },
};

type ProgramsComparePageProps = {
  searchParams: Promise<{
    ids?: string | string[];
  }>;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function parseRequestedIds(value?: string | string[]) {
  const rawValues = Array.isArray(value) ? value : value ? [value] : [];
  const requested = rawValues.flatMap((entry) => entry.split(",").map((token) => token.trim()));

  const slotIds: Array<string | null> = [];
  const seen = new Set<string>();
  let needsNormalization = rawValues.length > 1 || requested.length > 3;

  requested.slice(0, 3).forEach((token) => {
    if (!token) {
      slotIds.push(null);
      return;
    }

    if (!isUuid(token)) {
      slotIds.push(null);
      needsNormalization = true;
      return;
    }

    if (seen.has(token)) {
      slotIds.push(null);
      needsNormalization = true;
      return;
    }

    seen.add(token);
    slotIds.push(token);
  });

  while (slotIds.length < 3) {
    slotIds.push(null);
  }

  return {
    slotIds,
    needsNormalization,
  };
}

export default async function ProgramsComparePage({ searchParams }: ProgramsComparePageProps) {
  const resolvedSearchParams = await searchParams;
  const { slotIds, needsNormalization: parsedNeedsNormalization } = parseRequestedIds(resolvedSearchParams.ids);

  const requestedProgramIds = slotIds.filter((programId): programId is string => Boolean(programId));
  const programsById = new Map<string, CompareProgram>();
  if (requestedProgramIds.length > 0) {
    try {
      const items = await getPrograms(requestedProgramIds);
      items.forEach((program) => {
        if (typeof program.id === "string") programsById.set(program.id, program);
      });
    } catch {
      // Keep invalid or unavailable slots empty.
    }
  }
  const slotPrograms = slotIds.map((programId) => (programId ? programsById.get(programId) ?? null : null));
  const activePrograms = slotPrograms.filter((program): program is CompareProgram => program !== null);
  const canonicalIds = activePrograms
    .map((program) => (typeof program.id === "string" ? program.id : null))
    .filter((programId): programId is string => Boolean(programId));
  const needsNormalization = parsedNeedsNormalization || canonicalIds.length !== slotIds.filter(Boolean).length;
  const detailsById = new Map<string, CompareProgram["detail"]>();
  if (canonicalIds.length > 0) {
    try {
      const detailItems = await getProgramDetails(canonicalIds);
      detailItems.forEach((detail) => {
        if (typeof detail.id === "string") detailsById.set(detail.id, detail);
      });
    } catch {
      // Detail fields are additive for compare; keep the page renderable with list data.
    }
  }
  const enrichedSlotPrograms = slotPrograms.map((program) => {
    if (!program || typeof program.id !== "string") return program;
    return { ...program, detail: detailsById.get(program.id) ?? null };
  });

  let suggestions: Program[] = [];
  let suggestionsError: string | null = null;

  try {
    const listedPrograms = await listPrograms({ limit: 8, sort: "deadline" });
    suggestions = listedPrograms
      .filter((program) => {
        const programId = typeof program.id === "string" ? program.id : "";
        return Boolean(programId) && !canonicalIds.includes(programId);
      })
      .slice(0, 4);
  } catch (error) {
    suggestionsError =
      error instanceof Error ? error.message : "추천 프로그램을 불러올 수 없습니다.";
  }

  let isLoggedIn = false;
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    isLoggedIn = Boolean(user);
  } catch {
    isLoggedIn = false;
  }

  return (
    <>
      <LandingHeader />
      <ProgramsCompareClient
        initialSlots={enrichedSlotPrograms}
        canonicalIds={canonicalIds}
        needsNormalization={needsNormalization}
        suggestions={suggestions}
        suggestionsError={suggestionsError}
        isLoggedIn={isLoggedIn}
      />
    </>
  );
}
