"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { getCoachFeedback } from "@/lib/api/backend";
import {
  deleteGuestCoverLetter,
  getGuestCoverLetterById,
  isGuestMode,
  saveGuestCoverLetter,
} from "@/lib/guest";
import { createBrowserClient } from "@/lib/supabase/client";
import type { CoverLetter } from "@/lib/types";

const ANSWER_MAX_LENGTH = 3000;

type QaItem = {
  question: string;
  answer: string;
};

type CoachMessage = {
  role: "user" | "assistant";
  content: string;
};

function splitTags(raw: string): string[] {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 10);
}

function toTagInput(tags: string[] | null): string {
  if (!Array.isArray(tags) || tags.length === 0) return "";
  return tags.join(", ");
}

function normalizeQaItems(raw: unknown, fallbackQuestion: string | null, fallbackContent: string): QaItem[] {
  if (Array.isArray(raw)) {
    const parsed = raw
      .map((item) => {
        const q = typeof (item as { question?: unknown }).question === "string"
          ? (item as { question: string }).question
          : "";
        const a = typeof (item as { answer?: unknown }).answer === "string"
          ? (item as { answer: string }).answer
          : "";
        return { question: q, answer: a.slice(0, ANSWER_MAX_LENGTH) };
      })
      .filter((item) => item.question.trim() || item.answer.trim());
    if (parsed.length > 0) return parsed;
  }

  const question = fallbackQuestion || "";
  const answer = (fallbackContent || "").slice(0, ANSWER_MAX_LENGTH);
  return [{ question, answer }];
}

function buildCombinedContent(items: QaItem[]): string {
  return items
    .map((item, idx) => `문항 ${idx + 1}\nQ. ${item.question}\nA. ${item.answer}`)
    .join("\n\n");
}

function isQaColumnMissingError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42703") return true;
  return (error.message || "").toLowerCase().includes("qa_items");
}

