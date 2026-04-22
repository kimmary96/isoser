import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { LandingANavBar, LandingATickerBar } from "@/app/(landing)/landing-a/_components";
import AdSlot from "@/components/AdSlot";
import { getProgramDetail } from "@/lib/api/backend";
import { getSiteUrl } from "@/lib/seo";
import type { ProgramDetail } from "@/lib/types";

type ProgramDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const getProgramDetailView = cache(async (id: string) => getProgramDetail(id));

function formatDateLabel(value: string | null | undefined): string | null {
  if (!value) return null;
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

function formatDateRange(startDate: string | null | undefined, endDate: string | null | undefined): string | null {
  if (!startDate && !endDate) {
    return null;
  }

  const start = formatDateLabel(startDate) || "시작일 미정";
  const end = formatDateLabel(endDate) || "종료일 미정";
  return `${start} - ${end}`;
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
    const chips = [...program.tags, ...program.tech_stack, ...program.certifications].slice(0, 10);
    const externalLink = program.source_url;
    const jsonLd = buildProgramJsonLd(program);
    const applicationPeriod = formatDateRange(program.application_start_date, program.application_end_date);
    const programPeriod = formatDateRange(program.program_start_date, program.program_end_date);
    const primaryFacts = [
      ["운영 기관", program.provider],
      ["주관/담당", program.organizer],
      ["지역", program.location],
      ["신청 기간", applicationPeriod],
      ["운영 기간", programPeriod],
      ["운영 방식", program.teaching_method],
      ["지원 유형", program.support_type],
      ["수강료", typeof program.fee === "number" ? `${program.fee.toLocaleString("ko-KR")}원` : null],
      ["지원금", typeof program.support_amount === "number" ? `${program.support_amount.toLocaleString("ko-KR")}원` : null],
    ].filter(([, value]) => Boolean(value));
    const optionalFacts = [
      ["만족도", program.rating],
      ["취업률", program.job_placement_rate],
      ["정원", typeof program.capacity_total === "number" ? `${program.capacity_total}명` : null],
      ["잔여 정원", typeof program.capacity_remaining === "number" ? `${program.capacity_remaining}명` : null],
      ["담당자", program.manager_name],
      ["전화", program.phone],
      ["이메일", program.email],
    ].filter(([, value]) => Boolean(value));

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
                Program Detail
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight">
                {program.title || "제목 미정"}
              </h1>
              <div className="mt-5 flex flex-wrap gap-2 text-sm text-slate-600">
                {program.provider ? <span className="rounded-full bg-slate-100 px-3 py-1">{program.provider}</span> : null}
                {program.location ? <span className="rounded-full bg-slate-100 px-3 py-1">{program.location}</span> : null}
                {program.schedule_text ? <span className="rounded-full bg-slate-100 px-3 py-1">{program.schedule_text}</span> : null}
              </div>
              {program.description ? (
                <p className="mt-6 whitespace-pre-wrap text-sm leading-7 text-slate-700">{program.description}</p>
              ) : null}

              {primaryFacts.length > 0 ? (
                <section className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <h2 className="text-base font-semibold text-slate-950">핵심 정보</h2>
                  <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    {primaryFacts.map(([label, value]) => (
                      <div key={label} className="rounded-xl bg-white px-4 py-3">
                        <dt className="text-xs font-semibold text-slate-400">{label}</dt>
                        <dd className="mt-1 text-sm font-medium text-slate-800">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ) : null}

              {program.eligibility.length > 0 ? (
                <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
                  <h2 className="text-base font-semibold text-slate-950">지원 대상</h2>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                    {program.eligibility.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {optionalFacts.length > 0 ? (
                <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
                  <h2 className="text-base font-semibold text-slate-950">추가 운영 정보</h2>
                  <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    {optionalFacts.map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-xs font-semibold text-slate-400">{label}</dt>
                        <dd className="mt-1 text-sm text-slate-700">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ) : null}

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
