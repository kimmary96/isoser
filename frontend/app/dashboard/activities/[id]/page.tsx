// 활동 상세 페이지 - 활동 내용 편집 + AI 코치 대화
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import { getCoachFeedback } from "@/lib/api/backend";
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
  const [error, setError] = useState<string | null>(null);
  const [sessionId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    const fetchActivity = async () => {
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

  if (loading || !activity) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">불러오는 중...</p>
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
