
// 이력서 편집 페이지 - 활동 선택 및 이력서 구성
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import { getGuestActivities, isGuestMode, saveGuestResume } from "@/lib/guest";
import type { Activity } from "@/lib/types";

export default function ResumePage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(), []);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetJob, setTargetJob] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTypeTab, setActiveTypeTab] = useState<string>("전체");
  const [templateId, setTemplateId] = useState<string>("simple");
  const [chatMessages, setChatMessages] = useState<
    { role: "user" | "ai"; text: string }[]
  >([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [profile, setProfile] = useState<{
    name: string;
    email: string;
    phone: string;
    self_intro: string;
    skills: string[];
  } | null>(null);
  const [leftMainTab, setLeftMainTab] = useState<"성과저장소" | "자기소개서">(
    "성과저장소"
  );
  const [leftSubTab, setLeftSubTab] = useState<string>("회사경력");
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const [coverLetterTab, setCoverLetterTab] = useState<
    "공통질문" | "회사맞춤질문" | "직접입력"
  >("공통질문");
  const [selectedCommonQuestions, setSelectedCommonQuestions] = useState<Set<string>>(
    new Set()
  );
  const [customQuestion, setCustomQuestion] = useState("");
  const [customQuestionInput, setCustomQuestionInput] = useState("");

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

  useEffect(() => {
    const fetchActivities = async () => {
      if (isGuestMode()) {
        setActivities(getGuestActivities());
        setLoading(false);
        return;
      }

      try {
        const { data, error: queryError } = await supabase
          .from("activities")
          .select("*")
          .eq("is_visible", true)
          .order("created_at", { ascending: false });
        if (queryError) {
          throw new Error(queryError.message);
        }
        setActivities(data || []);

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("name, email, phone, self_intro, skills")
            .eq("id", user.id)
            .maybeSingle();
          if (profileData) setProfile(profileData);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "활동을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };
    fetchActivities();
  }, [supabase]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleChatSend = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setChatInput("");
    setChatLoading(true);
    try {
      const res = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `당신은 이력서 작성 전문 AI 코치입니다.
사용자가 선택한 활동 목록: ${selectedActivities.map((a) => a.title).join(", ")}
지원 직무: ${targetJob || "미입력"}

사용자 질문: ${userMsg}

이력서 개선에 도움이 되는 구체적인 피드백을 3~5문장으로 작성해주세요.`,
        }),
      });
      const data = await res.json();
      setChatMessages((prev) => [
        ...prev,
        { role: "ai", text: data.summary || "응답을 가져오지 못했습니다." },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleCreateResume = async () => {
    setSaving(true);
    setError(null);
    try {
      if (isGuestMode()) {
        const now = new Date().toISOString();
        const guestResume = {
          id: "guest-resume-1",
          user_id: "guest",
          title: `게스트 이력서 ${new Date().toISOString().slice(0, 10)}`,
          target_job: targetJob || null,
          template_id: "simple",
          selected_activity_ids: Array.from(selected),
          created_at: now,
          updated_at: now,
        };
        saveGuestResume(guestResume);
        router.push("/dashboard/documents");
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        throw new Error("로그인이 필요합니다.");
      }

      const payload = {
        user_id: authData.user.id,
        title: `이력서 ${new Date().toISOString().slice(0, 10)}`,
        target_job: targetJob || null,
        template_id: templateId,
        selected_activity_ids: Array.from(selected),
      };

      const { data, error: insertError } = await supabase
        .from("resumes")
        .insert(payload)
        .select("id")
        .single();
      if (insertError || !data) {
        throw new Error(insertError?.message ?? "이력서 저장에 실패했습니다.");
      }

      router.push(`/dashboard/documents?resumeId=${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "이력서 저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

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
                      onClick={() => {
                        const next = new Set(selected);
                        if (next.has(activity.id)) next.delete(activity.id);
                        else next.add(activity.id);
                        setSelected(next);
                      }}
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
                          {activity.description && (
                            <p className="text-[10px] text-gray-500 mt-1 line-clamp-2">
                              {activity.description}
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

      <div className="flex-1 overflow-y-auto flex flex-col">
        <div className="sticky top-0 bg-white/80 backdrop-blur-sm border-b border-gray-100 px-8 py-3 flex items-center gap-3 z-10">
          <div className="flex-1 flex items-center gap-2 bg-gray-50 rounded-lg px-4 py-2">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-gray-400"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <span className="text-sm text-gray-400">문서 검색...</span>
          </div>
        </div>

        <div className="flex-1 p-8">
          <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm p-10 min-h-[800px]">
            <div className="flex items-start justify-between mb-4 pb-4 border-b border-gray-200">
              <div>
                <h1
                  className="text-3xl font-bold text-gray-900 mb-1"
                  style={{ fontFamily: "Pretendard, sans-serif" }}
                >
                  {profile?.name || "이름을 입력해주세요"}
                </h1>
                {targetJob && <p className="text-gray-500 text-sm mt-0.5">{targetJob}</p>}
                <div className="flex gap-3 mt-2 text-xs text-gray-400">
                  {profile?.email && <span>✉ {profile.email}</span>}
                  {profile?.phone && <span>☎ {profile.phone}</span>}
                </div>
              </div>
              <p className="text-xs text-gray-400">Seoul, South Korea</p>
            </div>

            {profile?.self_intro && (
              <div className="mb-6">
                <p className="text-[10px] font-semibold text-gray-400 tracking-widest mb-2">
                  PROFESSIONAL PROFILE
                </p>
                <p className="text-xs text-gray-600 leading-relaxed">{profile.self_intro}</p>
              </div>
            )}

            {selectedCareerActivities.length > 0 && (
              <div className="mb-6">
                <p className="text-[10px] font-semibold text-gray-400 tracking-widest mb-3">
                  WORK EXPERIENCE
                </p>
                <div className="space-y-4">
                  {selectedCareerActivities.map((activity, i) => (
                    <div key={activity.id} className="flex gap-3">
                      <div
                        className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                          i === 0 ? "bg-blue-500" : "bg-gray-300"
                        }`}
                      />
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-1">
                          <h3 className="font-bold text-gray-900 text-sm">{activity.title}</h3>
                          <span className="text-xs text-gray-400 flex-shrink-0 ml-4">
                            {activity.period}
                          </span>
                        </div>
                        {activity.description && (
                          <p className="text-xs text-gray-600 leading-relaxed">
                            {activity.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedProjectActivities.length > 0 && (
              <div className="mb-6">
                <p className="text-[10px] font-semibold text-gray-400 tracking-widest mb-3">
                  KEY EXPERIENCE
                </p>
                <div className="space-y-4">
                  {selectedProjectActivities.map((activity, i) => (
                    <div key={activity.id} className="flex gap-3">
                      <div
                        className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                          i === 0 ? "bg-blue-500" : "bg-gray-300"
                        }`}
                      />
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-1">
                          <h3 className="font-bold text-gray-900 text-sm">{activity.title}</h3>
                          <span className="text-xs text-gray-400 flex-shrink-0 ml-4">
                            {activity.period}
                          </span>
                        </div>
                        {activity.description && (
                          <p className="text-xs text-gray-600 leading-relaxed">
                            {activity.description}
                          </p>
                        )}
                        {Array.isArray(activity.skills) && activity.skills.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {activity.skills.map((s, j) => (
                              <span
                                key={j}
                                className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedSkillsList.length > 0 && (
              <div className="mb-6">
                <p className="text-[10px] font-semibold text-gray-400 tracking-widest mb-3">SKILLS</p>
                <div className="flex flex-wrap gap-2">
                  {selectedSkillsList.map((skill, i) => (
                    <span
                      key={i}
                      className="text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded-full"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedCommonQuestions.size > 0 && (
              <div className="mb-6">
                <p className="text-[10px] font-semibold text-gray-400 tracking-widest mb-3">
                  COVER LETTER
                </p>
                <div className="space-y-4">
                  {Array.from(selectedCommonQuestions).map((q, i) => (
                    <div key={i}>
                      <p className="text-xs font-bold text-gray-700 mb-1">{q}</p>
                      <div className="h-16 border border-dashed border-gray-200 rounded-xl flex items-center justify-center">
                        <p className="text-xs text-gray-300">내용을 입력해주세요</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedCareerActivities.length === 0 &&
              selectedProjectActivities.length === 0 &&
              selectedSkillsList.length === 0 &&
              selectedCommonQuestions.size === 0 && (
                <div className="text-center py-16 text-gray-300">
                  <p className="text-base mb-2">왼쪽에서 항목을 선택하세요.</p>
                  <p className="text-sm">경력, 프로젝트, 기술스택 순으로 구성됩니다.</p>
                </div>
              )}
          </div>
        </div>
      </div>

      <div className="w-64 flex-shrink-0 bg-white border-l border-gray-100 flex flex-col h-full overflow-y-auto">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2 bg-blue-600 text-white rounded-xl px-3 py-2">
            <span className="text-xs font-bold">✦ PREMIUM AI</span>
            <span className="text-[10px] bg-blue-500 rounded px-1.5 py-0.5">
              ACTIVE
            </span>
          </div>
        </div>

        <div className="p-4 border-b border-gray-100 space-y-2">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
            문서 제어
          </p>

          <input
            value={targetJob}
            onChange={(e) => setTargetJob(e.target.value)}
            placeholder="지원 직무 입력..."
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-400 mb-2"
          />

          <button
            onClick={handleCreateResume}
            disabled={saving || selected.size === 0}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #094cb2, #3b82f6)" }}
          >
            {saving ? "저장 중..." : "✦ 문서 생성하기"}
          </button>

          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>

        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              템플릿 선택
            </p>
            <button className="text-[10px] text-blue-500 hover:underline">
              모두 보기
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => t.free && setTemplateId(t.id)}
                className={`relative p-2 rounded-xl border text-center transition-all ${
                  templateId === t.id
                    ? "border-blue-400 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                } ${
                  !t.free ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
                }`}
              >
                <div className="h-12 bg-gray-100 rounded-lg mb-1 flex items-center justify-center">
                  <span className="text-[10px] text-gray-400">
                    {t.free ? "미리보기" : "🔒"}
                  </span>
                </div>
                <p className="text-[10px] font-medium text-gray-700">{t.label}</p>
                {!t.free && (
                  <span className="absolute top-1 right-1 text-[8px] bg-amber-400 text-white px-1 rounded">
                    PRO
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col p-4">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
            ✦ AI 조립 어시스턴트
          </p>

          <div className="flex-1 space-y-2 overflow-y-auto mb-3 min-h-[120px]">
            {chatMessages.length === 0 && (
              <p className="text-[10px] text-gray-400 leading-relaxed">
                선택한 성과 카드를 분석하여 채용 공고의 핵심 키워드에 맞춰 문장을
                최적화할까요?
              </p>
            )}
            {chatMessages.map((msg, i) => (
              <div
                key={i}
                className={`text-[10px] leading-relaxed rounded-xl p-2 ${
                  msg.role === "user"
                    ? "bg-blue-50 text-blue-800 text-right ml-4"
                    : "bg-gray-50 text-gray-700 mr-4"
                }`}
              >
                {msg.text}
              </div>
            ))}
            {chatLoading && (
              <div className="bg-gray-50 rounded-xl p-2 text-[10px] text-gray-400">
                분석 중...
              </div>
            )}
          </div>

          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleChatSend();
                }
              }}
              placeholder="공고 URL이나 직무 정보를 입력하세요..."
              className="w-full px-3 py-2 text-[10px] resize-none focus:outline-none"
              rows={3}
            />
            <div className="flex justify-end px-2 pb-2">
              <button
                onClick={handleChatSend}
                disabled={chatLoading || !chatInput.trim()}
                className="text-[10px] px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-all"
              >
                키워드 최적화 실행
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
