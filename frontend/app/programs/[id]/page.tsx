import Link from "next/link";

import { getProgram } from "@/lib/api/backend";

type ProgramDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

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

export default async function ProgramDetailPage({ params }: ProgramDetailPageProps) {
  const { id } = await params;

  try {
    const program = await getProgram(id);
    const chips = [...normalizeTextList(program.tags), ...normalizeTextList(program.skills)].slice(0, 10);
    const externalLink = program.application_url || program.link || program.source_url;

    return (
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
          </section>
        </div>
      </main>
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "프로그램을 불러오지 못했습니다.";
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="rounded-2xl border border-rose-200 bg-white px-8 py-10 text-center shadow-sm">
          <p className="text-base font-medium text-rose-700">{message}</p>
          <Link href="/programs" className="mt-4 inline-flex text-sm font-medium text-slate-700 hover:text-slate-950">
            프로그램 목록으로 돌아가기
          </Link>
        </div>
      </main>
    );
  }
}
