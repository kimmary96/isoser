"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { getDocuments, getPortfolioExportData, getResumeExportData } from "@/lib/api/app";
import type { DashboardDocumentItem } from "@/lib/types";

const DOCUMENT_DESIGNS = [
  {
    id: "simple",
    name: "기본형",
    status: "사용 가능",
    description: "현재 PDF 출력에 연결된 안정 버전입니다.",
    available: true,
  },
  {
    id: "compact",
    name: "압축형",
    status: "준비중",
    description: "짧은 경력과 1페이지 출력에 맞춘 후보입니다.",
    available: false,
  },
  {
    id: "editorial",
    name: "스토리형",
    status: "준비중",
    description: "프로젝트 설명과 이미지를 더 크게 쓰는 후보입니다.",
    available: false,
  },
] as const;

type DocumentDesignId = (typeof DOCUMENT_DESIGNS)[number]["id"];
type DocumentKindFilter = DashboardDocumentItem["kind"] | "all";
type PaymentStatus = "idle" | "processing" | "downloading" | "success" | "error";

const DEMO_PDF_PRICE = "1,000원";
const DEMO_PAYMENT_METHOD = "신한카드 **** 1234";

function getDocumentLabel(kind: DashboardDocumentItem["kind"]): string {
  return kind === "resume" ? "이력서" : "포트폴리오";
}

function formatDate(value: string): string {
  return value ? value.slice(0, 10) : "-";
}

function getDocumentPreviewHref(
  document: DashboardDocumentItem,
  designId: DocumentDesignId
): string {
  const params = new URLSearchParams({ template: designId });
  if (document.kind === "resume") {
    params.set("resumeId", document.id);
    return `/preview/documents/resume?${params.toString()}`;
  }

  params.set("portfolioId", document.id);
  return `/preview/documents/portfolio?${params.toString()}`;
}

