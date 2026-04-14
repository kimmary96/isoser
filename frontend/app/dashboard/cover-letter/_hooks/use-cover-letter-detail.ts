"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  createCoverLetter,
  deleteCoverLetter,
  getCoverLetterDetail,
  requestCoverLetterCoaching,
  updateCoverLetter,
} from "@/lib/api/app";
import type { CoverLetter } from "@/lib/types";

const ANSWER_MAX_LENGTH = 3000;

export type QaItem = {
  question: string;
  answer: string;
};

export type CoverLetterCoachMessage = {
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
        const q =
          typeof (item as { question?: unknown }).question === "string"
            ? (item as { question: string }).question
            : "";
        const a =
          typeof (item as { answer?: unknown }).answer === "string"
            ? (item as { answer: string }).answer
            : "";
        return { question: q, answer: a.slice(0, ANSWER_MAX_LENGTH) };
      })
      .filter((item) => item.question.trim() || item.answer.trim());
    if (parsed.length > 0) return parsed;
  }

  return [{ question: fallbackQuestion || "", answer: (fallbackContent || "").slice(0, ANSWER_MAX_LENGTH) }];
}

function buildCombinedContent(items: QaItem[]): string {
  return items
    .map((item, idx) => `문항 ${idx + 1}\nQ. ${item.question}\nA. ${item.answer}`)
    .join("\n\n");
}

export function useCoverLetterDetail(letterId: string, isNew: boolean) {
  const router = useRouter();
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
  const [coachMessages, setCoachMessages] = useState<CoverLetterCoachMessage[]>([]);
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

        const result = await getCoverLetterDetail(letterId);
        if (!result.coverLetter) throw new Error("자기소개서를 찾을 수 없습니다.");
        const next = result.coverLetter;
        setItem(next);
        setTitle(next.title);
        setCompanyName(next.company_name || "");
        setJobTitle(next.job_title || "");
        setTagInput(toTagInput(next.tags));
        setQaItems(normalizeQaItems(next.qa_items, next.prompt_question, next.content || ""));
        setActiveQaIndex(0);
      } catch (e) {
        setError(e instanceof Error ? e.message : "자기소개서를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };

    void fetchItem();
  }, [isNew, letterId]);

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

    if (usedItems.length === 0) missing.push("문항/답변");
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
      const firstItem = usedItems[0];
      const combinedContent = buildCombinedContent(usedItems);

      const payload = {
        title: title.trim(),
        company_name: companyName.trim() || null,
        job_title: jobTitle.trim() || null,
        prompt_question: firstItem.question,
        content: combinedContent,
        qa_items: usedItems,
        tags,
      };

      if (isNew) {
        const result = await createCoverLetter(payload);
        router.replace(`/dashboard/cover-letter/${result.coverLetter.id}`);
        return;
      }

      const result = await updateCoverLetter(letterId, payload);
      setItem(result.coverLetter);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const requestCoaching = async (requestText: string) => {
    const trimmed = requestText.trim();
    if (!trimmed) return;
    const userMessage: CoverLetterCoachMessage = { role: "user", content: trimmed };
    const nextHistory = [...coachMessages, userMessage];
    setCoaching(true);
    setCoachMessages(nextHistory);
    setCoachInput("");
    try {
      const result = await requestCoverLetterCoaching({
        session_id: coachSessionId,
        activity_description: [
          `자기소개서 문항 코칭 요청`,
          `[지원 회사] ${companyName || "(미입력)"}`,
          `[지원 직무] ${coachJobTitle || jobTitle || "(미입력)"}`,
          `[현재 문항] ${activeQa.question || "(미입력)"}`,
          `[현재 답변] ${activeQa.answer || "(미입력)"}`,
          `[추가 요청] ${trimmed}`,
        ].join("\n"),
        job_title: coachJobTitle || jobTitle || "일반",
        section_type: "요약",
        history: nextHistory,
      });

      setCoachSessionId(result.session_id);
      setCoachMessages(result.updated_history);
    } catch (e) {
      const message = e instanceof Error ? e.message : "AI 코칭 요청에 실패했습니다.";
      setCoachMessages([...nextHistory, { role: "assistant", content: `코칭 중 오류가 발생했습니다: ${message}` }]);
    } finally {
      setCoaching(false);
    }
  };

  const handleDelete = async () => {
    if (isNew) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteCoverLetter(letterId);
      router.push("/dashboard/cover-letter");
    } catch (e) {
      setError(e instanceof Error ? e.message : "삭제에 실패했습니다.");
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  return {
    router,
    item,
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
  };
}
