import Link from "next/link";

type ProfileCompletionCardProps = {
  completionScore: number;
  missingItems: string[];
  isComplete: boolean;
};

export function ProfileCompletionCard({
  completionScore,
  missingItems,
  isComplete,
}: ProfileCompletionCardProps) {
  return (
    <section className="relative mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
      {isComplete && (
        <div className="pointer-events-none absolute inset-0">
          {["left-[10%]", "left-[24%]", "left-[42%]", "left-[61%]", "left-[78%]", "left-[90%]"].map(
            (position, index) => (
              <span
                key={position}
                className={`absolute top-3 h-2 w-2 animate-[profile-fanfare_1.3s_ease-out_forwards] rounded-full ${position}`}
                style={{
                  animationDelay: `${index * 90}ms`,
                  backgroundColor: ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6"][index],
                }}
              />
            )
          )}
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-xl font-semibold tracking-tight text-slate-950">
              내 이력 완성도
            </h2>
            {!isComplete && missingItems.length > 0 && (
              <p className="text-xs text-slate-500">
                부족: {missingItems.slice(0, 4).join(", ")}
                {missingItems.length > 4 ? ` 외 ${missingItems.length - 4}개` : ""}
              </p>
            )}
            {isComplete && <p className="text-xs font-semibold text-emerald-600">완성되었습니다</p>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {!isComplete && (
            <Link
              href="/onboarding"
              className="rounded-xl px-5 py-2 text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #094cb2, #3b82f6)" }}
            >
              기존 이력서로 한번에 채우기
            </Link>
          )}
          <p className={`text-2xl font-bold ${isComplete ? "text-emerald-600" : "text-blue-600"}`}>
            {completionScore}%
          </p>
        </div>
      </div>
      <div className="mt-4 h-2 w-full rounded-full bg-gray-200">
        <div
          className="h-2 rounded-full transition-all duration-500"
          style={{ width: `${completionScore}%`, backgroundColor: isComplete ? "#10b981" : "#094cb2" }}
        />
      </div>
      <style jsx global>{`
        @keyframes profile-fanfare {
          0% {
            opacity: 0;
            transform: translateY(22px) scale(0.7);
          }
          30% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translateY(88px) scale(1.4);
          }
        }
      `}</style>
    </section>
  );
}
