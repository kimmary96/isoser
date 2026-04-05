// 활동 상세 페이지 - 활동 내용 편집 + AI 코치 대화
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import { getCoachFeedback } from "@/lib/api/backend";
import { getGuestActivities, isGuestMode } from "@/lib/guest";
import type { Activity, CoachMessage } from "@/lib/types";

export default function ActivityDetailPage() {
  const params = useParams();
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
  const [error, setError] = useState<string | null>(null);
  const [sessionId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    const fetchActivity = async () => {
      if (isGuestMode()) {
        const found = getGuestActivities().find((item) => item.id === (params.id as string)) ?? null;
        setActivity(found);
        setDescriptionDraft(found?.description ?? "");
        setStarSituation(found?.star_situation || "");
        setStarTask(found?.star_task || "");
        setStarAction(found?.star_action || "");
        setStarResult(found?.star_result || "");
        setLoading(false);
        return;
      }

      try {
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
      } catch (e) {
        setError(e instanceof Error ? e.message : "활동을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };
    fetchActivity();
  }, [params.id, supabase]);

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
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <p className="text-sm text-gray-400">{activity.type}</p>
          <h1 className="text-2xl font-bold text-gray-900">{activity.title}</h1>
          {activity.period && (
            <p className="text-sm text-gray-500">{activity.period}</p>
          )}
        </div>
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
              <div>
                <h2 className="font-semibold text-gray-900 mb-3">활동 설명</h2>
                <textarea
                  value={descriptionDraft}
                  onChange={(e) => setDescriptionDraft(e.target.value)}
                  rows={12}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400 resize-none"
                  placeholder="활동 내용을 구체적으로 작성하세요."
                />
                <button
                  onClick={handleSaveDescription}
                  disabled={saving}
                  className="mt-3 px-3 py-2 text-sm rounded-lg bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {saving ? "저장 중..." : "활동 설명 저장"}
                </button>
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
        </div>
      </div>
    </main>
  );
}
