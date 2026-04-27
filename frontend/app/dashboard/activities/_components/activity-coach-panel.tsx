import type { CoachMessage } from "@/lib/types";

type ActivityCoachPanelProps = {
  jobTitle: string;
  onJobTitleChange: (value: string) => void;
  messages: CoachMessage[];
  sending: boolean;
  diagnosisLoading: boolean;
  canRunDiagnosis: boolean;
  input: string;
  onInputChange: (value: string) => void;
  onSendMessage: () => Promise<void>;
  onRunDiagnosis: () => Promise<void>;
};

export function ActivityCoachPanel({
  jobTitle,
  onJobTitleChange,
  messages,
  sending,
  diagnosisLoading,
  canRunDiagnosis,
  input,
  onInputChange,
  onSendMessage,
  onRunDiagnosis,
}: ActivityCoachPanelProps) {
  const targetRole = jobTitle.trim();
  const diagnosisDisabled = diagnosisLoading || sending || !canRunDiagnosis;

  return (
    <div className="flex h-full min-h-[640px] flex-col rounded-2xl border border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-gray-900">AI 코치</h2>
          <button
            type="button"
            onClick={() => void onRunDiagnosis()}
            disabled={diagnosisDisabled}
            title={!canRunDiagnosis ? "STAR 4개 항목을 모두 채우면 진단할 수 있습니다." : undefined}
            className="shrink-0 rounded-lg bg-[#094cb2] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#073c8f] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
          >
            {diagnosisLoading ? "진단 중..." : "코칭 진단"}
          </button>
        </div>
        <input
          type="text"
          placeholder="지원 직무 (예: PM, 백엔드 개발자)"
          value={jobTitle}
          onChange={(e) => onJobTitleChange(e.target.value)}
          className="mt-2 w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-gray-400"
        />
        {targetRole && (
          <p className="mt-2 truncate text-[11px] font-medium text-blue-700">
            직무 기준: {targetRole}
          </p>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto overflow-x-hidden p-4">
        {messages.length === 0 && (
          <p className="text-sm text-gray-400 text-center mt-8">
            활동 내용을 입력하면 AI 코치가 STAR 기법으로 피드백을 드립니다.
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm ${
                msg.role === "user"
                  ? "bg-[#071a36] text-white"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{msg.content}</p>
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-xl px-4 py-2.5 text-sm text-gray-500">
              분석 중...
            </div>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-gray-100 flex gap-2">
        <textarea
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void onSendMessage();
            }
          }}
          placeholder="활동 내용을 입력하세요..."
          rows={2}
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-gray-400 resize-none"
        />
        <button
          onClick={() => void onSendMessage()}
          disabled={sending || !input.trim()}
          className="rounded-lg bg-[#071a36] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0a2146] disabled:opacity-50"
        >
          전송
        </button>
      </div>
    </div>
  );
}
