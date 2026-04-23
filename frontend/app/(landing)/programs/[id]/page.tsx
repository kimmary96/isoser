import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { LandingHeader } from "@/components/landing/LandingHeader";
import { getProgramDetail } from "@/lib/api/backend";
import { getSiteUrl } from "@/lib/seo";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ProgramDetail } from "@/lib/types";

import ProgramDetailClient from "./program-detail-client";

type ProgramDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const getProgramDetailView = cache(async (id: string) => getProgramDetail(id));

function isNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes("404") || message.includes("not found") || message.includes("invalid input syntax");
}

function buildProgramDescription(program: ProgramDetail): string {
  const summary = [
    program.provider ? `${program.provider}에서 운영하는` : undefined,
    "취업 지원 프로그램.",
    program.location || undefined,
    program.schedule_text || undefined,
  ].filter(Boolean);

  if (summary.length > 0) {
    return summary.join(" ");
  }

  return "이소서에서 제공하는 취업 지원 프로그램 상세 정보입니다.";
}

function omitUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

function buildProgramJsonLd(program: ProgramDetail): Record<string, unknown> | null {
  if (!program.title) {
    return null;
  }

  const description = program.description || undefined;
  const location = program.location
    ? {
        "@type": "Place",
        address: program.location,
      }
    : undefined;
  const provider = program.provider
    ? {
        "@type": "Organization",
        name: program.provider,
      }
    : undefined;
  const offers =
    program.support_type || description
      ? omitUndefined({
          "@type": "Offer",
          price: program.fee ?? 0,
          priceCurrency: "KRW",
          description: program.support_type || undefined,
        })
      : undefined;

  return omitUndefined({
    "@context": "https://schema.org",
    "@type": "Course",
    name: program.title,
    provider,
    description,
    locationCreated: location,
    startDate: program.program_start_date || program.application_start_date || undefined,
    endDate: program.program_end_date || program.application_end_date || undefined,
    offers,
  });
}

async function getProgramForPage(id: string): Promise<ProgramDetail> {
  try {
    return await getProgramDetailView(id);
  } catch (error) {
    if (isNotFoundError(error)) {
      notFound();
    }

    throw error;
  }
}

async function getProgramBookmarkState(programId: string): Promise<{ isLoggedIn: boolean; initialBookmarked: boolean }> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      return { isLoggedIn: false, initialBookmarked: false };
    }

    const { data } = await supabase
      .from("program_bookmarks")
      .select("program_id")
      .eq("user_id", session.user.id)
      .eq("program_id", programId)
      .maybeSingle();

    return { isLoggedIn: true, initialBookmarked: Boolean(data?.program_id) };
  } catch {
    return { isLoggedIn: false, initialBookmarked: false };
  }
}

export async function generateMetadata({ params }: ProgramDetailPageProps): Promise<Metadata> {
  const { id } = await params;

  try {
    const program = await getProgramDetailView(id);
    const title = program.title ? `${program.title} | 이소서` : "프로그램 상세 | 이소서";
    const description = buildProgramDescription(program);

    return {
      title,
      description,
      alternates: {
        canonical: `/programs/${id}`,
      },
      openGraph: {
        title,
        description,
        type: "article",
        url: getSiteUrl(`/programs/${id}`),
      },
    };
  } catch (error) {
    if (isNotFoundError(error)) {
      return {
        title: "프로그램 상세 | 이소서",
        description: "이소서 프로그램 상세 페이지입니다.",
      };
    }

    return {
      title: "프로그램 상세 | 이소서",
      description: "이소서 프로그램 상세 페이지입니다.",
    };
  }
}

export default async function ProgramDetailPage({ params }: ProgramDetailPageProps) {
  const { id } = await params;

  try {
    const program = await getProgramForPage(id);
    const bookmarkState = await getProgramBookmarkState(String(program.id ?? id));
    const jsonLd = buildProgramJsonLd(program);

    return (
      <>
        {jsonLd ? (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
        ) : null}
        <div className="hidden h-8 overflow-hidden bg-indigo-950 text-white md:block">
          <div className="mx-auto flex h-full max-w-7xl items-center gap-7 px-6 text-[11px] font-bold tracking-[0.04em] text-white/80">
            <span className="inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {program.title || "프로그램 상세"}
            </span>
            {program.provider ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-300" />
                운영 {program.provider}
              </span>
            ) : null}
            {program.location ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                지역 {program.location}
              </span>
            ) : null}
          </div>
        </div>
        <LandingHeader />
        <ProgramDetailClient
          program={program}
          isLoggedIn={bookmarkState.isLoggedIn}
          initialBookmarked={bookmarkState.initialBookmarked}
        />
      </>
    );
  } catch (e) {
    if (isNotFoundError(e)) {
      notFound();
    }

    return (
      <>
        <LandingHeader />
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
          <div className="rounded-2xl border border-rose-200 bg-white px-8 py-10 text-center shadow-sm">
            <p className="text-base font-medium text-rose-700">프로그램 정보를 불러오지 못했습니다.</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              잠시 후 다시 시도하거나 프로그램 목록에서 다른 공고를 확인해 주세요.
            </p>
            <Link href="/programs" className="mt-4 inline-flex text-sm font-medium text-slate-700 hover:text-slate-950">
              프로그램 목록으로 돌아가기
            </Link>
          </div>
        </main>
      </>
    );
  }
}
