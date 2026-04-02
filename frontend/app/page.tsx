// 랜딩 페이지 - 서비스 소개 및 시작하기 버튼
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-white px-4">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-5xl font-bold text-gray-900">이소서</h1>
        <p className="text-xl text-gray-600">
          AI가 대신 써주는 게 아니라, 당신이 직접 고치는 이력서
        </p>
        <p className="text-gray-500">
          AI 코치가 STAR 기법으로 한 줄씩 피드백을 드립니다.
          경험을 입력하고, 더 나은 문장으로 다듬어보세요.
        </p>
        <div className="flex gap-4 justify-center pt-4">
          <Link
            href="/login"
            className="px-8 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
          >
            시작하기
          </Link>
          <Link
            href="/dashboard"
            className="px-8 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            대시보드 →
          </Link>
        </div>
      </div>
    </main>
  );
}
