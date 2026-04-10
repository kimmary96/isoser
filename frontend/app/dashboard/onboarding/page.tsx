// 온보딩 페이지 - 기존 이력서 PDF 업로드/분석 후 프로필·활동 분리 확인 및 저장
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { parsePdf } from "@/lib/api/backend";
import { isGuestMode } from "@/lib/guest";
import { createBrowserClient } from "@/lib/supabase/client";
import type { ParsedActivity, ParsedProfile } from "@/lib/types";

const ALLOWED_TYPES = ["회사경력", "프로젝트", "대외활동", "학생활동"] as const;

function normalizeType(type: string): ParsedActivity["type"] {
  const value = (type || "").trim();
  if (ALLOWED_TYPES.includes(value as ParsedActivity["type"])) {
    return value as ParsedActivity["type"];
  }

  const lower = value.toLowerCase();
  if (["경력", "인턴", "work", "experience"].includes(lower)) return "회사경력";
  if (["project"].includes(lower)) return "프로젝트";
  if (["활동", "동아리", "봉사", "contest", "competition"].includes(lower)) return "대외활동";
  if (["school", "학내활동", "학술활동"].includes(lower)) return "학생활동";

  return "프로젝트";
}

function countByType(activities: ParsedActivity[]) {
  return ALLOWED_TYPES.map((type) => ({
    type,
    count: activities.filter((activity) => activity.type === type).length,
  }));
}

