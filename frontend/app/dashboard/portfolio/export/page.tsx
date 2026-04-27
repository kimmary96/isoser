"use client";

import { Suspense } from "react";
import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import {
  getOrderedPortfolioProjects,
  getPortfolioProjectDisplaySections,
  getPortfolioProjectSummary,
} from "@/lib/portfolio-document";
import type { PortfolioDocumentPayload, PortfolioImagePlacement, PortfolioProjectDraft } from "@/lib/types";
import { usePortfolioExport } from "./_hooks/use-portfolio-export";

const PortfolioPdfDownload = dynamic(
  () => import("./_components/portfolio-pdf-download").then((mod) => mod.PortfolioPdfDownload),
  {
    ssr: false,
    loading: () => (
      <div className="block w-full rounded-xl bg-slate-100 px-4 py-3 text-center text-sm font-semibold text-slate-500">
        PDF 모듈 로딩 중...
      </div>
    ),
  }
);

function imagesForSection(
  document: PortfolioDocumentPayload,
  project: PortfolioProjectDraft,
  sectionKey: PortfolioImagePlacement["sectionKey"]
): PortfolioImagePlacement[] {
  return document.imagePlacements
    .filter((placement) => placement.activityId === project.activityId && placement.sectionKey === sectionKey)
    .sort((a, b) => a.order - b.order);
}

function PreviewImages({ placements }: { placements: PortfolioImagePlacement[] }) {
  if (placements.length === 0) return null;
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      {placements.map((placement) => (
        <figure key={placement.id} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          <div className="relative aspect-[4/3]">
            <Image
              src={placement.imageUrl}
              alt={placement.captionDraft || "포트폴리오 이미지"}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              unoptimized
              className="object-cover"
            />
          </div>
          <figcaption className="px-3 py-2 text-xs text-slate-500">
            {placement.captionDraft || "이미지 캡션 확인 필요"}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

function PreviewProject({
  document,
  project,
  index,
}: {
  document: PortfolioDocumentPayload;
  project: PortfolioProjectDraft;
  index: number;
}) {
  const overview = project.portfolio.project_overview;
  const displaySections = getPortfolioProjectDisplaySections(project);

  return (
    <article className="border-b border-slate-200 pb-8 last:border-b-0">
      <p className="text-xs font-bold text-[#094cb2]">PROJECT {index + 1}</p>
      <h3 className="mt-1 text-xl font-bold text-slate-950">{overview.title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{getPortfolioProjectSummary(project)}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {[overview.period, overview.role, overview.organization].filter(Boolean).map((item) => (
          <span key={item} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
            {item}
          </span>
        ))}
        {overview.skills.slice(0, 6).map((skill) => (
          <span key={skill} className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-[#094cb2]">
            {skill}
          </span>
        ))}
      </div>
      <PreviewImages placements={imagesForSection(document, project, "overview")} />
      {displaySections.map((section) => {
        const placements = imagesForSection(document, project, section.key);
        const hasContent =
          Boolean(section.text) || section.highlights.length > 0 || placements.length > 0;
        if (!hasContent) return null;

        return (
          <PreviewBlock key={section.key} title={section.title} text={section.text}>
            {section.highlights.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-600">
                {section.highlights.map((highlight) => (
                  <li key={highlight}>{highlight}</li>
                ))}
              </ul>
            )}
            <PreviewImages placements={placements} />
          </PreviewBlock>
        );
      })}
    </article>
  );
}

function PreviewBlock({
  title,
  text,
  children,
}: {
  title: string;
  text: string | null;
  children?: ReactNode;
}) {
  return (
    <section className="mt-5">
      <h4 className="text-sm font-bold text-slate-950">{title}</h4>
      {text && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{text}</p>}
      {children}
    </section>
  );
}

function PortfolioExportContent() {
  const searchParams = useSearchParams();
  const portfolioId = searchParams.get("portfolioId");
  const embedded = searchParams.get("embedded") === "true";
  const templateName = "기본형";
  const { document, profile, loading, error } = usePortfolioExport(portfolioId);
  const projects = document ? getOrderedPortfolioProjects(document) : [];

  return (
    <main className={`min-h-screen bg-[#f3f6fb] ${embedded ? "px-3 py-3" : "px-4 py-8"}`}>
      <div className={embedded ? "mx-auto max-w-4xl" : "mx-auto max-w-6xl"}>
        {!embedded && (
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#094cb2]">포트폴리오 PDF 출력</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">{document?.title || "포트폴리오"}</h1>
          </div>
          <Link
            href="/dashboard/portfolio"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            빌더로 돌아가기
          </Link>
          </div>
        )}

        {error && <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

        <div className={embedded ? "block" : "grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]"}>
          <section className="min-h-[720px] rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            {loading ? (
              <p className="text-sm text-slate-500">불러오는 중...</p>
            ) : !document ? (
              <p className="text-sm text-slate-500">저장된 포트폴리오가 없습니다.</p>
            ) : (
              <div className="mx-auto max-w-3xl">
                <div className="border-b border-slate-200 pb-5">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#094cb2]">Portfolio</p>
                  <h2 className="mt-2 text-3xl font-bold text-slate-950">{document.title}</h2>
                  <p className="mt-2 text-sm text-slate-500">
                    {[profile?.name, document.targetJob ? `지원 직무: ${document.targetJob}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {profile?.self_intro && (
                    <p className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                      {profile.self_intro}
                    </p>
                  )}
                </div>
                <div className="mt-8 space-y-8">
                  {projects.map((project, index) => (
                    <PreviewProject
                      key={project.activityId || `${project.portfolio.project_overview.title}-${index}`}
                      document={document}
                      project={project}
                      index={index}
                    />
                  ))}
                </div>
              </div>
            )}
          </section>

          {!embedded && (
            <aside className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-bold text-slate-950">출력 설정</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                저장된 포트폴리오 문서를 기준으로 PDF를 생성합니다.
              </p>
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <p>프로젝트 {projects.length}개</p>
                <p>디자인 {templateName}</p>
              </div>
            </section>
            {!loading && document && <PortfolioPdfDownload document={document} profile={profile} />}
            </aside>
          )}
        </div>
      </div>
    </main>
  );
}

export default function PortfolioExportPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#f3f6fb]">
          <p className="text-sm text-slate-500">불러오는 중...</p>
        </main>
      }
    >
      <PortfolioExportContent />
    </Suspense>
  );
}
