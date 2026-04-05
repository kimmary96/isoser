"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import { getGuestResume, isGuestMode } from "@/lib/guest";
import type { Resume } from "@/lib/types";

function DocumentsContent() {
  const supabase = useMemo(() => createBrowserClient(), []);
  const searchParams = useSearchParams();
  const highlightedResumeId = searchParams.get("resumeId");
  const [documents, setDocuments] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDocuments = async () => {
      setLoading(true);
      setError(null);
      try {
        if (isGuestMode()) {
          const guestResume = getGuestResume();
          setDocuments(guestResume ? [guestResume] : []);
          return;
        }

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
        if (authError || !user) {
          throw new Error("로그인이 필요합니다.");
        }

        const { data, error: queryError } = await supabase
          .from("resumes")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (queryError) {
          throw new Error(queryError.message);
        }
        setDocuments(data || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "문서 목록을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, [supabase]);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">문서 저장소</h1>
          <p className="text-sm text-gray-500 mt-1">생성한 이력서를 확인하고 PDF로 내보낼 수 있습니다.</p>
        </div>

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        {loading ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
            불러오는 중...
          </div>
        ) : documents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <p className="text-gray-500">저장된 문서가 없습니다.</p>
            <Link
              href="/dashboard/resume"
              className="inline-block mt-4 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
            >
              이력서 만들기
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => {
              const isHighlighted = highlightedResumeId === doc.id;
              return (
                <div
                  key={doc.id}
                  className={`rounded-xl border bg-white p-4 flex items-center justify-between ${
                    isHighlighted ? "border-blue-400" : "border-gray-200"
                  }`}
                >
                  <div>
                    <p className="font-semibold text-gray-900">{doc.title}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      지원 직무: {doc.target_job ?? "미입력"} | 생성일: {doc.created_at.slice(0, 10)}
                    </p>
                  </div>
                  <Link
                    href={`/dashboard/resume/export?resumeId=${doc.id}`}
                    className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    PDF 내보내기
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gray-50 flex items-center justify-center">
          <p className="text-gray-500">불러오는 중...</p>
        </main>
      }
    >
      <DocumentsContent />
    </Suspense>
  );
}