export default function CoverLetterDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(), []);

  const letterId = params.id as string;
  const isNew = letterId === "new";

  const [item, setItem] = useState<CoverLetter | null>(null);
  const [title, setTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [qaItems, setQaItems] = useState<QaItem[]>([{ question: "", answer: "" }]);
  const [activeQaIndex, setActiveQaIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coachMessages, setCoachMessages] = useState<CoachMessage[]>([]);
  const [coachInput, setCoachInput] = useState("");
  const [coachJobTitle, setCoachJobTitle] = useState("");
  const [coachSessionId, setCoachSessionId] = useState<string | undefined>(undefined);
  const [coaching, setCoaching] = useState(false);

  const activeQa = qaItems[activeQaIndex] || { question: "", answer: "" };

  useEffect(() => {
    const fetchItem = async () => {
      setLoading(true);
      setError(null);

      try {
        if (isNew) {
          setItem(null);
          setTitle("");
          setCompanyName("");
          setJobTitle("");
          setTagInput("");
          setQaItems([{ question: "", answer: "" }]);
          setActiveQaIndex(0);
          return;
        }

        if (isGuestMode()) {
          const found = getGuestCoverLetterById(letterId);
          if (!found) {
            throw new Error("자기소개서를 찾을 수 없습니다.");
          }
          setItem(found);
          setTitle(found.title);
          setCompanyName(found.company_name || "");
          setJobTitle(found.job_title || "");
          setTagInput(toTagInput(found.tags));
          const normalized = normalizeQaItems(found.qa_items, found.prompt_question, found.content || "");
          setQaItems(normalized);
          setActiveQaIndex(0);
          return;
        }

        const { data, error: queryError } = await supabase
          .from("cover_letters")
          .select("*")
          .eq("id", letterId)
          .single();

        if (queryError) {
          throw new Error(queryError.message);
        }

        const next = data as CoverLetter;
        setItem(next);
        setTitle(next.title);
        setCompanyName(next.company_name || "");
        setJobTitle(next.job_title || "");
        setTagInput(toTagInput(next.tags));
        const normalized = normalizeQaItems(next.qa_items, next.prompt_question, next.content || "");
        setQaItems(normalized);
        setActiveQaIndex(0);
      } catch (e) {
        setError(e instanceof Error ? e.message : "자기소개서를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchItem();
  }, [isNew, letterId, supabase]);

  const updateQaItem = (index: number, patch: Partial<QaItem>) => {
    setQaItems((prev) => prev.map((entry, idx) => (idx === index ? { ...entry, ...patch } : entry)));
  };

  const handleAddQuestion = () => {
    if (qaItems.length >= 10) return;
    setQaItems((prev) => [...prev, { question: "", answer: "" }]);
    setActiveQaIndex(qaItems.length);
  };

  const handleRemoveQuestion = () => {
    if (qaItems.length <= 1) return;
    setQaItems((prev) => prev.filter((_, idx) => idx !== activeQaIndex));
    setActiveQaIndex((prev) => Math.max(0, prev - 1));
  };

  const handleSave = async () => {
    const missing: string[] = [];
    if (!title.trim()) missing.push("제목");
    if (!companyName.trim()) missing.push("회사명");
    if (!jobTitle.trim()) missing.push("지원 직무");

    const normalized = qaItems.map((entry) => ({
      question: entry.question.trim(),
      answer: entry.answer.slice(0, ANSWER_MAX_LENGTH).trim(),
    }));
    const usedItems = normalized.filter((entry) => entry.question || entry.answer);

    if (usedItems.length === 0) {
      missing.push("문항/답변");
    }
    if (usedItems.some((entry) => !entry.question || !entry.answer)) {
      setError("각 문항은 질문과 답변을 모두 입력해야 저장할 수 있습니다.");
      return;
    }

    if (missing.length > 0) {
      setError(`필수 항목을 입력해 주세요: ${missing.join(", ")}`);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const tags = splitTags(tagInput);
      const now = new Date().toISOString();
      const firstItem = usedItems[0];
      const combinedContent = buildCombinedContent(usedItems);

      if (isGuestMode()) {
        const next: CoverLetter = {
          id: item?.id || crypto.randomUUID(),
          user_id: "guest",
          title: title.trim(),
          company_name: companyName.trim() || null,
          job_title: jobTitle.trim() || null,
          prompt_question: firstItem.question,
          content: combinedContent,
          qa_items: usedItems,
          tags: tags.length > 0 ? tags : null,
          created_at: item?.created_at || now,
          updated_at: now,
        };
        saveGuestCoverLetter(next);
        setItem(next);
        setQaItems(usedItems);
        if (isNew) {
          router.replace(`/dashboard/cover-letter/${next.id}`);
        }
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("로그인이 필요합니다.");
      }

      const payload = {
        title: title.trim(),
        company_name: companyName.trim() || null,
        job_title: jobTitle.trim() || null,
        prompt_question: firstItem.question,
        content: combinedContent,
        qa_items: usedItems,
        tags: tags.length > 0 ? tags : [],
      };
      const legacyPayload = {
        title: title.trim(),
        company_name: companyName.trim() || null,
        job_title: jobTitle.trim() || null,
        prompt_question: firstItem.question,
        content: combinedContent,
        tags: tags.length > 0 ? tags : [],
      };

      if (isNew) {
        let { data, error: insertError } = await supabase
          .from("cover_letters")
          .insert({ user_id: user.id, ...payload })
          .select("*")
          .single();
        if (isQaColumnMissingError(insertError)) {
          const retry = await supabase
            .from("cover_letters")
            .insert({ user_id: user.id, ...legacyPayload })
            .select("*")
            .single();
          data = retry.data;
          insertError = retry.error;
        }
        if (insertError) {
          throw new Error(insertError.message);
        }
        router.replace(`/dashboard/cover-letter/${(data as CoverLetter).id}`);
        return;
      }

      let { error: updateError } = await supabase
        .from("cover_letters")
        .update(payload)
        .eq("id", letterId);
      if (isQaColumnMissingError(updateError)) {
        const retry = await supabase
          .from("cover_letters")
          .update(legacyPayload)
          .eq("id", letterId);
        updateError = retry.error;
      }
      if (updateError) {
        throw new Error(updateError.message);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const requestCoaching = async (requestText: string) => {
    const trimmed = requestText.trim();
    if (!trimmed) return;

    const userMessage: CoachMessage = { role: "user", content: trimmed };
    const nextHistory = [...coachMessages, userMessage];

    setCoaching(true);
    setCoachMessages(nextHistory);
    setCoachInput("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const activityDescription = [
        `자기소개서 문항 코칭 요청`,
        `[지원 회사] ${companyName || "(미입력)"}`,
        `[지원 직무] ${coachJobTitle || jobTitle || "(미입력)"}`,
        `[현재 문항] ${activeQa.question || "(미입력)"}`,
        `[현재 답변] ${activeQa.answer || "(미입력)"}`,
        `[추가 요청] ${trimmed}`,
      ].join("\n");

      const result = await getCoachFeedback({
        session_id: coachSessionId,
        user_id: user?.id ?? null,
        activity_description: activityDescription,
        job_title: coachJobTitle || jobTitle || "일반",
        section_type: "요약",
        history: nextHistory,
      });

      setCoachSessionId(result.session_id);
      setCoachMessages(result.updated_history);
    } catch (e) {
      const message = e instanceof Error ? e.message : "AI 코칭 요청에 실패했습니다.";
      setCoachMessages([
        ...nextHistory,
        { role: "assistant", content: `코칭 중 오류가 발생했습니다: ${message}` },
      ]);
    } finally {
      setCoaching(false);
    }
  };

  const handleDelete = async () => {
    if (isNew) return;
    setDeleting(true);
    setError(null);
    try {
      if (isGuestMode()) {
        deleteGuestCoverLetter(letterId);
        router.push("/dashboard/cover-letter");
        return;
      }

      const { error: deleteError } = await supabase
        .from("cover_letters")
        .delete()
        .eq("id", letterId);
      if (deleteError) throw new Error(deleteError.message);
      router.push("/dashboard/cover-letter");
    } catch (e) {
      setError(e instanceof Error ? e.message : "삭제에 실패했습니다.");
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">불러오는 중...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-5 py-8">
        <button
          onClick={() => router.push("/dashboard/cover-letter")}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
        >
          <span>←</span>
          목록으로
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-gray-400 mb-1">자기소개서 편집기</p>
                <h1 className="text-xl font-bold text-gray-900">
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
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-2 flex flex-col items-center gap-2">
                {qaItems.map((_, idx) => (
                  <button
                    key={`qa-tab-${idx}`}
                    onClick={() => setActiveQaIndex(idx)}
                    className={`h-8 w-8 rounded-md text-sm font-semibold ${
                      idx === activeQaIndex ? "bg-orange-500 text-white" : "bg-white text-gray-600 border border-gray-200"
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
                className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "저장 중..." : "저장하기"}
              </button>
            </div>
          </div>

          <aside className="rounded-2xl border border-gray-200 bg-white h-fit lg:sticky lg:top-6 overflow-hidden">
            <div className="px-4 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900 mb-3">AI 코치</h2>
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
                        ? "bg-gray-900 text-white ml-8"
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
                  className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
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
