"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  createResumeDocument,
  extractResumeJobPostingUrl,
  getResumeBuilderData,
  requestResumeJobPostingRewrite,
  updateDashboardProfileSection,
} from "@/lib/api/app";
import { extractJobImage, extractJobPdf } from "@/lib/api/backend";
import { hasResumeActivityLineOverrides } from "@/lib/resume-line-overrides";
import type { Activity } from "@/lib/types";
import type { MatchRewriteResponse } from "@/lib/types";
import {
  addResumeRewriteLine,
  applyResumeRewriteLine,
  appendJobPostingText,
  canRequestResumeRewrite,
  clearResumeRewriteLine,
  mapResumeRewriteActivityTitles,
  removeResumeRewriteLine,
  resolveResumeRewriteSectionType,
  updateResumeRewriteLine,
  type AppliedResumeRewriteLines,
} from "../_lib/resume-rewrite";

export function useResumeBuilder() {
  const router = useRouter();
  const lastSavedBioRef = useRef("");
  const bioSavingRef = useRef(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetJob, setTargetJob] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTypeTab, setActiveTypeTab] = useState<string>("전체");
  const templateId = "simple";
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [profile, setProfile] = useState<{
    name: string;
    bio?: string;
    avatar_url?: string | null;
    email: string;
    phone: string;
    self_intro: string;
    skills: string[];
    awards: string[];
    certifications: string[];
    languages: string[];
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
  const [jobPostingText, setJobPostingText] = useState("");
  const [jobPostingUrl, setJobPostingUrl] = useState("");
  const [jobImageFiles, setJobImageFiles] = useState<File[]>([]);
  const [jobPdfFile, setJobPdfFile] = useState<File | null>(null);
  const [jobPostingExtracting, setJobPostingExtracting] = useState(false);
  const [rewriteLoading, setRewriteLoading] = useState(false);
  const [rewriteError, setRewriteError] = useState<string | null>(null);
  const [rewriteResult, setRewriteResult] = useState<MatchRewriteResponse | null>(null);
  const [rewriteActivityTitles, setRewriteActivityTitles] = useState<Record<string, string>>({});
  const [appliedRewriteLines, setAppliedRewriteLines] = useState<AppliedResumeRewriteLines>({});

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

  const toggleSelect = (id: string) => {
    const wasSelected = selected.has(id);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (wasSelected) {
      setAppliedRewriteLines((prev) => clearResumeRewriteLine(prev, id));
    }
  };

  const addJobImageFiles = (files: FileList | null) => {
    const incoming = Array.from(files ?? []);
    if (incoming.length === 0) return;

    setJobImageFiles((prev) => {
      const next = new Map<string, File>();
      for (const file of [...prev, ...incoming]) {
        next.set(`${file.name}-${file.size}-${file.lastModified}`, file);
      }
      return Array.from(next.values());
    });
  };

  const removeJobImageFile = (target: File) => {
    setJobImageFiles((prev) =>
      prev.filter(
        (file) =>
          !(
            file.name === target.name &&
            file.size === target.size &&
            file.lastModified === target.lastModified
          )
      )
    );
  };

  const clearJobImageFiles = () => {
    setJobImageFiles([]);
  };

  const handleExtractJobUrl = async () => {
    if (!jobPostingUrl.trim() || jobPostingExtracting) return;

    setJobPostingExtracting(true);
    setRewriteError(null);
    try {
      const result = await extractResumeJobPostingUrl(jobPostingUrl);
      setJobPostingText((prev) => appendJobPostingText(prev, result.job_posting_text));
      setJobPostingUrl(result.final_url || jobPostingUrl);
    } catch (e) {
      setRewriteError(e instanceof Error ? e.message : "URL 공고 추출에 실패했습니다.");
    } finally {
      setJobPostingExtracting(false);
    }
  };

  const handleExtractJobImages = async () => {
    if (jobImageFiles.length === 0 || jobPostingExtracting) return;

    setJobPostingExtracting(true);
    setRewriteError(null);
    try {
      const results = await Promise.all(jobImageFiles.map((file) => extractJobImage(file)));
      const extractedText = results
        .map((result) => result.job_posting_text?.trim() ?? "")
        .filter(Boolean)
        .join("\n\n---\n\n");

      if (!extractedText) {
        throw new Error("선택한 이미지에서 공고 텍스트를 추출하지 못했습니다.");
      }

      setJobPostingText((prev) => appendJobPostingText(prev, extractedText));
    } catch (e) {
      setRewriteError(e instanceof Error ? e.message : "이미지 공고 추출에 실패했습니다.");
    } finally {
      setJobPostingExtracting(false);
    }
  };

  const handleExtractJobPdf = async () => {
    if (!jobPdfFile || jobPostingExtracting) return;

    setJobPostingExtracting(true);
    setRewriteError(null);
    try {
      const result = await extractJobPdf(jobPdfFile);
      const extractedText = result.job_posting_text?.trim() ?? "";
      if (!extractedText) {
        throw new Error("PDF에서 추출된 공고 텍스트가 비어 있습니다.");
      }

      setJobPostingText((prev) => appendJobPostingText(prev, extractedText));
    } catch (e) {
      setRewriteError(e instanceof Error ? e.message : "PDF 공고 추출에 실패했습니다.");
    } finally {
      setJobPostingExtracting(false);
    }
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

  const handleGenerateRewriteSuggestions = async (selectedActivities: Activity[]) => {
    if (rewriteLoading) return;

    setRewriteError(null);
    setRewriteResult(null);

    if (
      !canRequestResumeRewrite({
        selectedCount: selectedActivities.length,
        targetJob,
        jobPostingText,
        loading: rewriteLoading,
      })
    ) {
      setRewriteError("지원 직무, 50자 이상의 공고 텍스트, 선택한 성과가 필요합니다.");
      return;
    }

    setRewriteLoading(true);
    try {
      const result = await requestResumeJobPostingRewrite({
        job_posting_text: jobPostingText,
        job_title: targetJob,
        activity_ids: selectedActivities.map((activity) => activity.id),
        section_type: resolveResumeRewriteSectionType(selectedActivities),
      });

      setRewriteActivityTitles(mapResumeRewriteActivityTitles(selectedActivities));
      setRewriteResult(result);
    } catch (e) {
      setRewriteError(e instanceof Error ? e.message : "문장 후보 생성에 실패했습니다.");
    } finally {
      setRewriteLoading(false);
    }
  };

  const handleApplyRewriteSuggestion = (activityId: string, text: string) => {
    setAppliedRewriteLines((prev) => applyResumeRewriteLine(prev, activityId, text));
  };

  const handleClearRewriteSuggestion = (activityId: string) => {
    setAppliedRewriteLines((prev) => clearResumeRewriteLine(prev, activityId));
  };

  const handleUpdateRewriteLine = (activityId: string, lineIndex: number, text: string) => {
    setAppliedRewriteLines((prev) => updateResumeRewriteLine(prev, activityId, lineIndex, text));
  };

  const handleAddRewriteLine = (activityId: string) => {
    setAppliedRewriteLines((prev) => addResumeRewriteLine(prev, activityId));
  };

  const handleRemoveRewriteLine = (activityId: string, lineIndex: number) => {
    setAppliedRewriteLines((prev) => removeResumeRewriteLine(prev, activityId, lineIndex));
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
        activity_line_overrides: appliedRewriteLines,
      });

      const params = new URLSearchParams({ resumeId: data.id });
      if (
        data.activity_line_overrides_saved === false &&
        hasResumeActivityLineOverrides(appliedRewriteLines)
      ) {
        params.set("notice", "activityOverridesNotSaved");
      }

      router.push(`/dashboard/documents?${params.toString()}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "이력서 저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return {
    activities,
    selected,
    targetJob,
    setTargetJob,
    loading,
    saving,
    error,
    activeTypeTab,
    setActiveTypeTab,
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
    jobPostingText,
    setJobPostingText,
    jobPostingUrl,
    setJobPostingUrl,
    jobImageFiles,
    addJobImageFiles,
    removeJobImageFile,
    clearJobImageFiles,
    jobPdfFile,
    setJobPdfFile,
    jobPostingExtracting,
    rewriteLoading,
    rewriteError,
    rewriteResult,
    rewriteActivityTitles,
    appliedRewriteLines,
    toggleSelect,
    saveBio,
    handleExtractJobUrl,
    handleExtractJobImages,
    handleExtractJobPdf,
    handleChatSend,
    handleGenerateRewriteSuggestions,
    handleApplyRewriteSuggestion,
    handleClearRewriteSuggestion,
    handleUpdateRewriteLine,
    handleAddRewriteLine,
    handleRemoveRewriteLine,
    handleCreateResume,
  };
}
