// 활동 상세 페이지 - 활동 내용 편집 + AI 코치 대화
"use client";

import type { ChangeEvent } from "react";
import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  createActivity,
  deleteActivity,
  getActivityDetail,
  saveCoachSession,
  updateActivity,
  uploadActivityImages,
} from "@/lib/api/app";
import {
  convertActivity,
  generateActivityIntro,
  getCoachFeedback,
  getSkillSuggestions,
} from "@/lib/api/backend";
import {
  deleteGuestActivity,
  getGuestActivities,
  isGuestMode,
  upsertGuestActivity,
} from "@/lib/guest";
import type { Activity, ActivityConvertRequest, CoachMessage } from "@/lib/types";
import { ActivityBasicTab } from "../_components/activity-basic-tab";
import { ActivityCoachPanel } from "../_components/activity-coach-panel";
import { ActivityDetailModals } from "../_components/activity-detail-modals";
import { ActivityStarTab } from "../_components/activity-star-tab";

const PENDING_STAR_CONVERSION_KEY = "isoser:pending-star-conversion";
const PENDING_PORTFOLIO_CONVERSION_KEY = "isoser:pending-portfolio-conversion";

export default function ActivityDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const activityId = params.id as string;
  const isNewActivity = activityId === "new" || activityId === "__new__";
  const router = useRouter();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [input, setInput] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"basic" | "star">("basic");
  const [starSituation, setStarSituation] = useState("");
  const [starTask, setStarTask] = useState("");
  const [starAction, setStarAction] = useState("");
  const [starResult, setStarResult] = useState("");
  const [starSaving, setStarSaving] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
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
  const [starSaveToast, setStarSaveToast] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (searchParams.get("tab") === "star") {
      setActiveTab("star");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!starSaveToast) return;

    const timer = window.setTimeout(() => {
      setStarSaveToast(null);
    }, 2500);

    return () => window.clearTimeout(timer);
  }, [starSaveToast]);

  useEffect(() => {
    const fetchActivity = async () => {
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

      if (isGuestMode()) {
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
        const found = getGuestActivities().find((item) => item.id === activityId) ?? null;
        setActivity(found);
        setDescriptionDraft(found?.description ?? "");
        setStarSituation(found?.star_situation || "");
        setStarTask(found?.star_task || "");
        setStarAction(found?.star_action || "");
        setStarResult(found?.star_result || "");
        setOrganization(found?.organization || "");
        setTeamSize(found?.team_size || 0);
        setTeamComposition(found?.team_composition || "");
        setMyRole(found?.my_role || "");
        setContributions(found?.contributions?.length ? found.contributions : [""]);
        setImageUrls(found?.image_urls || []);
        setTitleDraft(found?.title || "");
        setTypeDraft(found?.type || "");
        const foundParts = (found?.period || "").split("~");
        setPeriodStart(foundParts[0]?.trim() || "");
        setPeriodEnd(foundParts[1]?.trim() || "");
        setSkillsDraft(Array.isArray(found?.skills) ? found.skills : []);
        setLoading(false);
        return;
      }

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
        if (!loaded) {
          throw new Error("활동을 찾을 수 없습니다.");
        }
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
        const parts = (loaded.period || "").split("~");
        setPeriodStart(parts[0]?.trim() || "");
        setPeriodEnd(parts[1]?.trim() || "");
        setSkillsDraft(Array.isArray(loaded.skills) ? loaded.skills : []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "활동을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };
    fetchActivity();
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
    if (
      isNewActivity ||
      loading ||
      !activity ||
      typeof window === "undefined" ||
      searchParams.get("tab") !== "star"
    ) {
      return;
    }

    const raw = window.sessionStorage.getItem(PENDING_STAR_CONVERSION_KEY);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as {
        activityId?: string;
        star?: {
          star_situation?: string;
          star_task?: string;
          star_action?: string;
          star_result?: string;
        };
      };

      if (parsed.activityId !== activityId || parsed.activityId !== activity.id || !parsed.star) {
        return;
      }

      setStarSituation(parsed.star.star_situation ?? "");
      setStarTask(parsed.star.star_task ?? "");
      setStarAction(parsed.star.star_action ?? "");
      setStarResult(parsed.star.star_result ?? "");
      window.sessionStorage.removeItem(PENDING_STAR_CONVERSION_KEY);
    } catch {
      window.sessionStorage.removeItem(PENDING_STAR_CONVERSION_KEY);
    }
  }, [activity, activityId, isNewActivity, loading, searchParams]);

  const handleSaveDescription = async () => {
    if (!activity) return;
    if (isGuestMode()) {
      setActivity({ ...activity, description: descriptionDraft });
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const data = await updateActivity(activity.id, { description: descriptionDraft });
      setActivity(data.activity);
    } catch (e) {
      setError(e instanceof Error ? e.message : "설명 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleSendMessage = async () => {
    if (!activity || !input.trim()) return;
    setSending(true);
    setError(null);

    const userMessage: CoachMessage = { role: "user", content: input };
    const updatedHistory = [...messages, userMessage];
    setMessages(updatedHistory);
    setInput("");

    try {
      const result = await getCoachFeedback({
        session_id: sessionId,
        activity_description: input,
        job_title: jobTitle || "일반",
        section_type: (typeDraft || activity.type) as Activity["type"],
        history: updatedHistory,
      });

      const assistantMessage: CoachMessage = {
        role: "assistant",
        content: result.feedback,
      };
      setMessages([...updatedHistory, assistantMessage]);

      // 대화 이력 Supabase에 저장
      if (isGuestMode()) {
        return;
      }

      await saveCoachSession({
        sessionId,
        activityId: activity.id,
        messages: [...updatedHistory, assistantMessage],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "코치 피드백 요청에 실패했습니다.");
      setMessages([
        ...updatedHistory,
        { role: "assistant", content: "오류가 발생했습니다. 다시 시도해주세요." },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleSaveBasicInfo = async () => {
    if (!activity) return;
    setBasicSaving(true);
    setError(null);
    try {
      if (isGuestMode()) {
        const now = new Date().toISOString();
        const guestActivity: Activity = {
          ...activity,
          id: isNewActivity ? `guest-activity-${Date.now()}` : activity.id,
          user_id: "guest",
          type: (typeDraft || activity.type) as Activity["type"],
          title: titleDraft || organization.trim() || "새 성과 기록",
          period: periodValue || null,
          role: myRole || activity.role,
          skills: skillsDraft,
          description: descriptionDraft || null,
          organization,
          team_size: teamSize,
          team_composition: teamComposition,
          my_role: myRole,
          contributions: filteredContributions,
          image_urls: imageUrls,
          updated_at: now,
          created_at: isNewActivity ? now : activity.created_at,
        };

        upsertGuestActivity(guestActivity);

        if (isNewActivity) {
          setPostSaveActivity(guestActivity);
          setShowPostSaveModal(true);
          return;
        }

        setActivity(guestActivity);
        return;
      }

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
      setActivity(data.activity);
    } catch (e) {
      setError(e instanceof Error ? e.message : "?쒕룞 ??μ뿉 ?ㅽ뙣?덉뒿?덈떎.");
    } finally {
      setBasicSaving(false);
    }
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (isGuestMode() || !files || imageUrls.length >= 5) return;

    setImageUploading(true);
    try {
      const uploadFiles = Array.from(files).slice(0, 5 - imageUrls.length);
      const data = await uploadActivityImages(activity?.id || "new", uploadFiles);
      setImageUrls((prev) => [...prev, ...data.urls].slice(0, 5));
    } finally {
      setImageUploading(false);
    }
  };

  const handleImageRemove = (index: number) => {
    setImageUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleContributionChange = (index: number, value: string) => {
    setContributions((prev) => prev.map((c, i) => i === index ? value : c));
  };

  const handleContributionAdd = () => {
    if (contributions.length >= 6) return;
    setContributions((prev) => [...prev, ""]);
  };

  const handleContributionRemove = (index: number) => {
    if (contributions.length <= 1) return;
    setContributions((prev) => prev.filter((_, i) => i !== index));
  };

  const contributionItems = contributions
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  const hasContributionContent = contributionItems.length > 0;

  const buildIntroSourceText = () => {
    const segments = [
      titleDraft.trim() ? `활동명: ${titleDraft.trim()}` : "",
      organization.trim() ? `조직: ${organization.trim()}` : "",
      myRole.trim() ? `역할: ${myRole.trim()}` : "",
      `활동 유형: ${(typeDraft || activity?.type || "프로젝트").trim()}`,
      contributionItems.length > 0
        ? `기여 내용:\n- ${contributionItems.join("\n- ")}`
        : "",
    ].filter(Boolean);

    return segments.join("\n");
  };

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
        activity_description: buildIntroSourceText(),
        activity_type: typeDraft || activity?.type || "?꾨줈?앺듃",
        org_name: organization.trim(),
        period: periodValue,
        team_size: teamSize,
        role: myRole.trim(),
        skills: skillsDraft,
        contribution: contributionItems.join("\n"),
        section_type: (typeDraft || activity?.type || "프로젝트") as Activity["type"],
      });
      setIntroCandidates(result.intro_candidates);
      if (result.intro_candidates.length === 0) {
        setIntroGenerateError("생성된 소개글 후보가 없습니다.");
      }
    } catch (e) {
      setIntroCandidates([]);
      setIntroGenerateError(
        e instanceof Error ? e.message : "AI 소개글을 생성하지 못했습니다."
      );
    } finally {
      setIntroGenerateLoading(false);
    }
  };

  const filteredContributions = contributions.filter((c) => c.trim() !== "");
  const periodValue =
    periodStart && periodEnd ? `${periodStart} ~ ${periodEnd}` : periodStart || "";

  const buildActivityConvertPayload = (
    activityOverride?: Partial<Activity>
  ): ActivityConvertRequest["activity"] => ({
    id: activityOverride?.id ?? (isNewActivity ? null : activity?.id) ?? null,
    type: (typeDraft || activityOverride?.type || activity?.type || "?꾨줈?앺듃") as Activity["type"],
    title:
      titleDraft.trim() ||
      activityOverride?.title ||
      activity?.title ||
      "???깃낵 湲곕줉",
    organization: organization || activityOverride?.organization || null,
    team_size:
      teamSize > 0
        ? teamSize
        : activityOverride?.team_size ?? activity?.team_size ?? null,
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

  const isSkillSelected = (value: string) =>
    skillsDraft.some((skill) => normalizeSkill(skill) === normalizeSkill(value));

  const addSkillToDraft = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || isSkillSelected(trimmed)) {
      return false;
    }

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
      if (result.recommended_skill_tags.length === 0) {
        setSkillSuggestionError("추천할 기술 태그가 없습니다.");
      }
    } catch (e) {
      setSkillSuggestions([]);
      setSkillSuggestionRoleLabel(null);
      setSkillSuggestionError(
        e instanceof Error ? e.message : "기술 태그 추천을 불러오지 못했습니다."
      );
    } finally {
      setSkillSuggestionLoading(false);
    }
  };

  const handleSkillAdd = async () => {
    const trimmed = skillInput.trim();
    if (trimmed) {
      const added = addSkillToDraft(trimmed);
      if (added) {
        setSkillInput("");
      }
      return;
    }

    await handleSkillSuggest();
  };

  const handleSkillRemove = (index: number) => {
    setSkillsDraft((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSuggestedSkillToggle = (skill: string) => {
    if (isSkillSelected(skill)) {
      setSkillsDraft((prev) =>
        prev.filter((item) => normalizeSkill(item) !== normalizeSkill(skill))
      );
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
      const result = await convertActivity({
        target: "star",
        activity: buildActivityConvertPayload(postSaveActivity),
      });

      if (!result.star) {
        throw new Error("STAR 蹂??寃곌낵瑜??쎌쓣 ???놁뒿?덈떎.");
      }

      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          PENDING_STAR_CONVERSION_KEY,
          JSON.stringify({
            activityId: postSaveActivity.id,
            star: result.star,
          })
        );
      }

      setShowPostSaveModal(false);
      router.push(`/dashboard/activities/${postSaveActivity.id}?tab=star`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "STAR 蹂??以묒뿉 ?ㅽ뙣?덉뒿?덈떎.");
    } finally {
      setPostSaveAction(null);
    }
  };

  const handleSendToPortfolio = async () => {
    if (!postSaveActivity) return;
    setPostSaveAction("portfolio");
    setError(null);
    try {
      const result = await convertActivity({
        target: "portfolio",
        activity: buildActivityConvertPayload(postSaveActivity),
      });

      if (!result.portfolio) {
        throw new Error("?ъ듃?명룷由ъ삤 蹂??寃곌낵瑜??쎌쓣 ???놁뒿?덈떎.");
      }

      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          PENDING_PORTFOLIO_CONVERSION_KEY,
          JSON.stringify({
            activityId: postSaveActivity.id,
            portfolio: result.portfolio,
          })
        );
      }

      setShowPostSaveModal(false);
      router.push("/dashboard/portfolio");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "?ъ듃?명룷由ъ삤 蹂??以묒뿉 ?ㅽ뙣?덉뒿?덈떎."
      );
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
      if (isGuestMode()) {
        deleteGuestActivity(activity.id);
        router.push("/dashboard/activities");
        return;
      }

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
      if (isGuestMode()) {
        const now = new Date().toISOString();
        const guestActivity: Activity = {
          ...activity,
          type: (typeDraft || activity.type) as Activity["type"],
          title: titleDraft || activity.title,
          period: periodValue || activity.period,
          role: myRole || activity.role,
          skills: skillsDraft,
          description: descriptionDraft || activity.description,
          organization,
          team_size: teamSize,
          team_composition: teamComposition,
          my_role: myRole,
          contributions: filteredContributions,
          image_urls: imageUrls,
          star_situation: starSituation,
          star_task: starTask,
          star_action: starAction,
          star_result: starResult,
          updated_at: now,
        };

        upsertGuestActivity(guestActivity);
        setActivity(guestActivity);
        setStarSaveToast({
          tone: "success",
          message: "STAR 기록이 저장되었습니다.",
        });
        return;
      }

      const data = await updateActivity(activity.id, {
        star_situation: starSituation,
        star_task: starTask,
        star_action: starAction,
        star_result: starResult,
      });
      setActivity(data.activity);
      setStarSaveToast({
        tone: "success",
        message: "STAR 기록이 저장되었습니다.",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했습니다.");
      setStarSaveToast({
        tone: "error",
        message: "저장에 실패했습니다.",
      });
    } finally {
      setStarSaving(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (!starSituation && !starTask && !starAction && !starResult) return;
    setSummaryLoading(true);
    try {
      const prompt = `아래 STAR 기법으로 작성된 활동 내용을 바탕으로,
이력서에 쓸 수 있는 간결하고 임팩트 있는 활동 소개 문단을 3~4문장으로 작성해줘.
수치와 결과를 강조하고, 1인칭 주어 없이 서술해줘.

Situation(상황): ${starSituation}
Task(과제): ${starTask}
Action(행동): ${starAction}
Result(결과): ${starResult}`;

      const res = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (data.summary) {
        setDescriptionDraft(data.summary);
        setActiveTab("basic");
      }
    } finally {
      setSummaryLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">불러오는 중...</p>
      </main>
    );
  }

  if (!activity) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">활동을 찾을 수 없습니다.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <button
        onClick={() => router.push("/dashboard/activities")}
        aria-label="뒤로가기"
        className="fixed top-6 left-[230px] ml-4 z-40 flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition-all"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-gray-500"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <p className="text-sm text-gray-400">{typeDraft || activity.type}</p>
            <input
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              className="text-2xl font-bold text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-400 focus:outline-none w-full transition-all"
              style={{ fontFamily: "Pretendard, sans-serif" }}
            />
            {activity.period && (
              <p className="text-sm text-gray-500">{activity.period}</p>
            )}
          </div>
          {!isNewActivity && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm text-red-500 border border-red-200 hover:bg-red-50 transition-all"
            >
              삭제
            </button>
          )}
        </div>
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
        {starSaveToast && (
          <div className="fixed bottom-6 right-6 z-50">
            <div
              className={`rounded-2xl px-4 py-3 text-sm font-medium shadow-lg ${
                starSaveToast.tone === "success"
                  ? "bg-emerald-600 text-white"
                  : "bg-red-500 text-white"
              }`}
            >
              {starSaveToast.message}
            </div>
          </div>
        )}

        <div className={`grid grid-cols-1 ${activeTab === "star" ? "lg:grid-cols-2" : ""} gap-6`}>
          {/* 활동 설명 */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setActiveTab("basic")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "basic"
                    ? "bg-gray-900 text-white"
                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                기본 정보
              </button>
              <button
                onClick={() => setActiveTab("star")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "star"
                    ? "bg-gray-900 text-white"
                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                STAR 기록
              </button>
            </div>

            {activeTab === "basic" && (
              <ActivityBasicTab
                activity={activity}
                isNewActivity={isNewActivity}
                typeDraft={typeDraft}
                onTypeDraftChange={setTypeDraft}
                organization={organization}
                onOrganizationChange={setOrganization}
                periodStart={periodStart}
                onPeriodStartChange={setPeriodStart}
                periodEnd={periodEnd}
                onPeriodEndChange={setPeriodEnd}
                teamSize={teamSize}
                onTeamSizeChange={setTeamSize}
                teamComposition={teamComposition}
                onTeamCompositionChange={setTeamComposition}
                myRole={myRole}
                onMyRoleChange={setMyRole}
                skillsDraft={skillsDraft}
                skillInput={skillInput}
                onSkillInputChange={setSkillInput}
                skillSuggestions={skillSuggestions}
                skillSuggestionRoleLabel={skillSuggestionRoleLabel}
                skillSuggestionLoading={skillSuggestionLoading}
                skillSuggestionError={skillSuggestionError}
                isSkillSelected={isSkillSelected}
                onSkillAdd={handleSkillAdd}
                onSkillRemove={handleSkillRemove}
                onSuggestedSkillToggle={handleSuggestedSkillToggle}
                contributions={contributions}
                onContributionChange={handleContributionChange}
                onContributionAdd={handleContributionAdd}
                onContributionRemove={handleContributionRemove}
                descriptionDraft={descriptionDraft}
                onDescriptionDraftChange={setDescriptionDraft}
                hasContributionContent={hasContributionContent}
                introGenerateLoading={introGenerateLoading}
                introGenerateError={introGenerateError}
                introCandidates={introCandidates}
                onGenerateIntroCandidates={handleGenerateIntroCandidates}
                imageUrls={imageUrls}
                imageUploading={imageUploading}
                onImageUpload={handleImageUpload}
                onImageRemove={handleImageRemove}
                isGuestMode={isGuestMode()}
                basicSaving={basicSaving}
                onSaveBasicInfo={handleSaveBasicInfo}
              />
            )}

            {activeTab === "star" && (
              <ActivityStarTab
                starSituation={starSituation}
                onStarSituationChange={setStarSituation}
                starTask={starTask}
                onStarTaskChange={setStarTask}
                starAction={starAction}
                onStarActionChange={setStarAction}
                starResult={starResult}
                onStarResultChange={setStarResult}
                starSaving={starSaving}
                onStarSave={handleStarSave}
                summaryLoading={summaryLoading}
                onGenerateSummary={handleGenerateSummary}
              />
            )}
          </div>

          {activeTab === "star" && (
            <ActivityCoachPanel
              jobTitle={jobTitle}
              onJobTitleChange={setJobTitle}
              messages={messages}
              sending={sending}
              input={input}
              onInputChange={setInput}
              onSendMessage={handleSendMessage}
            />
          )}
        </div>
      </div>
      <ActivityDetailModals
        showPostSaveModal={showPostSaveModal}
        postSaveActivity={postSaveActivity}
        postSaveAction={postSaveAction}
        onSendToStar={handleSendToStar}
        onSendToPortfolio={handleSendToPortfolio}
        onPostSaveLater={handlePostSaveLater}
        showDeleteModal={showDeleteModal}
        isNewActivity={isNewActivity}
        onCloseDeleteModal={() => setShowDeleteModal(false)}
        onDelete={handleDelete}
        deleting={deleting}
      />
    </main>
  );
}
