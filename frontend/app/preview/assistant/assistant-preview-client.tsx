"use client";

import { useState } from "react";

import type { AssistantMessageResponse, CoachMessage } from "@/lib/types";

const SECTION_TYPES = ["프로젝트", "인턴", "대외활동", "동아리", "요약"] as const;

async function readError(response: Response): Promise<string> {
  const payload = await response.json().catch(() => null);
  return payload?.error || payload?.detail || "Assistant preview request failed.";
}

export function AssistantPreviewClient() {
  const [message, setMessage] = useState("추천 프로그램 알려줘");
  const [activityDescription, setActivityDescription] = useState(
    "Redis cache rollout reduced API latency from 780ms to 290ms in a backend project."
  );
  const [jobTitle, setJobTitle] = useState("Backend Engineer");
  const [sectionType, setSectionType] = useState<(typeof SECTION_TYPES)[number]>("프로젝트");
  const [category, setCategory] = useState("IT");
  const [region, setRegion] = useState("서울");
  const [includeCalendar, setIncludeCalendar] = useState(false);
  const [history, setHistory] = useState<CoachMessage[]>([]);
  const [result, setResult] = useState<AssistantMessageResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = message.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);

    const nextHistory = [...history, { role: "user", content: trimmed } satisfies CoachMessage];

    try {
      const response = await fetch("/api/preview/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history,
          activity_description: activityDescription.trim() || undefined,
          job_title: jobTitle.trim() || undefined,
          section_type: sectionType,
          category: category.trim() || undefined,
          region: region.trim() || undefined,
          include_calendar: includeCalendar,
        }),
      });

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const payload = (await response.json()) as AssistantMessageResponse;
      setResult(payload);

      if (payload.coach_result?.updated_history?.length) {
        setHistory(payload.coach_result.updated_history);
      } else {
        setHistory([...nextHistory, { role: "assistant", content: payload.reply }]);
      }

      setMessage("");
    } catch (submitError) {
      const messageText =
        submitError instanceof Error ? submitError.message : "Assistant preview request failed.";
      setError(messageText);
      setHistory([...nextHistory, { role: "assistant", content: `Error: ${messageText}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
      <section className="space-y-5 rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-sky-300">Preview assistant</p>
          <h1 className="text-3xl font-semibold">Unified coach and recommendation testbed</h1>
          <p className="max-w-2xl text-sm text-slate-300">
            Send one message and let the backend choose the existing coach or recommendation flow.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="text-slate-300">Message</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={4}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none ring-0 transition focus:border-sky-400"
              placeholder="추천 프로그램 알려줘 / 이 활동 코칭해줘"
            />
          </label>

          <label className="space-y-2 text-sm">
            <span className="text-slate-300">Activity description for coach path</span>
            <textarea
              value={activityDescription}
              onChange={(event) => setActivityDescription(event.target.value)}
              rows={4}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none ring-0 transition focus:border-sky-400"
              placeholder="Paste activity text to coach."
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-2 text-sm">
            <span className="text-slate-300">Job title</span>
            <input
              value={jobTitle}
              onChange={(event) => setJobTitle(event.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-sky-400"
            />
          </label>

          <label className="space-y-2 text-sm">
            <span className="text-slate-300">Section type</span>
            <select
              value={sectionType}
              onChange={(event) => setSectionType(event.target.value as (typeof SECTION_TYPES)[number])}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-sky-400"
            >
              {SECTION_TYPES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm">
            <span className="text-slate-300">Category</span>
            <input
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-sky-400"
            />
          </label>

          <label className="space-y-2 text-sm">
            <span className="text-slate-300">Region</span>
            <input
              value={region}
              onChange={(event) => setRegion(event.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-sky-400"
            />
          </label>
        </div>

        <label className="flex items-center gap-3 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={includeCalendar}
            onChange={(event) => setIncludeCalendar(event.target.checked)}
            className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-sky-400"
          />
          Prefer calendar-oriented recommendation output
        </label>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={submit}
            disabled={loading || !message.trim()}
            className="rounded-full bg-sky-400 px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {loading ? "Running..." : "Send"}
          </button>
          <button
            type="button"
            onClick={() => {
              setMessage("캘린더에 볼 수 있게 마감 임박 프로그램 추천해줘");
              setIncludeCalendar(true);
            }}
            className="rounded-full border border-slate-700 px-5 py-3 text-sm text-slate-200 transition hover:border-sky-400"
          >
            Prefill calendar request
          </button>
          <button
            type="button"
            onClick={() => {
              setMessage("이 활동을 백엔드 엔지니어 관점으로 코칭해줘");
              setIncludeCalendar(false);
            }}
            className="rounded-full border border-slate-700 px-5 py-3 text-sm text-slate-200 transition hover:border-sky-400"
          >
            Prefill coach request
          </button>
        </div>

        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      </section>

      <section className="space-y-4">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-sky-300">Transcript</p>
          <div className="mt-4 space-y-3">
            {history.length === 0 ? (
              <p className="text-sm text-slate-400">No messages yet.</p>
            ) : (
              history.map((entry, index) => (
                <div
                  key={`${entry.role}-${index}`}
                  className={`rounded-2xl px-4 py-3 text-sm ${
                    entry.role === "assistant"
                      ? "bg-slate-800 text-slate-100"
                      : "bg-sky-500/15 text-sky-100"
                  }`}
                >
                  <p className="mb-1 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                    {entry.role}
                  </p>
                  <p className="whitespace-pre-wrap">{entry.content}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-sky-300">Structured result</p>
          {result ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl bg-slate-950 p-4 text-sm text-slate-200">
                <p>
                  <span className="text-slate-400">Intent:</span> {result.intent}
                </p>
                <p className="mt-2">
                  <span className="text-slate-400">Tool:</span> {result.tool_call.name}
                </p>
                <p className="mt-2 whitespace-pre-wrap">
                  <span className="text-slate-400">Reply:</span> {result.reply}
                </p>
              </div>
              <pre className="overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-300">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-400">Run a request to inspect the structured output.</p>
          )}
        </div>
      </section>
    </div>
  );
}
