"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { getDocuments } from "@/lib/api/app";
import type { DashboardDocumentItem } from "@/lib/types";

const DOCUMENT_DESIGNS = [
  {
    id: "simple",
    name: "기본형",
    status: "사용 가능",
    description: "현재 이력서와 포트폴리오 PDF 출력에 연결된 안정 버전입니다.",
    available: true,
  },
  {
    id: "compact",
    name: "압축형",
    status: "준비중",
    description: "짧은 경력과 한 페이지 출력에 맞춘 디자인 후보입니다.",
    available: false,
  },
  {
    id: "editorial",
    name: "스토리형",
    status: "준비중",
    description: "포트폴리오 프로젝트 설명과 이미지를 더 크게 쓰는 디자인 후보입니다.",
    available: false,
  },
] as const;

type DocumentDesignId = (typeof DOCUMENT_DESIGNS)[number]["id"];

function getDocumentLabel(kind: DashboardDocumentItem["kind"]): string {
  return kind === "resume" ? "이력서" : "포트폴리오";
}

function formatDate(value: string): string {
  return value ? value.slice(0, 10) : "-";
}

function withExportParams(
  href: string,
  params: Record<string, string | boolean | undefined>
): string {
  const url = new URL(href, "https://isoser.local");
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === false) {
      url.searchParams.delete(key);
      continue;
    }
    url.searchParams.set(key, String(value));
  }

  const query = url.searchParams.toString();
  return `${url.pathname}${query ? `?${query}` : ""}`;
}

