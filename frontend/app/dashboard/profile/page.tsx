"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type { Profile } from "@/lib/types";
import { useProfilePage } from "./_hooks/use-profile-page";
import { ProfileCompletionCard } from "./_components/profile-completion-card";
import { ProfileEditModal } from "./_components/profile-edit-modal";
import { ProfileHeroSection } from "./_components/profile-hero-section";
import {
  CareerEditorModal,
  ListEditorModal,
  PencilButton,
  ReadonlyListSection,
} from "./_components/profile-section-editors";
import {
  type EditableSection,
  buildCareerCards,
  getCareerItemsFromActivities,
  isStructuredCareerLine,
  toArray,
} from "./_lib/profile-page";


export default function DashboardPage() {
  const router = useRouter();
  const [editing, setEditing] = useState<EditableSection | null>(null);
  const [activeTab, setActiveTab] = useState<string>("회사경력");
  const {
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
    fileInputRef,
    handleAvatarFileChange,
    handleSaveProfileModal,
  } = useProfilePage();

  const rawCareerItems = toArray(profile.career);
  const structuredCareerItems = rawCareerItems.filter(isStructuredCareerLine);
  const derivedCareerItems = getCareerItemsFromActivities(activities);
  const careerItems = structuredCareerItems.length > 0 ? structuredCareerItems : derivedCareerItems;
  const educationItems =
    toArray(profile.education_history).length > 0
      ? toArray(profile.education_history)
      : [profile.education ?? ""].filter(Boolean);
  const awardItems = toArray(profile.awards);
  const certItems = toArray(profile.certifications);
  const languageItems = toArray(profile.languages);
  const skillItems = toArray(profile.skills);
  const careerCards = buildCareerCards(careerItems, activities);
  const tabs = [
    { label: "회사 프로젝트", type: "회사경력" },
    { label: "개인 프로젝트", type: "개인프로젝트" },
    { label: "대외 활동", type: "대외활동" },
    { label: "학생 활동", type: "학생활동" },
  ];
  const tabActivities = activities.filter((a) => {
    const activityType = a.type as string;
    return activeTab === "개인프로젝트"
      ? activityType === "프로젝트" || activityType === "개인프로젝트"
      : activityType === activeTab;
  });
  const recommendedRate =
    matchAnalyses.length > 0
      ? matchAnalyses.filter((item) => item.total_score >= 75).length / matchAnalyses.length
      : 0;
  const recentMatchAnalyses = matchAnalyses.slice(0, 3);
  const completionScore = useMemo(() => {
    let score = 0;
    if (!profile) return 0;

    const profileAny = profile as Profile & {
      avatar_url?: string | null;
      bio?: string | null;
      education?: string[] | string | null;
    };

    if (profileAny.avatar_url) score += 10;
    if (profile.name) score += 10;
    if (profile.email) score += 10;
    if (profile.phone) score += 10;
    if (profileAny.bio || profile.self_intro) score += 10;
    if (toArray(profile.skills).length > 0) score += 10;
    if (toArray(profile.career).length > 0) score += 10;

    const educationSource = Array.isArray(profileAny.education)
      ? profileAny.education
      : [profileAny.education ?? ""].filter(Boolean);
    if (toArray(educationSource).length > 0) score += 10;

    const activityCount = activities.length;
    if (activityCount >= 2) score += 20;
    else if (activityCount === 1) score += 10;

    return Math.min(score, 100);
  }, [profile, activities]);
  const profileAny = profile as Profile & { avatar_url?: string | null };

  return (
    <div className="min-h-screen bg-[#f3f6fb] px-6 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <ProfileCompletionCard completionScore={completionScore} />

        {error && <p className="text-sm text-red-600">{error}</p>}

        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-slate-500 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">불러오는 중...</div>
        ) : (
          <>
            <ProfileHeroSection
              profile={profile as Profile & { avatar_url?: string | null; portfolio_url?: string | null }}
              skillItems={skillItems}
              onOpenProfileModal={() => setIsProfileModalOpen(true)}
              onEditSelfIntro={() => setEditing("self_intro")}
              onEditSkills={() => setEditing("skills")}
            />

            <div className="mb-6">
              <div className="flex gap-2 mb-4 flex-wrap">
                {tabs.map((tab) => {
                  const count = activities.filter((a) => {
                    const activityType = a.type as string;
                    return tab.type === "개인프로젝트"
                      ? activityType === "프로젝트" || activityType === "개인프로젝트"
                      : activityType === tab.type;
                  }).length;
                  return (
                    <button
                      key={tab.type}
                      onClick={() => setActiveTab(tab.type)}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                        activeTab === tab.type ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {tab.label}
                      <span className={`text-xs ${activeTab === tab.type ? "text-gray-300" : "text-gray-400"}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => router.push("/dashboard/activities")}
                  className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500 hover:bg-slate-50"
                >
                  ⚙ 활동 관리
                </button>
              </div>

              <div className="flex gap-4 overflow-x-auto pb-2">
                {tabActivities.map((activity) => (
                  <div
                    key={activity.id}
                    onClick={() => router.push(`/dashboard/activities/${activity.id}`)}
                    className="flex-shrink-0 w-56 overflow-hidden rounded-3xl border border-slate-200 bg-white cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(15,23,42,0.08)]"
                    style={{ height: "220px" }}
                  >
                    <div className="flex h-28 items-center justify-center bg-[linear-gradient(135deg,#dbeafe,#e2e8f0)]">
                      <span className="text-2xl text-slate-400">🖼</span>
                    </div>
                    <div className="p-3">
                      <p className="mb-1 text-xs text-slate-400">{activity.period}</p>
                      <p className="line-clamp-2 text-sm font-semibold text-slate-900">{activity.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">{activity.description}</p>
                    </div>
                  </div>
                ))}
                <div
                  onClick={() => router.push("/dashboard/activities/new")}
                  className="flex-shrink-0 flex w-24 flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-slate-300 bg-white cursor-pointer text-slate-400 hover:text-slate-600"
                  style={{ height: "220px" }}
                >
                  <span className="text-2xl">+</span>
                  <span className="text-xs">활동 추가</span>
                </div>
              </div>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-6">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold tracking-tight text-slate-950">🗂 경력</h3>
                  <PencilButton onClick={() => setEditing("career")} label="경력 수정" />
                </div>
                {careerCards.length === 0 ? (
                  <p className="text-sm text-slate-400">저장된 경력이 없습니다.</p>
                ) : (
                  careerCards.map((card, i) => (
                    <div key={i} className="mb-4">
                      <div className="flex justify-between items-start mb-1">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{card.company}</p>
                          <p className="text-xs text-slate-500">{card.position}</p>
                        </div>
                        <p className="ml-2 shrink-0 text-xs text-slate-400">{card.period}</p>
                      </div>
                      <div className="mt-2 space-y-1 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        {card.activities.map((act, j) => (
                          <p key={j} className="text-xs text-slate-600">- {act.title}</p>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
                <ReadonlyListSection
                  title="🎓 학력"
                  items={educationItems}
                  emptyMessage="학력을 입력해주세요."
                  onEdit={() => setEditing("education_history")}
                />
              </div>
            </div>

            <div className="mb-6 grid grid-cols-3 gap-6">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
                <ReadonlyListSection
                  title="🏆 수상경력"
                  items={awardItems}
                  emptyMessage="수상 경력을 입력하세요."
                  onEdit={() => setEditing("awards")}
                />
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
                <ReadonlyListSection
                  title="📋 자격증"
                  items={certItems}
                  emptyMessage="자격증을 입력하세요."
                  onEdit={() => setEditing("certifications")}
                />
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
                <ReadonlyListSection
                  title="🌐 외국어"
                  items={languageItems}
                  emptyMessage="외국어를 입력하세요."
                  onEdit={() => setEditing("languages")}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mb-8">
              <button className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
                ⚙ 설정
              </button>
              <button
                type="button"
                onClick={() => {
                  const portfolioUrl = (profile as Profile & { portfolio_url?: string | null }).portfolio_url;
                  if (portfolioUrl) {
                    window.open(portfolioUrl, "_blank", "noopener,noreferrer");
                    return;
                  }
                  setIsProfileModalOpen(true);
                }}
                className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                {(profile as Profile & { portfolio_url?: string | null }).portfolio_url ? "포트폴리오 링크 열기" : "포트폴리오 링크 설정"}
              </button>
            </div>
          </>
        )}
      </div>

      <CareerEditorModal
        open={editing === "career"}
        initialItems={careerItems}
        saving={saving}
        onClose={() => setEditing(null)}
        onSave={async (items) => updateProfileSection({ career: items })}
      />

      <ListEditorModal
        open={editing === "education_history"}
        title="학력 수정"
        initialItems={educationItems}
        placeholder="학력 항목 입력"
        saving={saving}
        onClose={() => setEditing(null)}
        onSave={async (items) => updateProfileSection({ education_history: items })}
      />

      <ListEditorModal
        open={editing === "awards"}
        title="수상 수정"
        initialItems={awardItems}
        placeholder="수상 항목 입력"
        saving={saving}
        onClose={() => setEditing(null)}
        onSave={async (items) => updateProfileSection({ awards: items })}
      />

      <ListEditorModal
        open={editing === "certifications"}
        title="자격증 수정"
        initialItems={certItems}
        placeholder="자격증 항목 입력"
        saving={saving}
        onClose={() => setEditing(null)}
        onSave={async (items) => updateProfileSection({ certifications: items })}
      />

      <ListEditorModal
        open={editing === "skills"}
        title="스킬 수정"
        initialItems={skillItems}
        placeholder="스킬 입력"
        saving={saving}
        onClose={() => setEditing(null)}
        onSave={async (items) => updateProfileSection({ skills: items })}
      />

      <ListEditorModal
        open={editing === "languages"}
        title="외국어 수정"
        initialItems={languageItems}
        placeholder="외국어 항목 입력"
        saving={saving}
        onClose={() => setEditing(null)}
        onSave={async (items) => updateProfileSection({ languages: items })}
      />

      <ListEditorModal
        open={editing === "self_intro"}
        title="자기소개 수정"
        initialItems={[profile.self_intro || ""]}
        placeholder="자기소개 입력"
        saving={saving}
        onClose={() => setEditing(null)}
        onSave={async (items) => updateProfileSection({ self_intro: items[0] ?? "" })}
      />

      <ProfileEditModal
        open={isProfileModalOpen}
        avatarPreviewUrl={avatarPreviewUrl}
        fileInputRef={fileInputRef}
        onAvatarFileChange={handleAvatarFileChange}
        profileNameInput={profileNameInput}
        onProfileNameInputChange={setProfileNameInput}
        profileBioInput={profileBioInput}
        onProfileBioInputChange={setProfileBioInput}
        profileEmailInput={profileEmailInput}
        onProfileEmailInputChange={setProfileEmailInput}
        profilePhoneInput={profilePhoneInput}
        onProfilePhoneInputChange={setProfilePhoneInput}
        profilePortfolioUrlInput={profilePortfolioUrlInput}
        onProfilePortfolioUrlInputChange={setProfilePortfolioUrlInput}
        profileModalSaving={profileModalSaving}
        onClose={() => setIsProfileModalOpen(false)}
        onSave={handleSaveProfileModal}
      />
    </div>
  );
}
