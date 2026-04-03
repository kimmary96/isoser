import Link from "next/link";

function ExploreButton() {
  return (
    <div className="flex flex-col items-start gap-3">
      <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm animate-bounce">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-gray-500 opacity-75 animate-ping" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-gray-700" />
        </span>
        아직 이력서가 없다면?
      </div>
      <Link
        href="/login"
        className="border border-gray-300 text-gray-900 rounded-lg px-6 py-3 hover:bg-gray-50 transition"
      >
        커리어의 첫 발자취 남겨보기
      </Link>
    </div>
  );
}

export default function Home() {
  return (
    <div className="bg-white text-gray-900">
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <nav className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-semibold text-lg">
            이소서
          </Link>
          <div className="flex items-center gap-6">
            <a href="#about" className="text-sm text-gray-700 hover:text-gray-900 transition">
              서비스 소개
            </a>
            <a href="#pricing" className="text-sm text-gray-700 hover:text-gray-900 transition">
              요금제
            </a>
            <a href="#reviews" className="text-sm text-gray-700 hover:text-gray-900 transition">
              후기
            </a>
            <Link
              href="/login"
              className="bg-gray-900 text-white rounded-lg px-6 py-3 hover:bg-gray-700 transition"
            >
              무료로 시작하기
            </Link>
          </div>
        </nav>
      </header>

      <main>
        <section id="about" className="py-20">
          <div className="max-w-5xl mx-auto px-6">
            <div className="max-w-3xl">
              <span className="inline-flex bg-gray-100 text-gray-600 rounded-full text-sm px-4 py-1">
                PDF 업로드 1분 · 무료 시작
              </span>
              <h1 className="mt-6 text-4xl md:text-4xl font-semibold leading-tight">
                포털마다 이력서를 새로 쓰고 계신가요?
              </h1>
              <h2 className="mt-4 text-2xl md:text-3xl text-gray-700 font-medium">
                한 번 정리한 경력, 어디서든 꺼내 쓰세요.
              </h2>
              <p className="mt-6 text-lg text-gray-600 leading-relaxed">
                이력서 PDF 한 장 올리면 경력이 자동으로 정리됩니다. AI 코치가 한 줄씩 다듬고,
                지원 직무에 맞는 이력서를 바로 꺼낼 수 있어요.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <Link
                  href="/login"
                  className="bg-gray-900 text-white rounded-lg px-6 py-3 hover:bg-gray-700 transition"
                >
                  이력서 PDF로 바로 시작하기
                </Link>
                <ExploreButton />
              </div>
              <p className="mt-4 text-sm text-gray-500">
                PDF 없어도 직접 입력으로 시작 가능합니다
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gray-100 rounded-xl p-6 text-center">
                <p className="text-2xl font-semibold">91%</p>
                <p className="mt-2 text-sm text-gray-600">Z세대 AI 자소서 활용 경험 (캐치, 2025)</p>
              </div>
              <div className="bg-gray-100 rounded-xl p-6 text-center">
                <p className="text-2xl font-semibold">6.4개사</p>
                <p className="mt-2 text-sm text-gray-600">취준생 1인 평균 동시 지원 수</p>
              </div>
              <div className="bg-gray-100 rounded-xl p-6 text-center">
                <p className="text-2xl font-semibold">107만 명</p>
                <p className="mt-2 text-sm text-gray-600">국내 이직 준비 인구 (통계청, 2024)</p>
              </div>
            </div>
          </div>
        </section>

        <section id="pain" className="py-20 border-t border-gray-100">
          <div className="max-w-5xl mx-auto px-6">
            <h3 className="text-3xl font-semibold">이런 불편함, 겪어본 적 있으신가요?</h3>
            <p className="mt-3 text-gray-600">이소서는 이 고통에서 시작했습니다.</p>
            <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
              <article className="bg-gray-50 border border-gray-200 rounded-xl p-6">
                <p className="text-lg font-medium">"사람인 이력서랑 잡코리아 이력서 내용이 또 달라져버렸어요"</p>
                <p className="mt-3 text-sm text-gray-600">포털 동기화 문제</p>
              </article>
              <article className="bg-gray-50 border border-gray-200 rounded-xl p-6">
                <p className="text-lg font-medium">"부트캠프 프로젝트 3개를 어디다 정리해야 할지 모르겠어요"</p>
                <p className="mt-3 text-sm text-gray-600">활동 기록 분산</p>
              </article>
              <article className="bg-gray-50 border border-gray-200 rounded-xl p-6">
                <p className="text-lg font-medium">"ChatGPT가 써준 이력서엔 내 경험이 하나도 없었어요"</p>
                <p className="mt-3 text-sm text-gray-600">AI 생성의 한계</p>
              </article>
            </div>
          </div>
        </section>

        <section className="py-20 border-t border-gray-100">
          <div className="max-w-5xl mx-auto px-6">
            <h3 className="text-3xl font-semibold">3단계로 끝납니다</h3>
            <p className="mt-3 text-gray-600">복잡한 설정 없이, PDF 한 장으로 시작하세요.</p>
            <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
              <article className="bg-gray-50 border border-gray-200 rounded-xl p-6">
                <p className="text-sm text-gray-500 font-medium">01</p>
                <h4 className="mt-2 text-xl font-semibold">PDF 업로드</h4>
                <p className="mt-3 text-gray-600">
                  기존 이력서 PDF를 올리면 경력·프로젝트·학력이 자동으로 정리됩니다.
                </p>
              </article>
              <article className="bg-gray-50 border border-gray-200 rounded-xl p-6">
                <p className="text-sm text-gray-500 font-medium">02</p>
                <h4 className="mt-2 text-xl font-semibold">AI 코치 피드백</h4>
                <p className="mt-3 text-gray-600">
                  STAR 기법 기준으로 내 문장을 한 줄씩 더 강하게 다듬습니다.
                </p>
              </article>
              <article className="bg-gray-50 border border-gray-200 rounded-xl p-6">
                <p className="text-sm text-gray-500 font-medium">03</p>
                <h4 className="mt-2 text-xl font-semibold">직무 맞춤 출력</h4>
                <p className="mt-3 text-gray-600">
                  지원 직무를 선택하면 그 회사에 맞는 이력서가 바로 완성됩니다.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="py-20 border-t border-gray-100">
          <div className="max-w-5xl mx-auto px-6">
            <h3 className="text-3xl font-semibold">이소서가 다른 이유</h3>
            <p className="mt-3 text-gray-600">포털도, ChatGPT도 해결 못 한 문제를 해결합니다.</p>
            <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
              <article className="bg-gray-50 border border-gray-200 rounded-xl p-6">
                <h4 className="text-xl font-semibold">경력은 영구 보존됩니다</h4>
                <p className="mt-3 text-gray-600">
                  한 번 입력하면 삭제되지 않습니다. 지원 직무마다 조합만 바꾸면 됩니다.
                </p>
              </article>
              <article className="bg-gray-50 border border-gray-200 rounded-xl p-6">
                <h4 className="text-xl font-semibold">AI가 대신 쓰지 않습니다</h4>
                <p className="mt-3 text-gray-600">
                  내 문장을 AI가 코치합니다. 결과물은 온전히 내 언어로 남습니다.
                </p>
              </article>
              <article className="bg-gray-50 border border-gray-200 rounded-xl p-6">
                <h4 className="text-xl font-semibold">0초 시작, 빈칸 없음</h4>
                <p className="mt-3 text-gray-600">
                  PDF 업로드 한 번으로 즉시 시작됩니다. 빈칸부터 채우지 않아도 됩니다.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section id="reviews" className="py-20 border-t border-gray-100">
          <div className="max-w-5xl mx-auto px-6">
            <h3 className="text-3xl font-semibold">
              이 문제, 생각보다 훨씬 많은 분들이 겪고 있습니다
            </h3>
            <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gray-100 rounded-xl p-6 text-center">
                <p className="text-2xl font-semibold">69%</p>
                <p className="mt-2 text-sm text-gray-600">
                  2025년 AI 자소서 활용률 (2023년 7%에서 9배 증가)
                </p>
              </div>
              <div className="bg-gray-100 rounded-xl p-6 text-center">
                <p className="text-2xl font-semibold">6.4개사</p>
                <p className="mt-2 text-sm text-gray-600">취준생 1인 평균 동시 지원 기업 수</p>
              </div>
              <div className="bg-gray-100 rounded-xl p-6 text-center">
                <p className="text-2xl font-semibold">107만 명</p>
                <p className="mt-2 text-sm text-gray-600">국내 이직 준비 실업자 (2024년 기준)</p>
              </div>
            </div>

            <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
              <article className="bg-gray-50 border border-gray-200 rounded-xl p-6">
                <p className="text-gray-800 leading-relaxed">
                  "포트폴리오 프로젝트 정리하는데 이소서 쓰고 나서 이력서 버전 관리가 진짜 편해졌어요.
                  직무별로 꺼내 쓰니까 복붙 실수가 없어졌습니다."
                </p>
                <p className="mt-4 text-sm text-gray-600">부트캠프 수료 취준생, 27세</p>
              </article>
              <article className="bg-gray-50 border border-gray-200 rounded-xl p-6">
                <p className="text-gray-800 leading-relaxed">
                  "ChatGPT로 썼더니 면접관이 AI 썼죠? 라고 바로 알아봤어요. 이소서 코치 방식은 내
                  말투가 살아있어서 달랐습니다."
                </p>
                <p className="mt-4 text-sm text-gray-600">5년차 마케터, 이직 준비 중</p>
              </article>
            </div>
          </div>
        </section>

        <section id="pricing" className="py-20 border-t border-gray-100">
          <div className="max-w-5xl mx-auto px-6 text-center">
            <h3 className="text-3xl font-semibold">
              지금 이력서 PDF 한 장만 있으면 됩니다. 무료로 시작하세요.
            </h3>
            <p className="mt-4 text-gray-600">경력 정리부터 PDF 출력 첫 1회까지 완전 무료입니다.</p>
            <div className="mt-8 flex justify-center">
              <Link
                href="/login"
                className="bg-gray-900 text-white rounded-lg px-6 py-3 hover:bg-gray-700 transition"
              >
                이력서 PDF 업로드하기
              </Link>
            </div>
            <p className="mt-4 text-sm text-gray-500">
              PDF 없이 직접 입력으로도 시작 가능 · 신용카드 불필요
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm text-gray-600">
          <p>© 2026 이소서</p>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-gray-900 transition">
              개인정보처리방침
            </a>
            <a href="#" className="hover:text-gray-900 transition">
              이용약관
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
