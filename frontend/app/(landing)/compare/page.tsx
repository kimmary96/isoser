import { LandingANavBar, LandingATickerBar } from "@/app/(landing)/landing-a/_components";
import { getProgram, listPrograms } from "@/lib/api/backend";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Program } from "@/lib/types";

import ProgramsCompareClient from "./programs-compare-client";

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
  const requested = rawValues.flatMap((entry) =>
    entry
      .split(",")
      .map((token) => token.trim())
      .filter(Boolean)
  );

  const slotIds: Array<string | null> = [];
  const seen = new Set<string>();
  let needsNormalization = rawValues.length > 1 || requested.length > 3;

  requested.slice(0, 3).forEach((token) => {
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

async function getOptionalProgram(programId: string | null): Promise<Program | null> {
  if (!programId) {
    return null;
  }

  try {
    return await getProgram(programId);
  } catch {
    return null;
  }
}

export default async function ProgramsComparePage({ searchParams }: ProgramsComparePageProps) {
  const resolvedSearchParams = await searchParams;
  const { slotIds, needsNormalization: parsedNeedsNormalization } = parseRequestedIds(resolvedSearchParams.ids);

  const slotPrograms = await Promise.all(slotIds.map((programId) => getOptionalProgram(programId)));
  const activePrograms = slotPrograms.filter((program): program is Program => program !== null);
  const canonicalIds = activePrograms
    .map((program) => (typeof program.id === "string" ? program.id : null))
    .filter((programId): programId is string => Boolean(programId));
  const needsNormalization = parsedNeedsNormalization || canonicalIds.length !== slotIds.filter(Boolean).length;

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
      <LandingATickerBar />
      <LandingANavBar />
      <ProgramsCompareClient
        initialSlots={slotPrograms}
        canonicalIds={canonicalIds}
        needsNormalization={needsNormalization}
        suggestions={suggestions}
        suggestionsError={suggestionsError}
        isLoggedIn={isLoggedIn}
      />
    </>
  );
}
