"use client";

import { useEffect, useMemo, useState } from "react";

import MiniCalendar from "@/components/MiniCalendar";
import { createBrowserClient } from "@/lib/supabase/client";

type RecommendedProgram = {
  title: string | null;
  source: string | null;
  end_date: string | null;
  days_left: number | null;
  final_score: number | null;
  link: string | null;
};

type RecommendResponseItem = {
  program?: RecommendedProgram | null;
};

function formatUserName(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed || "사용자";
}

function formatEndDate(value: string | null | undefined): string | null {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `~${month}/${day}까지`;
}

function toDateKey(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatRelevance(score: number | null | undefined): string {
  if (typeof score !== "number" || Number.isNaN(score)) {
    return "관련도 0%";
  }

  const percent = score <= 1 ? Math.round(score * 100) : Math.round(score);
  return `관련도 ${percent}%`;
}

function getDdayBadge(daysLeft: number | null | undefined) {
  if (typeof daysLeft !== "number" || Number.isNaN(daysLeft)) {
    return null;
  }

  if (daysLeft <= 7) {
    return {
      label: `D-${daysLeft}`,
      className: "bg-red-50 text-red-600 ring-1 ring-inset ring-red-200",
    };
  }

  if (daysLeft <= 14) {
    return {
      label: `D-${daysLeft}`,
      className: "bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-200",
    };
  }

  return {
    label: `D-${daysLeft}`,
    className: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  };
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="h-5 w-3/4 rounded bg-slate-200" />
          <div className="mt-2 h-4 w-24 rounded bg-slate-100" />
        </div>
        <div className="h-7 w-14 rounded-full bg-slate-100" />
      </div>
      <div className="mb-5 h-4 w-20 rounded bg-slate-100" />
      <div className="mb-6 h-4 w-24 rounded bg-slate-200" />
      <div className="h-4 w-20 rounded bg-slate-100" />
    </div>
  );
}

function ProgramCard({ program, cardId }: { program: RecommendedProgram; cardId?: string }) {
  const endDateLabel = formatEndDate(program.end_date);
  const ddayBadge = program.end_date ? getDdayBadge(program.days_left) : null;

  return (
    <article
      id={cardId}
      className="flex min-h-[220px] flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-base font-semibold text-slate-950">{program.title || "제목 없음"}</h3>
          <p className="mt-2 text-sm text-slate-500">{program.source || "출처 미상"}</p>
        </div>
        {ddayBadge ? (
          <span
            className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold ${ddayBadge.className}`}
          >
            {ddayBadge.label}
          </span>
        ) : null}
      </div>

      <div className="mb-3 text-sm text-slate-600">{endDateLabel || "종료일 정보 없음"}</div>

      <div className="mb-6 text-sm font-medium text-slate-800">{formatRelevance(program.final_score)}</div>

      <div className="mt-auto">
        {program.link ? (
          <a
            href={program.link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            자세히 보기
          </a>
        ) : (
          <span className="text-sm text-slate-400">링크 없음</span>
        )}
      </div>
    </article>
  );
}

export default function DashboardPage() {
  const supabase = useMemo(() => createBrowserClient(), []);

  const [userName, setUserName] = useState("사용자");
  const [programs, setPrograms] = useState<RecommendedProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleDateClick = (date: string) => {
    const target = document.getElementById(`card-${date}`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  useEffect(() => {
    let mounted = true;

    const loadDashboard = async () => {
      setLoading(true);
      setError(null);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const user = session?.user ?? null;
        const accessToken = session?.access_token;

        if (!mounted) return;

        const metadataName =
          typeof user?.user_metadata?.name === "string"
            ? user.user_metadata.name
            : typeof user?.user_metadata?.full_name === "string"
              ? user.user_metadata.full_name
              : typeof user?.email === "string"
                ? user.email.split("@")[0]
                : "사용자";

        setUserName(formatUserName(metadataName));

        if (user?.id) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("name")
            .eq("id", user.id)
            .maybeSingle();

          if (mounted && typeof profile?.name === "string" && profile.name.trim()) {
            setUserName(profile.name.trim());
          }
        }

        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.trim();
        if (!backendUrl) {
          throw new Error("NEXT_PUBLIC_BACKEND_URL is not configured.");
        }

        const response = await fetch(`${backendUrl}/programs/recommend`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({ top_k: 9 }),
        });

        if (!response.ok) {
          throw new Error(`추천 프로그램 요청 실패 (${response.status})`);
        }

        const data = (await response.json()) as { items?: RecommendResponseItem[] | null };
        const nextPrograms = (data.items ?? [])
          .map((item) => item.program)
          .filter((program): program is RecommendedProgram => Boolean(program))
          .slice(0, 9);

        if (!mounted) return;

        setPrograms(nextPrograms);
      } catch (e) {
        if (!mounted) return;
        setPrograms([]);
        setError(e instanceof Error ? e.message : "추천 프로그램을 불러오지 못했습니다.");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadDashboard();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            안녕하세요, {userName}님
          </h1>
        </header>

        <MiniCalendar
          programs={programs.map((program) => ({
            title: program.title || "제목 없음",
            end_date: program.end_date || undefined,
          }))}
          onDateClick={handleDateClick}
        />

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
              AI 맞춤 취업 지원 캘린더
            </h2>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : programs.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {programs.map((program, index) => {
                const dateKey = program.end_date ? toDateKey(program.end_date) : null;

                return (
                  <ProgramCard
                    key={`${program.link ?? program.title ?? "program"}-${index}`}
                    cardId={dateKey ? `card-${dateKey}` : undefined}
                    program={program}
                  />
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
              <p className="text-sm text-slate-500">
                {error ? error : "추천 프로그램이 없습니다"}
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
