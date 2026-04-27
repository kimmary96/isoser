import type { Metadata } from "next";
import { LandingHeader } from "@/components/landing/LandingHeader";
import {
  getProgramDetails,
  getPrograms,
} from "@/lib/api/backend";
import { toBookmarkProgramCardItem } from "@/lib/program-card-items";
import { loadProgramCardSummariesByIds } from "@/lib/server/program-card-summary";
import { getSiteUrl } from "@/lib/seo";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service-role";
import type { ProgramCardItem } from "@/lib/types";
import type { ProgramCardRouteClient } from "@/lib/server/program-card-summary";

import { COMPARE_COPY } from "./compare-copy";
import { loadCompareSuggestions } from "./compare-suggestions";
import ProgramsCompareClient from "./programs-compare-client";
import type { CompareProgram } from "./compare-value-getters";

export const metadata: Metadata = {
  title: COMPARE_COPY.metadata.title,
  description: COMPARE_COPY.metadata.description,
  alternates: {
    canonical: "/compare",
  },
  openGraph: {
    title: COMPARE_COPY.metadata.title,
    description: COMPARE_COPY.metadata.description,
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
  const enrichedActivePrograms = enrichedSlotPrograms.filter(
    (program): program is CompareProgram => program !== null
  );

  let isLoggedIn = false;
  let initialBookmarkedItems: ProgramCardItem[] = [];
  let accessToken: string | null = null;
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    isLoggedIn = Boolean(user);
    accessToken = session?.access_token ?? null;
    if (user?.id) {
      initialBookmarkedItems = await loadComparePageBookmarks(user.id);
    }
  } catch {
    isLoggedIn = false;
    initialBookmarkedItems = [];
    accessToken = null;
  }

  const { suggestions, error: suggestionsError } = await loadCompareSuggestions({
    accessToken,
    activePrograms: enrichedActivePrograms,
    canonicalIds,
    initialBookmarkedItems,
  });

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
        initialBookmarkedItems={initialBookmarkedItems}
      />
    </>
  );
}

type BookmarkRow = {
  program_id: string | null;
  created_at: string | null;
};

async function loadComparePageBookmarks(userId: string): Promise<ProgramCardItem[]> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("program_bookmarks")
    .select("program_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    throw new Error(error.message || COMPARE_COPY.modal.bookmarks.errorTitle);
  }

  const rows = ((data ?? []) as BookmarkRow[]).filter((row) => row.program_id);
  const programIds = rows.map((row) => String(row.program_id));
  const programs = await loadProgramCardSummariesByIds(
    supabase as unknown as ProgramCardRouteClient,
    programIds
  );
  const programMap = new Map(programs.map((program) => [String(program.id ?? ""), program]));
  return rows
    .map((row) => {
      const program = row.program_id ? programMap.get(String(row.program_id)) : null;
      return program ? toBookmarkProgramCardItem(program, row.created_at ?? null) : null;
    })
    .filter((item): item is ProgramCardItem => Boolean(item));
}
