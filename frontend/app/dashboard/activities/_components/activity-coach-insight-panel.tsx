import type { ActivityCoachInsight, ActivityCoachRewriteCandidate } from "../_lib/activity-coach-insight";

type ActivityCoachInsightPanelProps = {
  insight: ActivityCoachInsight;
  showPlaceholder?: boolean;
  onApplyToDescription?: (text: string) => void;
  onApplyToStar?: (candidate: ActivityCoachRewriteCandidate) => void;
  onApplyToContribution?: (text: string) => void;
};

const STATUS_COPY = {
  strong: "충분",
  missing: "보강",
} as const;

const PLACEHOLDER_DIAGNOSIS_ITEMS = [
  {
    label: "문제 정의",
    status: "예시",
    reason: "기존 방식의 불편함과 해결하려던 문제를 확인합니다.",
  },
  {
    label: "구현 디테일",
    status: "예시",
    reason: "어떤 행동과 전략으로 문제를 풀었는지 살펴봅니다.",
  },
  {
    label: "정량적 성과",
    status: "예시",
    reason: "결과를 숫자, 변화율, 비교 기준으로 더 선명하게 만듭니다.",
  },
  {
    label: "직무 핏",
    status: "예시",
    reason: "지원 직무 관점에서 살릴 단어와 강조점을 찾습니다.",
  },
];

function ActivityCoachInsightPlaceholder() {
  return (
    <div className="h-full min-h-[640px] space-y-4 rounded-2xl border border-dashed border-blue-200 bg-[#eef6ff] p-4">
      <div>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-900">코칭 진단</h3>
          <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-blue-700">
            대기 중
          </span>
        </div>
        <p className="mt-3 text-sm font-semibold leading-6 text-blue-800">
          STAR 작성후 AI 코치의 진단을 받아보세요!
        </p>
        <p className="mt-1 text-[12px] leading-5 text-slate-600">
          진단 결과는 이 영역에 문제 정의, 성과 보강, 직무 핏 문장 후보로 정리됩니다.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {PLACEHOLDER_DIAGNOSIS_ITEMS.map((item) => (
          <div key={item.label} className="rounded-lg border border-white bg-white/75 p-2">
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 text-xs font-semibold text-slate-800">{item.label}</p>
              <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                {item.status}
              </span>
            </div>
            <p className="mt-1 text-[11px] leading-4 text-slate-500">{item.reason}</p>
          </div>
        ))}
      </div>

      <div>
        <h4 className="text-xs font-semibold text-slate-900">예시 문장 후보</h4>
        <div className="mt-2 rounded-lg border border-white bg-white/75 p-3">
          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
            Result
          </span>
          <p className="mt-2 text-[12px] leading-5 text-slate-600">
            사용자가 작성한 STAR 내용을 바탕으로 성과와 직무 관련성이 드러나는 문장 후보가 표시됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}

export function ActivityCoachInsightPanel({
  insight,
  showPlaceholder = false,
  onApplyToDescription,
  onApplyToStar,
  onApplyToContribution,
}: ActivityCoachInsightPanelProps) {
  if (!insight.hasInsight) {
    return showPlaceholder ? <ActivityCoachInsightPlaceholder /> : null;
  }

  return (
    <div className="h-full min-h-[640px] space-y-4 overflow-y-auto rounded-2xl border border-blue-100 bg-[#eef6ff] p-3">
      <div>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-900">코칭 진단</h3>
          {insight.priorityFocus && (
            <span className="shrink-0 rounded-full bg-[#094cb2] px-2 py-0.5 text-[11px] font-semibold text-white">
              우선 보강: {insight.priorityFocus}
            </span>
          )}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {insight.diagnosisItems.map((item) => (
            <div
              key={item.key}
              className={`rounded-lg border bg-white p-2 ${
                item.status === "missing" ? "border-amber-200" : "border-emerald-100"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 text-xs font-semibold text-slate-900">{item.label}</p>
                <span
                  className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    item.status === "missing"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {STATUS_COPY[item.status]}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-4 text-slate-600">{item.reason}</p>
            </div>
          ))}
        </div>
      </div>

      {(insight.strengthPoints.length > 0 || insight.roleKeywords.length > 0) && (
        <div>
          <h4 className="text-xs font-semibold text-slate-900">살릴 포인트</h4>
          {insight.roleKeywords.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {insight.roleKeywords.map((keyword) => (
                <span
                  key={keyword}
                  className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-blue-700"
                >
                  {keyword}
                </span>
              ))}
            </div>
          )}
          {insight.strengthPoints.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {insight.strengthPoints.map((point) => (
                <div key={point.id} className="rounded-lg bg-white px-2 py-1.5">
                  <p className="text-[11px] font-semibold text-slate-900">{point.label}</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-slate-600">{point.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {insight.questions.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-slate-900">보강 질문</h4>
          <ul className="mt-2 space-y-1.5">
            {insight.questions.map((item) => (
              <li key={item.id} className="rounded-lg bg-white px-2 py-1.5 text-[12px] leading-5 text-slate-700">
                <span className="font-semibold text-blue-700">{item.missingElement}</span>
                <span className="mx-1 text-slate-300">/</span>
                {item.question}
              </li>
            ))}
          </ul>
        </div>
      )}

      {insight.rewriteCandidates.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-slate-900">문장 후보</h4>
          <div className="mt-2 space-y-2">
            {insight.rewriteCandidates.map((candidate) => (
              <div key={candidate.id} className="rounded-lg border border-slate-100 bg-white p-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                    {candidate.section}
                  </span>
                  {candidate.needsUserCheck && (
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                      확인 필요
                    </span>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-[12px] leading-5 text-slate-800">{candidate.text}</p>
                {candidate.rationale && (
                  <p className="mt-1 text-[11px] leading-4 text-slate-500">{candidate.rationale}</p>
                )}
                {(onApplyToDescription || onApplyToStar || onApplyToContribution) && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {onApplyToDescription && (
                      <button
                        type="button"
                        onClick={() => onApplyToDescription(candidate.text)}
                        className="rounded-md border border-blue-200 px-2 py-1 text-[11px] font-semibold text-blue-700 transition-colors hover:bg-blue-50"
                      >
                        소개글에 적용
                      </button>
                    )}
                    {onApplyToStar && (
                      <button
                        type="button"
                        onClick={() => onApplyToStar(candidate)}
                        className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        {candidate.starTargetLabel}에 적용
                      </button>
                    )}
                    {onApplyToContribution && (
                      <button
                        type="button"
                        onClick={() => onApplyToContribution(candidate.text)}
                        className="rounded-md border border-emerald-200 px-2 py-1 text-[11px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-50"
                      >
                        기여내용에 추가
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {insight.riskFlags.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-slate-900">검토 포인트</h4>
          <div className="mt-2 space-y-1.5">
            {insight.riskFlags.map((flag) => (
              <div key={flag.id} className="rounded-lg bg-white px-2 py-1.5">
                <p className="text-[11px] font-semibold text-amber-700">{flag.label}</p>
                <p className="mt-0.5 text-[11px] leading-4 text-slate-600">{flag.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