function previewValue(value?: string | null) {
  return value && value.trim() ? value : "미추출";
}

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(), []);

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [parsedProfile, setParsedProfile] = useState<ParsedProfile | null>(null);
  const [parsedActivities, setParsedActivities] = useState<ParsedActivity[]>([]);
  const [analyzed, setAnalyzed] = useState(false);

  const [showAnalyzingModal, setShowAnalyzingModal] = useState(false);
  const [analyzeStep, setAnalyzeStep] = useState<1 | 2>(1);

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      if (isGuestMode()) {
        if (mounted) {
          setAuthChecking(false);
        }
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (!user) {
        router.replace("/login");
        return;
      }

      setAuthChecking(false);
    };

    void checkAuth();

    return () => {
      mounted = false;
    };
  }, [router, supabase]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (selected.type !== "application/pdf") {
      setError("PDF 파일만 업로드 가능합니다.");
      return;
    }

    setFile(selected);
    setError(null);
    setAnalyzed(false);
    setParsedProfile(null);
    setParsedActivities([]);
  };

  const handleAnalyze = async () => {
    if (isGuestMode()) {
      setError("게스트 모드에서는 PDF 추출을 사용할 수 없습니다. 로그인 후 업로드해 주세요.");
      return;
    }

    if (!file) {
      setError("먼저 이력서 PDF를 선택해 주세요.");
      return;
    }

    setLoading(true);
    setError(null);
    setShowAnalyzingModal(true);
    setAnalyzeStep(1);

    window.setTimeout(() => setAnalyzeStep(2), 1300);

    try {
      const result = await parsePdf(file);
      const profile = result.profile ?? {
        name: "",
        email: "",
        phone: "",
        education: "",
      };
      const activities = (result.activities ?? []).map((a) => ({
        ...a,
        type: normalizeType(a.type),
      }));

      setParsedProfile(profile);
      setParsedActivities(activities);
      setAnalyzed(true);

      if (
        !profile.name &&
        !profile.email &&
        !profile.phone &&
        !profile.education &&
        activities.length === 0
      ) {
        setError("추출된 정보가 없습니다. 다른 PDF로 다시 시도해주세요.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "분석 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
      setShowAnalyzingModal(false);
    }
  };

  const handleSave = async () => {
    if (!parsedProfile) {
      setError("먼저 PDF 분석을 진행해주세요.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("로그인이 필요합니다.");

      const {
        name,
        email,
        phone,
        bio,
        education,
        career,
        education_history,
        awards,
        certifications,
        languages,
        skills,
        self_intro,
      } = parsedProfile;
      let { error: profileError } = await supabase.from("profiles").upsert({
        id: user.id,
        name,
        email,
        phone,
        bio: bio ?? "",
        education,
        career: career ?? [],
        education_history: education_history ?? [],
        awards: awards ?? [],
        certifications: certifications ?? [],
        languages: languages ?? [],
        skills: skills ?? [],
        self_intro: self_intro ?? "",
      });
      if (profileError?.code === "42703" || profileError?.message.toLowerCase().includes("bio")) {
        const retry = await supabase.from("profiles").upsert({
          id: user.id,
          name,
          email,
          phone,
          education,
          career: career ?? [],
          education_history: education_history ?? [],
          awards: awards ?? [],
          certifications: certifications ?? [],
          languages: languages ?? [],
          skills: skills ?? [],
          self_intro: self_intro ?? "",
        });
        profileError = retry.error;
      }
      if (profileError) {
        throw new Error(profileError.message);
      }

      if (parsedActivities.length > 0) {
        const { error: activityError } = await supabase.from("activities").insert(
          parsedActivities.map((activity) => ({
            ...activity,
            type: normalizeType(activity.type),
            user_id: user.id,
          }))
        );
        if (activityError) {
          throw new Error(activityError.message);
        }
      }

      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (authChecking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-gray-500">로그인 상태를 확인 중입니다...</p>
      </main>
    );
  }

  const activityCounts = countByType(parsedActivities);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#eef4ff,#f8fafc)]">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="rounded-[2rem] bg-[#071a36] p-8 text-white shadow-xl shadow-slate-900/10">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-200">
              Onboarding
            </p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight">
              이력서 PDF를 올리고,
              <br />
              추출 결과를 확인한 뒤 저장하세요.
            </h1>
            <p className="mt-4 text-base leading-7 text-slate-300">
              온보딩에서는 먼저 프로필과 활동을 읽어옵니다. 저장 후에는 성과 저장소,
              공고 매칭, 이력서 생성으로 바로 이어집니다.
            </p>

            <div className="mt-10 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                  Step 1
                </p>
                <p className="mt-2 text-lg font-semibold">PDF 업로드</p>
                <p className="mt-1 text-sm leading-6 text-slate-300">
                  텍스트 인식 가능한 PDF를 업로드하면 기본 정보와 활동을 추출합니다.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                  Step 2
                </p>
                <p className="mt-2 text-lg font-semibold">추출 결과 확인</p>
                <p className="mt-1 text-sm leading-6 text-slate-300">
                  이름, 연락처, 학력, 활동 개수를 바로 확인하고 저장 여부를 결정합니다.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                  Step 3
                </p>
                <p className="mt-2 text-lg font-semibold">대시보드로 이동</p>
                <p className="mt-1 text-sm leading-6 text-slate-300">
                  저장 후에는 성과 저장소, 합격률 분석, 문서 저장소를 바로 사용할 수 있습니다.
                </p>
              </div>
            </div>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/dashboard"
                className="rounded-full bg-white px-5 py-3 text-center text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
              >
                직접 입력으로 이동
              </Link>
              {isGuestMode() && (
                <Link
                  href="/login"
                  className="rounded-full border border-white/16 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-white/8"
                >
                  로그인하고 업로드하기
                </Link>
              )}
            </div>
          </section>

          <section className="rounded-[2rem] bg-white p-8 shadow-xl shadow-slate-900/5">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-6">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-700">
                  Upload
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                  업로드 후 바로 미리보기
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  자기소개서 업로드나 지원 직무 입력은 온보딩에서 제거했습니다. 먼저 이력서
                  데이터가 제대로 들어오는지 확인하는 것이 우선입니다.
                </p>
              </div>
              {file && (
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setAnalyzed(false);
                    setParsedProfile(null);
                    setParsedActivities([]);
                    setError(null);
                  }}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  다시 선택
                </button>
              )}
            </div>

            <div className="mt-8">
              {!file ? (
                <label
                  htmlFor="resume-upload"
                  className="block cursor-pointer rounded-[1.75rem] border-2 border-dashed border-blue-200 bg-blue-50/60 p-10 text-center transition hover:border-blue-300 hover:bg-blue-50"
                >
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.8">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0l-4 4m4-4l4 4" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                    </svg>
                  </div>
                  <p className="mt-5 text-xl font-semibold text-slate-950">이력서 PDF를 첨부해 주세요</p>
                  <p className="mt-2 text-sm text-slate-500">
                    텍스트 인식 가능한 PDF, 최대 10MB
                  </p>
                  <div className="mt-6 inline-flex rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white">
                    파일 선택
                  </div>
                  <input
                    id="resume-upload"
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              ) : (
                <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Selected File
                      </p>
                      <p className="mt-2 truncate text-base font-semibold text-slate-950">{file.name}</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAnalyze}
                      disabled={loading || isGuestMode()}
                      className="rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {loading ? "분석 중..." : "추출 시작"}
                    </button>
                  </div>
                  {isGuestMode() && (
                    <p className="mt-4 text-sm text-amber-700">
                      게스트 모드에서는 업로드 분석이 비활성화되어 있습니다. 로그인 후 이용해
                      주세요.
                    </p>
                  )}
                </div>
              )}
            </div>

            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

            <div className="mt-8 border-t border-slate-100 pt-8">
              {!analyzed || !parsedProfile ? (
                <div className="rounded-[1.75rem] border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                  <p className="text-lg font-semibold text-slate-900">추출 결과가 여기에 표시됩니다</p>
                  <p className="mt-2 text-sm text-slate-500">
                    업로드 후 이름, 연락처, 학력, 활동 개수를 먼저 검토할 수 있습니다.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Profile Preview
                      </p>
                      <div className="mt-4 space-y-3 text-sm text-slate-700">
                        <div>
                          <p className="text-xs text-slate-400">이름</p>
                          <p className="mt-1 font-medium text-slate-950">
                            {previewValue(parsedProfile.name)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">이메일</p>
                          <p className="mt-1">{previewValue(parsedProfile.email)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">연락처</p>
                          <p className="mt-1">{previewValue(parsedProfile.phone)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">학력</p>
                          <p className="mt-1">{previewValue(parsedProfile.education)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Activity Summary
                      </p>
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        {activityCounts.map((item) => (
                          <div key={item.type} className="rounded-2xl bg-slate-50 p-4">
                            <p className="text-xs text-slate-400">{item.type}</p>
                            <p className="mt-2 text-2xl font-semibold text-slate-950">{item.count}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                          Activity Preview
                        </p>
                        <p className="mt-2 text-lg font-semibold text-slate-950">
                          추출된 활동 {parsedActivities.length}개
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3">
                      {parsedActivities.length === 0 ? (
                        <p className="text-sm text-slate-500">추출된 활동이 없습니다.</p>
                      ) : (
                        parsedActivities.slice(0, 6).map((activity, index) => (
                          <div key={`${activity.title}-${index}`} className="rounded-2xl bg-slate-50 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-blue-700">{activity.type}</p>
                                <p className="mt-1 truncate text-sm font-semibold text-slate-950">
                                  {activity.title || "제목 미추출"}
                                </p>
                              </div>
                              <p className="shrink-0 text-xs text-slate-400">
                                {previewValue(activity.period)}
                              </p>
                            </div>
                            {activity.description && (
                              <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                                {activity.description}
                              </p>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    {parsedActivities.length > 6 && (
                      <p className="mt-4 text-xs text-slate-400">
                        나머지 활동은 저장 후 성과 저장소에서 확인할 수 있습니다.
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-3 border-t border-slate-100 pt-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={loading}
                      className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
                    >
                      {loading ? "저장 중..." : "이 결과로 저장하고 대시보드로 이동"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAnalyzed(false);
                        setParsedProfile(null);
                        setParsedActivities([]);
                        setError(null);
                      }}
                      className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      다시 추출하기
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {showAnalyzingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-[1.75rem] bg-white p-8 shadow-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
              Parsing Resume
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
              이력서에서 데이터를 추출하고 있습니다
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              30초에서 1분 정도 소요될 수 있습니다.
            </p>

            <div className="mt-8 space-y-4">
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">프로필 읽기</p>
                  <p className="text-xs text-slate-400">이름, 연락처, 학력 추출</p>
                </div>
                <div className="text-sm font-semibold text-blue-700">
                  {analyzeStep === 1 ? "진행 중" : "완료"}
                </div>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">활동 구조화</p>
                  <p className="text-xs text-slate-400">경력, 프로젝트, 활동 정리</p>
                </div>
                <div className="text-sm font-semibold text-blue-700">
                  {analyzeStep === 2 ? "진행 중" : "대기"}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
