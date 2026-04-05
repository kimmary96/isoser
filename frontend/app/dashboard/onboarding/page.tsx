// 온보딩 페이지 - 기존 이력서 PDF 업로드/분석 후 프로필·활동 분리 확인 및 저장
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { parsePdf } from "@/lib/api/backend";
import { isGuestMode } from "@/lib/guest";
import { createBrowserClient } from "@/lib/supabase/client";
import type { ParsedProfile, ParsedActivity } from "@/lib/types";

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

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(), []);

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [parsedProfile, setParsedProfile] = useState<ParsedProfile | null>(null);
  const [parsedActivities, setParsedActivities] = useState<ParsedActivity[]>([]);
  const [analyzed, setAnalyzed] = useState(false);

  const [coverLetterFile, setCoverLetterFile] = useState<File | null>(null);
  const [jobTitle, setJobTitle] = useState("");
  const [showJobModal, setShowJobModal] = useState(false);
  const [showAnalyzingModal, setShowAnalyzingModal] = useState(false);
  const [analyzeStep, setAnalyzeStep] = useState<1 | 2>(1);
  const [surveyAnswer, setSurveyAnswer] = useState<string | null>(null);
  const [showCompleteModal, setShowCompleteModal] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected && selected.type === "application/pdf") {
      setFile(selected);
      setError(null);
      setAnalyzed(false);
      setParsedProfile(null);
      setParsedActivities([]);
    } else {
      setError("PDF 파일만 업로드 가능합니다.");
    }
  };

  const handleAnalyze = async () => {
    if (isGuestMode()) {
      setError("게스트 모드에서는 업로드 저장을 지원하지 않습니다. 활동 페이지의 샘플 데이터로 QA를 진행해주세요.");
      return;
    }

    if (!file) return;
    setLoading(true);
    setError(null);

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
      const { data: { user } } = await supabase.auth.getUser();
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
      const { error: profileError } = await supabase.from("profiles").upsert({
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
      if (profileError) {
        throw new Error(profileError.message);
      }

      if (parsedActivities.length > 0) {
        const { error: activityError } = await supabase.from("activities").insert(
          parsedActivities.map((a) => ({ ...a, type: normalizeType(a.type), user_id: user.id }))
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

  const handleStartAnalyze = async () => {
    setShowJobModal(false);
    setShowAnalyzingModal(true);
    setAnalyzeStep(1);

    setTimeout(() => setAnalyzeStep(2), 1500);

    await handleAnalyze();
  };

  useEffect(() => {
    if (analyzed) {
      setShowAnalyzingModal(false);
      setShowCompleteModal(true);
    }
  }, [analyzed]);

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <h1 className="text-blue-500 font-bold text-2xl text-center">이력서와 자기소개서를 업로드해주세요!</h1>
        <p className="text-gray-500 text-sm text-center mt-2">
          이력서 업로드 후, 자기소개서까지 제출하면 더 정교한 분석이 완성돼요.
        </p>

        {!file ? (
          <div className="border-2 border-dashed border-blue-400 bg-white rounded-2xl p-10 text-center mt-8">
            <svg width="72" height="60" viewBox="0 0 72 60" fill="none" className="mx-auto mb-4">
              <path d="M4 8C4 5.8 5.8 4 8 4H28L36 12H64C66.2 12 68 13.8 68 16V52C68 54.2 66.2 56 64 56H8C5.8 56 4 54.2 4 52V8Z" fill="#3B82F6"/>
              <path d="M4 20H68V52C68 54.2 66.2 56 64 56H8C5.8 56 4 54.2 4 52V20Z" fill="#60A5FA"/>
            </svg>

            <div className="flex items-center justify-center">
              <span className="text-red-500 text-sm mr-2">필수</span>
              <p className="text-gray-900 text-xl font-bold">이력서를 첨부해주세요.</p>
            </div>
            <p className="text-gray-400 text-sm mt-2">텍스트 인식이 가능한 PDF를 첨부해주세요(최대 10MB).</p>

            <input
              id="resume-upload"
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <label htmlFor="resume-upload" className="inline-block border border-gray-300 rounded-lg px-6 py-2 text-sm mt-4 cursor-pointer">
              파일 선택 ↑
            </label>
          </div>
        ) : (
          <div className="border-2 border-blue-400 bg-white rounded-2xl p-4 mt-8">
            <div className="flex justify-between items-center gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <svg width="20" height="24" viewBox="0 0 20 24" fill="none" className="shrink-0">
                  <path d="M4 1H11L16 6V22C16 22.55 15.55 23 15 23H4C3.45 23 3 22.55 3 22V2C3 1.45 3.45 1 4 1Z" stroke="#3B82F6" strokeWidth="1.5"/>
                  <path d="M11 1V6H16" stroke="#3B82F6" strokeWidth="1.5"/>
                </svg>
                <p className="text-blue-500 text-sm truncate">{file.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setFile(null)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="이력서 삭제"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M3 5H17" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M8 2H12" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M6 5V16C6 16.55 6.45 17 7 17H13C13.55 17 14 16.55 14 16V5" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
              </button>
            </div>
          </div>
        )}

        {!coverLetterFile ? (
          <div className="border border-dashed border-gray-300 bg-white rounded-2xl p-8 text-center mt-4">
            <div className="flex items-center justify-center">
              <span className="text-gray-400 text-sm mr-2">선택</span>
              <p className="text-gray-900 text-xl font-bold">자기소개서를 첨부해주세요.</p>
            </div>

            <input
              id="cover-letter-upload"
              type="file"
              accept="application/pdf"
              onChange={(e) => {
                const selected = e.target.files?.[0] ?? null;
                if (!selected || selected.type === "application/pdf") {
                  setCoverLetterFile(selected);
                  setError(null);
                } else {
                  setError("PDF 파일만 업로드 가능합니다.");
                }
              }}
              className="hidden"
            />
            <label htmlFor="cover-letter-upload" className="inline-block border border-gray-300 rounded-lg px-6 py-2 text-sm mt-4 cursor-pointer">
              파일 선택 ↑
            </label>
          </div>
        ) : (
          <div className="border-2 border-blue-400 bg-white rounded-2xl p-4 mt-4">
            <div className="flex justify-between items-center gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <svg width="20" height="24" viewBox="0 0 20 24" fill="none" className="shrink-0">
                  <path d="M4 1H11L16 6V22C16 22.55 15.55 23 15 23H4C3.45 23 3 22.55 3 22V2C3 1.45 3.45 1 4 1Z" stroke="#3B82F6" strokeWidth="1.5"/>
                  <path d="M11 1V6H16" stroke="#3B82F6" strokeWidth="1.5"/>
                </svg>
                <p className="text-blue-500 text-sm truncate">{coverLetterFile.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setCoverLetterFile(null)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="자기소개서 삭제"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M3 5H17" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M8 2H12" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M6 5V16C6 16.55 6.45 17 7 17H13C13.55 17 14 16.55 14 16V5" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
              </button>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600 mt-4 text-center">{error}</p>}

        {!file ? (
          <div className="mt-16 text-center">
            <div className="bg-gray-900 text-white text-sm rounded-lg px-4 py-2 inline-block">이력서가 없다면?</div>
            <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-t-[10px] border-l-transparent border-r-transparent border-t-gray-900 mx-auto" />
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="border border-gray-300 bg-white rounded-lg px-20 py-3 text-gray-700 mt-4"
            >
              직접 입력하기
            </button>
          </div>
        ) : (
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={() => setShowJobModal(true)}
              disabled={loading}
              className="bg-blue-500 text-white rounded-xl px-20 py-4 text-base font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              추출하기
            </button>
          </div>
        )}
      </div>

      {showJobModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-8 w-96 relative">
            <button
              type="button"
              onClick={() => setShowJobModal(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
              aria-label="닫기"
            >
              ×
            </button>

            <h2 className="text-blue-500 font-bold text-xl text-center">지원 직무를 입력해주세요!</h2>
            <p className="text-gray-400 text-sm text-center mt-1">직무 기반으로 이력서를 분석합니다.</p>

            <input
              type="text"
              placeholder="예) 서비스 기획자"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              className="border border-gray-200 rounded-lg px-4 py-3 w-full mt-4"
            />

            <label className="flex items-center gap-2 mt-4 text-sm text-gray-700">
              <input type="checkbox" defaultChecked />
              <span>이력서 기반으로 프로필 업데이트 하기</span>
            </label>

            <button
              type="button"
              className="bg-blue-400 text-white rounded-full px-6 py-3 w-full mt-4"
              onClick={() => {
                void handleStartAnalyze();
              }}
            >
              이력서 분석 시작하기
            </button>
          </div>
        </div>
      )}

      {showAnalyzingModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-8 w-[480px]">
            <h2 className="font-bold text-xl text-center">이력서를 분석하고 있습니다.</h2>
            <p className="text-gray-400 text-sm text-center mt-1">30초에서 1분 정도 소요됩니다.</p>

            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-blue-500 text-white text-sm flex items-center justify-center">1</div>
                  <p className="text-blue-500 text-sm">이력서에서 커리어 분석</p>
                </div>
                <div>
                  {analyzeStep === 1 ? (
                    <div>
                      <span className="dot" />
                      <span className="dot" />
                      <span className="dot" />
                    </div>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M4 10L8 14L16 6" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full text-sm flex items-center justify-center ${analyzeStep === 1 ? "bg-gray-200 text-gray-500" : "bg-blue-500 text-white"}`}>
                    2
                  </div>
                  <p className={analyzeStep === 1 ? "text-gray-400 text-sm" : "text-blue-500 text-sm"}>경력에서 핵심 경험을 추출</p>
                </div>
                <div>
                  {analyzeStep === 2 ? (
                    <div>
                      <span className="dot" />
                      <span className="dot" />
                      <span className="dot" />
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-6">
              <p className="font-bold text-sm">설문 조사</p>
              <p className="text-gray-400 text-sm">이력서 분석 시 어떠한 것이 더 필요한가요?</p>

              {surveyAnswer ? (
                <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <p className="mt-1 text-sm font-bold text-gray-900">내 이력서와 맞는 공고를 바로 찾아보세요</p>
                  <p className="mt-1 text-xs text-gray-500">
                    공고 매칭 분석에서 내 경험과 직무 키워드 적합도를 확인할 수 있어요.
                  </p>
                </div>
              ) : (
                [
                  "다양한 템플릿",
                  "다양한 항목 (경력, 프로젝트, 기술 스택 등)",
                  "보다 더 정교한 결과",
                ].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSurveyAnswer(option)}
                    className="py-3 w-full text-sm mt-2 rounded-lg border border-gray-200 text-gray-700"
                  >
                    {option}
                  </button>
                ))
              )}
            </div>

            <style>{`
              .dot { width:8px; height:8px; border-radius:50%; background:#3B82F6; display:inline-block; margin:0 2px; animation: blink 1.2s infinite; }
              .dot:nth-child(2) { animation-delay: 0.2s; }
              .dot:nth-child(3) { animation-delay: 0.4s; }
              @keyframes blink { 0%,80%,100%{opacity:0.2} 40%{opacity:1} }
            `}</style>
          </div>
        </div>
      )}

      {showCompleteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-8 w-96 text-center">
            <h2 className="font-bold text-xl">추출이 완료되었습니다.</h2>
            <p className="text-gray-400 text-sm mt-2">추출된 활동 내용을 확인해주세요!</p>
            <button
              type="button"
              className="bg-blue-500 text-white rounded-lg px-6 py-3 w-full mt-6"
              onClick={async () => {
                await handleSave();
              }}
            >
              확인
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
