import Link from "next/link";

const featureItems = [
  {
    title: "PDF에서 바로 시작",
    body: "기존 이력서 PDF를 올리면 이름, 연락처, 경력, 프로젝트를 한 번에 정리합니다.",
  },
  {
    title: "성과 저장소로 자산화",
    body: "회사경력, 프로젝트, 대외활동을 흩어지지 않게 보관하고 필요할 때 다시 조합합니다.",
  },
  {
    title: "공고 매칭 분석",
    body: "지원 공고와 내 경험을 비교해 강점, 부족 키워드, 추천 활동을 바로 확인합니다.",
  },
  {
    title: "문서 저장과 PDF 출력",
    body: "선택한 활동으로 이력서를 만들고 문서 저장소에서 다시 꺼내 PDF로 내보냅니다.",
  },
];

const workflowItems = [
  {
    step: "01",
    title: "업로드",
    body: "기존 이력서 PDF에서 프로필과 활동을 추출합니다.",
  },
  {
    step: "02",
    title: "정리",
    body: "성과 저장소에서 경험을 다듬고 STAR 기준으로 문장을 보강합니다.",
  },
  {
    step: "03",
    title: "분석",
    body: "지원 공고와 비교해 맞는 경험과 보완 포인트를 확인합니다.",
  },
  {
    step: "04",
    title: "생성",
    body: "선택한 활동으로 이력서를 만들고 문서 저장소에 저장합니다.",
  },
];

const proofItems = [
  "활동 상세 AI 코치 피드백",
  "공고 매칭 분석 저장/조회",
  "문서 저장소와 PDF 내보내기",
  "게스트 모드와 직접 입력 시작",
];

