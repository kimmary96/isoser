import Link from "next/link";

import { LandingHeader } from "@/components/landing/LandingHeader";
import { cx, iso } from "@/components/ui/isoser-ui";

export default function ProgramDetailNotFound() {
  return (
    <>
      <LandingHeader />
      <main className={cx("flex min-h-screen items-center justify-center px-6", iso.page)}>
        <div className="max-w-md rounded-2xl border border-white/70 bg-white/90 px-8 py-10 text-center shadow-sm backdrop-blur-sm">
          <p className="text-lg font-semibold text-slate-950">프로그램을 찾을 수 없습니다</p>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            링크가 잘못되었거나 더 이상 제공되지 않는 프로그램일 수 있습니다. 목록에서 현재 지원 가능한 프로그램을 다시 확인해 주세요.
          </p>
          <Link
            href="/programs"
            className={cx("mt-6 inline-flex rounded-full px-5 py-3 text-sm font-semibold", iso.primaryButton)}
          >
            프로그램 목록으로 돌아가기
          </Link>
        </div>
      </main>
    </>
  );
}
