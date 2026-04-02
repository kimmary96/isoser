// 온보딩 페이지 - 기존 이력서 PDF 업로드로 활동 자동 추출
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { parsePdf } from "@/lib/api/backend";
import { isGuestMode } from "@/lib/guest";
import { createBrowserClient } from "@/lib/supabase/client";
import type { ParsedProfile, ParsedActivity } from "@/lib/types";

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(), []);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected && selected.type === "application/pdf") {
      setFile(selected);
      setError(null);
    } else {
      setError("PDF 파일만 업로드 가능합니다.");
    }
  };

  const handleUpload = async () => {
    if (isGuestMode()) {
      setError("게스트 모드에서는 업로드 저장을 지원하지 않습니다. 활동 페이지의 샘플 데이터로 QA를 진행해주세요.");
      return;
    }

    if (!file) return;
    setLoading(true);
    setError(null);

    try {
      const result = await parsePdf(file);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("로그인이 필요합니다.");

      // 프로필 저장
      const profile: ParsedProfile = result.profile;
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: user.id,
        ...profile,
      });
      if (profileError) {
        throw new Error(profileError.message);
      }

      // 활동 목록 저장
      const activities: ParsedActivity[] = result.activities;
      if (activities.length > 0) {
        const { error: activityError } = await supabase.from("activities").insert(
          activities.map((a) => ({ ...a, user_id: user.id }))
        );
        if (activityError) {
          throw new Error(activityError.message);
        }
      }

      router.push("/dashboard/activities");
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl border border-gray-200 p-8 w-full max-w-lg space-y-6">
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
            <div className="text-gray-400 mb-2">
              <svg className="w-10 h-10 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            {file ? (
              <p className="text-sm font-medium text-gray-700">{file.name}</p>
            ) : (
              <p className="text-sm text-gray-500">
                클릭하여 PDF 파일 선택
              </p>
            )}
          </label>
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            건너뛰기
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || loading}
            className="flex-1 px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "분석 중..." : "업로드 및 분석"}
          </button>
        </div>
      </div>
    </main>
  );
}
