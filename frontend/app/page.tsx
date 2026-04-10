import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10">
        <section className="rounded-2xl border border-slate-200 bg-white p-8">
          {/* 광고 배너 영역 */}
          <p className="text-sm font-semibold text-slate-500">상단 배너 광고 슬롯</p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">인기 부트캠프 TOP 10</h1>
              <p className="mt-2 text-sm text-slate-600">이번 주 많이 보는 과정을 확인하세요.</p>
            </div>
            <Link
              href="/programs"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              전체 보기
            </Link>
          </div>
          <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-sm text-slate-500">
            {/* 프로그램 카드 영역 */}
            프로그램 카드 영역
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-8">
          <h2 className="text-2xl font-semibold tracking-tight">카테고리 필터</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {["개발", "데이터", "디자인", "기획", "마케팅"].map((category) => (
              <button
                key={category}
                type="button"
                className="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                {category}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-8">
          <h2 className="text-2xl font-semibold tracking-tight">마감 임박 과정 하이라이트</h2>
          <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-sm text-slate-500">
            마감 임박 과정 하이라이트 영역
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-slate-900 p-8 text-white">
          <h2 className="text-2xl font-semibold tracking-tight">회원가입 후 저장하고 비교해보세요</h2>
          <p className="mt-2 text-sm text-slate-300">
            프로그램 북마크와 지원 준비 기능은 로그인 후 사용할 수 있습니다.
          </p>
          <div className="mt-6">
            <Link
              href="/login"
              className="inline-flex rounded-lg bg-white px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-slate-100"
            >
              회원가입 CTA 버튼
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
