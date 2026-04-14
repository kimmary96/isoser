// 활동 상세 페이지 - 활동 내용 편집 + AI 코치 대화
"use client";

import { useParams, useSearchParams } from "next/navigation";

import { useActivityDetail } from "../_hooks/use-activity-detail";
import { ActivityBasicTab } from "../_components/activity-basic-tab";
import { ActivityCoachPanel } from "../_components/activity-coach-panel";
import { ActivityDetailModals } from "../_components/activity-detail-modals";
import { ActivityStarTab } from "../_components/activity-star-tab";

export default function ActivityDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const activityId = params.id as string;
  const isNewActivity = activityId === "new" || activityId === "__new__";
  const {
    router,
    activity,
    messages,
    input,
    setInput,
    descriptionDraft,
    setDescriptionDraft,
    jobTitle,
    setJobTitle,
    loading,
    sending,
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
    summaryLoading,
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
    handleGenerateSummary,
  } = useActivityDetail(activityId, isNewActivity, searchParams.get("tab"));

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
