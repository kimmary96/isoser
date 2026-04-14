"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";

type QuizAnswers = {
  situation: string;
  mode: string;
  interest: string;
  directInterest: string;
};

type Option = {
  label: string;
  subtitle: string;
  icon: string;
};

type ProgramPreview = {
  title: string;
  meta: string;
  deadline: string;
  tone: "red" | "orange" | "amber";
};

const situationOptions: Option[] = [
  { label: "취업 준비", subtitle: "처음 취업 도전", icon: "📋" },
  { label: "이직", subtitle: "현재 재직 중", icon: "🔄" },
  { label: "재취업", subtitle: "경력 공백 있음", icon: "🌱" },
  { label: "창업", subtitle: "내 사업 시작", icon: "🚀" },
];

const modeOptions: Option[] = [
  { label: "온라인", subtitle: "장소 자유", icon: "💻" },
  { label: "오프라인", subtitle: "집중 환경", icon: "🏫" },
  { label: "상관없음", subtitle: "좋은 거면 OK", icon: "🔀" },
];

const interestOptions: Option[] = [
  { label: "AI·데이터", subtitle: "분석, 개발, ML", icon: "🤖" },
  { label: "IT·개발", subtitle: "웹, 앱, 백엔드", icon: "💻" },
  { label: "디자인", subtitle: "UX/UI, 그래픽", icon: "🎨" },
  { label: "경영·마케팅", subtitle: "기획, 마케팅", icon: "📈" },
];

const resultCounts: Record<string, number> = {
  "AI·데이터": 23,
  "IT·개발": 31,
  디자인: 18,
  "경영·마케팅": 27,
};

const previewPrograms: Record<string, ProgramPreview[]> = {
  "AI·데이터": [
    {
      title: "청년 AI 데이터 분석 인턴십 2기",
      meta: "고용24 · 온라인 · 월 200만원 · 3개월",
      deadline: "D-3",
      tone: "orange",
    },
    {
      title: "K-디지털 AI 엔지니어 부트캠프",
      meta: "HRD넷 · 강남구 · 국비 100% · 6개월",
      deadline: "D-1",
      tone: "red",
    },
    {
      title: "내일배움카드 AI 자동화 실무 과정",
      meta: "서울시 · 온라인 · 국비 80% · 2개월",
      deadline: "D-7",
      tone: "amber",
    },
    {
      title: "기업연계 데이터 시각화 프로젝트랩",
      meta: "K-디지털 · 하이브리드 · 4개월",
      deadline: "D-12",
      tone: "amber",
    },
  ],
  "IT·개발": [
    {
      title: "K-디지털 풀스택 개발자 과정 6기",
      meta: "HRD넷 · 강남구 · 국비 100% · 6개월",
      deadline: "D-1",
      tone: "red",
    },
    {
      title: "프론트엔드 실무 집중 부트캠프",
      meta: "고용24 · 온라인 · 포트폴리오 코칭 포함",
      deadline: "D-4",
      tone: "orange",
    },
    {
      title: "백엔드 취업 연계 프로젝트 트랙",
      meta: "서울시 · 오프라인 · 5개월",
      deadline: "D-8",
      tone: "amber",
    },
    {
      title: "앱 서비스 개발 취업캠프",
      meta: "K-디지털 · 하이브리드 · 4개월",
      deadline: "D-11",
      tone: "amber",
    },
  ],
  디자인: [
    {
      title: "UX/UI 실무 포트폴리오 부트캠프",
      meta: "서울시 · 성수 · 국비 100% · 4개월",
      deadline: "D-2",
      tone: "red",
    },
    {
      title: "브랜드 디자이너 취업 연계 트랙",
      meta: "고용24 · 온라인 · 3개월",
      deadline: "D-5",
      tone: "orange",
    },
    {
      title: "프로덕트 디자이너 양성과정",
      meta: "HRD넷 · 오프라인 · 5개월",
      deadline: "D-9",
      tone: "amber",
    },
    {
      title: "디자인 시스템 구축 워크숍",
      meta: "민간위탁 · 하이브리드 · 6주",
      deadline: "D-13",
      tone: "amber",
    },
  ],
  "경영·마케팅": [
    {
      title: "퍼포먼스 마케팅 취업 캠프",
      meta: "고용24 · 온라인 · 3개월",
      deadline: "D-2",
      tone: "red",
    },
    {
      title: "브랜드 전략 실무 트랙",
      meta: "서울시 · 오프라인 · 4개월",
      deadline: "D-6",
      tone: "orange",
    },
    {
      title: "CRM·그로스 마케팅 집중과정",
      meta: "K-디지털 · 하이브리드 · 10주",
      deadline: "D-10",
      tone: "amber",
    },
    {
      title: "콘텐츠 마케터 포트폴리오 랩",
      meta: "민간위탁 · 온라인 · 8주",
      deadline: "D-14",
      tone: "amber",
    },
  ],
};