function DocumentsContent() {
  const searchParams = useSearchParams();
  const highlightedResumeId = searchParams.get("resumeId");
  const highlightedPortfolioId = searchParams.get("portfolioId");
  const notice = searchParams.get("notice");
  const [documents, setDocuments] = useState<DashboardDocumentItem[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [selectedDesignId, setSelectedDesignId] = useState<DocumentDesignId>("simple");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDocuments = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getDocuments();
        setDocuments(data.documents || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "문서 목록을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };

    void fetchDocuments();
  }, []);

  useEffect(() => {
    if (documents.length === 0) {
      setSelectedDocumentId(null);
      return;
    }

    setSelectedDocumentId((current) => {
      if (current && documents.some((doc) => doc.id === current)) {
        return current;
      }

      const highlightedId = highlightedResumeId || highlightedPortfolioId;
      const highlighted = documents.find((doc) => doc.id === highlightedId);
      return highlighted?.id ?? documents[0]?.id ?? null;
    });
  }, [documents, highlightedPortfolioId, highlightedResumeId]);

  const selectedDocument = useMemo(
    () => documents.find((doc) => doc.id === selectedDocumentId) ?? null,
    [documents, selectedDocumentId]
  );
  const selectedDesign =
    DOCUMENT_DESIGNS.find((design) => design.id === selectedDesignId) ?? DOCUMENT_DESIGNS[0];
  const exportHref = selectedDocument
    ? withExportParams(selectedDocument.exportHref, { template: selectedDesign.id })
    : "#";
  const previewHref = selectedDocument
    ? withExportParams(selectedDocument.exportHref, {
        template: selectedDesign.id,
        embedded: true,
      })
    : "#";

  return (
    <main className="flex h-screen overflow-hidden bg-[#f3f6fb] text-slate-950">
      <aside className="flex h-full w-80 flex-shrink-0 flex-col border-r border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.04)] 2xl:w-[21rem]">
        <div className="border-b border-slate-100 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Document Store
          </p>
          <h1 className="mt-1 text-xl font-bold text-slate-950">문서 저장소</h1>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            저장된 이력서와 포트폴리오를 선택합니다.
          </p>
        </div>

        {notice === "activityOverridesNotSaved" && (
          <div className="m-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
            이력서는 저장됐지만 AI 적용 문장은 저장되지 않았습니다. 데이터베이스 컬럼 적용 후
            다시 문서를 생성하면 PDF에도 반영됩니다.
          </div>
        )}

        {error && (
          <div className="m-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
              불러오는 중...
            </div>
          ) : documents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-center">
              <p className="text-sm font-semibold text-slate-700">저장된 문서가 없습니다.</p>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                이력서 또는 포트폴리오 빌더에서 먼저 문서를 생성하세요.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {documents.map((doc) => {
                const isSelected = selectedDocumentId === doc.id;
                const isHighlighted =
                  (doc.kind === "resume" && highlightedResumeId === doc.id) ||
                  (doc.kind === "portfolio" && highlightedPortfolioId === doc.id);

                return (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => setSelectedDocumentId(doc.id)}
                    className={`w-full rounded-2xl border p-3.5 text-left transition-all ${
                      isSelected
                        ? "border-blue-200 bg-[#eef6ff]"
                        : "border-slate-200 bg-white hover:border-orange-200"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        {getDocumentLabel(doc.kind)}
                      </span>
                      {isHighlighted && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-[#094cb2]">
                          최근 생성
                        </span>
                      )}
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm font-bold leading-5 text-slate-950">
                      {doc.title}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                      {doc.subtitle}
                    </p>
                    <p className="mt-2 text-[11px] text-slate-400">
                      업데이트 {formatDate(doc.updatedAt)}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-slate-100 p-4">
          <Link
            href="/dashboard/resume"
            className="rounded-xl bg-[#094cb2] px-3 py-2 text-center text-xs font-semibold text-white hover:bg-[#073c8f]"
          >
            이력서 작성
          </Link>
          <Link
            href="/dashboard/portfolio"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            포트폴리오 작성
          </Link>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col overflow-hidden px-6 py-5">
        <div className="mb-4 flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#094cb2]">PDF 미리보기</p>
            <h2 className="mt-1 truncate text-2xl font-bold text-slate-950">
              {selectedDocument?.title ?? "문서를 선택하세요"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {selectedDocument
                ? `${getDocumentLabel(selectedDocument.kind)} · ${selectedDesign.name} · 생성 ${formatDate(
                    selectedDocument.createdAt
                  )}`
                : "왼쪽 목록에서 저장된 문서를 선택하면 미리보기가 표시됩니다."}
            </p>
          </div>
          {selectedDocument && (
            <div className="flex flex-wrap gap-2">
              <Link
                href={previewHref}
                target="_blank"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                미리보기 새 창
              </Link>
              <Link
                href={exportHref}
                target="_blank"
                className="rounded-xl bg-[#071a36] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a2146]"
              >
                PDF 출력
              </Link>
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {selectedDocument ? (
            <iframe
              key={`${selectedDocument.id}-${selectedDesign.id}`}
              title={`${selectedDocument.title} PDF 미리보기`}
              src={previewHref}
              className="h-full w-full bg-white"
            />
          ) : (
            <div className="flex h-full items-center justify-center p-10 text-center">
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  선택된 문서가 없습니다.
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  저장된 문서를 선택하거나 새 문서를 생성하세요.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      <aside className="flex h-full w-80 flex-shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.04)] 2xl:w-[22rem]">
        <div className="border-b border-slate-100 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Design
          </p>
          <h2 className="mt-1 text-lg font-bold text-slate-950">디자인 선택</h2>
        </div>

        <div className="space-y-3 p-4">
          {DOCUMENT_DESIGNS.map((design) => {
            const isSelected = selectedDesignId === design.id;

            return (
              <button
                key={design.id}
                type="button"
                onClick={() => {
                  if (design.available) {
                    setSelectedDesignId(design.id);
                  }
                }}
                disabled={!design.available}
                className={`w-full rounded-2xl border p-4 text-left transition-all ${
                  isSelected
                    ? "border-blue-200 bg-[#eef6ff]"
                    : "border-slate-200 bg-white hover:border-orange-200"
                } ${design.available ? "" : "cursor-not-allowed opacity-60"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-slate-950">{design.name}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      design.available
                        ? "bg-blue-100 text-[#094cb2]"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {design.status}
                  </span>
                </div>
                <div className="mt-3 h-24 rounded-xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] p-3">
                  <div className="h-2 w-16 rounded bg-slate-300" />
                  <div className="mt-3 space-y-1.5">
                    <div className="h-1.5 w-full rounded bg-slate-200" />
                    <div className="h-1.5 w-5/6 rounded bg-slate-200" />
                    <div className="h-1.5 w-2/3 rounded bg-slate-200" />
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-1.5">
                    <div className="h-7 rounded bg-blue-50" />
                    <div className="h-7 rounded bg-slate-100" />
                    <div className="h-7 rounded bg-slate-100" />
                  </div>
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-500">{design.description}</p>
              </button>
            );
          })}
        </div>
      </aside>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#f3f6fb]">
          <p className="text-slate-500">불러오는 중...</p>
        </main>
      }
    >
      <DocumentsContent />
    </Suspense>
  );
}
