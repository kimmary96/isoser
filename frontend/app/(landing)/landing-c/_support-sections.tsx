import Link from "next/link";

import { DASHBOARD_RECOMMEND_CALENDAR, getLoginHref } from "@/lib/routes";

import { circularFlowSteps, workflowCards } from "./_content";

function FeaturePreview({ type }: { type: (typeof workflowCards)[number]["preview"] }) {
  if (type === "pdf") {
    return (
      <div className="rounded-[22px] bg-[var(--surface)] p-4">
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white p-5 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-strong)] text-xl font-black text-[var(--indigo)]">
            PDF
          </div>
          <div className="mt-4 text-sm font-black text-[var(--ink)]">김이소_이력서.pdf</div>
          <div className="mt-2 text-xs font-bold text-[var(--muted)]">프로필 · 경력 · 프로젝트 추출</div>
          <div className="mt-5 space-y-2">
            {[88, 74, 92].map((width) => (
              <div key={width} className="mx-auto h-2 rounded bg-[var(--surface-strong)]" style={{ width: `${width}%` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (type === "match") {
    return (
      <div className="rounded-2xl bg-[var(--surface)] p-5">
        <div className="flex items-end justify-between">
          <div className="text-sm font-extrabold text-[var(--ink)]">매칭 점수 상세</div>
          <div className="text-4xl font-black text-[var(--indigo)]">74<span className="text-sm">점</span></div>
        </div>
        <div className="mt-5 space-y-3">
          {["직무 일치도", "경력 연관성", "학력/자격", "프로젝트"].map((label, index) => (
            <div key={label} className="grid grid-cols-[82px_1fr_34px] items-center gap-2 text-[11px] font-bold text-[var(--sub)]">
              <span>{label}</span>
              <span className="h-2 overflow-hidden rounded-full bg-white">
                <span className="block h-full rounded-full bg-[var(--indigo)]" style={{ width: `${[90, 60, 75, 80][index]}%` }} />
              </span>
              <span>{[20, 8, 1, 8][index]}점</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "resume") {
    return (
      <div className="grid gap-3 rounded-2xl bg-[var(--surface)] p-4 sm:grid-cols-[0.9fr_1.2fr]">
        <div className="space-y-2 text-[11px] font-bold">
          {["기본형", "Modern", "Minimal"].map((item, index) => (
            <div key={item} className={`rounded-lg border px-3 py-2 ${index === 0 ? "border-[var(--indigo)] text-[var(--indigo)]" : "border-[var(--border)] text-[var(--sub)]"}`}>
              {item}
            </div>
          ))}
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="mb-4 h-3 w-28 rounded bg-[var(--ink)]" />
          <div className="space-y-2">
            {[80, 56, 92, 48, 72].map((width) => (
              <div key={width} className="h-2 rounded bg-[var(--surface-strong)]" style={{ width: `${width}%` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-[var(--surface)] p-4">
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-3 w-32 rounded bg-[var(--ink)]" />
            <div className="mt-2 h-2 w-24 rounded bg-[var(--surface-strong)]" />
          </div>
          <span className="rounded-full bg-[rgba(56,189,248,0.13)] px-3 py-1 text-[10px] font-black text-[var(--indigo)]">
            저장 완료
          </span>
        </div>
        <div className="mt-5 space-y-2">
          {[92, 74, 86, 64].map((width) => (
            <div key={width} className="h-2 rounded bg-[var(--surface-strong)]" style={{ width: `${width}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function LandingCBackupHeroSection() {
  const proofItems = [
    "활동 상세 AI 코치 피드백",
    "공고 매칭 분석 저장/조회",
    "문서 저장소와 PDF 내보내기",
    "게스트 모드와 직접 입력 시작",
  ];

  return (
    <section className="relative overflow-hidden bg-[#071a36] px-5 py-16 text-white sm:px-8 lg:px-12 lg:py-20">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(43,111,242,0.32),transparent_32%),linear-gradient(120deg,#071a36_0%,#0a2146_48%,#0f172a_100%)]" />
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[28%] bg-white/5 lg:block" />
      <div className="relative mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_460px] lg:items-center">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-sky-200/90">Career Asset Workspace</p>
          <h2 className="mt-5 text-4xl font-bold leading-[1.08] tracking-[-0.04em] sm:text-5xl">
            흩어진 경력을 한 번 정리하면,<br />공고마다 다시 꺼내 쓸 수 있습니다.
          </h2>
          <p className="mt-5 max-w-xl text-[15.5px] leading-8 text-slate-200/90">
            이소서는 AI가 대신 써주는 서비스가 아니라, 내 경험을 저장하고 다듬고 조합할 수 있게 만드는 이력서 작업 공간입니다.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/dashboard/profile" className="rounded-full bg-white px-6 py-3 text-sm font-bold text-[#0a1325] transition hover:opacity-90">
              PDF 업로드로 시작하기
            </Link>
            <Link href={DASHBOARD_RECOMMEND_CALENDAR} className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
              추천 캘린더 보기
            </Link>
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {proofItems.map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm text-slate-200/85">
                <span className="h-2 w-2 shrink-0 rounded-full bg-blue-300" />
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[32px] border border-white/10 bg-white/10 p-4 shadow-[0_32px_80px_rgba(0,0,0,0.35)] backdrop-blur">
          <div className="rounded-[24px] bg-[#f6f8fc] p-5 text-[#0a1325]">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <div className="text-[9.5px] font-bold uppercase tracking-[0.22em] text-slate-400">Resume Pipeline</div>
                <div className="mt-1 text-lg font-bold">업로드 후 바로 이어지는 흐름</div>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold text-emerald-800">Live</span>
            </div>
            <div className="mt-3 rounded-[18px] bg-white p-4">
              <div className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-slate-400">Step 1</div>
              <div className="mt-2 text-[15px] font-bold">PDF에서 프로필과 활동 추출</div>
              <p className="mt-1 text-sm leading-6 text-slate-500">이름, 연락처, 경력, 프로젝트를 자동 정리</p>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[18px] bg-[#0d4fd7] p-4 text-white">
                <div className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-sky-100/80">Step 2</div>
                <div className="mt-2 text-[15px] font-bold">성과 저장소</div>
                <p className="mt-1 text-sm leading-6 text-blue-100">회사경력과 프로젝트를 한 화면에서 관리</p>
              </div>
              <div className="rounded-[18px] bg-slate-900 p-4 text-white">
                <div className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-slate-500">Step 3</div>
                <div className="mt-2 text-[15px] font-bold">공고 매칭 분석</div>
                <p className="mt-1 text-sm leading-6 text-slate-300">강점과 부족 키워드를 바로 확인</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-[18px] border border-slate-200 bg-slate-50 p-4">
              <div>
                <div className="text-[9.5px] uppercase tracking-[0.18em] text-slate-400">Final</div>
                <div className="mt-1 text-sm font-bold">문서 저장소</div>
                <p className="mt-1 text-sm text-slate-500">생성한 이력서를 저장하고 PDF로 다시 출력</p>
              </div>
              <div className="text-base font-bold">Ready to send</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function LandingCWorkflowSection() {
  return (
    <section className="border-t border-[var(--border)] bg-white px-5 py-16 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.24em] text-[var(--teal)]">What Works Today</p>
        <h2 className="mt-3 max-w-2xl text-3xl font-black leading-tight tracking-[-0.04em]">
          이미 구현된 흐름을 첫 화면에서 바로 이해할 수 있어야 합니다.
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--sub)]">
          지금 제품의 설득 포인트는 미래 기능이 아니라, 이미 연결된 작업 흐름입니다.
        </p>

        <div className="mt-9 grid gap-5 lg:grid-cols-2">
          {workflowCards.map((card) => (
            <article key={card.title} className="rounded-[24px] border border-[var(--border)] bg-white p-6 shadow-[0_18px_46px_rgba(10,19,37,0.05)]">
              <div className="mb-5">
                <h3 className="text-xl font-black tracking-[-0.04em]">{card.title}</h3>
                <p className="mt-2 text-sm leading-7 text-[var(--sub)]">{card.body}</p>
              </div>
              <FeaturePreview type={card.preview} />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingCCircularFlowSection() {
  return (
    <section className="px-5 pb-14 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl rounded-[28px] border border-[var(--border)] bg-white px-6 py-8 shadow-[0_22px_64px_rgba(10,19,37,0.06)] sm:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--indigo)]">Circular flow</p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.05em] text-[var(--ink)]">
            탐색한 프로그램은 다음 지원 준비로 이어집니다
          </h2>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {circularFlowSteps.map((stage) => (
            <article
              key={stage.step}
              className="flex min-h-[188px] flex-col rounded-[20px] border border-[var(--border)] bg-[var(--surface)] px-4 py-5 transition hover:border-[var(--indigo)] hover:bg-white hover:shadow-[0_16px_38px_rgba(10,19,37,0.08)]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--ink)] text-xs font-black text-white">
                {stage.step}
              </span>
              <h3 className="mt-5 text-base font-black tracking-[-0.03em] text-[var(--ink)]">{stage.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[var(--sub)]">{stage.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingCFinalCtaSection() {
  return (
    <section className="px-5 pb-14 sm:px-8 lg:px-12">
      <div className="relative mx-auto flex max-w-6xl flex-col gap-8 overflow-hidden rounded-[28px] bg-[var(--indigo)] px-6 py-10 text-white sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-10">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10" />
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-white/60">Final CTA</p>
          <h2 className="mt-4 text-3xl font-black leading-tight tracking-[-0.05em] sm:text-4xl">
            준비가 되었다면
            <br />
            이력서를 준비해 보세요.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/72">
            흩어진 경력 한 번에 정리하고, 원하는 공고에 맞춰 작성해 보세요
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href={getLoginHref(DASHBOARD_RECOMMEND_CALENDAR)} className="rounded-full bg-white px-6 py-3 text-sm font-black text-[var(--indigo)]">무료로 시작하기</Link>
          <Link href={DASHBOARD_RECOMMEND_CALENDAR} className="rounded-full border border-white/30 px-6 py-3 text-sm font-black text-white">대시보드 미리 보기</Link>
        </div>
      </div>
    </section>
  );
}

export function LandingCFooter() {
  return (
    <footer className="border-t border-[var(--border)] bg-white px-5 py-10 text-[var(--ink)] sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-2xl font-black tracking-[-0.05em]">이소<span className="text-[var(--teal)]">서</span></div>
          <p className="mt-3 max-w-xl text-sm leading-7 text-[var(--sub)]">
            공공 취업 지원 탐색을 시작점으로, 개인화 추천과 문서 워크플로우까지 연결하는 커리어 SaaS.
          </p>
        </div>
        <div className="text-xs font-bold text-[var(--muted)]">© 2026 Isoser. Career support workspace.</div>
      </div>
    </footer>
  );
}
