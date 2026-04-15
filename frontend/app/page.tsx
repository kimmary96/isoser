import Link from "next/link";

import KakaoMap from "@/components/KakaoMap";
import { PROGRAM_CATEGORIES } from "@/lib/program-categories";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function fallbackName(email: string | null | undefined, metadataName: unknown): string {
  if (typeof metadataName === "string" && metadataName.trim()) {
    return metadataName.trim();
  }

  if (typeof email === "string" && email.includes("@")) {
    return email.split("@")[0];
  }

  return "사용자";
}

export default async function Home() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("name, avatar_url").eq("id", user.id).maybeSingle()
    : { data: null };

  const isLoggedIn = Boolean(user);
  const displayName =
    (typeof profile?.name === "string" && profile.name.trim()) ||
    fallbackName(user?.email, user?.user_metadata?.name ?? user?.user_metadata?.full_name);
  const profileInitial = displayName.slice(0, 1).toUpperCase() || "U";

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10">
        <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">
              Isoser
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">AI 취업 준비를 한곳에서 정리하세요</h1>
            <p className="mt-2 text-sm text-slate-600">
              프로그램 탐색은 랜딩에서 하고, 프로필과 문서 작업은 대시보드에서 이어집니다.
            </p>
          </div>

          {isLoggedIn ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-3 self-start rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-slate-300 hover:bg-slate-100"
            >
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={`${displayName} 프로필 이미지`}
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                  {profileInitial}
                </div>
              )}
              <div className="text-left">
                <p className="text-sm font-semibold text-slate-900">{displayName}</p>
                <p className="text-xs text-slate-500">프로필 열기</p>
              </div>
            </Link>
          ) : (
            <Link
              href="/login"
              className="inline-flex self-start rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              로그인 / 회원가입
            </Link>
          )}
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-8">
          <p className="text-sm font-semibold text-slate-500">상단 배너 광고 영역</p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">인기 부트캠프 TOP 10</h2>
              <p className="mt-2 text-sm text-slate-600">
                이번 주 많이 본 과정을 한눈에 확인해보세요.
              </p>
            </div>
            <Link
              href="/programs"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              전체 보기
            </Link>
          </div>
          <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-sm text-slate-500">
            프로그램 카드 영역
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-8">
          <h2 className="text-2xl font-semibold tracking-tight">카테고리 필터</h2>
          <div className="-mx-2 mt-4 overflow-x-auto px-2 pb-2">
            <div className="flex min-w-max gap-2">
              {PROGRAM_CATEGORIES.map((category) => {
                const href =
                  category === "전체"
                    ? "/programs"
                    : `/programs?category=${encodeURIComponent(category)}`;

                return (
                  <Link
                    key={category}
                    href={href}
                    className="shrink-0 rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
                  >
                    {category}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">내 주변 부트캠프 찾기</h2>
              <p className="mt-2 text-sm text-slate-600">
                서울 주요 부트캠프 위치를 지도에서 확인하고 관심 있는 기관을 눌러보세요.
              </p>
            </div>
            <p className="text-sm text-slate-500">마커를 클릭하면 기관명이 표시됩니다.</p>
          </div>
          <div className="mt-6">
            <KakaoMap />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-8">
          <h2 className="text-2xl font-semibold tracking-tight">마감 임박 과정 하이라이트</h2>
          <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-sm text-slate-500">
            마감 임박 과정 하이라이트 영역
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-slate-900 p-8 text-white">
          <h2 className="text-2xl font-semibold tracking-tight">
            {isLoggedIn ? "이제 대시보드에서 이력서를 이어서 작성하세요" : "회원가입하고 관심 프로그램을 비교해보세요"}
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            {isLoggedIn
              ? "프로필, 이력서, 자기소개서, 활동 기록은 대시보드에서 바로 이어집니다."
              : "프로그램 북마크와 지원 준비 기능은 로그인 후 사용할 수 있습니다."}
          </p>
          <div className="mt-6">
            <Link
              href={isLoggedIn ? "/dashboard" : "/login"}
              className="inline-flex rounded-lg bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
            >
              {isLoggedIn ? "내 대시보드 열기" : "회원가입 CTA 버튼"}
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
