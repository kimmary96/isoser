"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type { Profile } from "@/lib/types";
import { useProfilePage } from "./_hooks/use-profile-page";
import { ProfileActivityStrip } from "./_components/profile-activity-strip";
import { ProfileCompletionCard } from "./_components/profile-completion-card";
import {
  ProfileCareerCardSection,
  ProfileFooterActions,
  ProfileListCard,
} from "./_components/profile-detail-cards";
import { ProfileEditModal } from "./_components/profile-edit-modal";
import { ProfileHeroSection } from "./_components/profile-hero-section";
import {
  CareerEditorModal,
  ListEditorModal,
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
    loading,
    saving,
    error,
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

            <ProfileActivityStrip
              tabs={tabs}
              activeTab={activeTab}
              activities={activities}
              tabActivities={tabActivities}
              onSelectTab={setActiveTab}
              onManageActivities={() => router.push("/dashboard/activities")}
              onOpenActivity={(id) => router.push(`/dashboard/activities/${id}`)}
              onCreateActivity={() => router.push("/dashboard/activities/new")}
            />

            <div className="mb-6 grid grid-cols-2 gap-6">
              <ProfileCareerCardSection
                careerCards={careerCards}
                onEditCareer={() => setEditing("career")}
              />

              <ProfileListCard
                title="🎓 학력"
                items={educationItems}
                emptyMessage="학력을 입력해주세요."
                onEdit={() => setEditing("education_history")}
              />
            </div>

            <div className="mb-6 grid grid-cols-3 gap-6">
              <ProfileListCard
                title="🏆 수상경력"
                items={awardItems}
                emptyMessage="수상 경력을 입력하세요."
                onEdit={() => setEditing("awards")}
              />

              <ProfileListCard
                title="📋 자격증"
                items={certItems}
                emptyMessage="자격증을 입력하세요."
                onEdit={() => setEditing("certifications")}
              />

              <ProfileListCard
                title="🌐 외국어"
                items={languageItems}
                emptyMessage="외국어를 입력하세요."
                onEdit={() => setEditing("languages")}
              />
            </div>

            <ProfileFooterActions
              hasPortfolioUrl={Boolean((profile as Profile & { portfolio_url?: string | null }).portfolio_url)}
              onOpenSettings={() => setIsProfileModalOpen(true)}
              onOpenPortfolio={() => {
                const portfolioUrl = (profile as Profile & { portfolio_url?: string | null }).portfolio_url;
                if (portfolioUrl) {
                  window.open(portfolioUrl, "_blank", "noopener,noreferrer");
                  return;
                }
                setIsProfileModalOpen(true);
              }}
            />
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
