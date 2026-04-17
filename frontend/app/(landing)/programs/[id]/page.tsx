import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { LandingANavBar, LandingATickerBar } from "@/app/(landing)/landing-a/_components";
import AdSlot from "@/components/AdSlot";
import { getProgram } from "@/lib/api/backend";
import { getSiteUrl } from "@/lib/seo";
import type { Program } from "@/lib/types";

type ProgramDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const getProgramDetail = cache(async (id: string) => getProgram(id));

function normalizeTextList(value: string[] | string | null | undefined): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }

  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function formatDateLabel(value: string | null | undefined): string {
  if (!value) return "정보 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ko-KR");
}

function isNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes("404") || message.includes("not found");
}

function formatProgramPeriod(program: Program): string | undefined {
  if (!program.start_date && !program.end_date) {
    return undefined;
  }

  const start = program.start_date ? formatDateLabel(program.start_date) : "시작일 미정";
  const end = program.end_date ? formatDateLabel(program.end_date) : "종료일 미정";
  return `${start} - ${end}`;
}

function buildProgramDescription(program: Program): string {
  const summary = [
    program.provider ? `${program.provider}에서 운영하는` : undefined,
    program.category ? `${program.category} 프로그램.` : "취업 지원 프로그램.",
    program.location || undefined,
    formatProgramPeriod(program),
  ].filter(Boolean);

  if (summary.length > 0) {
    return summary.join(" ");
  }

  return "이소서에서 제공하는 취업 지원 프로그램 상세 정보입니다.";
}

function omitUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

function buildProgramJsonLd(program: Program): Record<string, unknown> | null {
  if (!program.title) {
    return null;
  }

  const description = program.description || program.summary || undefined;
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
          price: "0",
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
    educationalLevel: program.category || undefined,
    locationCreated: location,
    startDate: program.start_date || undefined,
    endDate: program.end_date || undefined,
    offers,
  });
}

async function getProgramForPage(id: string): Promise<Program> {
  try {
    return await getProgramDetail(id);
  } catch (error) {
    if (isNotFoundError(error)) {
      notFound();
    }

    throw error;
  }
}

export async function generateMetadata({ params }: ProgramDetailPageProps): Promise<Metadata> {
  const { id } = await params;

  try {
    const program = await getProgramDetail(id);
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
    const chips = [...normalizeTextList(program.tags), ...normalizeTextList(program.skills)].slice(0, 10);
    const externalLink = program.application_url || program.link || program.source_url;
    const jsonLd = buildProgramJsonLd(program);

    return (
      <>
        {jsonLd ? (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
        ) : null}
        <LandingATickerBar />
        <LandingANavBar />
        <main className="min-h-screen bg-slate-50 text-slate-950">
          <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
            <Link href="/programs" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              프로그램 목록으로
            </Link>

            <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                {program.category || "미분류"}
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight">
                {program.title || "제목 미정"}
              </h1>
              <div className="mt-5 flex flex-wrap gap-2 text-sm text-slate-600">
                <span className="rounded-full bg-slate-100 px-3 py-1">{program.provider || "기관 정보 없음"}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1">{program.location || "지역 정보 없음"}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1">마감 {formatDateLabel(program.deadline)}</span>
              </div>
              <p className="mt-6 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {program.description || program.summary || "프로그램 소개가 아직 등록되지 않았습니다."}
              </p>

              {chips.length > 0 ? (
                <div className="mt-6 flex flex-wrap gap-2">
                  {chips.map((chip) => (
                    <span
                      key={chip}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600"
                    >
                      #{chip}
                    </span>
                  ))}
                </div>
              ) : null}

              {externalLink ? (
                <div className="mt-8">
                  <a
                    href={externalLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                  >
                    신청 페이지로 이동
                  </a>
                </div>
              ) : null}

              <AdSlot
                slotId="program-detail-bottom-banner"
                className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"
              />
            </section>
          </div>
        </main>
      </>
    );
  } catch (e) {
    if (isNotFoundError(e)) {
      notFound();
    }

    const message = e instanceof Error ? e.message : "프로그램을 불러오지 못했습니다.";
    return (
      <>
        <LandingATickerBar />
        <LandingANavBar />
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
          <div className="rounded-2xl border border-rose-200 bg-white px-8 py-10 text-center shadow-sm">
            <p className="text-base font-medium text-rose-700">{message}</p>
            <Link href="/programs" className="mt-4 inline-flex text-sm font-medium text-slate-700 hover:text-slate-950">
              프로그램 목록으로 돌아가기
            </Link>
          </div>
        </main>
      </>
    );
  }
}
