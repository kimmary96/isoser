import Link from "next/link";

import { getGoogleAuthHref, resolveInternalPath } from "@/lib/routes";

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

function GoogleMark() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
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
  );
}

const LOGIN_POINTS = ["찜한 프로그램", "맞춤 추천", "이력서·자기소개서"] as const;

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = await searchParams;
  const safeNext = resolveInternalPath(takeFirst(resolvedSearchParams.redirectedFrom));
  const errorMessage = getLoginErrorMessage(takeFirst(resolvedSearchParams.error));

  const googleLoginHref = getGoogleAuthHref(safeNext);

  return (
    <main className="min-h-[100svh] bg-[linear-gradient(135deg,#dbeafe_0%,#e0f2fe_48%,#f8fbff_100%)] px-5 py-8 text-slate-950 sm:px-8">
      <div className="mx-auto flex min-h-[calc(100svh-4.5rem)] max-w-7xl items-center justify-center">
        <section className="w-full max-w-6xl overflow-hidden rounded-[36px] border border-white/70 bg-white/75 shadow-[0_40px_100px_rgba(15,23,42,0.12)] backdrop-blur-xl">
          <div className="grid md:min-h-[min(720px,calc(100svh-4.5rem))] md:grid-cols-[0.95fr_1.05fr]">
            <div className="flex min-h-[520px] flex-col justify-between bg-[linear-gradient(135deg,#bae6fd_0%,#dbeafe_48%,#ffffff_100%)] px-8 py-10 sm:px-12 md:min-h-0 md:py-12">
              <div>
                <Link href="/landing-c" className="text-3xl font-extrabold text-[#0a1325]">
                  이소서<span className="text-blue-600">!</span>
                </Link>

                <div className="mt-24 max-w-lg sm:mt-28 md:mt-32">
                  <p className="text-sm font-semibold uppercase text-blue-700">One Line Login</p>
                  <h1 className="mt-6 text-4xl font-extrabold leading-tight text-[#0a1325] sm:text-5xl">
                    프로그램 찾고,
                    <br />
                    지원 준비까지 이어서.
                  </h1>
                  <p className="mt-5 max-w-sm text-[15px] leading-7 text-slate-600 sm:text-base">
                    로그인하면 찜한 프로그램과 맞춤 추천, 이력서·자기소개서 준비가 같은 흐름에서 이어집니다.
                  </p>
                </div>
              </div>

              <div className="mt-12 flex flex-wrap gap-2.5">
                {LOGIN_POINTS.map((point) => (
                  <span
                    key={point}
                    className="rounded-full border border-white/80 bg-white/80 px-4 py-2 text-sm font-medium text-slate-600 shadow-sm"
                  >
                    {point}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-center bg-[linear-gradient(180deg,rgba(255,255,255,0.55)_0%,rgba(255,255,255,0.95)_100%)] px-6 py-10 sm:px-8">
              <div className="w-full max-w-[420px] rounded-[30px] border border-white/80 bg-white/95 p-7 shadow-[0_28px_70px_rgba(15,23,42,0.12)] sm:p-9">
                <p className="text-xs font-semibold uppercase text-blue-700">Login</p>
                <h2 className="mt-3 text-4xl font-extrabold text-[#101828] sm:text-[40px]">계속하기</h2>
                <p className="mt-3 text-sm leading-7 text-slate-500 sm:text-[15px]">
                  프로그램을 저장하고, 맞춤 추천을 확인하고,
                  <br />
                  이력서·자기소개서 준비까지 바로 이어갑니다.
                </p>

                {errorMessage ? (
                  <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {errorMessage}
                  </div>
                ) : null}

                <div className={errorMessage ? "mt-5" : "mt-8"}>
                  <a
                    href={googleLoginHref}
                    className="flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-base font-semibold text-slate-900 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    <GoogleMark />
                    <span>Google로 로그인</span>
                  </a>
                </div>

                <a
                  href={googleLoginHref}
                  className="mt-4 flex min-h-14 w-full items-center justify-center rounded-2xl bg-[#1d4ed8] px-5 py-4 text-base font-semibold text-white transition hover:bg-[#1e40af] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  가입하고 프로그램 추천 받기
                </a>

                <p className="mt-6 text-center text-xs leading-6 text-slate-400">
                  로그인 없이도 프로그램 탐색과 비교는 가능하고, 로그인하면 저장과 추천, 서류 준비 기능이 함께 열립니다.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