export default function Home() {
  return (
    <div className="bg-[#f5f7fb] text-slate-950">
      <header className="absolute inset-x-0 top-0 z-20">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <Link href="/" className="text-lg font-semibold tracking-tight text-white">
            이소서
          </Link>
          <div className="hidden items-center gap-6 text-sm text-white/78 md:flex">
            <a href="#features" className="transition hover:text-white">
              기능
            </a>
            <a href="#workflow" className="transition hover:text-white">
              흐름
            </a>
            <a href="#cta" className="transition hover:text-white">
              시작하기
            </a>
          </div>
          <Link
            href="/login"
            className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur transition hover:bg-white/16"
          >
            무료로 시작
          </Link>
        </nav>
      </header>

      <main>
        <section className="relative overflow-hidden bg-[#071a36] text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(74,144,226,0.34),_transparent_38%),radial-gradient(circle_at_80%_20%,_rgba(44,99,235,0.42),_transparent_28%),linear-gradient(135deg,_rgba(6,18,38,0.82),_rgba(7,26,54,0.98))]" />
          <div className="absolute inset-y-0 right-0 hidden w-[48%] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] lg:block" />

          <div className="relative mx-auto grid min-h-screen max-w-7xl items-end gap-16 px-6 pb-16 pt-28 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)] lg:items-center lg:pb-20">
            <div className="max-w-2xl">
              <p className="text-sm font-medium uppercase tracking-[0.24em] text-sky-200/86">
                Career Asset Workspace
              </p>
              <h1 className="mt-6 text-5xl font-semibold leading-[1.02] tracking-tight md:text-6xl">
                흩어진 경력을 한 번 정리하면,
                <br />
                공고마다 다시 꺼내 쓸 수 있습니다.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-200">
                이소서는 AI가 대신 써주는 서비스가 아니라, 내 경험을 저장하고 다듬고 조합할 수
                있게 만드는 이력서 작업 공간입니다.
              </p>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <Link
                  href="/login"
                  className="rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                >
                  PDF 업로드로 시작하기
                </Link>
                <Link
                  href="/dashboard/onboarding"
                  className="rounded-full border border-white/20 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/8"
                >
                  온보딩 먼저 보기
                </Link>
              </div>

              <div className="mt-10 grid gap-3 text-sm text-slate-200 sm:grid-cols-2">
                {proofItems.map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <span className="h-2 w-2 rounded-full bg-sky-300" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="rounded-[2rem] border border-white/12 bg-white/8 p-4 shadow-2xl shadow-slate-950/35 backdrop-blur">
                <div className="rounded-[1.5rem] bg-[#f6f8fc] p-5 text-slate-900">
                  <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                        Resume Pipeline
                      </p>
                      <p className="mt-2 text-2xl font-semibold">업로드 후 바로 이어지는 흐름</p>
                    </div>
                    <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                      Live
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    <div className="rounded-2xl bg-white p-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Step 1
                      </p>
                      <p className="mt-2 text-base font-semibold">PDF에서 프로필과 활동 추출</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        이름, 연락처, 경력, 프로젝트를 자동 정리
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl bg-[#0d4fd7] p-4 text-white">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">
                          Step 2
                        </p>
                        <p className="mt-2 text-base font-semibold">성과 저장소</p>
                        <p className="mt-1 text-sm leading-6 text-blue-50">
                          회사경력과 프로젝트를 한 화면에서 관리
                        </p>
                      </div>
                      <div className="rounded-2xl bg-slate-900 p-4 text-white">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                          Step 3
                        </p>
                        <p className="mt-2 text-base font-semibold">공고 매칭 분석</p>
                        <p className="mt-1 text-sm leading-6 text-slate-300">
                          강점과 부족 키워드를 바로 확인
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">문서 저장소</p>
                          <p className="mt-1 text-sm text-slate-600">
                            생성한 이력서를 저장하고 PDF로 다시 출력
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                            Final
                          </p>
                          <p className="text-lg font-semibold">Ready to send</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-6 py-24">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-700">
              What Works Today
            </p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">
              이미 구현된 흐름을 첫 화면에서 바로 이해할 수 있어야 합니다.
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              지금 제품의 설득 포인트는 미래 기능이 아니라, 이미 연결된 작업 흐름입니다.
            </p>
          </div>

          <div className="mt-14 grid gap-x-8 gap-y-10 md:grid-cols-2">
            {featureItems.map((item, index) => (
              <article key={item.title} className="border-t border-slate-200 pt-5">
                <p className="text-sm font-semibold text-slate-400">0{index + 1}</p>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                  {item.title}
                </h3>
                <p className="mt-3 max-w-md text-sm leading-7 text-slate-600">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          id="workflow"
          className="border-y border-slate-200 bg-[linear-gradient(180deg,#ffffff,#edf3ff)]"
        >
          <div className="mx-auto max-w-6xl px-6 py-24">
            <div className="grid gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-700">
                  Workflow
                </p>
                <h2 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">
                  업로드 다음 행동이 명확해야 사용자가 남습니다.
                </h2>
                <p className="mt-4 text-base leading-7 text-slate-600">
                  그래서 홈과 온보딩 모두 같은 순서로 말해야 합니다. 업로드, 정리, 분석, 생성.
                </p>
              </div>

              <div className="space-y-6">
                {workflowItems.map((item) => (
                  <div
                    key={item.step}
                    className="grid gap-4 border-t border-slate-200 pt-5 sm:grid-cols-[64px_minmax(0,1fr)]"
                  >
                    <p className="text-sm font-semibold text-slate-400">{item.step}</p>
                    <div>
                      <h3 className="text-2xl font-semibold tracking-tight text-slate-950">
                        {item.title}
                      </h3>
                      <p className="mt-2 text-sm leading-7 text-slate-600">{item.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="cta" className="mx-auto max-w-6xl px-6 py-24">
          <div className="rounded-[2rem] bg-[#081a36] px-8 py-12 text-white md:px-12">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-200">
              Start From Your Existing Resume
            </p>
            <h2 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight">
              포털마다 다시 쓰는 대신, 한 번 정리한 경력을 작업 가능한 데이터로 바꾸세요.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
              PDF 업로드로 시작해도 되고, 바로 직접 입력으로 들어가도 됩니다. 중요한 건 처음부터
              빈 문서와 싸우지 않는 것입니다.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/login"
                className="rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
              >
                무료로 시작하기
              </Link>
              <Link
                href="/dashboard"
                className="rounded-full border border-white/18 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/8"
              >
                직접 입력으로 둘러보기
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
