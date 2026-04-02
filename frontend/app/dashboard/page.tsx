// 메인 대시보드 페이지 - 활동 목록 요약 및 이력서 바로가기
import Link from "next/link";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
          <Link
            href="/dashboard/onboarding"
            className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            + 경험 추가
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <p className="text-sm text-gray-500">총 활동</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">0</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <p className="text-sm text-gray-500">이력서</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">0</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <p className="text-sm text-gray-500">AI 코치 세션</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">0</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/dashboard/activities"
            className="bg-white rounded-xl border border-gray-200 p-6 hover:border-gray-400 transition-colors"
          >
            <h2 className="font-semibold text-gray-900 mb-1">내 활동 관리</h2>
            <p className="text-sm text-gray-500">프로젝트, 경력, 대외활동을 관리하고 AI 코치의 피드백을 받으세요</p>
          </Link>
          <Link
            href="/dashboard/resume"
            className="bg-white rounded-xl border border-gray-200 p-6 hover:border-gray-400 transition-colors"
          >
            <h2 className="font-semibold text-gray-900 mb-1">이력서 편집</h2>
            <p className="text-sm text-gray-500">활동을 선택해 이력서를 구성하고 PDF로 출력하세요</p>
          </Link>
          <Link
            href="/dashboard/match"
            className="bg-white rounded-xl border border-gray-200 p-6 hover:border-gray-400 transition-colors"
          >
            <h2 className="font-semibold text-gray-900 mb-1">공고 매칭 분석</h2>
            <p className="text-sm text-gray-500">채용 공고를 붙여넣으면 내 경험과의 매칭률을 분석해 드립니다</p>
          </Link>
        </div>
      </div>
    </main>
  );
}
