// 온보딩 페이지 - 기존 이력서 PDF 업로드/분석 후 프로필·활동 분리 확인 및 저장
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { parsePdf } from "@/lib/api/backend";
import { isGuestMode } from "@/lib/guest";
import { mergeParsedProfileToExtra, setProfileExtra } from "@/lib/profile_extra";
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

      const { name, email, phone, education } = parsedProfile;
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: user.id,
        name,
        email,
        phone,
        education,
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

      setProfileExtra(mergeParsedProfileToExtra(parsedProfile));
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="max-w-4xl mx-auto bg-white rounded-xl border border-gray-200 p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">기존 이력서 불러오기</h1>
          <p className="text-sm text-gray-500 mt-1">
            PDF를 업로드하면 AI가 프로필과 활동 목록을 자동으로 추출합니다.
          </p>
        </div>

        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <input
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            className="hidden"
            id="pdf-upload"
          />
          <label htmlFor="pdf-upload" className="cursor-pointer">
            <p className="text-sm text-gray-600">{file ? file.name : "클릭하여 PDF 파일 선택"}</p>
          </label>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            건너뛰기
          </button>
          <button
            onClick={handleAnalyze}
            disabled={!file || loading}
            className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {loading ? "분석 중..." : "업로드 및 분석"}
          </button>
          <button
            onClick={handleSave}
            disabled={!analyzed || loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? "저장 중..." : "추출 결과 저장"}
          </button>
        </div>

        {analyzed && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="rounded-lg border border-gray-200 p-4">
              <h2 className="font-semibold text-gray-900 mb-3">프로필 정보</h2>
              <div className="space-y-2 text-sm text-gray-700">
                <p><span className="text-gray-500">이름:</span> {parsedProfile?.name || "-"}</p>
                <p><span className="text-gray-500">이메일:</span> {parsedProfile?.email || "-"}</p>
                <p><span className="text-gray-500">전화번호:</span> {parsedProfile?.phone || "-"}</p>
                <p><span className="text-gray-500">최종 학력:</span> {parsedProfile?.education || "-"}</p>
                <p><span className="text-gray-500">경력:</span> {(parsedProfile?.career ?? []).join(", ") || "-"}</p>
                <p><span className="text-gray-500">학력 상세:</span> {(parsedProfile?.education_history ?? []).join(", ") || "-"}</p>
                <p><span className="text-gray-500">수상경력:</span> {(parsedProfile?.awards ?? []).join(", ") || "-"}</p>
                <p><span className="text-gray-500">자격증:</span> {(parsedProfile?.certifications ?? []).join(", ") || "-"}</p>
                <p><span className="text-gray-500">외국어:</span> {(parsedProfile?.languages ?? []).join(", ") || "-"}</p>
                <p><span className="text-gray-500">스킬:</span> {(parsedProfile?.skills ?? []).join(", ") || "-"}</p>
                <p><span className="text-gray-500">자기소개:</span> {parsedProfile?.self_intro || "-"}</p>
              </div>
            </section>

            <section className="rounded-lg border border-gray-200 p-4">
              <h2 className="font-semibold text-gray-900 mb-3">활동 정보 ({parsedActivities.length})</h2>
              {parsedActivities.length === 0 ? (
                <p className="text-sm text-gray-500">추출된 활동이 없습니다.</p>
              ) : (
                <div className="space-y-3 max-h-[360px] overflow-y-auto pr-2">
                  {parsedActivities.map((activity, idx) => (
                    <div key={`${activity.title}-${idx}`} className="rounded border border-gray-200 p-3">
                      <p className="text-xs text-gray-500">{activity.type}</p>
                      <p className="font-medium text-gray-900">{activity.title || "(제목 없음)"}</p>
                      <p className="text-xs text-gray-500 mt-1">{activity.period || "기간 미입력"}</p>
                      <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{activity.description || "설명 없음"}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
