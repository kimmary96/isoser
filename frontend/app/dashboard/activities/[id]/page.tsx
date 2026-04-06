// 활동 상세 페이지 - 활동 내용 편집 + AI 코치 대화
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
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

const PENDING_STAR_CONVERSION_KEY = "isoser:pending-star-conversion";
const PENDING_PORTFOLIO_CONVERSION_KEY = "isoser:pending-portfolio-conversion";

export default function ActivityDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const activityId = params.id as string;
  const isNewActivity = activityId === "new";
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(), []);
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
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (searchParams.get("tab") === "star") {
      setActiveTab("star");
    }
  }, [searchParams]);

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
        const found = getGuestActivities().find((item) => item.id === (params.id as string)) ?? null;
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
        const { data, error: activityError } = await supabase
          .from("activities")
          .select("*")
          .eq("id", params.id as string)
          .single();
        if (activityError) {
          throw new Error(activityError.message);
        }
        setActivity(data);
        setDescriptionDraft(data?.description ?? "");
        setStarSituation(data.star_situation || "");
        setStarTask(data.star_task || "");
        setStarAction(data.star_action || "");
        setStarResult(data.star_result || "");
        setOrganization(data.organization || "");
        setTeamSize(data.team_size || 0);
        setTeamComposition(data.team_composition || "");
        setMyRole(data.my_role || "");
        setContributions(data.contributions?.length ? data.contributions : [""]);
        setImageUrls(data.image_urls || []);
        setTitleDraft(data.title || "");
        setTypeDraft(data.type || "");
        const parts = (data.period || "").split("~");
        setPeriodStart(parts[0]?.trim() || "");
        setPeriodEnd(parts[1]?.trim() || "");
        setSkillsDraft(Array.isArray(data.skills) ? data.skills : []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "활동을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };
    fetchActivity();
  }, [isNewActivity, params.id, supabase]);

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

      if (parsed.activityId !== activityId || !parsed.star) {
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
  }, [activityId, isNewActivity, searchParams]);

  const handleSaveDescription = async () => {
    if (!activity) return;
    if (isGuestMode()) {
      setActivity({ ...activity, description: descriptionDraft });
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from("activities")
        .update({ description: descriptionDraft })
        .eq("id", activity.id);
      if (updateError) {
        throw new Error(updateError.message);
      }
      setActivity({ ...activity, description: descriptionDraft });
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

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error: sessionError } = await supabase.from("coach_sessions").upsert({
          id: sessionId,
          user_id: user.id,
          activity_id: activity.id,
          messages: [...updatedHistory, assistantMessage],
        });
        if (sessionError) {
          throw new Error(sessionError.message);
        }
      }
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
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error("로그인이 필요합니다.");
        }
        const { data: insertedActivity, error: insertError } = await supabase
          .from("activities")
          .insert({
            user_id: user.id,
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
          })
          .select("*")
          .single();
        if (insertError) {
          throw insertError;
        }
        setPostSaveActivity(insertedActivity as Activity);
        setShowPostSaveModal(true);
        return;
      }

      const { error: updateError } = await supabase
        .from("activities")
        .update({
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
        })
        .eq("id", activity.id);
      if (updateError) {
        throw updateError;
      }
      setActivity({
        ...activity,
        description: descriptionDraft,
        organization,
        team_size: teamSize,
        team_composition: teamComposition,
        my_role: myRole,
        contributions: filteredContributions,
        image_urls: imageUrls,
        title: titleDraft,
        type: (typeDraft || activity.type) as Activity["type"],
        period: periodValue,
        skills: skillsDraft,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "?쒕룞 ??μ뿉 ?ㅽ뙣?덉뒿?덈떎.");
    } finally {
      setBasicSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || imageUrls.length >= 5) return;

    setImageUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const uploadPromises = Array.from(files).slice(0, 5 - imageUrls.length).map(async (file) => {
        const ext = file.name.split(".").pop();
        const path = `${user.id}/${activity?.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("activity-images")
          .upload(path, file, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage
          .from("activity-images")
          .getPublicUrl(path);
        return urlData.publicUrl;
      });

      const newUrls = await Promise.all(uploadPromises);
      setImageUrls((prev) => [...prev, ...newUrls].slice(0, 5));
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

      await supabase
        .from("activities")
        .delete()
        .eq("id", activity.id);
      router.push("/dashboard/activities");
    } finally {
      setDeleting(false);
    }
  };

  const handleStarSave = async () => {
    if (!activity) return;
    setStarSaving(true);
    try {
      await supabase
        .from("activities")
        .update({
          star_situation: starSituation,
          star_task: starTask,
          star_action: starAction,
          star_result: starResult,
        })
        .eq("id", activity.id);
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
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-2 block">활동 유형</label>
                    <div className="flex gap-2 flex-wrap">
                      {["회사경력", "프로젝트", "대외활동", "학생활동"].map((type) => (
                        <button
                          key={type}
                          onClick={() => setTypeDraft(type)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                            typeDraft === type
                              ? "bg-gray-900 text-white border-gray-900"
                              : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-2 block">소속 조직</label>
                    <input
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      placeholder="활동 소속 조직을 입력해주세요."
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-2 block">
                    활동 기간 <span className="text-red-400">*</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      value={periodStart}
                      onChange={(e) => setPeriodStart(e.target.value)}
                      placeholder="예) 2025.03"
                      className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm w-32 focus:outline-none focus:border-blue-400"
                    />
                    <span className="text-gray-400">~</span>
                    <input
                      value={periodEnd}
                      onChange={(e) => setPeriodEnd(e.target.value)}
                      placeholder="예) 2025.07"
                      className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm w-32 focus:outline-none focus:border-blue-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-2 block">인원</label>
                    <input
                      type="number"
                      value={teamSize || ""}
                      onChange={(e) => setTeamSize(Number(e.target.value))}
                      placeholder="예) 5"
                      min={1}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-2 block">팀 구성</label>
                    <input
                      value={teamComposition}
                      onChange={(e) => setTeamComposition(e.target.value)}
                      placeholder="예) PM 1 / 백엔드 2 / 프론트엔드 1"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-2 block">
                    어떤 역할을 담당하셨나요? <span className="text-red-400">*</span>
                  </label>
                  <input
                    value={myRole}
                    onChange={(e) => setMyRole(e.target.value)}
                    placeholder="예) 백엔드 개발자로 참여"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-2 block">
                    사용 기술 ({skillsDraft.length}/10)
                  </label>

                  <div className="flex flex-wrap gap-2 mb-3">
                    {skillsDraft.map((skill, i) => (
                      <span
                        key={i}
                        className="flex items-center gap-1.5 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs"
                      >
                        {skill}
                        <button
                          onClick={() => handleSkillRemove(i)}
                          className="text-gray-400 hover:text-red-400 transition-all"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>

                  {skillsDraft.length < 10 && (
                    <div className="flex gap-2">
                      <input
                        value={skillInput}
                        onChange={(e) => setSkillInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void handleSkillAdd();
                          }
                        }}
                        placeholder="기술을 직접 입력하거나, 비워둔 뒤 추가 버튼으로 추천을 불러오세요."
                        className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                      />
                      <button
                        onClick={() => void handleSkillAdd()}
                        disabled={skillSuggestionLoading}
                        className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm hover:bg-gray-200 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {skillSuggestionLoading ? "불러오는 중..." : "추가"}
                      </button>
                    </div>
                  )}

                  {skillsDraft.length < 10 && (
                    <>
                      <p className="mt-2 text-[11px] text-gray-400">
                        역할을 입력한 뒤 입력칸을 비우고 추가 버튼을 누르면 기술 태그를 추천합니다.
                      </p>

                      {skillSuggestionError && (
                        <p className="mt-2 text-xs text-red-500">{skillSuggestionError}</p>
                      )}

                      {skillSuggestions.length > 0 && (
                        <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-3">
                          <div className="flex items-center justify-between gap-3 mb-2">
                            <p className="text-xs font-semibold text-blue-700">
                              역할 기반 추천
                            </p>
                            {skillSuggestionRoleLabel && (
                              <span className="text-[11px] text-blue-500">
                                기준 역할: {skillSuggestionRoleLabel}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {skillSuggestions.map((skill) => {
                              const selected = isSkillSelected(skill);
                              const disabled = !selected && skillsDraft.length >= 10;

                              return (
                                <button
                                  key={skill}
                                  type="button"
                                  onClick={() => handleSuggestedSkillToggle(skill)}
                                  disabled={disabled}
                                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-all ${
                                    selected
                                      ? "border-blue-600 bg-blue-600 text-white"
                                      : "border-blue-200 bg-white text-blue-700 hover:border-blue-300 hover:bg-blue-50"
                                  } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                                >
                                  {selected && (
                                    <svg
                                      width="12"
                                      height="12"
                                      viewBox="0 0 20 20"
                                      fill="none"
                                      aria-hidden="true"
                                    >
                                      <path
                                        d="M5 10.5L8.5 14L15 7.5"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                  )}
                                  <span>{skill}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-gray-500">기여 내용</label>
                    {contributions.length < 6 && (
                      <button
                        onClick={handleContributionAdd}
                        className="text-xs text-blue-500 hover:underline"
                      >
                        + 항목 추가
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {contributions.map((c, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <span className="text-gray-400 text-sm">-</span>
                        <input
                          value={c}
                          onChange={(e) => handleContributionChange(i, e.target.value)}
                          placeholder={`기여 내용 ${i + 1}`}
                          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                        />
                        {contributions.length > 1 && (
                          <button
                            onClick={() => handleContributionRemove(i)}
                            className="text-gray-300 hover:text-red-400 text-sm"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-gray-500">
                      어떤 활동이었는지 간단한 소개를 적어주세요. <span className="text-red-400">*</span>
                    </label>
                    {isNewActivity && (
                      <button
                        type="button"
                        onClick={() => void handleGenerateIntroCandidates()}
                        disabled={!hasContributionContent || introGenerateLoading}
                        title={
                          hasContributionContent
                            ? "기여 내용을 바탕으로 소개글 후보를 생성합니다."
                            : "기여내용을 먼저 작성해주세요"
                        }
                        className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition-all hover:border-blue-300 hover:bg-blue-100 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400"
                      >
                        <span aria-hidden="true">AI</span>
                        <span>
                          {introGenerateLoading ? "소개글 생성 중..." : "소개글 생성"}
                        </span>
                      </button>
                    )}
                  </div>
                  <textarea
                    value={descriptionDraft}
                    onChange={(e) => setDescriptionDraft(e.target.value)}
                    placeholder="활동에 대한 간단한 소개를 작성해주세요."
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-blue-400"
                    rows={5}
                  />

                  {isNewActivity && (
                    <>
                      <p className="mt-2 text-[11px] text-gray-400">
                        기여 내용을 먼저 작성한 뒤 소개글 생성 버튼을 누르면 AI가 후보 1~3개를 제안합니다.
                      </p>

                      {introGenerateError && (
                        <p className="mt-2 text-xs text-red-500">{introGenerateError}</p>
                      )}

                      {introCandidates.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {introCandidates.map((candidate, index) => {
                            const selected = descriptionDraft.trim() === candidate.trim();

                            return (
                              <button
                                key={`${index}-${candidate}`}
                                type="button"
                                onClick={() => {
                                  setDescriptionDraft(candidate);
                                  setIntroGenerateError(null);
                                }}
                                className={`w-full rounded-2xl border p-3 text-left transition-all ${
                                  selected
                                    ? "border-blue-500 bg-blue-50 shadow-sm"
                                    : "border-gray-200 bg-white hover:border-blue-200 hover:bg-blue-50/40"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-[11px] font-semibold text-gray-500">
                                      소개글 후보 {index + 1}
                                    </p>
                                    <p className="mt-1 text-sm leading-6 text-gray-700">
                                      {candidate}
                                    </p>
                                  </div>
                                  <span
                                    className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${
                                      selected
                                        ? "bg-blue-600 text-white"
                                        : "bg-gray-100 text-gray-500"
                                    }`}
                                  >
                                    {selected ? "선택됨" : "선택"}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">
                    활동 이미지 추가하기{" "}
                    <span className="text-blue-500">{imageUrls.length}/5</span>
                  </label>
                  <p className="text-xs text-gray-400 mb-3">
                    대표 이미지가 성과저장소 카드에 표시됩니다. 최대 5개까지 첨부 가능합니다.
                  </p>

                  {imageUrls.length > 0 && (
                    <div className="flex gap-3 flex-wrap mb-3">
                      {imageUrls.map((url, i) => (
                        <div key={i} className="relative w-24 h-24">
                          <img
                            src={url}
                            alt={`activity-${i}`}
                            className="w-24 h-24 object-cover rounded-xl border border-gray-200"
                          />
                          <button
                            onClick={() => handleImageRemove(i)}
                            className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {imageUrls.length < 5 && (
                    <label className="flex items-center gap-2 w-fit cursor-pointer border border-dashed border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-500 hover:bg-gray-50 transition-all">
                      <span>🖼</span>
                      <span>{imageUploading ? "업로드 중..." : "이미지 선택"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleImageUpload}
                        disabled={imageUploading}
                      />
                    </label>
                  )}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSaveBasicInfo}
                    disabled={basicSaving}
                    className="px-6 py-2.5 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition-all"
                  >
                    {basicSaving ? "저장 중..." : "저장"}
                  </button>
                </div>
              </div>
            )}

            {activeTab === "star" && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-blue-600 mb-1 block">
                    S - Situation (상황)
                  </label>
                  <p className="text-xs text-gray-400 mb-2">
                    프로젝트가 시작된 배경이나 당시 직면했던 구체적인 상황은 무엇인가요?
                  </p>
                  <textarea
                    value={starSituation}
                    onChange={(e) => setStarSituation(e.target.value)}
                    placeholder="예) 신규 서비스 출시를 앞두고 기존 온보딩 이탈률이 68%에 달하는 상황이었습니다."
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-blue-400"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-blue-600 mb-1 block">
                    T - Task (과제)
                  </label>
                  <p className="text-xs text-gray-400 mb-2">
                    본인이 해결해야 했던 핵심 과제와 목표 수치는 무엇이었나요?
                  </p>
                  <textarea
                    value={starTask}
                    onChange={(e) => setStarTask(e.target.value)}
                    placeholder="예) 온보딩 완료율을 3개월 내 85% 이상으로 개선하는 것이 목표였습니다."
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-blue-400"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-blue-600 mb-1 block">
                    A - Action (행동)
                  </label>
                  <p className="text-xs text-gray-400 mb-2">
                    목표 달성을 위해 어떤 구체적인 행동과 전략을 실행했나요?
                  </p>
                  <textarea
                    value={starAction}
                    onChange={(e) => setStarAction(e.target.value)}
                    placeholder="예) 사용자 인터뷰 20건을 진행하고 이탈 구간을 특정해 단계를 5단계에서 3단계로 축소했습니다."
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-blue-400"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-blue-600 mb-1 block">
                    R - Result (결과)
                  </label>
                  <p className="text-xs text-gray-400 mb-2">
                    결과적으로 어떤 성과를 냈나요? 숫자, 퍼센트, 비즈니스 임팩트 중심으로 작성해주세요.
                  </p>
                  <textarea
                    value={starResult}
                    onChange={(e) => setStarResult(e.target.value)}
                    placeholder="예) 온보딩 완료율 89% 달성, 첫 주 리텐션 41% 향상, 고객 문의 32% 감소."
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-blue-400"
                    rows={3}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleStarSave}
                    disabled={starSaving}
                    className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {starSaving ? "저장 중..." : "저장"}
                  </button>
                  <button
                    onClick={handleGenerateSummary}
                    disabled={summaryLoading || (!starSituation && !starTask && !starAction && !starResult)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition-all"
                  >
                    {summaryLoading ? "생성 중..." : "✦ AI 요약 생성"}
                  </button>
                </div>

                {summaryLoading && (
                  <p className="text-xs text-blue-400 text-center">
                    STAR 내용을 분석해 활동 소개를 작성하고 있습니다...
                  </p>
                )}
              </div>
            )}
          </div>

          {/* AI 코치 */}
          {activeTab === "star" && (
            <div className="bg-white rounded-xl border border-gray-200 flex flex-col h-[500px]">
              <div className="p-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">AI 코치</h2>
                <input
                  type="text"
                  placeholder="지원 직무 (예: PM, 백엔드 개발자)"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
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
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="활동 내용을 입력하세요..."
                  rows={2}
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-gray-400 resize-none"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={sending || !input.trim()}
                  className="px-3 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  전송
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {showPostSaveModal && postSaveActivity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
            <p className="text-sm font-semibold text-blue-500">저장 완료</p>
            <h2 className="mt-2 text-2xl font-bold text-gray-900">
              다음 단계로 바로 이어서 작업하시겠어요?
            </h2>
            <p className="mt-3 text-sm leading-6 text-gray-500">
              방금 저장한 활동을 STAR 기록으로 정리하거나, 포트폴리오 초안으로
              변환해 이어서 보실 수 있습니다.
            </p>

            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={() => void handleSendToStar()}
                disabled={postSaveAction !== null}
                className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4 text-left transition hover:border-blue-300 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <p className="text-sm font-semibold text-blue-700">
                  {postSaveAction === "star" ? "STAR로 변환 중..." : "STAR로 보내기"}
                </p>
                <p className="mt-1 text-xs leading-5 text-blue-600">
                  활동 내용을 STAR 탭으로 옮겨서 바로 다듬을 수 있습니다.
                </p>
              </button>

              <button
                type="button"
                onClick={() => void handleSendToPortfolio()}
                disabled={postSaveAction !== null}
                className="w-full rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-left transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <p className="text-sm font-semibold text-emerald-700">
                  {postSaveAction === "portfolio"
                    ? "포트폴리오 초안 생성 중..."
                    : "포트폴리오에 추가하기"}
                </p>
                <p className="mt-1 text-xs leading-5 text-emerald-600">
                  현재 활동을 포트폴리오 구조로 변환한 초안을 확인할 수 있습니다.
                </p>
              </button>
            </div>

            <button
              type="button"
              onClick={handlePostSaveLater}
              disabled={postSaveAction !== null}
              className="mt-6 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              나중에 하기
            </button>
          </div>
        </div>
      )}
      {showDeleteModal && !isNewActivity && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-80 text-center shadow-xl">
            <p className="font-bold text-gray-900 text-lg mb-2">성과를 삭제할까요?</p>
            <p className="text-sm text-gray-400 mb-6">
              삭제된 성과는 복구할 수 없습니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 disabled:opacity-50"
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
