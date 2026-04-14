"use client";

import { useEffect, useState } from "react";

import { createMatchAnalysis, deleteMatchAnalysis, getMatchDashboardData } from "@/lib/api/app";
import { analyzeMatch, extractJobImage, extractJobPdf } from "@/lib/api/backend";
import { getGuestActivities, getGuestResume, isGuestMode } from "@/lib/guest";
import type { MatchResult } from "@/lib/types";

export type SavedAnalysisCard = {
  id: string;
  job_title: string;
  job_posting: string;
  total_score: number;
  grade: string;
  summary: string;
  created_at: string;
  result: MatchResult | null;
};

export type AnalysisMode = "resume" | "activity" | null;

export type ResumeOption = {
  id: string;
  title: string;
  target_job: string | null;
  selected_activity_ids: string[] | null;
  created_at: string;
};

function makeJobTitle(company: string, position: string): string {
  const c = company.trim();
  const p = position.trim();
  if (c && p) return `${c} ${p}`;
  if (c) return c;
  if (p) return p;
  return "제목 미지정 공고";
}

export function useMatchPage() {
  const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysisCard[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<SavedAnalysisCard | null>(null);
  const [showInputModal, setShowInputModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>(null);
  const [companyName, setCompanyName] = useState("");
  const [positionName, setPositionName] = useState("");
  const [jobPosting, setJobPosting] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [resumeOptions, setResumeOptions] = useState<ResumeOption[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState("");
  const [loadingResumes, setLoadingResumes] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingAnalyze, setLoadingAnalyze] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const addImageFiles = (files: FileList | null) => {
    const incoming = Array.from(files ?? []);
    if (incoming.length === 0) return;
    setImageFiles((prev) => {
      const map = new Map<string, File>();
      [...prev, ...incoming].forEach((f) => {
        map.set(`${f.name}-${f.size}-${f.lastModified}`, f);
      });
      return Array.from(map.values());
    });
  };

  const removeImageFile = (target: File) => {
    setImageFiles((prev) =>
      prev.filter(
        (f) =>
          !(f.name === target.name && f.size === target.size && f.lastModified === target.lastModified)
      )
    );
  };

  const clearImageFiles = () => {
    setImageFiles([]);
  };

  const loadResumeOptions = async () => {
    setLoadingResumes(true);
    try {
      if (isGuestMode()) {
        const guestResume = getGuestResume();
        if (!guestResume) {
          setResumeOptions([]);
          return;
        }
        setResumeOptions([
          {
            id: guestResume.id,
            title: guestResume.title ?? "게스트 이력서",
            target_job: guestResume.target_job ?? null,
            selected_activity_ids: guestResume.selected_activity_ids ?? [],
            created_at: guestResume.created_at ?? new Date().toISOString(),
          },
        ]);
        return;
      }

      const data = await getMatchDashboardData();
      setResumeOptions((data.resumeOptions as ResumeOption[] | null) ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "이력서 목록을 불러오는 중 오류가 발생했습니다.");
      setResumeOptions([]);
    } finally {
      setLoadingResumes(false);
    }
  };

  const loadSavedAnalyses = async () => {
    if (isGuestMode()) {
      setSavedAnalyses([]);
      return;
    }
    setLoadingList(true);
    try {
      const data = await getMatchDashboardData();
      setSavedAnalyses((data.savedAnalyses as SavedAnalysisCard[] | null) ?? []);
      setResumeOptions((data.resumeOptions as ResumeOption[] | null) ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "분석 목록을 불러오는 중 오류가 발생했습니다.");
      setSavedAnalyses([]);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    void loadSavedAnalyses();
  }, []);

  const handleExtractImage = async () => {
    if (imageFiles.length === 0) {
      setError("먼저 이미지 파일을 1개 이상 선택해 주세요.");
      return;
    }
    setExtracting(true);
    setError(null);
    try {
      const extractedChunks: string[] = [];
      for (const file of imageFiles) {
        const extracted = await extractJobImage(file);
        const extractedText = extracted?.job_posting_text || "";
        if (extractedText.trim()) extractedChunks.push(extractedText.trim());
      }
      if (extractedChunks.length === 0) {
        throw new Error("선택한 이미지들에서 공고 텍스트를 추출하지 못했습니다.");
      }
      const joined = extractedChunks.join("\n\n---\n\n");
      setJobPosting((prev) => (prev.trim() ? `${prev}\n\n${joined}` : joined));
    } catch (err) {
      setError(err instanceof Error ? err.message : "이미지 공고 추출 중 오류가 발생했습니다.");
    } finally {
      setExtracting(false);
    }
  };

  const handleExtractPdf = async () => {
    if (!pdfFile) {
      setError("먼저 PDF 파일을 선택해 주세요.");
      return;
    }
    setExtracting(true);
    setError(null);
    try {
      const extracted = await extractJobPdf(pdfFile);
      const extractedText = extracted?.job_posting_text || "";
      if (!extractedText.trim()) throw new Error("PDF에서 추출된 공고 텍스트가 비어 있습니다.");
      setJobPosting((prev) => (prev.trim() ? `${prev}\n\n${extractedText.trim()}` : extractedText.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF 공고 추출 중 오류가 발생했습니다.");
    } finally {
      setExtracting(false);
    }
  };

  const handleAnalyze = async () => {
    if (!jobPosting.trim()) {
      setError("공고 전문을 입력해 주세요.");
      return;
    }
    if (!companyName.trim()) {
      setError("회사명을 입력해 주세요.");
      return;
    }
    if (!positionName.trim()) {
      setError("직무명을 입력해 주세요.");
      return;
    }
    if (!analysisMode) {
      setError("먼저 분석 방식을 선택해 주세요.");
      return;
    }
    if (analysisMode === "resume" && !selectedResumeId) {
      setError("분석할 이력서를 선택해 주세요.");
      return;
    }

    setLoadingAnalyze(true);
    setError(null);
    setSaveNotice(null);

    try {
      let activities: { id: string; title: string; description: string | null }[] = [];
      let profileContext: {
        name?: string;
        education?: string;
        career?: string[];
        education_history?: string[];
        awards?: string[];
        certifications?: string[];
        languages?: string[];
        skills?: string[];
        self_intro?: string;
      } = {};

      if (isGuestMode()) {
        const allGuestActivities = getGuestActivities().map((item) => ({
          id: item.id,
          title: item.title,
          description: item.description,
        }));
        if (analysisMode === "resume") {
          const guestResume = getGuestResume();
          const selectedIds = new Set(guestResume?.selected_activity_ids ?? []);
          activities = allGuestActivities.filter((item) => selectedIds.has(item.id));
          if (activities.length === 0) {
            throw new Error("선택한 이력서에 연결된 활동이 없습니다.");
          }
        } else {
          activities = allGuestActivities;
        }

        profileContext = {
          name: "게스트 사용자",
          education: "게스트 모드",
          career: ["게스트 QA 경력"],
          education_history: ["게스트 학력"],
          awards: [],
          certifications: [],
          languages: ["한국어"],
          skills: ["Next.js", "FastAPI"],
          self_intro: "게스트 모드 프로필",
        };
      }

      if (!isGuestMode()) {
        const result = await createMatchAnalysis({
          companyName,
          positionName,
          jobPosting,
          analysisMode,
          selectedResumeId: analysisMode === "resume" ? selectedResumeId : undefined,
        });
        await loadSavedAnalyses();
        setSelectedAnalysis(result.analysis as SavedAnalysisCard);
      } else {
        const matchResult = await analyzeMatch({
          job_posting: jobPosting,
          activities,
          profile_context: profileContext,
        });
        setSelectedAnalysis({
          id: `tmp-${Date.now()}`,
          job_title: makeJobTitle(companyName, positionName),
          job_posting: jobPosting,
          total_score: matchResult.total_score,
          grade: matchResult.grade,
          summary: matchResult.summary,
          created_at: new Date().toISOString(),
          result: matchResult,
        });
      }

      setShowDetailModal(true);
      setShowInputModal(false);
      setSaveNotice("분석이 완료되어 저장되었습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "분석 중 오류가 발생했습니다.");
    } finally {
      setLoadingAnalyze(false);
    }
  };

  const handleDeleteSavedAnalysis = async (item: SavedAnalysisCard) => {
    const ok = window.confirm(`"${item.job_title}" 분석 결과를 삭제할까요?`);
    if (!ok) return;
    setDeletingId(item.id);
    setError(null);
    setSaveNotice(null);
    try {
      if (!isGuestMode()) {
        await deleteMatchAnalysis(item.id);
      }
      await loadSavedAnalyses();
      if (selectedAnalysis?.id === item.id) {
        setShowDetailModal(false);
        setSelectedAnalysis(null);
      }
      setSaveNotice("선택한 분석 결과를 삭제했습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제 중 오류가 발생했습니다.");
    } finally {
      setDeletingId(null);
    }
  };

  const openInputModal = () => {
    setCompanyName("");
    setPositionName("");
    setJobPosting("");
    setImageFiles([]);
    setPdfFile(null);
    setAnalysisMode(null);
    setSelectedResumeId("");
    setResumeOptions([]);
    setError(null);
    setSaveNotice(null);
    setShowInputModal(true);
  };

  return {
    savedAnalyses,
    selectedAnalysis,
    setSelectedAnalysis,
    showInputModal,
    setShowInputModal,
    showDetailModal,
    setShowDetailModal,
    analysisMode,
    setAnalysisMode,
    companyName,
    setCompanyName,
    positionName,
    setPositionName,
    jobPosting,
    setJobPosting,
    imageFiles,
    pdfFile,
    setPdfFile,
    resumeOptions,
    selectedResumeId,
    setSelectedResumeId,
    loadingResumes,
    loadingList,
    loadingAnalyze,
    deletingId,
    extracting,
    error,
    saveNotice,
    addImageFiles,
    clearImageFiles,
    removeImageFile,
    loadResumeOptions,
    handleExtractImage,
    handleExtractPdf,
    handleAnalyze,
    handleDeleteSavedAnalysis,
    openInputModal,
  };
}
