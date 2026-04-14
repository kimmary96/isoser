import type { CoachMessage } from "@/lib/types";

type ActivityCoachPanelProps = {
  jobTitle: string;
  onJobTitleChange: (value: string) => void;
  messages: CoachMessage[];
  sending: boolean;
  input: string;
  onInputChange: (value: string) => void;
  onSendMessage: () => Promise<void>;
};

export function ActivityCoachPanel({
  jobTitle,
  onJobTitleChange,
  messages,
  sending,
  input,
  onInputChange,
  onSendMessage,
}: ActivityCoachPanelProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 flex flex-col h-[500px]">
      <div className="p-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900">AI 코치</h2>
        <input
          type="text"
          placeholder="지원 직무 (예: PM, 백엔드 개발자)"
          value={jobTitle}
          onChange={(e) => onJobTitleChange(e.target.value)}
          className="mt-2 w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-gray-400"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
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
                  ? "bg-black text-white"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
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
          className="px-3 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          전송
        </button>
      </div>
    </div>
  );
}
