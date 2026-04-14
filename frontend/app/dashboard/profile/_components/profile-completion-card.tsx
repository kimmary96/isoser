import Link from "next/link";

type ProfileCompletionCardProps = {
  completionScore: number;
};

export function ProfileCompletionCard({
  completionScore,
}: ProfileCompletionCardProps) {
  return (
    <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
          내 이력 완성도
        </h2>
        <div className="flex flex-col items-end gap-2">
          <Link
            href="/onboarding"
            className="rounded-xl px-6 py-2.5 text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #094cb2, #3b82f6)" }}
          >
            기존 이력서로 한번에 채우기
          </Link>
          <p className="text-2xl font-bold text-blue-600">{completionScore}%</p>
        </div>
      </div>
      <div className="mt-4 h-2 w-full rounded-full bg-gray-200">
        <div
          className="h-2 rounded-full transition-all duration-500"
          style={{ width: `${completionScore}%`, backgroundColor: "#094cb2" }}
        />
      </div>
    </section>
  );
}
