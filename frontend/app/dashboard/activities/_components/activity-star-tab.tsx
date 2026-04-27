type ActivityStarTabProps = {
  starSituation: string;
  onStarSituationChange: (value: string) => void;
  starTask: string;
  onStarTaskChange: (value: string) => void;
  starAction: string;
  onStarActionChange: (value: string) => void;
  starResult: string;
  onStarResultChange: (value: string) => void;
  starSaving: boolean;
  canImportBasicInfo: boolean;
  onImportBasicInfo: () => void;
  onStarSave: () => Promise<void>;
};

export function ActivityStarTab({
  starSituation,
  onStarSituationChange,
  starTask,
  onStarTaskChange,
  starAction,
  onStarActionChange,
  starResult,
  onStarResultChange,
  starSaving,
  canImportBasicInfo,
  onImportBasicInfo,
  onStarSave,
}: ActivityStarTabProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-slate-600">
            기본정보의 활동명, 역할, 사용 기술, 기여내용을 STAR 초안에 자동으로 나눠 넣습니다.
          </p>
          <button
            type="button"
            onClick={onImportBasicInfo}
            disabled={!canImportBasicInfo}
            className="shrink-0 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400"
          >
            기본정보 가져오기
          </button>
        </div>
      </div>

      <div>
        <label className="text-sm font-semibold text-blue-600 mb-1 block">
          S - Situation (상황)
        </label>
        <p className="text-xs text-gray-400 mb-2">
          프로젝트가 시작된 배경이나 당시 직면했던 구체적인 상황은 무엇인가요?
        </p>
        <textarea
          value={starSituation}
          onChange={(e) => onStarSituationChange(e.target.value)}
          placeholder="예) 신규 서비스 출시를 앞두고 기존 온보딩 이탈률이 68%에 달하는 상황이었습니다."
          className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-blue-400"
          rows={3}
        />
      </div>

      <div>
        <label className="text-sm font-semibold text-blue-600 mb-1 block">
          T - Task (과제)
        </label>
        <p className="text-xs text-gray-400 mb-2">
          본인이 해결해야 했던 핵심 과제와 목표 수치는 무엇이었나요?
        </p>
        <textarea
          value={starTask}
          onChange={(e) => onStarTaskChange(e.target.value)}
          placeholder="예) 온보딩 완료율을 3개월 내 85% 이상으로 개선하는 것이 목표였습니다."
          className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-blue-400"
          rows={3}
        />
      </div>

      <div>
        <label className="text-sm font-semibold text-blue-600 mb-1 block">
          A - Action (행동)
        </label>
        <p className="text-xs text-gray-400 mb-2">
          목표 달성을 위해 어떤 구체적인 행동과 전략을 실행했나요?
        </p>
        <textarea
          value={starAction}
          onChange={(e) => onStarActionChange(e.target.value)}
          placeholder="예) 사용자 인터뷰 20건을 진행하고 이탈 구간을 특정해 단계를 5단계에서 3단계로 축소했습니다."
          className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-blue-400"
          rows={3}
        />
      </div>

      <div>
        <label className="text-sm font-semibold text-blue-600 mb-1 block">
          R - Result (결과)
        </label>
        <p className="text-xs text-gray-400 mb-2">
          결과적으로 어떤 성과를 냈나요? 숫자, 퍼센트, 비즈니스 임팩트 중심으로 작성해주세요.
        </p>
        <textarea
          value={starResult}
          onChange={(e) => onStarResultChange(e.target.value)}
          placeholder="예) 온보딩 완료율 89% 달성, 첫 주 리텐션 41% 향상, 고객 문의 32% 감소."
          className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-blue-400"
          rows={3}
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          onClick={() => void onStarSave()}
          disabled={starSaving}
          className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          {starSaving ? "저장 중..." : "저장"}
        </button>
      </div>
    </div>
  );
}