function waitForDemoPayment(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function preloadPdfDownloadModule(kind: DashboardDocumentItem["kind"]) {
  if (kind === "resume") {
    void import("../resume/export/_components/resume-pdf-download");
    return;
  }

  void import("../portfolio/export/_components/portfolio-pdf-download");
}

function DocumentsContent() {
  const searchParams = useSearchParams();
  const highlightedResumeId = searchParams.get("resumeId");
  const highlightedPortfolioId = searchParams.get("portfolioId");
  const notice = searchParams.get("notice");
  const [documents, setDocuments] = useState<DashboardDocumentItem[]>([]);
  const [activeKindFilter, setActiveKindFilter] = useState<DocumentKindFilter>(() => {
    if (highlightedResumeId) return "resume";
    if (highlightedPortfolioId) return "portfolio";
    return "all";
  });
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [selectedDesignId, setSelectedDesignId] = useState<DocumentDesignId>("simple");
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("idle");
  const [paymentMessage, setPaymentMessage] = useState("");
  const [paymentError, setPaymentError] = useState<string | null>(null);
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

  const filteredDocuments = useMemo(
    () =>
      activeKindFilter === "all"
        ? documents
        : documents.filter((document) => document.kind === activeKindFilter),
    [activeKindFilter, documents]
  );

  useEffect(() => {
    if (filteredDocuments.length === 0) {
      setSelectedDocumentId(null);
      return;
    }

    setSelectedDocumentId((current) => {
      if (current && filteredDocuments.some((doc) => doc.id === current)) {
        return current;
      }

      const highlightedId = highlightedResumeId || highlightedPortfolioId;
      const highlighted = filteredDocuments.find((doc) => doc.id === highlightedId);
      return highlighted?.id ?? filteredDocuments[0]?.id ?? null;
    });
  }, [filteredDocuments, highlightedPortfolioId, highlightedResumeId]);

  const selectedDocument = useMemo(
    () => documents.find((doc) => doc.id === selectedDocumentId) ?? null,
    [documents, selectedDocumentId]
  );
  const selectedDesign =
    DOCUMENT_DESIGNS.find((design) => design.id === selectedDesignId) ?? DOCUMENT_DESIGNS[0];
  const previewHref = selectedDocument
    ? getDocumentPreviewHref(selectedDocument, selectedDesign.id)
    : "#";
  const filterOptions = [
    { id: "all" as const, label: "전체", count: documents.length },
    {
      id: "resume" as const,
      label: "이력서",
      count: documents.filter((document) => document.kind === "resume").length,
    },
    {
      id: "portfolio" as const,
      label: "포트폴리오",
      count: documents.filter((document) => document.kind === "portfolio").length,
    },
  ];
  const paymentProcessing = paymentStatus === "processing";
  const paymentDownloading = paymentStatus === "downloading";
  const paymentBusy = paymentProcessing || paymentDownloading;

  const openPaymentModal = () => {
    if (!selectedDocument) return;
    preloadPdfDownloadModule(selectedDocument.kind);
    setPaymentStatus("idle");
    setPaymentMessage("");
    setPaymentError(null);
    setPaymentModalOpen(true);
  };

  const closePaymentModal = () => {
    if (paymentProcessing) return;
    setPaymentModalOpen(false);
  };

  const handleConfirmPayment = async () => {
    if (!selectedDocument || paymentBusy) return;

    setPaymentStatus("processing");
    setPaymentError(null);
    setPaymentMessage("저장된 결제수단으로 결제 중입니다...");

    try {
      await waitForDemoPayment(250);
      setPaymentStatus("downloading");
      setPaymentMessage("결제 완료했습니다. PDF를 다운로드합니다.");

      if (selectedDocument.kind === "resume") {
        const [exportData, pdfModule] = await Promise.all([
          getResumeExportData(selectedDocument.id),
          import("../resume/export/_components/resume-pdf-download"),
        ]);

        if (!exportData.resume) {
          throw new Error("저장된 이력서 데이터를 찾지 못했습니다.");
        }

        await pdfModule.downloadResumePdf({
          resume: exportData.resume,
          activities: exportData.activities,
          profile: exportData.profile,
        });
      } else {
        const [exportData, pdfModule] = await Promise.all([
          getPortfolioExportData(selectedDocument.id),
          import("../portfolio/export/_components/portfolio-pdf-download"),
        ]);

        if (!exportData.document) {
          throw new Error("저장된 포트폴리오 데이터를 찾지 못했습니다.");
        }

        await pdfModule.downloadPortfolioPdf({
          document: exportData.document,
          profile: exportData.profile,
        });
      }

      setPaymentStatus("success");
      setPaymentMessage("결제가 완료되었습니다. PDF 다운로드가 시작되었습니다.");
    } catch (paymentFlowError) {
      setPaymentStatus("error");
      setPaymentMessage("");
      setPaymentError(
        paymentFlowError instanceof Error
          ? paymentFlowError.message
          : "PDF 다운로드 처리 중 오류가 발생했습니다."
      );
    }
  };

  return (
    <main className="flex h-screen overflow-hidden bg-[#f3f6fb] text-slate-950">
      <aside className="flex h-full w-80 flex-shrink-0 flex-col border-r border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.04)] 2xl:w-[21rem]">
        <div className="border-b border-slate-100 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Document Store
          </p>
          <h1 className="mt-1 text-lg font-bold text-slate-950">문서 저장소</h1>
          <p className="mt-1.5 text-[11px] leading-5 text-slate-500">
            저장된 이력서와 포트폴리오를 선택합니다.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-xl bg-slate-100 p-1">
            {filterOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setActiveKindFilter(option.id)}
                className={`rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-all ${
                  activeKindFilter === option.id
                    ? "bg-white text-[#094cb2] shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {option.label}
                <span className="ml-1 text-[10px] text-slate-400">{option.count}</span>
              </button>
            ))}
          </div>
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
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-500">
              불러오는 중...
            </div>
          ) : documents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center">
              <p className="text-sm font-semibold text-slate-700">저장된 문서가 없습니다.</p>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                이력서 또는 포트폴리오 빌더에서 먼저 문서를 생성하세요.
              </p>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center">
              <p className="text-sm font-semibold text-slate-700">
                {activeKindFilter === "resume" ? "저장된 이력서가 없습니다." : "저장된 포트폴리오가 없습니다."}
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                상단 필터를 바꾸거나 새 문서를 생성하세요.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredDocuments.map((doc) => {
                const isSelected = selectedDocumentId === doc.id;
                const isHighlighted =
                  (doc.kind === "resume" && highlightedResumeId === doc.id) ||
                  (doc.kind === "portfolio" && highlightedPortfolioId === doc.id);

                return (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => setSelectedDocumentId(doc.id)}
                    className={`w-full rounded-xl border p-3 text-left transition-all ${
                      isSelected
                        ? "border-blue-200 bg-[#eef6ff] shadow-[0_8px_20px_rgba(9,76,178,0.08)]"
                        : "border-slate-200 bg-white hover:border-orange-200 hover:bg-[#fffaf6]"
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
                    <p className="mt-2 line-clamp-2 text-[13px] font-bold leading-5 text-slate-950">
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

      <section className="flex min-w-0 flex-1 flex-col overflow-hidden px-5 py-4">
        <div className="mb-3 flex flex-col gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#094cb2]">PDF 미리보기</p>
            <h2 className="mt-1 truncate text-xl font-bold text-slate-950">
              {selectedDocument?.title ?? "문서를 선택하세요"}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
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
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                미리보기 새 창
              </Link>
              <button
                type="button"
                onClick={openPaymentModal}
                className="rounded-xl bg-[#071a36] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0a2146]"
              >
                PDF 출력
              </button>
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-[#e8edf5] p-2 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
          {selectedDocument ? (
            <iframe
              key={`${selectedDocument.id}-${selectedDesign.id}`}
              title={`${selectedDocument.title} PDF 미리보기`}
              src={previewHref}
              className="h-full w-full rounded-xl bg-white"
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
        <div className="border-b border-slate-100 p-4">
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
                className={`w-full rounded-xl border p-3.5 text-left transition-all ${
                  isSelected
                    ? "border-blue-200 bg-[#eef6ff] shadow-[0_8px_20px_rgba(9,76,178,0.08)]"
                    : "border-slate-200 bg-white hover:border-orange-200 hover:bg-[#fffaf6]"
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
                <div className="mt-3 h-20 rounded-xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] p-3">
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

      {paymentModalOpen && selectedDocument && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-[#094cb2]">Demo Payment</p>
                <h3 className="mt-1 text-lg font-bold text-slate-950">PDF 출력 결제</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  데모 시연용 결제 플로우입니다. 실제 결제는 발생하지 않습니다.
                </p>
              </div>
              <button
                type="button"
                onClick={closePaymentModal}
                disabled={paymentProcessing}
                className="rounded-lg px-2 py-1 text-sm font-semibold text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                닫기
              </button>
            </div>

            <div className="mt-5 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-500">문서</span>
                <span className="min-w-0 truncate font-semibold text-slate-900">
                  {selectedDocument.title}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-500">종류</span>
                <span className="font-semibold text-slate-900">
                  {getDocumentLabel(selectedDocument.kind)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-500">디자인</span>
                <span className="font-semibold text-slate-900">{selectedDesign.name}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-500">금액</span>
                <span className="font-bold text-slate-950">{DEMO_PDF_PRICE}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-500">결제수단</span>
                <span className="font-semibold text-slate-900">{DEMO_PAYMENT_METHOD}</span>
              </div>
            </div>

            {(paymentMessage || paymentError) && (
              <div
                className={`mt-4 rounded-xl px-3 py-2 text-sm leading-6 ${
                  paymentStatus === "error"
                    ? "border border-rose-200 bg-rose-50 text-rose-700"
                    : "border border-blue-100 bg-[#eef6ff] text-[#094cb2]"
                }`}
              >
                {paymentError || paymentMessage}
              </div>
            )}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={closePaymentModal}
                disabled={paymentProcessing}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {paymentDownloading ? "닫기" : "취소"}
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmPayment()}
                disabled={paymentBusy || paymentStatus === "success"}
                className="flex-1 rounded-xl bg-[#071a36] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0a2146] disabled:cursor-wait disabled:opacity-60"
              >
                {paymentStatus === "processing"
                  ? "결제 중..."
                  : paymentStatus === "downloading"
                    ? "PDF 준비 중..."
                    : paymentStatus === "success"
                      ? "다운로드 완료"
                      : "결제하고 다운로드"}
              </button>
            </div>
          </div>
        </div>
      )}
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
