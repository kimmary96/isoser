"use client";

import Link from "next/link";

import {
  featureCards,
  interestOptions,
  landingStats,
  modeOptions,
  situationOptions,
  urgencyChips,
  type ProgramPreview,
  type QuizAnswers,
} from "./_content";

type QuizSectionProps = {
  answers: QuizAnswers;
  step: 1 | 2 | 3;
  progressLabel: string;
  progressWidth: string;
  canGoNext: boolean;
  canShowStep3: boolean;
  canShowResult: boolean;
  onStepChange: (step: 1 | 2 | 3) => void;
  onShowResult: () => void;
  onSelectSituation: (label: string) => void;
  onSelectMode: (label: string) => void;
  onSelectInterest: (label: string) => void;
  onDirectInterestFocus: () => void;
  onDirectInterestChange: (value: string) => void;
};

export function LandingBQuizSection({
  answers,
  step,
  progressLabel,
  progressWidth,
  canGoNext,
  canShowStep3,
  canShowResult,
  onStepChange,
  onShowResult,
  onSelectSituation,
  onSelectMode,
  onSelectInterest,
  onDirectInterestFocus,
  onDirectInterestChange,
}: QuizSectionProps) {
  return (
    <section className="landing-hero relative overflow-hidden border-b border-[var(--border)] bg-white px-6 pb-16 pt-20 sm:px-10 lg:min-h-screen lg:px-12 lg:pb-20">
      <div className="landing-blob landing-blob-primary" />
      <div className="landing-blob landing-blob-secondary" />
      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center gap-8 lg:justify-center">
        <div className="max-w-2xl text-center">
          <div className="fade-up inline-flex items-center gap-2 rounded-full border border-[rgba(37,99,235,0.2)] bg-[var(--blue-bg)] px-3 py-1.5 text-xs font-bold text-[var(--blue)]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--blue)]" />
            847개 프로그램 · 매일 업데이트
          </div>
          <h1 className="fade-up delay-1 mt-5 text-4xl font-extrabold leading-tight tracking-[-0.04em] text-[var(--ink)] sm:text-5xl">
            <span className="mb-2 block text-3xl font-bold text-[var(--sub)] sm:text-4xl">흩어진 국비 지원 정보,</span>
            내 상황에 맞는 것만 <span className="text-[var(--blue)]">골라드립니다</span>
          </h1>
          <p className="fade-up delay-2 mt-5 text-sm leading-7 text-[var(--sub)] sm:text-base">
            고용24, HRD넷, K-디지털, 서울시 일자리까지 한곳에 모았습니다.
            <br />
            3가지 조건만 알려주시면 <strong className="text-[var(--ink)]">마감 임박순으로 정렬해드립니다</strong>
          </p>
          <div className="fade-up delay-3 mt-7 grid overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] sm:grid-cols-3">
            {landingStats.map((stat, index) => (
              <div
                key={stat.label}
                className={`px-4 py-4 text-center ${index < 2 ? "border-b border-[var(--border)] sm:border-b-0 sm:border-r" : ""}`}
              >
                <div className="text-lg font-extrabold text-[var(--ink)]">{stat.value}</div>
                <div className="mt-1 text-[11px] text-[var(--muted)]">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="fade-up delay-2 w-full max-w-2xl rounded-[20px] border border-[var(--border)] bg-white p-6 shadow-[0_8px_32px_rgba(0,0,0,0.08)] sm:p-7">
          <div className="mb-5">
            <div className="mb-2 flex items-center justify-between text-[11px] font-bold">
              <span className="text-[var(--muted)]">
                <span className="text-[var(--blue)]">{step}</span> / 3가지 조건
              </span>
              <span className="text-[var(--muted)]">{progressLabel}</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-[var(--border)]">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,var(--blue),var(--sky))] transition-all duration-300"
                style={{ width: progressWidth }}
              />
            </div>
          </div>

          {step === 1 ? (
            <div>
              <h2 className="text-base font-bold text-[var(--ink)]">지금 상황이 어떠세요?</h2>
              <p className="mb-4 mt-1 text-[11px] text-[var(--muted)]">
                가장 가까운 것을 선택하세요. 이 정보로 마감·지역·지원율을 필터링합니다.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {situationOptions.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => onSelectSituation(option.label)}
                    className={`rounded-xl border px-4 py-4 text-center transition ${
                      answers.situation === option.label
                        ? "border-[var(--blue)] bg-[var(--blue-bg)] shadow-[0_0_0_3px_rgba(37,99,235,0.08)]"
                        : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--blue)] hover:bg-[var(--blue-bg)]"
                    }`}
                  >
                    <div className="text-xl">{option.icon}</div>
                    <div className="mt-1 text-sm font-bold text-[var(--ink)]">{option.label}</div>
                    <div className="mt-1 text-[11px] text-[var(--muted)]">{option.subtitle}</div>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => onStepChange(2)}
                disabled={!canGoNext}
                className={`mt-4 w-full rounded-xl px-4 py-3 text-sm font-bold text-white transition ${
                  canGoNext
                    ? "bg-[var(--blue)] hover:bg-[var(--blue-lo)] hover:shadow-[0_4px_14px_rgba(37,99,235,0.3)]"
                    : "cursor-not-allowed bg-[var(--blue)] opacity-30"
                }`}
              >
                다음 →
              </button>
            </div>
          ) : null}

          {step === 2 ? (
            <div>
              <h2 className="text-base font-bold text-[var(--ink)]">선호하는 수업 방식은?</h2>
              <p className="mb-4 mt-1 text-[11px] text-[var(--muted)]">온라인·오프라인 여부로 지역과 기관을 좁혀드립니다.</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {modeOptions.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => onSelectMode(option.label)}
                    className={`rounded-xl border px-4 py-4 text-center transition ${
                      answers.mode === option.label
                        ? "border-[var(--blue)] bg-[var(--blue-bg)] shadow-[0_0_0_3px_rgba(37,99,235,0.08)]"
                        : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--blue)] hover:bg-[var(--blue-bg)]"
                    }`}
                  >
                    <div className="text-xl">{option.icon}</div>
                    <div className="mt-1 text-sm font-bold text-[var(--ink)]">{option.label}</div>
                    <div className="mt-1 text-[11px] text-[var(--muted)]">{option.subtitle}</div>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => onStepChange(3)}
                disabled={!canShowStep3}
                className={`mt-4 w-full rounded-xl px-4 py-3 text-sm font-bold text-white transition ${
                  canShowStep3
                    ? "bg-[var(--blue)] hover:bg-[var(--blue-lo)] hover:shadow-[0_4px_14px_rgba(37,99,235,0.3)]"
                    : "cursor-not-allowed bg-[var(--blue)] opacity-30"
                }`}
              >
                다음 →
              </button>
            </div>
          ) : null}

          {step === 3 ? (
            <div>
              <h2 className="text-base font-bold text-[var(--ink)]">관심 분야가 어디인가요?</h2>
              <p className="mb-4 mt-1 text-[11px] text-[var(--muted)]">카테고리별 과정을 필터링합니다. 없는 분야는 직접 입력하세요.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {interestOptions.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => onSelectInterest(option.label)}
                    className={`rounded-xl border px-4 py-4 text-center transition ${
                      answers.interest === option.label
                        ? "border-[var(--blue)] bg-[var(--blue-bg)] shadow-[0_0_0_3px_rgba(37,99,235,0.08)]"
                        : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--blue)] hover:bg-[var(--blue-bg)]"
                    }`}
                  >
                    <div className="text-xl">{option.icon}</div>
                    <div className="mt-1 text-sm font-bold text-[var(--ink)]">{option.label}</div>
                    <div className="mt-1 text-[11px] text-[var(--muted)]">{option.subtitle}</div>
                  </button>
                ))}
                <label
                  className={`flex items-center gap-3 rounded-xl border px-4 py-4 transition sm:col-span-2 ${
                    answers.directInterest.trim() ? "border-[var(--blue)] bg-[var(--blue-bg)]" : "border-[var(--border)] bg-[var(--surface)]"
                  }`}
                >
                  <span className="text-base">✏️</span>
                  <input
                    value={answers.directInterest}
                    onFocus={onDirectInterestFocus}
                    onChange={(event) => onDirectInterestChange(event.target.value)}
                    placeholder="원하는 분야 직접 입력 (예: 회계, 물류, 의료)"
                    className="w-full border-none bg-transparent text-sm font-semibold text-[var(--ink)] outline-none placeholder:font-normal placeholder:text-[var(--muted)]"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={onShowResult}
                disabled={!canShowResult}
                className={`mt-4 w-full rounded-xl px-4 py-3 text-sm font-bold text-white transition ${
                  canShowResult
                    ? "bg-[var(--blue)] hover:bg-[var(--blue-lo)] hover:shadow-[0_4px_14px_rgba(37,99,235,0.3)]"
                    : "cursor-not-allowed bg-[var(--blue)] opacity-30"
                }`}
              >
                내 맞춤 프로그램 찾기 →
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

type ResultSectionProps = {
  programs: ProgramPreview[];
  resultTag: string;
  totalCount: number;
};

export function LandingBResultSection({ programs, resultTag, totalCount }: ResultSectionProps) {
  return (
    <section className="landing-hero relative overflow-hidden border-b border-[var(--border)] bg-white px-6 pb-16 pt-24 sm:px-10 lg:px-12">
      <div className="relative z-10 mx-auto max-w-2xl">
        <div className="text-center">
          <div className="text-[72px] font-extrabold leading-none tracking-[-0.06em] text-[var(--blue)]">
            {totalCount}
            <span className="ml-1 text-4xl text-[var(--ink)]">개</span>
          </div>
          <p className="mt-3 text-sm text-[var(--sub)]">847개 중 선택하신 조건으로 필터링한 결과입니다.</p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[rgba(249,115,22,0.25)] bg-[var(--fire-bg)] px-4 py-1.5 text-xs font-bold text-[var(--fire)]">
            <span>⚡</span>
            <span>{resultTag}</span>
          </div>
        </div>

        <div className="mt-8 overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-[0_4px_20px_rgba(0,0,0,0.07)]">
          <div className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[11px] font-bold text-[var(--sub)]">
            미리보기 · 전체 결과는 가입 후 확인 가능합니다
          </div>
          <div className="relative">
            {programs.map((program, index) => (
              <div
                key={program.title}
                className={`flex items-center justify-between gap-4 border-b border-[var(--border)] px-4 py-4 last:border-b-0 ${
                  index >= 2 ? "blur-[5px]" : ""
                }`}
              >
                <div>
                  <div className="text-sm font-bold text-[var(--ink)]">{program.title}</div>
                  <div className="mt-1 text-[11px] text-[var(--muted)]">{program.meta}</div>
                </div>
                <div
                  className={`shrink-0 text-sm font-extrabold ${
                    program.tone === "red"
                      ? "text-[var(--red)]"
                      : program.tone === "orange"
                        ? "text-[var(--fire)]"
                        : "text-[var(--amber)]"
                  }`}
                >
                  {program.deadline}
                </div>
              </div>
            ))}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-28 items-end justify-center bg-[linear-gradient(to_bottom,transparent,rgba(255,255,255,0.97))] pb-4 text-center text-xs text-[var(--sub)]">
              + {Math.max(totalCount - 4, 1)}개 더 있습니다 · 가입하면 전체 확인 가능
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-[var(--border)] bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.07)]">
          <Link
            href="/login"
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-[var(--fire)] px-4 py-4 text-sm font-extrabold text-white shadow-[0_4px_14px_rgba(249,115,22,0.3)] transition hover:-translate-y-0.5 hover:bg-[var(--fire-lo)] hover:shadow-[0_6px_20px_rgba(249,115,22,0.4)]"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-black text-[var(--fire)]">
              G
            </span>
            내 맞춤 프로그램 전체 보기 · 무료 가입
          </Link>
          <p className="mt-3 text-center text-[11px] text-[var(--muted)]">가입 후 즉시 확인 · 신용카드 불필요 · 언제든 탈퇴 가능</p>
        </div>
      </div>
    </section>
  );
}

