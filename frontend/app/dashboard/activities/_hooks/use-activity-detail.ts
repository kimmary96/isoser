"use client";

import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  createActivity,
  deleteActivity,
  getActivityDetail,
  invalidateRecommendCache,
  requestActivityCoachChat,
  requestActivityCoaching,
  updateActivity,
  uploadActivityImages,
} from "@/lib/api/app";
import {
  convertActivity,
  generateActivityIntro,
  getSkillSuggestions,
} from "@/lib/api/backend";
import type { Activity, ActivityConvertRequest, CoachFeedbackResponse, CoachMessage } from "@/lib/types";
import {
  buildActivityCoachChatFallbackReply,
  buildActivityCoachChatPrompt,
  normalizeActivityCoachChatReply,
} from "../_lib/activity-coach-chat";
import { buildActivityCoachContext } from "../_lib/activity-coach-context";
import { buildActivityEvidenceText } from "../_lib/activity-evidence";
import { buildActivityIntroFallbackCandidates } from "../_lib/activity-intro-fallback";
import type { ActivityCoachRewriteCandidate } from "../_lib/activity-coach-insight";
import { buildActivityCoachInsight } from "../_lib/activity-coach-insight";
import {
  buildActivityStarImportDraft,
  hasActivityStarImportSource,
} from "../_lib/activity-star-import";

const PENDING_STAR_CONVERSION_KEY = "isoser:pending-star-conversion";
const PENDING_PORTFOLIO_CONVERSION_KEY = "isoser:pending-portfolio-conversion";

function appendUniqueDraft(current: string, next: string): string {
  const trimmedCurrent = current.trim();
  const trimmedNext = next.trim();
  if (!trimmedNext) return current;
  if (!trimmedCurrent) return trimmedNext;
  if (trimmedCurrent.includes(trimmedNext)) return current;
  return `${trimmedCurrent}\n\n${trimmedNext}`;
}

