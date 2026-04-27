"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { resolveProfileTargetJob } from "@/lib/normalizers/profile";
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
  EducationEditorModal,
  ListEditorModal,
  SelfIntroEditorModal,
  SkillEditorModal,
} from "./_components/profile-section-editors";
import {
  type EditableSection,
  buildCareerCards,
  formatEducationLine,
  getCareerItemsFromActivities,
  getActivitySortValue,
  isStructuredCareerLine,
  toArray,
} from "./_lib/profile-page";


export default function DashboardPage() {
  const router = useRouter();
  const [editing, setEditing] = useState<EditableSection | null>(null);
  const [activeTab, setActiveTab] = useState<string>("전체");
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
    profileTargetJobInput,
    setProfileTargetJobInput,
    profileBioInput,
    setProfileBioInput,
    profileEmailInput,
    setProfileEmailInput,
    profilePhoneInput,
    setProfilePhoneInput,
    profileAddressInput,
    setProfileAddressInput,
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
  const displayedEducationItems = educationItems.map(formatEducationLine);
  const awardItems = toArray(profile.awards);
  const certItems = toArray(profile.certifications);
  const languageItems = toArray(profile.languages);
  const skillItems = toArray(profile.skills);
  const careerCards = buildCareerCards(careerItems, activities);
  const tabs = [
    { label: "전체", type: "전체" },
    { label: "회사 프로젝트", type: "회사경력" },
    { label: "개인 프로젝트", type: "개인프로젝트" },
    { label: "대외 활동", type: "대외활동" },
    { label: "학생 활동", type: "학생활동" },
  ];
  const tabActivities = useMemo(() => {
    const filtered =
      activeTab === "전체"
        ? activities
        : activities.filter((activity) => {
            const activityType = activity.type as string;
            return activeTab === "개인프로젝트"
              ? activityType === "프로젝트" || activityType === "개인프로젝트"
              : activityType === activeTab;
          });

    return [...filtered].sort((a, b) => getActivitySortValue(b) - getActivitySortValue(a));
  }, [activeTab, activities]);
  const completion = useMemo(() => {
    let score = 0;
    const missingItems: string[] = [];
    if (!profile) return { score: 0, missingItems: ["기본 정보"] };

    const profileAny = profile as Profile & {
      avatar_url?: string | null;
      bio?: string | null;
      education?: string[] | string | null;
    };
    const targetJob = resolveProfileTargetJob(profile);

    if (profileAny.avatar_url) score += 10;
    else missingItems.push("프로필 사진");

    if (profile.name) score += 10;
    else missingItems.push("이름");

    if (profile.email) score += 10;
    else missingItems.push("이메일");

    if (profile.phone) score += 10;
    else missingItems.push("전화번호");

    if (targetJob || profileAny.bio || profile.self_intro) score += 10;
    else missingItems.push("희망 직무/소개");

    if (toArray(profile.skills).length > 0) score += 10;
    else missingItems.push("스킬");

    if (toArray(profile.career).length > 0) score += 10;
    else missingItems.push("경력");

    const educationSource = Array.isArray(profileAny.education)
      ? profileAny.education
      : [profileAny.education ?? ""].filter(Boolean);
    if (toArray(educationSource).length > 0) score += 10;
    else missingItems.push("학력");

    const activityCount = activities.length;
    if (activityCount >= 2) score += 20;
    else if (activityCount === 1) {
      score += 10;
      missingItems.push("활동 1개 추가");
    } else {
      missingItems.push("활동 2개");
    }

    return { score: Math.min(score, 100), missingItems };
  }, [profile, activities]);
  const completionScore = completion.score;
  const isCompletionComplete = completionScore >= 100;
  const [showCompletionCard, setShowCompletionCard] = useState(true);

  useEffect(() => {
    if (!isCompletionComplete) {
      setShowCompletionCard(true);
      return;
    }

    setShowCompletionCard(true);
    const timer = window.setTimeout(() => {
      setShowCompletionCard(false);
    }, 1900);

    return () => window.clearTimeout(timer);
  }, [isCompletionComplete]);

  return (
    <div className="min-h-screen bg-[#f3f6fb] px-6 py-8">
      <div className="mx-auto max-w-7xl space-y-4">
        {showCompletionCard && (
          <ProfileCompletionCard
            completionScore={completionScore}
            missingItems={completion.missingItems}
            isComplete={isCompletionComplete}
          />
        )}

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

            <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ProfileCareerCardSection
                careerCards={careerCards}
                onEditCareer={() => setEditing("career")}
              />

              <ProfileListCard
                title="🎓 학력"
                items={displayedEducationItems}
                emptyMessage="학력을 입력해주세요."
                onEdit={() => setEditing("education_history")}
              />
            </div>

            <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
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

      <EducationEditorModal
        open={editing === "education_history"}
        initialItems={educationItems}
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

      <SkillEditorModal
        open={editing === "skills"}
        initialItems={skillItems}
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

      <SelfIntroEditorModal
        open={editing === "self_intro"}
        initialValue={profile.self_intro || ""}
        saving={saving}
        onClose={() => setEditing(null)}
        onSave={async (value) => updateProfileSection({ self_intro: value })}
      />

        <ProfileEditModal
          open={isProfileModalOpen}
          avatarPreviewUrl={avatarPreviewUrl}
          fileInputRef={fileInputRef}
          onAvatarFileChange={handleAvatarFileChange}
          profileNameInput={profileNameInput}
          onProfileNameInputChange={setProfileNameInput}
          profileTargetJobInput={profileTargetJobInput}
          onProfileTargetJobInputChange={setProfileTargetJobInput}
          profileBioInput={profileBioInput}
          onProfileBioInputChange={setProfileBioInput}
          profileEmailInput={profileEmailInput}
        onProfileEmailInputChange={setProfileEmailInput}
        profilePhoneInput={profilePhoneInput}
        onProfilePhoneInputChange={setProfilePhoneInput}
        profileAddressInput={profileAddressInput}
        onProfileAddressInputChange={setProfileAddressInput}
        profilePortfolioUrlInput={profilePortfolioUrlInput}
        onProfilePortfolioUrlInputChange={setProfilePortfolioUrlInput}
        profileModalSaving={profileModalSaving}
        onClose={() => setIsProfileModalOpen(false)}
        onSave={handleSaveProfileModal}
      />
    </div>
  );
}
