import Link from "next/link";
import { redirect } from "next/navigation";

import { getGoogleAuthHref, resolveInternalPath } from "@/lib/routes";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    redirectedFrom?: string | string[];
  }>;
};

function takeFirst(value?: string | string[]): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function getLoginErrorMessage(errorCode: string): string | null {
  if (errorCode === "oauth_start_failed") {
    return "Google 로그인 시작에 실패했습니다. 잠시 후 다시 시도해주세요.";
  }

  if (errorCode === "oauth_callback_failed") {
    return "Google 로그인 완료 처리에 실패했습니다. 다시 로그인해주세요.";
  }

  return null;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = await searchParams;
  const safeNext = resolveInternalPath(takeFirst(resolvedSearchParams.redirectedFrom));
  const errorMessage = getLoginErrorMessage(takeFirst(resolvedSearchParams.error));

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      redirect(safeNext);
    }
  } catch {
    // 인증 확인 실패 시에는 로그인 화면을 그대로 보여준다.
  }

  const googleLoginHref = getGoogleAuthHref(safeNext);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10 lg:justify-center">
        <Link href="/landing-c" className="text-lg font-extrabold tracking-[-0.04em] text-slate-950">
          이소<span className="text-blue-600">서</span>
        </Link>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.05fr_420px] lg:items-center">
          <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">Login</p>
            <h1 className="mt-4 text-4xl font-extrabold tracking-[-0.05em] text-slate-950 sm:text-5xl">
              로그인하면 찜과 추천을
              <br />
              한 번에 이어서 볼 수 있습니다
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
              로그인하면 찜한 프로그램을 저장하고, 내 정보에 맞는 추천과 관련도까지 함께 확인할 수 있습니다.
              이후에는 활동 정리와 문서 준비 기능까지 이어서 사용할 수 있습니다.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                ["찜", "관심 있는 프로그램을 저장하고 다시 모아보기"],
                ["추천", "내 정보 기준 맞춤 프로그램과 관련도 확인"],
                ["문서 준비", "활동 정리와 자기소개서 준비 기능까지 확장"],
              ].map(([title, description]) => (
                <div key={title} className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-950">{title}</div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-slate-950">Google로 시작하기</h2>
              <p className="mt-2 text-sm text-slate-500">
                로그인하면 찜한 프로그램 저장, 맞춤 추천 확인, 문서 준비 기능을 바로 사용할 수 있습니다.
              </p>
            </div>

            {errorMessage ? (
              <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {errorMessage}
              </div>
            ) : null}

            <a
              href={googleLoginHref}
              className="mt-8 flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-300 px-4 py-3.5 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google로 계속하기
            </a>

            <p className="mt-4 text-center text-xs leading-5 text-slate-500">
              로그인 없이도 탐색과 비교는 가능하고, 로그인하면 찜, 추천, 문서 준비 기능이 함께 열립니다.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
