
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
    templateId,
    setTemplateId,
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
    toggleSelect,
    saveBio,
    handleChatSend,
    handleCreateResume,
  } = useResumeBuilder();

  const TEMPLATES = [
    { id: "simple", label: "기본형", free: true },
    { id: "modern", label: "Modern", free: true },
    { id: "minimal", label: "Minimal", free: true },
    { id: "bold", label: "Bold", free: true },
    { id: "elegant", label: "Elegant", free: true },
    { id: "premium1", label: "Premium A", free: false },
    { id: "premium2", label: "Premium B", free: false },
  ] as const;

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
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">불러오는 중...</p>
      </main>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8f7f4]">
      <div className="w-72 flex-shrink-0 bg-white border-r border-gray-100 flex flex-col h-full">
        <div className="flex border-b border-gray-100">
          {(["성과저장소", "자기소개서"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setLeftMainTab(tab);
                setLeftSubTab(tab === "성과저장소" ? "회사경력" : "공통질문");
              }}
              className={`flex-1 py-3 text-xs font-semibold transition-all ${
                leftMainTab === tab
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {tab}
              {tab === "성과저장소" && (
                <span className="ml-1 text-[10px] text-gray-400">{activities.length}개</span>
              )}
            </button>
          ))}
        </div>

        {leftMainTab === "성과저장소" && (
          <>
            <div className="px-3 py-2 border-b border-gray-100">
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-gray-400"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
                <span className="text-xs text-gray-400">검색하기</span>
              </div>
            </div>

            <div className="flex gap-1 px-3 py-2 border-b border-gray-100">
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
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                      isActive
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {leftSubTab === "기술스택" && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-400 mb-3">이력서에 포함할 기술을 선택하세요.</p>
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
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                            isSelected
                              ? "bg-blue-500 text-white border-blue-500"
                              : "bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-400"
                          }`}
                        >
                          {skill}
                        </button>
                      );
                    })}
                    {(!profile?.skills || profile.skills.length === 0) && (
                      <p className="text-xs text-gray-400">
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
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? "border-blue-400 bg-blue-50"
                          : "border-gray-100 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full">
                            {activity.type}
                          </span>
                          <p className="text-xs font-bold text-gray-900 line-clamp-2 mt-1">
                            {activity.title}
                          </p>
                          {activity.period && (
                            <p className="text-[10px] text-gray-400 mt-0.5">{activity.period}</p>
                          )}
                          {getActivityPreviewText(activity) && (
                            <p className="text-[10px] text-gray-500 mt-1 line-clamp-2">
                              {getActivityPreviewText(activity)}
                            </p>
                          )}
                          {Array.isArray(activity.skills) && activity.skills.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {activity.skills.slice(0, 3).map((s, i) => (
                                <span
                                  key={i}
                                  className="text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full"
                                >
                                  {s}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div
                          className={`w-4 h-4 rounded flex-shrink-0 border-2 flex items-center justify-center mt-0.5 transition-all ${
                            isSelected ? "bg-blue-500 border-blue-500" : "border-gray-300"
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
            <div className="flex border-b border-gray-100">
              {(["공통질문", "회사맞춤질문", "직접입력"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setCoverLetterTab(tab)}
                  className={`flex-1 py-2.5 text-[10px] font-semibold transition-all ${
                    coverLetterTab === tab
                      ? "text-blue-600 border-b-2 border-blue-600"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {coverLetterTab === "공통질문" && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-400 mb-3">이력서에 포함할 항목을 선택하세요.</p>
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
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? "border-blue-400 bg-blue-50"
                            : "border-gray-100 bg-white hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-gray-700">{q}</p>
                          <div
                            className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ml-2 ${
                              isSelected ? "bg-blue-500 border-blue-500" : "border-gray-300"
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
                  <p className="text-xs text-gray-400 mb-3">
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
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? "border-blue-400 bg-blue-50"
                            : "border-gray-100 bg-white hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-gray-700">{q}</p>
                          <div
                            className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ml-2 ${
                              isSelected ? "bg-blue-500 border-blue-500" : "border-gray-300"
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
                  <p className="text-xs text-gray-400 mb-3">질문을 직접 입력하고 이력서에 추가하세요.</p>
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
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-400"
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
                      className="px-3 py-2 bg-blue-500 text-white rounded-xl text-xs hover:bg-blue-600"
                    >
                      추가
                    </button>
                  </div>
                  {customQuestion && (
                    <p className="text-[10px] text-gray-400">최근 추가 질문: {customQuestion}</p>
                  )}
                  {Array.from(selectedCommonQuestions).map((q, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 bg-blue-50 rounded-xl border border-blue-200"
                    >
                      <p className="text-xs text-blue-700">{q}</p>
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
      />

      <ResumeAssistantSidebar
        targetJob={targetJob}
        onTargetJobChange={setTargetJob}
        onCreateResume={handleCreateResume}
        saving={saving}
        canCreate={selected.size > 0}
        error={error}
        templates={TEMPLATES.map((template) => ({ ...template }))}
        templateId={templateId}
        onTemplateChange={setTemplateId}
        chatMessages={chatMessages}
        chatLoading={chatLoading}
        chatInput={chatInput}
        onChatInputChange={setChatInput}
        onChatSend={() => handleChatSend(selectedActivities)}
      />
    </div>
  );
}
