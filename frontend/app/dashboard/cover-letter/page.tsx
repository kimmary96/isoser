"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { listCoverLetters } from "@/lib/api/app";
import type { CoverLetter } from "@/lib/types";
import { cx, iso } from "@/components/ui/isoser-ui";

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
      <main className="flex min-h-screen items-center justify-center bg-[#f3f6fb]">
        <p className="text-slate-500">불러오는 중...</p>
      </main>
    );
  }

  return (
    <main className={iso.page}>
      <div className="mx-auto max-w-7xl px-8 py-8">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-950">자기소개서 저장소</h1>
            <p className="text-sm text-slate-500">
              문항별로 하나씩 작성하고, 언제든 수정해서 재사용하세요.
            </p>
          </div>
          <Link
            href="/dashboard/cover-letter/new"
            className={cx("flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold", iso.primaryButton)}
          >
            + 새 자기소개서 작성
          </Link>
        </div>

        <div className="mb-6 rounded-2xl border border-blue-100 bg-[#eef6ff] px-4 py-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="제목, 회사, 직무, 문항 내용으로 검색"
            className="w-full bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none"
          />
        </div>

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white py-20 text-center text-slate-400 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
            <p className="mb-2 text-lg">저장된 자기소개서가 없습니다.</p>
            <p className="text-sm">새 문항을 추가해 자기소개서를 하나씩 쌓아보세요.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((item) => (
              <Link
                key={item.id}
                href={`/dashboard/cover-letter/${item.id}`}
                className="group block rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)] transition-all hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)]"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs text-slate-400">수정일 {formatDate(item.updated_at)}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-full bg-[#fff1e6] px-2 py-0.5 text-xs font-medium text-[#c94f12]">
                      {Array.isArray(item.qa_items) ? `${item.qa_items.length}문항` : "1문항"}
                    </span>
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-[#094cb2]">
                      {item.job_title || "직무 미지정"}
                    </span>
                  </div>
                </div>
                <h3 className="line-clamp-2 text-base font-bold text-slate-950">{item.title}</h3>
                <p className="mt-2 text-xs text-slate-500">
                  {item.company_name || "회사 미지정"}
                </p>
                {item.prompt_question && (
                  <p className="mt-3 line-clamp-2 text-sm text-slate-700">{item.prompt_question}</p>
                )}
                <p className="mt-3 line-clamp-4 text-sm text-slate-500">{item.content}</p>
                {Array.isArray(item.tags) && item.tags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {item.tags.slice(0, 4).map((tag, idx) => (
                      <span
                        key={`${item.id}-${tag}-${idx}`}
                        className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
                <p className="mt-4 text-right text-xs font-semibold text-[#e0621a] group-hover:underline">상세보기</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