type SupportSectionProps = {
  onReset: () => void;
};

export function LandingBSupportSection({ onReset }: SupportSectionProps) {
  return (
    <section className="border-t border-[var(--border)] bg-[var(--surface)] px-6 py-14 sm:px-10 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-11 flex flex-col gap-4 rounded-2xl border border-[#FECACA] bg-white px-5 py-4 sm:flex-row sm:items-center">
          <div className="shrink-0 text-[11px] font-extrabold text-[var(--red)]">D-7 이내 마감</div>
          <div className="flex flex-1 flex-wrap gap-2">
            {urgencyChips.map((chip) => (
              <span key={chip} className="rounded-full border border-[#FECACA] bg-[#FEF2F2] px-3 py-1 text-[11px] font-semibold text-[var(--red)]">
                {chip}
              </span>
            ))}
          </div>
          <div className="text-xs text-[var(--muted)]">+19개 →</div>
        </div>

        <div className="mb-11 text-center text-[11px] font-bold tracking-[0.04em] text-[var(--muted)]">이소서에서 할 수 있는 것</div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {featureCards.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-[var(--border)] bg-white px-5 py-6 transition hover:-translate-y-0.5 hover:border-[var(--blue)] hover:shadow-[0_4px_14px_rgba(37,99,235,0.08)]"
            >
              <div className="text-2xl">{feature.icon}</div>
              <div className="mt-3 text-sm font-bold text-[var(--ink)]">{feature.title}</div>
              <p className="mt-2 text-[11px] leading-6 text-[var(--sub)]">{feature.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <h2 className="text-2xl font-extrabold tracking-[-0.03em] text-[var(--ink)]">다시 찾아볼까요?</h2>
          <p className="mt-2 text-sm text-[var(--sub)]">조건을 바꿔서 다른 프로그램을 탐색해보세요.</p>
          <button
            type="button"
            onClick={onReset}
            className="mt-5 rounded-xl border border-[var(--border)] bg-white px-6 py-3 text-sm font-bold text-[var(--sub)] transition hover:border-[var(--blue)] hover:text-[var(--blue)]"
          >
            처음부터 다시 하기
          </button>
        </div>
      </div>
    </section>
  );
}
