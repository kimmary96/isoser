import Link from "next/link";

export default function CallbackPage() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-3">
        <p className="text-gray-700">로그인 경로가 변경되었습니다.</p>
        <Link href="/login" className="text-blue-600 hover:underline">
          로그인으로 이동
        </Link>
      </div>
    </main>
  );
}
