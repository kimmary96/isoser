"use client";

import { useParams } from "next/navigation";

import { useCoverLetterDetail } from "../_hooks/use-cover-letter-detail";

const ANSWER_MAX_LENGTH = 3000;

export default function CoverLetterDetailPage() {
  const params = useParams();
  const letterId = params.id as string;
  const isNew = letterId === "new";
  const {
    router,
    title,
    setTitle,
    companyName,
    setCompanyName,
    jobTitle,
    setJobTitle,
    tagInput,
    setTagInput,
    qaItems,
    activeQaIndex,
    setActiveQaIndex,
    loading,
    saving,
    deleting,
    showDeleteModal,
    setShowDeleteModal,
    error,
    coachMessages,
    coachInput,
    setCoachInput,
    coachJobTitle,
    setCoachJobTitle,
    coaching,
    activeQa,
    updateQaItem,
    handleAddQuestion,
    handleRemoveQuestion,
    handleSave,
    requestCoaching,
    handleDelete,
  } = useCoverLetterDetail(letterId, isNew);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f3f6fb]">
        <p className="text-slate-500">불러오는 중...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f3f6fb]">
      <div className="mx-auto max-w-7xl px-5 py-8">
        <button
          onClick={() => router.push("/dashboard/cover-letter")}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
        >
          <span>←</span>
          목록으로
        </button>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="mb-1 text-xs font-medium text-[#e0621a]">자기소개서 편집기</p>
                <h1 className="text-xl font-bold text-slate-950">
                  {isNew ? "새 자기소개서 작성" : "자기소개서 편집"}
                </h1>
              </div>
              {!isNew && (
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-500 hover:bg-red-50"
                >
                  삭제
                </button>
              )}
            </div>

            {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">제목 *</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예) 2026 상반기 공개채용 자소서"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">회사명 *</label>
                <input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="예) 이소서테크"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">지원 직무 *</label>
                <input
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="예) 백엔드 개발자"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">태그 (쉼표 구분)</label>
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="지원동기, 문제해결, 협업"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                />
              </div>
            </div>

            <div className="mt-6 grid grid-cols-[44px_minmax(0,1fr)] gap-4">
              <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
                {qaItems.map((_, idx) => (
                  <button
                    key={`qa-tab-${idx}`}
                    onClick={() => setActiveQaIndex(idx)}
                    className={`h-8 w-8 rounded-md text-sm font-semibold ${
                      idx === activeQaIndex ? "bg-[#e0621a] text-white" : "border border-slate-200 bg-white text-slate-600"
                    }`}
                    title={`문항 ${idx + 1}`}
                  >
                    {idx + 1}
                  </button>
                ))}
                <button
                  onClick={handleAddQuestion}
                  className="h-8 w-8 rounded-md border border-gray-300 bg-white text-gray-500 hover:bg-gray-100"
                  title="문항 추가"
                >
                  +
                </button>
                <button
                  onClick={handleRemoveQuestion}
                  disabled={qaItems.length <= 1}
                  className="h-8 w-8 rounded-md border border-gray-300 bg-white text-gray-500 hover:bg-gray-100 disabled:opacity-40"
                  title="현재 문항 삭제"
                >
                  -
                </button>
              </div>

              <div className="rounded-xl border border-gray-200">
                <div className="border-b border-gray-200 px-4 py-3">
                  <p className="text-xs font-semibold text-orange-500">문항 {activeQaIndex + 1}</p>
                  <textarea
                    value={activeQa.question}
                    onChange={(e) => updateQaItem(activeQaIndex, { question: e.target.value })}
                    placeholder="질문(문항)을 입력하세요."
                    rows={3}
                    className="mt-2 w-full text-sm rounded-lg border border-gray-200 px-3 py-2 outline-none resize-none focus:border-blue-400"
                  />
                </div>
                <div className="px-4 py-3">
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-500">답변</p>
                    <span className={`text-xs ${activeQa.answer.length >= ANSWER_MAX_LENGTH ? "text-red-500" : "text-gray-400"}`}>
                      {activeQa.answer.length}/{ANSWER_MAX_LENGTH}
                    </span>
                  </div>
                  <textarea
                    value={activeQa.answer}
                    onChange={(e) =>
                      updateQaItem(activeQaIndex, { answer: e.target.value.slice(0, ANSWER_MAX_LENGTH) })
                    }
                    maxLength={ANSWER_MAX_LENGTH}
                    placeholder="답변을 입력하세요."
                    rows={14}
                    className="w-full text-sm rounded-lg border border-gray-200 px-3 py-2.5 outline-none resize-y focus:border-blue-400"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl bg-[linear-gradient(135deg,#094cb2,#3b82f6)] px-6 py-2.5 text-sm font-medium text-white hover:brightness-95 disabled:opacity-50"
              >
                {saving ? "저장 중..." : "저장하기"}
              </button>
            </div>
          </div>

          <aside className="h-fit overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)] lg:sticky lg:top-6">
            <div className="px-4 py-4 border-b border-gray-100">
              <h2 className="mb-3 text-base font-bold text-slate-950">AI 코치</h2>
              <input
                value={coachJobTitle}
                onChange={(e) => setCoachJobTitle(e.target.value)}
                placeholder="지원 직무 (예: PM, 백엔드 개발자)"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
              />
            </div>

            <div className="h-[360px] overflow-y-auto p-4 space-y-2 bg-white">
              {coachMessages.length === 0 ? (
                <p className="text-xs text-gray-400 leading-relaxed">
                  현재 선택한 문항/답변을 바탕으로 코칭을 받을 수 있습니다.
                </p>
              ) : (
                coachMessages.map((message, idx) => (
                  <div
                    key={`${message.role}-${idx}`}
                    className={`rounded-lg px-3 py-2 text-xs whitespace-pre-wrap ${
                      message.role === "user"
                        ? "bg-[#071a36] text-white ml-8"
                        : "bg-gray-100 text-gray-700 mr-8"
                    }`}
                  >
                    {message.content}
                  </div>
                ))
              )}
              {coaching && (
                <div className="rounded-lg bg-white border border-gray-200 px-3 py-2 text-xs text-gray-500">
                  코칭 생성 중...
                </div>
              )}
            </div>

            <div className="p-3 border-t border-gray-100 bg-white">
              <textarea
                value={coachInput}
                onChange={(e) => setCoachInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    requestCoaching(coachInput);
                  }
                }}
                placeholder="코칭 요청을 입력하세요..."
                rows={2}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none resize-none focus:border-gray-400"
              />
              <div className="mt-2 flex justify-end">
                <button
                  onClick={() => requestCoaching(coachInput)}
                  disabled={coaching || !coachInput.trim()}
                  className="rounded-lg bg-[#071a36] px-4 py-2 text-sm font-medium text-white hover:bg-[#0a2146] disabled:opacity-50"
                >
                  {coaching ? "전송 중" : "전송"}
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <p className="text-lg font-semibold text-gray-900 mb-2">자기소개서를 삭제할까요?</p>
            <p className="text-sm text-gray-500 mb-5">삭제 후에는 복구할 수 없습니다.</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm text-white hover:bg-red-600 disabled:opacity-50"
              >
                {deleting ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
