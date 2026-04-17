type TemplateOption = {
  id: string;
  label: string;
  free: boolean;
};

type ChatMessage = {
  role: "user" | "ai";
  text: string;
};

type ResumeAssistantSidebarProps = {
  targetJob: string;
  onTargetJobChange: (value: string) => void;
  summaryDraft: string;
  onSummaryDraftChange: (value: string) => void;
  onCreateResume: () => Promise<void>;
  saving: boolean;
  canCreate: boolean;
  error: string | null;
  templates: TemplateOption[];
  templateId: string;
  onTemplateChange: (value: string) => void;
  chatMessages: ChatMessage[];
  chatLoading: boolean;
  chatInput: string;
  onChatInputChange: (value: string) => void;
  onChatSend: () => Promise<void>;
};

export function ResumeAssistantSidebar({
  targetJob,
  onTargetJobChange,
  summaryDraft,
  onSummaryDraftChange,
  onCreateResume,
  saving,
  canCreate,
  error,
  templates,
  templateId,
  onTemplateChange,
  chatMessages,
  chatLoading,
  chatInput,
  onChatInputChange,
  onChatSend,
}: ResumeAssistantSidebarProps) {
  return (
    <div className="flex h-full w-64 flex-shrink-0 flex-col overflow-y-auto border-l border-gray-100 bg-white">
      <div className="border-b border-gray-100 p-4">
        <div className="flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-white">
          <span className="text-xs font-bold">✦ PREMIUM AI</span>
          <span className="rounded bg-blue-500 px-1.5 py-0.5 text-[10px]">ACTIVE</span>
        </div>
      </div>

      <div className="space-y-2 border-b border-gray-100 p-4">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          문서 제어
        </p>

        <input
          value={targetJob}
          onChange={(e) => onTargetJobChange(e.target.value)}
          placeholder="지원 직무 입력..."
          className="mb-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-xs focus:border-blue-400 focus:outline-none"
        />

        <textarea
          value={summaryDraft}
          onChange={(e) => onSummaryDraftChange(e.target.value)}
          placeholder="요약 초안을 입력하세요..."
          rows={4}
          className="mb-2 w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-xs focus:border-blue-400 focus:outline-none"
        />

        <button
          onClick={() => void onCreateResume()}
          disabled={saving || !canCreate}
          className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #094cb2, #3b82f6)" }}
        >
          {saving ? "저장 중..." : "✦ 문서 생성하기"}
        </button>

        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>

      <div className="border-b border-gray-100 p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            템플릿 선택
          </p>
          <button className="text-[10px] text-blue-500 hover:underline">모두 보기</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {templates.map((template) => (
            <button
              key={template.id}
              onClick={() => template.free && onTemplateChange(template.id)}
              className={`relative rounded-xl border p-2 text-center transition-all ${
                templateId === template.id
                  ? "border-blue-400 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              } ${!template.free ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
            >
              <div className="mb-1 flex h-12 items-center justify-center rounded-lg bg-gray-100">
                <span className="text-[10px] text-gray-400">
                  {template.free ? "미리보기" : "🔒"}
                </span>
              </div>
              <p className="text-[10px] font-medium text-gray-700">{template.label}</p>
              {!template.free && (
                <span className="absolute right-1 top-1 rounded bg-amber-400 px-1 text-[8px] text-white">
                  PRO
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          ✦ AI 조립 어시스턴트
        </p>

        <div className="mb-3 min-h-[120px] flex-1 space-y-2 overflow-y-auto">
          {chatMessages.length === 0 && (
            <p className="text-[10px] leading-relaxed text-gray-400">
              선택한 성과 카드를 분석하여 채용 공고의 핵심 키워드에 맞춰 문장을 최적화할까요?
            </p>
          )}
          {chatMessages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`rounded-xl p-2 text-[10px] leading-relaxed ${
                message.role === "user"
                  ? "ml-4 bg-blue-50 text-right text-blue-800"
                  : "mr-4 bg-gray-50 text-gray-700"
              }`}
            >
              {message.text}
            </div>
          ))}
          {chatLoading && (
            <div className="rounded-xl bg-gray-50 p-2 text-[10px] text-gray-400">
              분석 중...
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t border-gray-100 pt-3">
          <textarea
            value={chatInput}
            onChange={(e) => onChatInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void onChatSend();
              }
            }}
            placeholder="AI에게 개선을 요청하세요..."
            rows={3}
            className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-xs focus:border-blue-400 focus:outline-none"
          />
          <button
            onClick={() => void onChatSend()}
            disabled={chatLoading || !chatInput.trim()}
            className="self-end rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            전송
          </button>
        </div>
      </div>
    </div>
  );
}
