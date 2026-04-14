"use client";

import { useEffect, useRef, useState } from "react";

import {
  getDashboardProfile,
  saveDashboardProfile,
  updateDashboardProfileSection,
} from "@/lib/api/app";
import { getGuestActivities, isGuestMode } from "@/lib/guest";
import type { Activity, MatchAnalysisRecord, Profile } from "@/lib/types";

const EMPTY_PROFILE: Profile = {
  id: "",
  name: null,
  bio: null,
  portfolio_url: null,
  email: null,
  phone: null,
  education: null,
  career: [],
  education_history: [],
  awards: [],
  certifications: [],
  languages: [],
  skills: [],
  self_intro: "",
  created_at: "",
  updated_at: "",
};

export function useProfilePage() {
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [matchAnalyses, setMatchAnalyses] = useState<MatchAnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileModalSaving, setProfileModalSaving] = useState(false);
  const [profileNameInput, setProfileNameInput] = useState("");
  const [profileBioInput, setProfileBioInput] = useState("");
  const [profileEmailInput, setProfileEmailInput] = useState("");
  const [profilePhoneInput, setProfilePhoneInput] = useState("");
  const [profilePortfolioUrlInput, setProfilePortfolioUrlInput] = useState("");
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        if (isGuestMode()) {
          const guestProfile: Profile = {
            ...EMPTY_PROFILE,
            id: "guest",
            name: "게스트 사용자",
            bio: "게스트 QA 엔지니어",
            email: "guest@local",
            phone: "-",
            education: "게스트 모드",
            career: ["게스트 회사 | QA 엔지니어 | 2024.01 ~ 현재"],
            education_history: ["게스트 학력"],
            awards: [],
            certifications: [],
            languages: ["한국어"],
            skills: ["FastAPI", "Next.js"],
            self_intro: "게스트 모드에서 기능을 점검 중입니다.",
          };
          setProfile(guestProfile);
          setActivities(getGuestActivities());
          setMatchAnalyses([
            {
              id: "guest-analysis-1",
              user_id: "guest",
              job_title: "QA Engineer",
              job_posting: "QA Engineer 공고",
              total_score: 78,
              grade: "A",
              summary: "테스트 자동화 경험과 협업 역량이 공고와 잘 맞습니다.",
              matched_keywords: ["테스트 자동화", "API 검증", "협업"],
              missing_keywords: ["모바일 QA"],
              recommended_activities: ["guest-activity-1"],
              created_at: new Date().toISOString(),
            },
          ]);
          return;
        }

        const data = await getDashboardProfile();
        setProfile(data.profile ?? EMPTY_PROFILE);
        setActivities(data.activities ?? []);
        setMatchAnalyses((data.matchAnalyses as MatchAnalysisRecord[] | null) ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "대시보드 데이터를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, []);

  useEffect(() => {
    if (!isProfileModalOpen) return;

    const profileAny = profile as Profile & { avatar_url?: string | null; bio?: string | null };
    setProfileNameInput(profile.name ?? "");
    setProfileBioInput(profileAny.bio ?? "");
    setProfileEmailInput(profile.email ?? "");
    setProfilePhoneInput(profile.phone ?? "");
    setProfilePortfolioUrlInput(
      (profile as Profile & { portfolio_url?: string | null }).portfolio_url ?? ""
    );
    setAvatarPreviewUrl(profileAny.avatar_url ?? null);
    setAvatarFile(null);
  }, [isProfileModalOpen, profile]);

  const updateProfileSection = async (patch: Partial<Profile>) => {
    setSaving(true);
    setError(null);

    try {
      if (isGuestMode()) {
        setProfile((prev) => ({ ...prev, ...patch }));
        return;
      }

      const data = await updateDashboardProfileSection(patch);
      setProfile(data.profile);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 중 오류가 발생했습니다.");
      throw e;
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreviewUrl(URL.createObjectURL(file));
  };

  const handleSaveProfileModal = async () => {
    if (!profileNameInput.trim()) {
      setError("이름은 필수입니다.");
      return;
    }

    setProfileModalSaving(true);
    setError(null);
    try {
      const profileAny = profile as Profile & {
        avatar_url?: string | null;
        portfolio_url?: string | null;
      };
      const normalizedPortfolioUrl = profilePortfolioUrlInput.trim()
        ? /^(https?:)?\/\//i.test(profilePortfolioUrlInput.trim())
          ? profilePortfolioUrlInput.trim()
          : `https://${profilePortfolioUrlInput.trim()}`
        : null;

      if (!isGuestMode()) {
        const payload = new FormData();
        payload.set("name", profileNameInput.trim());
        payload.set("bio", profileBioInput.trim());
        payload.set("email", profileEmailInput.trim());
        payload.set("phone", profilePhoneInput.trim());
        payload.set("portfolio_url", normalizedPortfolioUrl ?? "");
        payload.set("current_avatar_url", profileAny.avatar_url ?? "");
        if (avatarFile) {
          payload.set("avatar", avatarFile);
        }

        const data = await saveDashboardProfile(payload);
        setProfile(data.profile);
      } else {
        const nextAvatarUrl =
          avatarFile && avatarPreviewUrl ? avatarPreviewUrl : profileAny.avatar_url ?? null;
        setProfile((prev) => ({
          ...prev,
          name: profileNameInput.trim(),
          bio: profileBioInput.trim() || null,
          email: profileEmailInput.trim() || null,
          phone: profilePhoneInput.trim() || null,
          portfolio_url: normalizedPortfolioUrl,
          avatar_url: nextAvatarUrl ?? undefined,
        }));
      }
      setIsProfileModalOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "프로필 저장에 실패했습니다.");
    } finally {
      setProfileModalSaving(false);
    }
  };

  return {
    profile,
    activities,
    matchAnalyses,
    loading,
    saving,
    error,
    setError,
    updateProfileSection,
    isProfileModalOpen,
    setIsProfileModalOpen,
    profileModalSaving,
    profileNameInput,
    setProfileNameInput,
    profileBioInput,
    setProfileBioInput,
    profileEmailInput,
    setProfileEmailInput,
    profilePhoneInput,
    setProfilePhoneInput,
    profilePortfolioUrlInput,
    setProfilePortfolioUrlInput,
    avatarPreviewUrl,
    avatarFile,
    fileInputRef,
    handleAvatarFileChange,
    handleSaveProfileModal,
  };
}
