"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  createResumeDocument,
  getResumeBuilderData,
  getResumePrefill,
  updateDashboardProfileSection,
} from "@/lib/api/app";
import type { Activity, ResumePrefillData } from "@/lib/types";

export function useResumeBuilder() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastSavedBioRef = useRef("");
  const bioSavingRef = useRef(false);
  const selectedRef = useRef<Set<string>>(new Set());
  const targetJobRef = useRef("");
  const summaryDraftRef = useRef("");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetJob, setTargetJob] = useState("");
  const [summaryDraft, setSummaryDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTypeTab, setActiveTypeTab] = useState<string>("전체");
  const [templateId, setTemplateId] = useState<string>("simple");
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [profile, setProfile] = useState<{
    name: string;
    bio?: string;
    email: string;
    phone: string;
    self_intro: string;
    skills: string[];
  } | null>(null);
  const [bioInput, setBioInput] = useState("");
  const [bioSaving, setBioSaving] = useState(false);
  const [leftMainTab, setLeftMainTab] = useState<"성과저장소" | "자기소개서">("성과저장소");
  const [leftSubTab, setLeftSubTab] = useState<string>("회사경력");
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const [coverLetterTab, setCoverLetterTab] = useState<"공통질문" | "회사맞춤질문" | "직접입력">(
    "공통질문"
  );
  const [selectedCommonQuestions, setSelectedCommonQuestions] = useState<Set<string>>(new Set());
  const [customQuestion, setCustomQuestion] = useState("");
  const [customQuestionInput, setCustomQuestionInput] = useState("");
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [prefillData, setPrefillData] = useState<ResumePrefillData | null>(null);
  const [pendingPrefill, setPendingPrefill] = useState<ResumePrefillData | null>(null);
  const [autoSelectedIds, setAutoSelectedIds] = useState<Set<string>>(new Set());
  const [sourceProgramId, setSourceProgramId] = useState<string | null>(null);
  const prefillProgramId = searchParams.get("prefill_program_id")?.trim() || null;

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    targetJobRef.current = targetJob;
  }, [targetJob]);

  useEffect(() => {
    summaryDraftRef.current = summaryDraft;
  }, [summaryDraft]);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const data = await getResumeBuilderData();
        setActivities(data.activities || []);
        setProfile(data.profile);
        setBioInput(data.profile?.bio ?? "");
        lastSavedBioRef.current = (data.profile?.bio ?? "").trim();
      } catch (e) {
        setError(e instanceof Error ? e.message : "활동을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };

    void fetchActivities();
  }, []);

  const applyPrefill = (prefill: ResumePrefillData) => {
    setPrefillData(prefill);
    setPendingPrefill(null);
    setTargetJob(prefill.target_job);
    setSummaryDraft(prefill.summary);
    setSelected(new Set(prefill.selected_activity_ids));
    setAutoSelectedIds(new Set(prefill.auto_selected_activity_ids));
    setSourceProgramId(prefill.status === "missing_program" ? null : prefill.program_id);
  };

  useEffect(() => {
    if (loading || !prefillProgramId) {
      return;
    }

    let cancelled = false;

    const fetchPrefill = async () => {
      try {
        setPrefillLoading(true);
        const data = await getResumePrefill(prefillProgramId);
        if (cancelled || !data.prefill) return;

        const hasDraft =
          selectedRef.current.size > 0 ||
          targetJobRef.current.trim().length > 0 ||
          summaryDraftRef.current.trim().length > 0;
        const shouldDeferApply = hasDraft && data.prefill.status !== "missing_program";

        setPrefillData(data.prefill);
        if (shouldDeferApply) {
          setPendingPrefill(data.prefill);
          return;
        }

        if (data.prefill.status !== "missing_program") {
          applyPrefill(data.prefill);
          return;
        }

        setSourceProgramId(null);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "프리필 데이터를 불러오지 못했습니다.");
        }
      } finally {
        if (!cancelled) {
          setPrefillLoading(false);
        }
      }
    };

    void fetchPrefill();

    return () => {
      cancelled = true;
    };
  }, [loading, prefillProgramId]);

  const toggleSelect = (id: string) => {
    setAutoSelectedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const saveBio = async () => {
    const nextBio = bioInput.trim();
    if (bioSavingRef.current || nextBio === lastSavedBioRef.current) return;

    try {
      bioSavingRef.current = true;
      setBioSaving(true);
      await updateDashboardProfileSection({ bio: nextBio });
      lastSavedBioRef.current = nextBio;
      setProfile((prev) => (prev ? { ...prev, bio: nextBio } : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : "bio 저장에 실패했습니다.");
    } finally {
      bioSavingRef.current = false;
      setBioSaving(false);
    }
  };

  const handleChatSend = async (selectedActivities: Activity[]) => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setChatInput("");
    setChatLoading(true);
    try {
      const res = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `당신은 이력서 작성 전문 AI 코치입니다.
사용자가 선택한 활동 목록: ${selectedActivities.map((a) => a.title).join(", ")}
지원 직무: ${targetJob || "미입력"}

사용자 질문: ${userMsg}

이력서 개선에 도움이 되는 구체적인 피드백을 3~5문장으로 작성해주세요.`,
        }),
      });
      const data = await res.json();
      setChatMessages((prev) => [
        ...prev,
        { role: "ai", text: data.summary || "응답을 가져오지 못했습니다." },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleCreateResume = async () => {
    setSaving(true);
    setError(null);
    try {
      const data = await createResumeDocument({
        title: `이력서 ${new Date().toISOString().slice(0, 10)}`,
        target_job: targetJob || null,
        template_id: templateId,
        selected_activity_ids: Array.from(selected),
        source_program_id: sourceProgramId,
      });

      router.push(`/dashboard/documents?resumeId=${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "이력서 저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const applyPendingPrefill = () => {
    if (!pendingPrefill) return;
    applyPrefill(pendingPrefill);
  };

  const resetPrefill = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("prefill_program_id");
    router.replace(params.size > 0 ? `${pathname}?${params.toString()}` : pathname);
    setPrefillData(null);
    setPendingPrefill(null);
    setAutoSelectedIds(new Set());
    setSourceProgramId(null);
    setTargetJob("");
    setSummaryDraft("");
    setSelected(new Set());
  };

  return {
    activities,
    selected,
    targetJob,
    setTargetJob,
    summaryDraft,
    setSummaryDraft,
    loading,
    saving,
    error,
    activeTypeTab,
    setActiveTypeTab,
    templateId,
    setTemplateId,
    chatMessages,
    chatInput,
    setChatInput,
    chatLoading,
    profile,
    bioInput,
    setBioInput,
    bioSaving,
    leftMainTab,
    setLeftMainTab,
    leftSubTab,
    setLeftSubTab,
    selectedSkills,
    setSelectedSkills,
    coverLetterTab,
    setCoverLetterTab,
    selectedCommonQuestions,
    setSelectedCommonQuestions,
    customQuestion,
    setCustomQuestion,
    customQuestionInput,
    setCustomQuestionInput,
    prefillLoading,
    prefillData,
    pendingPrefill,
    autoSelectedIds,
    toggleSelect,
    saveBio,
    handleChatSend,
    handleCreateResume,
    applyPendingPrefill,
    resetPrefill,
  };
}