export function useActivityDetail(activityId: string, isNewActivity: boolean, initialTab?: string | null) {
  const router = useRouter();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [lastCoachResponse, setLastCoachResponse] = useState<CoachFeedbackResponse | null>(null);
  const [input, setInput] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [coachDiagnosisLoading, setCoachDiagnosisLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"basic" | "star">("basic");
  const [starSituation, setStarSituation] = useState("");
  const [starTask, setStarTask] = useState("");
  const [starAction, setStarAction] = useState("");
  const [starResult, setStarResult] = useState("");
  const [starSaving, setStarSaving] = useState(false);
  const [organization, setOrganization] = useState("");
  const [teamSize, setTeamSize] = useState(0);
  const [teamComposition, setTeamComposition] = useState("");
  const [myRole, setMyRole] = useState("");
  const [contributions, setContributions] = useState<string[]>([""]);
  const [titleDraft, setTitleDraft] = useState("");
  const [typeDraft, setTypeDraft] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [skillInput, setSkillInput] = useState("");
  const [skillsDraft, setSkillsDraft] = useState<string[]>([]);
  const [skillSuggestions, setSkillSuggestions] = useState<string[]>([]);
  const [skillSuggestionRoleLabel, setSkillSuggestionRoleLabel] = useState<string | null>(null);
  const [skillSuggestionLoading, setSkillSuggestionLoading] = useState(false);
  const [skillSuggestionError, setSkillSuggestionError] = useState<string | null>(null);
  const [introCandidates, setIntroCandidates] = useState<string[]>([]);
  const [introGenerateLoading, setIntroGenerateLoading] = useState(false);
  const [introGenerateError, setIntroGenerateError] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [imageUploading, setImageUploading] = useState(false);
  const [basicSaving, setBasicSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPostSaveModal, setShowPostSaveModal] = useState(false);
  const [postSaveActivity, setPostSaveActivity] = useState<Activity | null>(null);
  const [postSaveAction, setPostSaveAction] = useState<"star" | "portfolio" | null>(null);
  const [starSaveToast, setStarSaveToast] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (initialTab === "star") setActiveTab("star");
  }, [initialTab]);

  useEffect(() => {
    if (!starSaveToast) return;
    const timer = window.setTimeout(() => setStarSaveToast(null), 2500);
    return () => window.clearTimeout(timer);
  }, [starSaveToast]);

  useEffect(() => {
    const fetchActivity = async () => {
      setLastCoachResponse(null);
      const now = new Date().toISOString();
      const blankActivity: Activity = {
        id: "new",
        user_id: "new",
        type: "프로젝트",
        title: "새 성과 기록",
        period: null,
        role: null,
        skills: null,
        description: null,
        is_visible: true,
        created_at: now,
        updated_at: now,
      };

      try {
        if (isNewActivity) {
          setActivity(blankActivity);
          setDescriptionDraft("");
          setTitleDraft(blankActivity.title || "");
          setTypeDraft(blankActivity.type || "");
          setPeriodStart("");
          setPeriodEnd("");
          setSkillsDraft(Array.isArray(blankActivity.skills) ? blankActivity.skills : []);
          setLoading(false);
          return;
        }
        const data = await getActivityDetail(activityId);
        const loaded = data.activity;
        if (!loaded) throw new Error("활동을 찾을 수 없습니다.");
        setActivity(loaded);
        setDescriptionDraft(loaded.description ?? "");
        setStarSituation(loaded.star_situation || "");
        setStarTask(loaded.star_task || "");
        setStarAction(loaded.star_action || "");
        setStarResult(loaded.star_result || "");
        setOrganization(loaded.organization || "");
        setTeamSize(loaded.team_size || 0);
        setTeamComposition(loaded.team_composition || "");
        setMyRole(loaded.my_role || "");
        setContributions(loaded.contributions?.length ? loaded.contributions : [""]);
        setImageUrls(loaded.image_urls || []);
        setTitleDraft(loaded.title || "");
        setTypeDraft(loaded.type || "");
        const parts = (loaded.period || "").split(/\s*(?:~|–|—|-)\s*/);
        setPeriodStart(parts[0]?.trim() || "");
        setPeriodEnd(parts[1]?.trim() || "");
        setSkillsDraft(Array.isArray(loaded.skills) ? loaded.skills : []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "활동을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };
    void fetchActivity();
  }, [activityId, isNewActivity]);

  useEffect(() => {
    setSkillSuggestions([]);
    setSkillSuggestionRoleLabel(null);
    setSkillSuggestionError(null);
  }, [myRole]);

  useEffect(() => {
    setIntroCandidates([]);
    setIntroGenerateError(null);
  }, [titleDraft, typeDraft, organization, myRole, contributions]);

  useEffect(() => {
    if (isNewActivity || loading || !activity || typeof window === "undefined" || initialTab !== "star") return;
    const raw = window.sessionStorage.getItem(PENDING_STAR_CONVERSION_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { activityId?: string; star?: Record<string, string> };
      if (parsed.activityId !== activityId || parsed.activityId !== activity.id || !parsed.star) return;
      setStarSituation(parsed.star.star_situation ?? "");
      setStarTask(parsed.star.star_task ?? "");
      setStarAction(parsed.star.star_action ?? "");
      setStarResult(parsed.star.star_result ?? "");
      window.sessionStorage.removeItem(PENDING_STAR_CONVERSION_KEY);
    } catch {
      window.sessionStorage.removeItem(PENDING_STAR_CONVERSION_KEY);
    }
  }, [activity, activityId, initialTab, isNewActivity, loading]);

  const filteredContributions = contributions.filter((c) => c.trim() !== "");
  const periodValue = periodStart && periodEnd ? `${periodStart} ~ ${periodEnd}` : periodStart || "";
  const contributionItems = contributions.map((item) => item.trim()).filter(Boolean);
  const hasContributionContent = contributionItems.length > 0;
  const hasCompleteStarDraft = [starSituation, starTask, starAction, starResult].every(
    (value) => value.trim().length > 0
  );
  const starImportSource = useMemo(
    () => ({
      title: titleDraft,
      type: typeDraft || activity?.type || "프로젝트",
      organization,
      period: periodValue,
      teamSize,
      teamComposition,
      myRole,
      skills: skillsDraft,
      contributions: contributionItems,
      description: descriptionDraft,
    }),
    [
      activity?.type,
      contributionItems,
      descriptionDraft,
      myRole,
      organization,
      periodValue,
      skillsDraft,
      teamComposition,
      teamSize,
      titleDraft,
      typeDraft,
    ]
  );
  const canImportBasicInfoToStar = useMemo(
    () => hasActivityStarImportSource(starImportSource),
    [starImportSource]
  );
  const coachInsight = useMemo(
    () =>
      buildActivityCoachInsight(lastCoachResponse, {
        targetRole: jobTitle,
        activityTitle: titleDraft,
        activityType: typeDraft || activity?.type || "프로젝트",
        myRole,
        skills: skillsDraft,
        contributions: contributionItems,
        starSituation,
        starTask,
        starAction,
        starResult,
      }),
    [
      activity?.type,
      contributionItems,
      jobTitle,
      lastCoachResponse,
      myRole,
      skillsDraft,
      starAction,
      starResult,
      starSituation,
      starTask,
      titleDraft,
      typeDraft,
    ]
  );

  const handleSendMessage = async () => {
    if (!activity || !input.trim()) return;
    setSending(true);
    setError(null);
    const trimmedInput = input.trim();
    const userMessage: CoachMessage = { role: "user", content: trimmedInput };
    const updatedHistory = [...messages, userMessage];
    setMessages(updatedHistory);
    setInput("");
    try {
      const result = await requestActivityCoachChat(
        buildActivityCoachChatPrompt({
          question: trimmedInput,
          targetRole: jobTitle,
          activityTitle: titleDraft,
          activityType: typeDraft || activity.type,
          recentMessages: messages,
        })
      );
      setMessages([
        ...updatedHistory,
        {
          role: "assistant",
          content: normalizeActivityCoachChatReply(result.summary),
        },
      ]);
    } catch {
      setMessages([
        ...updatedHistory,
        {
          role: "assistant",
          content: buildActivityCoachChatFallbackReply(trimmedInput, jobTitle),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleRunCoachDiagnosis = async () => {
    if (!activity || !hasCompleteStarDraft) return;

    setCoachDiagnosisLoading(true);
    setError(null);
    try {
      const result = await requestActivityCoaching({
        message: "STAR 내용을 기준으로 코칭 진단을 생성해주세요.",
        session_id: sessionId,
        activity_description: buildCoachSourceText("STAR 내용을 기준으로 코칭 진단을 생성해주세요."),
        job_title: jobTitle.trim() || "일반",
        section_type: (typeDraft || activity.type) as Activity["type"],
        history: [],
      });
      setLastCoachResponse(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "코칭 진단 생성에 실패했습니다.");
    } finally {
      setCoachDiagnosisLoading(false);
    }
  };

  const handleSaveBasicInfo = async () => {
    if (!activity) return;
    setBasicSaving(true);
    setError(null);
    try {
      if (isNewActivity) {
        const data = await createActivity({
          type: typeDraft || activity.type,
          title: titleDraft || organization.trim() || "새 성과 기록",
          period: periodValue,
          role: activity.role,
          skills: skillsDraft,
          description: descriptionDraft || null,
          organization,
          team_size: teamSize,
          team_composition: teamComposition,
          my_role: myRole,
          contributions: filteredContributions,
          image_urls: imageUrls,
          is_visible: true,
        });
        void invalidateRecommendCache();
        setPostSaveActivity(data.activity);
        setShowPostSaveModal(true);
        return;
      }
      const data = await updateActivity(activity.id, {
        description: descriptionDraft,
        organization,
        team_size: teamSize,
        team_composition: teamComposition,
        my_role: myRole,
        contributions: filteredContributions,
        image_urls: imageUrls,
        title: titleDraft,
        type: typeDraft,
        period: periodValue,
        skills: skillsDraft,
      });
      void invalidateRecommendCache();
      setActivity(data.activity);
    } catch (e) {
      setError(e instanceof Error ? e.message : "활동 저장에 실패했습니다.");
    } finally {
      setBasicSaving(false);
    }
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || imageUrls.length >= 5) return;
    setImageUploading(true);
    try {
      const uploadFiles = Array.from(files).slice(0, 5 - imageUrls.length);
      const data = await uploadActivityImages(activity?.id || "new", uploadFiles);
      setImageUrls((prev) => [...prev, ...data.urls].slice(0, 5));
    } finally {
      setImageUploading(false);
    }
  };

  const handleImageRemove = (index: number) => setImageUrls((prev) => prev.filter((_, i) => i !== index));
  const handleContributionChange = (index: number, value: string) => setContributions((prev) => prev.map((c, i) => (i === index ? value : c)));
  const handleContributionAdd = () => { if (contributions.length < 6) setContributions((prev) => [...prev, ""]); };
  const handleContributionRemove = (index: number) => { if (contributions.length > 1) setContributions((prev) => prev.filter((_, i) => i !== index)); };

  const buildCoachSourceText = (fallbackText: string) =>
    buildActivityCoachContext({
      targetRole: jobTitle,
      title: titleDraft,
      type: typeDraft || activity?.type || "프로젝트",
      organization,
      period: periodValue,
      teamSize,
      teamComposition,
      myRole,
      skills: skillsDraft,
      contributions: contributionItems,
      description: descriptionDraft,
      starSituation,
      starTask,
      starAction,
      starResult,
      fallbackText,
    });

  const handleGenerateIntroCandidates = async () => {
    if (!hasContributionContent) {
      setIntroGenerateError("기여내용을 먼저 작성해주세요.");
      return;
    }
    setIntroGenerateLoading(true);
    setIntroGenerateError(null);
    try {
      const result = await generateActivityIntro({
        mode: "intro_generate",
        activity_description: buildActivityEvidenceText(starImportSource),
        activity_type: typeDraft || activity?.type || "프로젝트",
        org_name: organization.trim(),
        period: periodValue,
        team_size: teamSize,
        role: myRole.trim(),
        skills: skillsDraft,
        contribution: contributionItems.join("\n"),
        section_type: (typeDraft || activity?.type || "프로젝트") as Activity["type"],
      });
      setIntroCandidates(result.intro_candidates);
      if (result.intro_candidates.length === 0) setIntroGenerateError("생성된 소개글 후보가 없습니다.");
    } catch (e) {
      const fallbackCandidates = buildActivityIntroFallbackCandidates(starImportSource);
      setIntroCandidates(fallbackCandidates);
      const fallbackMessage =
        fallbackCandidates.length > 0
          ? "AI 소개글 생성에 실패해 기본정보 기반 후보를 대신 만들었습니다."
          : "AI 소개글을 생성하지 못했습니다.";
      setIntroGenerateError(e instanceof Error && fallbackCandidates.length === 0 ? e.message : fallbackMessage);
    } finally {
      setIntroGenerateLoading(false);
    }
  };

  const buildActivityConvertPayload = (activityOverride?: Partial<Activity>): ActivityConvertRequest["activity"] => ({
    id: activityOverride?.id ?? (isNewActivity ? null : activity?.id) ?? null,
    type: (typeDraft || activityOverride?.type || activity?.type || "프로젝트") as Activity["type"],
    title: titleDraft.trim() || activityOverride?.title || activity?.title || "새 성과 기록",
    organization: organization || activityOverride?.organization || null,
    team_size: teamSize > 0 ? teamSize : activityOverride?.team_size ?? activity?.team_size ?? null,
    team_composition: teamComposition || activityOverride?.team_composition || null,
    my_role: myRole || activityOverride?.my_role || null,
    contributions: filteredContributions,
    period: periodValue || activityOverride?.period || null,
    role: activityOverride?.role ?? activity?.role ?? (myRole || null),
    skills: skillsDraft,
    description: descriptionDraft || activityOverride?.description || null,
    star_situation: starSituation || activityOverride?.star_situation || null,
    star_task: starTask || activityOverride?.star_task || null,
    star_action: starAction || activityOverride?.star_action || null,
    star_result: starResult || activityOverride?.star_result || null,
  });

  const normalizeSkill = (value: string) => value.trim().toLowerCase();
  const isSkillSelected = (value: string) => skillsDraft.some((skill) => normalizeSkill(skill) === normalizeSkill(value));
  const addSkillToDraft = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || isSkillSelected(trimmed)) return false;
    if (skillsDraft.length >= 10) {
      setSkillSuggestionError("사용 기술은 최대 10개까지 선택할 수 있습니다.");
      return false;
    }
    setSkillsDraft((prev) => [...prev, trimmed]);
    setSkillSuggestionError(null);
    return true;
  };

  const handleSkillSuggest = async () => {
    const trimmedRole = myRole.trim();
    if (!trimmedRole) {
      setSkillSuggestionError("역할을 먼저 입력해주세요.");
      return;
    }
    setSkillSuggestionLoading(true);
    setSkillSuggestionError(null);
    try {
      const result = await getSkillSuggestions(trimmedRole, 20);
      setSkillSuggestions(result.recommended_skill_tags);
      setSkillSuggestionRoleLabel(result.display_name_ko || result.input_role);
      if (result.recommended_skill_tags.length === 0) setSkillSuggestionError("추천할 기술 태그가 없습니다.");
    } catch (e) {
      setSkillSuggestions([]);
      setSkillSuggestionRoleLabel(null);
      setSkillSuggestionError(e instanceof Error ? e.message : "기술 태그 추천을 불러오지 못했습니다.");
    } finally {
      setSkillSuggestionLoading(false);
    }
  };

  const handleSkillAdd = async () => {
    const trimmed = skillInput.trim();
    if (trimmed) {
      const added = addSkillToDraft(trimmed);
      if (added) setSkillInput("");
      return;
    }
    await handleSkillSuggest();
  };

  const handleSkillRemove = (index: number) => setSkillsDraft((prev) => prev.filter((_, i) => i !== index));
  const handleSuggestedSkillToggle = (skill: string) => {
    if (isSkillSelected(skill)) {
      setSkillsDraft((prev) => prev.filter((item) => normalizeSkill(item) !== normalizeSkill(skill)));
      setSkillSuggestionError(null);
      return;
    }
    addSkillToDraft(skill);
  };

  const handleSendToStar = async () => {
    if (!postSaveActivity) return;
    setPostSaveAction("star");
    setError(null);
    try {
      const result = await convertActivity({ target: "star", activity: buildActivityConvertPayload(postSaveActivity) });
      if (!result.star) throw new Error("STAR 변환 결과를 받지 못했습니다.");
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(PENDING_STAR_CONVERSION_KEY, JSON.stringify({ activityId: postSaveActivity.id, star: result.star }));
      }
      setShowPostSaveModal(false);
      router.push(`/dashboard/activities/${postSaveActivity.id}?tab=star`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "STAR 변환 중에 실패했습니다.");
    } finally {
      setPostSaveAction(null);
    }
  };

  const handleSendToPortfolio = async () => {
    if (!postSaveActivity) return;
    setPostSaveAction("portfolio");
    setError(null);
    try {
      const result = await convertActivity({ target: "portfolio", activity: buildActivityConvertPayload(postSaveActivity) });
      if (!result.portfolio) throw new Error("포트폴리오 변환 결과를 받지 못했습니다.");
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(PENDING_PORTFOLIO_CONVERSION_KEY, JSON.stringify({ activityId: postSaveActivity.id, portfolio: result.portfolio }));
      }
      setShowPostSaveModal(false);
      router.push("/dashboard/portfolio");
    } catch (e) {
      setError(e instanceof Error ? e.message : "포트폴리오 변환 중에 실패했습니다.");
    } finally {
      setPostSaveAction(null);
    }
  };

  const handlePostSaveLater = () => {
    setShowPostSaveModal(false);
    router.push("/dashboard/activities");
  };

  const handleDelete = async () => {
    if (!activity) return;
    setDeleting(true);
    try {
      await deleteActivity(activity.id);
      router.push("/dashboard/activities");
    } finally {
      setDeleting(false);
    }
  };

  const handleStarSave = async () => {
    if (!activity) return;
    setStarSaving(true);
    setError(null);
    try {
      const data = await updateActivity(activity.id, {
        star_situation: starSituation,
        star_task: starTask,
        star_action: starAction,
        star_result: starResult,
      });
      void invalidateRecommendCache();
      setActivity(data.activity);
      setStarSaveToast({ tone: "success", message: "STAR 기록이 저장되었습니다." });
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했습니다.");
      setStarSaveToast({ tone: "error", message: "저장에 실패했습니다." });
    } finally {
      setStarSaving(false);
    }
  };

  const handleImportBasicInfoToStar = useCallback(() => {
    const draft = buildActivityStarImportDraft(starImportSource);

    setStarSituation((current) => appendUniqueDraft(current, draft.situation));
    setStarTask((current) => appendUniqueDraft(current, draft.task));
    setStarAction((current) => appendUniqueDraft(current, draft.action));
    setStarResult((current) => appendUniqueDraft(current, draft.result));
    setStarSaveToast({ tone: "success", message: "기본정보를 STAR 초안에 가져왔습니다." });
  }, [starImportSource]);

  const handleApplyCoachSuggestionToDescription = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setDescriptionDraft(trimmed);
    setActiveTab("basic");
  }, []);

  const handleApplyCoachSuggestionToStar = useCallback((candidate: ActivityCoachRewriteCandidate) => {
    const text = candidate.text.trim();
    if (!text) return;

    if (candidate.starTarget === "situation") {
      setStarSituation((current) => appendUniqueDraft(current, text));
    } else if (candidate.starTarget === "task") {
      setStarTask((current) => appendUniqueDraft(current, text));
    } else if (candidate.starTarget === "action") {
      setStarAction((current) => appendUniqueDraft(current, text));
    } else {
      setStarResult((current) => appendUniqueDraft(current, text));
    }
    setActiveTab("star");
  }, []);

  const handleApplyCoachSuggestionToContribution = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const normalizedContributions = contributions.map((item) => item.trim());
    if (normalizedContributions.includes(trimmed)) {
      setActiveTab("basic");
      return;
    }

    const emptyIndex = normalizedContributions.findIndex((item) => item.length === 0);
    if (emptyIndex >= 0) {
      setContributions((current) => current.map((item, index) => (index === emptyIndex ? trimmed : item)));
      setActiveTab("basic");
      return;
    }

    if (contributions.length >= 6) {
      setError("기여 내용은 최대 6개까지 추가할 수 있습니다.");
      setActiveTab("basic");
      return;
    }

    setContributions((current) => [...current, trimmed]);
    setActiveTab("basic");
  }, [contributions]);

  return {
    router,
    activity,
    messages,
    coachInsight,
    input,
    setInput,
    descriptionDraft,
    setDescriptionDraft,
    jobTitle,
    setJobTitle,
    loading,
    sending,
    coachDiagnosisLoading,
    hasCompleteStarDraft,
    activeTab,
    setActiveTab,
    starSituation,
    setStarSituation,
    starTask,
    setStarTask,
    starAction,
    setStarAction,
    starResult,
    setStarResult,
    starSaving,
    canImportBasicInfoToStar,
    organization,
    setOrganization,
    teamSize,
    setTeamSize,
    teamComposition,
    setTeamComposition,
    myRole,
    setMyRole,
    contributions,
    titleDraft,
    setTitleDraft,
    typeDraft,
    setTypeDraft,
    periodStart,
    setPeriodStart,
    periodEnd,
    setPeriodEnd,
    skillInput,
    setSkillInput,
    skillsDraft,
    skillSuggestions,
    skillSuggestionRoleLabel,
    skillSuggestionLoading,
    skillSuggestionError,
    introCandidates,
    introGenerateLoading,
    introGenerateError,
    imageUrls,
    imageUploading,
    basicSaving,
    showDeleteModal,
    setShowDeleteModal,
    showPostSaveModal,
    postSaveActivity,
    postSaveAction,
    starSaveToast,
    deleting,
    error,
    hasContributionContent,
    isSkillSelected,
    handleSendMessage,
    handleRunCoachDiagnosis,
    handleSaveBasicInfo,
    handleImageUpload,
    handleImageRemove,
    handleContributionChange,
    handleContributionAdd,
    handleContributionRemove,
    handleGenerateIntroCandidates,
    handleSkillAdd,
    handleSkillRemove,
    handleSuggestedSkillToggle,
    handleSendToStar,
    handleSendToPortfolio,
    handlePostSaveLater,
    handleDelete,
    handleStarSave,
    handleImportBasicInfoToStar,
    handleApplyCoachSuggestionToDescription,
    handleApplyCoachSuggestionToStar,
    handleApplyCoachSuggestionToContribution,
  };
}