const urgencyChips = [
  "D-1 · K-디지털 풀스택",
  "D-3 · 청년 AI 인턴십",
  "D-5 · 내일배움카드 AI",
  "D-7 · UX/UI 양성과정",
];

const featureCards = [
  {
    icon: "🔍",
    title: "프로그램 탐색",
    description: "847개 국가 지원 프로그램을 마감·지역·대상 조건으로 빠르게 추립니다.",
  },
  {
    icon: "⚖️",
    title: "부트캠프 비교",
    description: "최대 3개 과정을 나란히 두고 커리큘럼과 지원 조건을 확인합니다.",
  },
  {
    icon: "📄",
    title: "이력서 즉시 생성",
    description: "관심 프로그램에 맞춰 AI가 지원용 이력서 초안을 바로 정리합니다.",
  },
  {
    icon: "📅",
    title: "AI 취업 캘린더",
    description: "마감일과 준비 일정을 자동으로 정리해 놓치지 않게 돕습니다.",
  },
];

const initialAnswers: QuizAnswers = {
  situation: "",
  mode: "",
  interest: "",
  directInterest: "",
};

export default function LandingBPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [showResult, setShowResult] = useState(false);
  const [answers, setAnswers] = useState<QuizAnswers>(initialAnswers);

  const effectiveInterest = answers.directInterest.trim() || answers.interest;
  const canGoNext = Boolean(answers.situation);
  const canShowStep3 = Boolean(answers.mode);
  const canShowResult = Boolean(effectiveInterest.trim());

  const totalCount = resultCounts[effectiveInterest] ?? 14;
  const programs = previewPrograms[effectiveInterest] ?? [
    {
      title: `${effectiveInterest} 맞춤 탐색 과정 A`,
      meta: "고용24 · 온라인 · 정적 미리보기 데이터",
      deadline: "D-4",
      tone: "orange" as const,
    },
    {
      title: `${effectiveInterest} 맞춤 탐색 과정 B`,
      meta: "HRD넷 · 오프라인 · 정적 미리보기 데이터",
      deadline: "D-6",
      tone: "orange" as const,
    },
    {
      title: `${effectiveInterest} 맞춤 탐색 과정 C`,
      meta: "서울시 · 하이브리드 · 정적 미리보기 데이터",
      deadline: "D-10",
      tone: "amber" as const,
    },
    {
      title: `${effectiveInterest} 맞춤 탐색 과정 D`,
      meta: "민간위탁 · 온라인 · 정적 미리보기 데이터",
      deadline: "D-13",
      tone: "amber" as const,
    },
  ];

  const resultTag = useMemo(() => {
    const tags = [
      answers.situation,
      effectiveInterest,
      answers.mode === "상관없음" ? "" : answers.mode,
      "마감 임박순",
    ].filter(Boolean);

    return tags.join(" · ");
  }, [answers.mode, answers.situation, effectiveInterest]);

  useEffect(() => {
    if (showResult) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [showResult]);

  const progressWidth = step === 1 ? "33%" : step === 2 ? "66%" : "100%";
  const progressLabel = step === 1 ? "상황 확인" : step === 2 ? "방식 확인" : "분야 확인";

  const selectSituation = (label: string) => {
    setAnswers((current) => ({ ...current, situation: label }));
  };

  const selectMode = (label: string) => {
    setAnswers((current) => ({ ...current, mode: label }));
  };

  const selectInterest = (label: string) => {
    setAnswers((current) => ({
      ...current,
      interest: label,
      directInterest: "",
    }));
  };

  const handleDirectInterestFocus = () => {
    setAnswers((current) => ({ ...current, interest: "" }));
  };

  const handleDirectInterestChange = (value: string) => {
    setAnswers((current) => ({
      ...current,
      interest: "",
      directInterest: value,
    }));
  };

  const resetQuiz = () => {
    setAnswers(initialAnswers);
    setStep(1);
    setShowResult(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main
      className="min-h-screen bg-[var(--surface)] text-[var(--ink)]"
      style={
        {
          "--ink": "#0F172A",
          "--blue": "#2563EB",
          "--blue-lo": "#1D4ED8",
          "--blue-bg": "#EFF6FF",
          "--sky": "#60A5FA",
          "--fire": "#F97316",
          "--fire-lo": "#EA580C",
          "--fire-bg": "#FFF7ED",
          "--green": "#16A34A",
          "--red": "#DC2626",
          "--amber": "#D97706",
          "--surface": "#F8FAFC",
          "--border": "#E2E8F0",
          "--muted": "#94A3B8",
          "--sub": "#64748B",
        } as CSSProperties
      }
    >
      {!showResult ? (
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
                <span className="mb-2 block text-3xl font-bold text-[var(--sub)] sm:text-4xl">
                  흩어진 국비 지원 정보,
                </span>
                내 상황에 맞는 것만 <span className="text-[var(--blue)]">골라드립니다</span>
              </h1>
              <p className="fade-up delay-2 mt-5 text-sm leading-7 text-[var(--sub)] sm:text-base">
                고용24, HRD넷, K-디지털, 서울시 일자리까지 한곳에 모았습니다.
                <br />
                3가지 조건만 알려주시면 <strong className="text-[var(--ink)]">마감 임박순으로 정렬해드립니다</strong>
              </p>
              <div className="fade-up delay-3 mt-7 grid overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] sm:grid-cols-3">
                {[
                  { value: "847개", label: "수집된 프로그램" },
                  { value: "134곳", label: "우수훈련기관" },
                  { value: "매일", label: "실시간 업데이트" },
                ].map((stat, index) => (
                  <div
                    key={stat.label}
                    className={`px-4 py-4 text-center ${
                      index < 2 ? "border-b border-[var(--border)] sm:border-b-0 sm:border-r" : ""
                    }`}
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
                        onClick={() => selectSituation(option.label)}
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
                    onClick={() => setStep(2)}
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
                  <p className="mb-4 mt-1 text-[11px] text-[var(--muted)]">
                    온라인·오프라인 여부로 지역과 기관을 좁혀드립니다.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {modeOptions.map((option) => (
                      <button
                        key={option.label}
                        type="button"
                        onClick={() => selectMode(option.label)}
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
                    onClick={() => setStep(3)}
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
                  <p className="mb-4 mt-1 text-[11px] text-[var(--muted)]">
                    카테고리별 과정을 필터링합니다. 없는 분야는 직접 입력하세요.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {interestOptions.map((option) => (
                      <button
                        key={option.label}
                        type="button"
                        onClick={() => selectInterest(option.label)}
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
                        answers.directInterest.trim()
                          ? "border-[var(--blue)] bg-[var(--blue-bg)]"
                          : "border-[var(--border)] bg-[var(--surface)]"
                      }`}
                    >
                      <span className="text-base">✏️</span>
                      <input
                        value={answers.directInterest}
                        onFocus={handleDirectInterestFocus}
                        onChange={(event) => handleDirectInterestChange(event.target.value)}
                        placeholder="원하는 분야 직접 입력 (예: 회계, 물류, 의료)"
                        className="w-full border-none bg-transparent text-sm font-semibold text-[var(--ink)] outline-none placeholder:font-normal placeholder:text-[var(--muted)]"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowResult(true)}
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
      ) : (
        <section className="landing-hero relative overflow-hidden border-b border-[var(--border)] bg-white px-6 pb-16 pt-24 sm:px-10 lg:px-12">
          <div className="relative z-10 mx-auto max-w-2xl">
            <div className="text-center">
              <div className="text-[72px] font-extrabold leading-none tracking-[-0.06em] text-[var(--blue)]">
                {totalCount}
                <span className="ml-1 text-4xl text-[var(--ink)]">개</span>
              </div>
              <p className="mt-3 text-sm text-[var(--sub)]">
                847개 중 선택하신 조건으로 필터링한 결과입니다.
              </p>
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
              <p className="mt-3 text-center text-[11px] text-[var(--muted)]">
                가입 후 즉시 확인 · 신용카드 불필요 · 언제든 탈퇴 가능
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="border-t border-[var(--border)] bg-[var(--surface)] px-6 py-14 sm:px-10 lg:px-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-11 flex flex-col gap-4 rounded-2xl border border-[#FECACA] bg-white px-5 py-4 sm:flex-row sm:items-center">
            <div className="shrink-0 text-[11px] font-extrabold text-[var(--red)]">D-7 이내 마감</div>
            <div className="flex flex-1 flex-wrap gap-2">
              {urgencyChips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-[#FECACA] bg-[#FEF2F2] px-3 py-1 text-[11px] font-semibold text-[var(--red)]"
                >
                  {chip}
                </span>
              ))}
            </div>
            <div className="text-xs text-[var(--muted)]">+19개 →</div>
          </div>

          <div className="mb-11 text-center text-[11px] font-bold tracking-[0.04em] text-[var(--muted)]">
            이소서에서 할 수 있는 것
          </div>
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
            <h2 className="text-2xl font-extrabold tracking-[-0.03em] text-[var(--ink)]">
              다시 찾아볼까요?
            </h2>
            <p className="mt-2 text-sm text-[var(--sub)]">
              조건을 바꿔서 다른 프로그램을 탐색해보세요.
            </p>
            <button
              type="button"
              onClick={resetQuiz}
              className="mt-5 rounded-xl border border-[var(--border)] bg-white px-6 py-3 text-sm font-bold text-[var(--sub)] transition hover:border-[var(--blue)] hover:text-[var(--blue)]"
            >
              처음부터 다시 하기
            </button>
          </div>
        </div>
      </section>

      <style jsx>{`
        .landing-hero::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image: radial-gradient(circle, #cbd5e1 1px, transparent 1px);
          background-size: 28px 28px;
          opacity: 0.5;
          mask-image: radial-gradient(ellipse 90% 90% at 50% 50%, black 30%, transparent 80%);
        }

        .landing-blob {
          position: absolute;
          pointer-events: none;
          border-radius: 9999px;
          filter: blur(80px);
          opacity: 0.12;
        }

        .landing-blob-primary {
          width: 500px;
          height: 400px;
          background: var(--blue);
          top: -100px;
          left: 50%;
          transform: translateX(-50%);
        }

        .landing-blob-secondary {
          width: 300px;
          height: 300px;
          background: var(--fire);
          bottom: -60px;
          right: 5%;
        }

        .fade-up {
          animation: fadeUp 0.5s ease both;
        }

        .delay-1 {
          animation-delay: 0.08s;
        }

        .delay-2 {
          animation-delay: 0.14s;
        }

        .delay-3 {
          animation-delay: 0.2s;
        }

        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </main>
  );
}
