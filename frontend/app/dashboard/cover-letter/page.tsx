"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { listCoverLetters } from "@/lib/api/app";
import type { CoverLetter } from "@/lib/types";

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("ko-KR");
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "");
}

export default function CoverLetterPage() {
  const [items, setItems] = useState<CoverLetter[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchItems = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await listCoverLetters();
        setItems(result.coverLetters);
      } catch (e) {
        setError(e instanceof Error ? e.message : "자기소개서를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, []);

  const filtered = useMemo(() => {
    const q = normalizeText(query);
    if (!q) return items;
    return items.filter((item) => {
      const target = normalizeText(
        [
          item.title,
          item.company_name || "",
          item.job_title || "",
          item.prompt_question || "",
          item.content || "",
          ...(item.tags || []),
        ].join(" ")
      );
      return target.includes(q);
    });
  }, [items, query]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">불러오는 중...</p>
      </main>
    );
  }

  return (
    <main className="bg-white min-h-screen">
      <div className="max-w-6xl mx-auto px-8 py-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">자기소개서 저장소</h1>
            <p className="text-sm text-gray-500">
              문항별로 하나씩 작성하고, 언제든 수정해서 재사용하세요.
            </p>
          </div>
          <Link
            href="/dashboard/cover-letter/new"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #094cb2, #3b82f6)" }}
          >
            + 새 자기소개서 작성
          </Link>
        </div>

        <div className="mb-6 rounded-xl border border-gray-200 px-4 py-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="제목, 회사, 직무, 문항 내용으로 검색"
            className="w-full text-sm text-gray-700 placeholder-gray-400 outline-none"
          />
        </div>

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        {filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg mb-2">저장된 자기소개서가 없습니다.</p>
            <p className="text-sm">새 문항을 추가해 자기소개서를 하나씩 쌓아보세요.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((item) => (
              <Link
                key={item.id}
                href={`/dashboard/cover-letter/${item.id}`}
                className="group block rounded-2xl border border-gray-100 bg-white p-5 hover:border-blue-200 hover:shadow-md transition-all"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs text-gray-400">수정일 {formatDate(item.updated_at)}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs text-orange-600">
                      {Array.isArray(item.qa_items) ? `${item.qa_items.length}문항` : "1문항"}
                    </span>
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
                      {item.job_title || "직무 미지정"}
                    </span>
                  </div>
                </div>
                <h3 className="line-clamp-2 text-base font-bold text-gray-900">{item.title}</h3>
                <p className="mt-2 text-xs text-gray-500">
                  {item.company_name || "회사 미지정"}
                </p>
                {item.prompt_question && (
                  <p className="mt-3 line-clamp-2 text-sm text-gray-700">{item.prompt_question}</p>
                )}
                <p className="mt-3 line-clamp-4 text-sm text-gray-500">{item.content}</p>
                {Array.isArray(item.tags) && item.tags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {item.tags.slice(0, 4).map((tag, idx) => (
                      <span
                        key={`${item.id}-${tag}-${idx}`}
                        className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
                <p className="mt-4 text-right text-xs text-blue-500 group-hover:underline">상세보기</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
