
"use client";

import { useResumeBuilder } from "./_hooks/use-resume-builder";
import { ResumeAssistantSidebar } from "./_components/resume-assistant-sidebar";
import { ResumePreviewPane } from "./_components/resume-preview-pane";
import { getActivityPreviewText } from "@/lib/activity-display";

export default function ResumePage() {
  const {
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
  } = useResumeBuilder();

  const COMMON_QUESTIONS = [
    "자기소개 (1분 자기소개)",
    "성장과정",
    "지원동기",
    "성격의 장단점",
    "입사 후 포부",
  ];

  const COMPANY_QUESTIONS = [
    "직무 관련 경험",
    "팀워크/협업 경험",
    "어려움을 극복한 경험",
    "본인의 강점과 직무 연관성",
    "회사를 선택한 이유",
  ];

  const selectedActivities = activities
    .filter((a) => selected.has(a.id))
    .sort((a, b) => {
      const aDate = a.period?.split("~")[1]?.trim() || a.period || "";
      const bDate = b.period?.split("~")[1]?.trim() || b.period || "";
      return bDate.localeCompare(aDate);
    });

  const careerActivities = activities
    .filter((a) => a.type === "회사경력")
    .sort((a, b) => (b.period || "").localeCompare(a.period || ""));

  const projectActivities = activities
    .filter((a) => ["프로젝트", "대외활동", "학생활동"].includes(a.type))
    .sort((a, b) => (b.period || "").localeCompare(a.period || ""));

  const selectedCareerActivities = careerActivities.filter((a) => selected.has(a.id));
  const selectedProjectActivities = projectActivities.filter((a) =>
    selected.has(a.id)
  );
  const selectedSkillsList = Array.from(selectedSkills);

  const currentActivities = leftSubTab === "회사경력" ? careerActivities : projectActivities;

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f3f6fb]">
        <p className="text-slate-500">불러오는 중...</p>
      </main>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f3f6fb] text-slate-950">
      <div className="flex h-full w-80 flex-shrink-0 flex-col border-r border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.04)] 2xl:w-[21rem]">
        <div className="flex border-b border-slate-100">
          {(["성과저장소", "자기소개서"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setLeftMainTab(tab);
                setLeftSubTab(tab === "성과저장소" ? "회사경력" : "공통질문");
              }}
              className={`flex-1 py-3 text-[13px] font-semibold transition-all ${
                leftMainTab === tab
                  ? "border-b-2 border-[#094cb2] text-[#094cb2]"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {tab}
              {tab === "성과저장소" && (
                <span className="ml-1 text-[11px] text-slate-400">{activities.length}개</span>
              )}
            </button>
          ))}
        </div>

        {leftMainTab === "성과저장소" && (
          <>
            <div className="border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-[#eef6ff] px-3 py-2">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-slate-400"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
                <span className="text-xs text-slate-400">검색하기</span>
              </div>
            </div>

            <div className="flex gap-1.5 border-b border-slate-100 px-4 py-3">
              {["회사경력", "프로젝트", "기술스택"].map((tab) => {
                const isActive =
                  leftSubTab === tab ||
                  (tab !== "기술스택" && activeTypeTab === tab && leftSubTab !== "기술스택");
                return (
                  <button
                    key={tab}
                    onClick={() => {
                      setLeftSubTab(tab);
                      if (tab === "회사경력" || tab === "프로젝트") {
                        setActiveTypeTab(tab);
                      }
                    }}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                      isActive
                        ? "bg-[#071a36] text-white"
                        : "border border-slate-200 bg-white text-slate-600 hover:border-orange-200 hover:text-orange-700"
                    }`}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 space-y-2.5 overflow-y-auto p-4">
              {leftSubTab === "기술스택" && (
                <div className="space-y-2">
                  <p className="mb-3 text-xs text-slate-500">이력서에 포함할 기술을 선택하세요.</p>
                  <div className="flex flex-wrap gap-2">
                    {(profile?.skills || []).map((skill, i) => {
                      const isSelected = selectedSkills.has(skill);
                      return (
                        <button
                          key={i}
                          onClick={() => {
                            const next = new Set(selectedSkills);
                            if (next.has(skill)) next.delete(skill);
                            else next.add(skill);
                            setSelectedSkills(next);
                          }}
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                            isSelected
                              ? "border-[#094cb2] bg-[#094cb2] text-white"
                              : "border-slate-200 bg-white text-slate-600 hover:border-orange-200 hover:text-orange-700"
                          }`}
                        >
                          {skill}
                        </button>
                      );
                    })}
                    {(!profile?.skills || profile.skills.length === 0) && (
                      <p className="text-xs text-slate-400">
                        대시보드에서 기술 스택을 먼저 추가해주세요.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {leftSubTab !== "기술스택" &&
                currentActivities.map((activity) => {
                  const isSelected = selected.has(activity.id);
                  return (
                    <div
                      key={activity.id}
                      onClick={() => toggleSelect(activity.id)}
                      className={`cursor-pointer rounded-2xl border p-3.5 transition-all ${
                        isSelected
                          ? "border-blue-200 bg-[#eef6ff]"
                          : "border-slate-200 bg-white hover:border-orange-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <span className="rounded-full bg-[#fff1e6] px-2 py-0.5 text-[11px] font-semibold text-[#c94f12]">
                            {activity.type}
                          </span>
                          <p className="mt-1.5 line-clamp-2 text-[13px] font-bold leading-snug text-slate-950">
                            {activity.title}
                          </p>
                          {activity.period && (
                            <p className="mt-1 text-[11px] text-slate-400">{activity.period}</p>
                          )}
                          {getActivityPreviewText(activity) && (
                            <p className="mt-1.5 line-clamp-2 text-[11px] leading-4 text-slate-500">
                              {getActivityPreviewText(activity)}
                            </p>
                          )}
                          {Array.isArray(activity.skills) && activity.skills.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {activity.skills.slice(0, 3).map((s, i) => (
                                <span
                                  key={i}
                                  className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500"
                                >
                                  {s}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div
                          className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-2 transition-all ${
                            isSelected ? "border-[#094cb2] bg-[#094cb2]" : "border-slate-300"
                          }`}
                        >
                          {isSelected && (
                            <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                              <path
                                d="M2 6l3 3 5-5"
                                stroke="white"
                                strokeWidth="2"
                                strokeLinecap="round"
                              />
                            </svg>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </>
        )}

        {leftMainTab === "자기소개서" && (
          <>
            <div className="flex border-b border-slate-100">
              {(["공통질문", "회사맞춤질문", "직접입력"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setCoverLetterTab(tab)}
                  className={`flex-1 py-2.5 text-[11px] font-semibold transition-all ${
                    coverLetterTab === tab
                      ? "border-b-2 border-[#094cb2] text-[#094cb2]"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {coverLetterTab === "공통질문" && (
                <div className="space-y-2">
                  <p className="mb-3 text-xs text-slate-500">이력서에 포함할 항목을 선택하세요.</p>
                  {COMMON_QUESTIONS.map((q, i) => {
                    const isSelected = selectedCommonQuestions.has(q);
                    return (
                      <div
                        key={i}
                        onClick={() => {
                          const next = new Set(selectedCommonQuestions);
                          if (next.has(q)) next.delete(q);
                          else next.add(q);
                          setSelectedCommonQuestions(next);
                        }}
                        className={`cursor-pointer rounded-2xl border p-3 transition-all ${
                          isSelected
                            ? "border-blue-200 bg-[#eef6ff]"
                            : "border-slate-200 bg-white hover:border-orange-200"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-slate-700">{q}</p>
                          <div
                            className={`ml-2 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-2 ${
                              isSelected ? "border-[#094cb2] bg-[#094cb2]" : "border-slate-300"
                            }`}
                          >
                            {isSelected && (
                              <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                                <path
                                  d="M2 6l3 3 5-5"
                                  stroke="white"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                />
                              </svg>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {coverLetterTab === "회사맞춤질문" && (
                <div className="space-y-2">
                  <p className="mb-3 text-xs text-slate-500">
                    채용공고 URL이나 내용을 AI 어시스턴트에 입력하면 맞춤 질문을 추출해드립니다.
                  </p>
                  {COMPANY_QUESTIONS.map((q, i) => {
                    const isSelected = selectedCommonQuestions.has(q);
                    return (
                      <div
                        key={i}
                        onClick={() => {
                          const next = new Set(selectedCommonQuestions);
                          if (next.has(q)) next.delete(q);
                          else next.add(q);
                          setSelectedCommonQuestions(next);
                        }}
                        className={`cursor-pointer rounded-2xl border p-3 transition-all ${
                          isSelected
                            ? "border-blue-200 bg-[#eef6ff]"
                            : "border-slate-200 bg-white hover:border-orange-200"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-slate-700">{q}</p>
                          <div
                            className={`ml-2 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-2 ${
                              isSelected ? "border-[#094cb2] bg-[#094cb2]" : "border-slate-300"
                            }`}
                          >
                            {isSelected && (
                              <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                                <path
                                  d="M2 6l3 3 5-5"
                                  stroke="white"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                />
                              </svg>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {coverLetterTab === "직접입력" && (
                <div className="space-y-3">
                  <p className="mb-3 text-xs text-slate-500">질문을 직접 입력하고 이력서에 추가하세요.</p>
                  <div className="flex gap-2">
                    <input
                      value={customQuestionInput}
                      onChange={(e) => setCustomQuestionInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && customQuestionInput.trim()) {
                          setCustomQuestion(customQuestionInput.trim());
                          setSelectedCommonQuestions(
                            (prev) => new Set([...prev, customQuestionInput.trim()])
                          );
                          setCustomQuestionInput("");
                        }
                      }}
                      placeholder="질문 입력 후 Enter"
                      className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#094cb2] focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        if (customQuestionInput.trim()) {
                          setCustomQuestion(customQuestionInput.trim());
                          setSelectedCommonQuestions(
                            (prev) => new Set([...prev, customQuestionInput.trim()])
                          );
                          setCustomQuestionInput("");
                        }
                      }}
                      className="rounded-xl bg-[#094cb2] px-3 py-2 text-xs text-white hover:bg-[#073c8f]"
                    >
                      추가
                    </button>
                  </div>
                  {customQuestion && (
                    <p className="text-[11px] text-slate-400">최근 추가 질문: {customQuestion}</p>
                  )}
                  {Array.from(selectedCommonQuestions).map((q, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-xl border border-blue-200 bg-[#eef6ff] p-2"
                    >
                      <p className="text-xs text-[#094cb2]">{q}</p>
                      <button
                        onClick={() => {
                          const next = new Set(selectedCommonQuestions);
                          next.delete(q);
                          setSelectedCommonQuestions(next);
                        }}
                        className="text-blue-400 hover:text-red-400 text-xs ml-2"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <ResumePreviewPane
        profile={profile}
        bioInput={bioInput}
        onBioInputChange={setBioInput}
        onBioSave={saveBio}
        bioSaving={bioSaving}
        targetJob={targetJob}
        selectedCareerActivities={selectedCareerActivities}
        selectedProjectActivities={selectedProjectActivities}
        selectedSkillsList={selectedSkillsList}
        selectedQuestions={Array.from(selectedCommonQuestions)}
        activityLineOverrides={appliedRewriteLines}
        onActivityLineOverrideChange={handleUpdateRewriteLine}
        onActivityLineOverrideAdd={handleAddRewriteLine}
        onActivityLineOverrideRemove={handleRemoveRewriteLine}
        onActivityLineOverrideClear={handleClearRewriteSuggestion}
      />

      <ResumeAssistantSidebar
        targetJob={targetJob}
        onTargetJobChange={setTargetJob}
        onCreateResume={handleCreateResume}
        saving={saving}
        canCreate={selected.size > 0}
        error={error}
        jobPostingText={jobPostingText}
        onJobPostingTextChange={setJobPostingText}
        jobPostingUrl={jobPostingUrl}
        onJobPostingUrlChange={setJobPostingUrl}
        onExtractJobUrl={handleExtractJobUrl}
        jobImageFiles={jobImageFiles}
        onAddJobImageFiles={addJobImageFiles}
        onRemoveJobImageFile={removeJobImageFile}
        onClearJobImageFiles={clearJobImageFiles}
        jobPdfFile={jobPdfFile}
        onJobPdfFileChange={setJobPdfFile}
        jobPostingExtracting={jobPostingExtracting}
        onExtractJobImages={handleExtractJobImages}
        onExtractJobPdf={handleExtractJobPdf}
        rewriteLoading={rewriteLoading}
        rewriteError={rewriteError}
        rewriteResult={rewriteResult}
        rewriteActivityTitles={rewriteActivityTitles}
        appliedRewriteLines={appliedRewriteLines}
        canGenerateRewrite={
          selected.size > 0 && Boolean(targetJob.trim()) && jobPostingText.trim().length >= 50
        }
        onGenerateRewrite={() => handleGenerateRewriteSuggestions(selectedActivities)}
        onApplyRewriteSuggestion={handleApplyRewriteSuggestion}
        onClearRewriteSuggestion={handleClearRewriteSuggestion}
        chatMessages={chatMessages}
        chatLoading={chatLoading}
        chatInput={chatInput}
        onChatInputChange={setChatInput}
        onChatSend={() => handleChatSend(selectedActivities)}
      />
    </div>
  );
}
