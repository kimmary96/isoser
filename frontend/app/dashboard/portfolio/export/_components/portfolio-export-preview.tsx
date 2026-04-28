"use client";

import type { ReactNode } from "react";
import Image from "next/image";

import {
  getOrderedPortfolioProjects,
  getPortfolioProjectDisplaySections,
  getPortfolioProjectMeta,
  getPortfolioProjectSummary,
  getPortfolioProjectTitle,
} from "@/lib/portfolio-document";
import type {
  PortfolioDocumentPayload,
  PortfolioImagePlacement,
  PortfolioProjectDraft,
} from "@/lib/types";

type PortfolioExportProfile = {
  name: string | null;
  self_intro: string | null;
};

type A4PreviewItem = {
  key: string;
  node: ReactNode;
  units: number;
  keepWithNext?: boolean;
};

const A4_PAGE_UNIT_LIMIT = 52;

function estimateTextRows(text: string | null | undefined, charsPerRow = 82): number {
  const normalized = text?.trim();
  if (!normalized) return 0;
  return normalized
    .split(/\n+/)
    .map((line) => Math.max(1, Math.ceil(line.trim().length / charsPerRow)))
    .reduce((sum, rows) => sum + rows, 0);
}

function paginateA4Items(items: A4PreviewItem[]): A4PreviewItem[][] {
  const pages: A4PreviewItem[][] = [];
  let currentPage: A4PreviewItem[] = [];
  let currentUnits = 0;

  items.forEach((item, index) => {
    const nextUnits = item.keepWithNext ? items[index + 1]?.units ?? 0 : 0;
    const shouldStartNextPage =
      currentPage.length > 0 &&
      (currentUnits + item.units > A4_PAGE_UNIT_LIMIT ||
        currentUnits + item.units + nextUnits > A4_PAGE_UNIT_LIMIT);

    if (shouldStartNextPage) {
      pages.push(currentPage);
      currentPage = [];
      currentUnits = 0;
    }

    currentPage.push(item);
    currentUnits += item.units;
  });

  if (currentPage.length > 0) pages.push(currentPage);
  return pages.length > 0 ? pages : [[]];
}

function estimateProjectUnits(
  document: PortfolioDocumentPayload,
  project: PortfolioProjectDraft
): number {
  const meta = getPortfolioProjectMeta(project);
  const displaySections = getPortfolioProjectDisplaySections(project, {
    hidePlaceholders: true,
    enhanceMissingResult: true,
  });
  const summaryUnits = estimateTextRows(getPortfolioProjectSummary(project), 78);
  const sectionUnits = displaySections.reduce(
    (sum, section) =>
      sum +
      4 +
      estimateTextRows(section.text, 78) +
      section.highlights.reduce((highlightSum, highlight) => highlightSum + estimateTextRows(highlight, 78), 0),
    0
  );
  const imageUnits = document.imagePlacements.filter(
    (placement) => placement.activityId === project.activityId
  ).length;
  const skillUnits = Math.ceil(meta.skills.length / 6);

  return Math.max(16, 8 + summaryUnits + sectionUnits + skillUnits + imageUnits * 8);
}

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
        <figure
          key={placement.id}
          className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
        >
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
      <h4 className="text-[13px] font-bold text-slate-950">{title}</h4>
      {text && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{text}</p>}
      {children}
    </section>
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
  const meta = getPortfolioProjectMeta(project);
  const displaySections = getPortfolioProjectDisplaySections(project, {
    hidePlaceholders: true,
    enhanceMissingResult: true,
  });

  return (
    <article className="border-b border-slate-200 pb-8 last:border-b-0">
      <p className="text-[11px] font-bold text-[#094cb2]">PROJECT {index + 1}</p>
      <h3 className="mt-1 text-lg font-bold text-slate-950">{getPortfolioProjectTitle(project)}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        {getPortfolioProjectSummary(project)}
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {[meta.period, meta.role, meta.organization].filter(Boolean).map((item) => (
          <span key={item} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
            {item}
          </span>
        ))}
        {meta.skills.slice(0, 6).map((skill) => (
          <span
            key={skill}
            className="rounded-full bg-[#eef6ff] px-2 py-1 text-xs font-semibold text-[#094cb2]"
          >
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

function PortfolioDocumentHeader({
  document,
  profile,
}: {
  document: PortfolioDocumentPayload;
  profile: PortfolioExportProfile | null;
}) {
  return (
    <div className="border-b border-slate-200 pb-5">
      <p className="text-xs font-bold uppercase tracking-wide text-[#094cb2]">Portfolio</p>
      <h2 className="mt-2 text-2xl font-bold text-slate-950">{document.title}</h2>
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
  );
}

function A4PreviewPages({ items }: { items: A4PreviewItem[] }) {
  const pages = paginateA4Items(items);

  return (
    <div className="mx-auto flex w-full max-w-[210mm] flex-col gap-6">
      {pages.map((pageItems, pageIndex) => (
        <section
          key={`portfolio-a4-page-${pageIndex}`}
          className="relative mx-auto aspect-[210/297] w-[210mm] max-w-full overflow-hidden bg-white shadow-[0_22px_60px_rgba(15,23,42,0.16)] ring-1 ring-slate-200"
          aria-label={`포트폴리오 A4 미리보기 ${pageIndex + 1}페이지`}
        >
          <div className="h-full overflow-hidden px-[14mm] pb-[18mm] pt-[14mm]">
            <div className="space-y-6">
              {pageItems.map((item) => (
                <div key={item.key}>{item.node}</div>
              ))}
            </div>
          </div>
          <div className="absolute bottom-[7mm] right-[14mm] rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium text-slate-400">
            {pageIndex + 1} / {pages.length}
          </div>
        </section>
      ))}
    </div>
  );
}

function PortfolioA4Preview({
  document,
  profile,
  loading,
}: {
  document: PortfolioDocumentPayload | null;
  profile: PortfolioExportProfile | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <A4PreviewPages
        items={[{ key: "loading", units: 8, node: <p className="text-sm text-slate-500">불러오는 중...</p> }]}
      />
    );
  }

  if (!document) {
    return (
      <A4PreviewPages
        items={[{ key: "empty", units: 8, node: <p className="text-sm text-slate-500">저장된 포트폴리오가 없습니다.</p> }]}
      />
    );
  }

  const projects = getOrderedPortfolioProjects(document);
  const items: A4PreviewItem[] = [
    {
      key: "portfolio-header",
      units: profile?.self_intro ? 14 : 9,
      node: <PortfolioDocumentHeader document={document} profile={profile} />,
    },
  ];

  projects.forEach((project, index) => {
    items.push({
      key: `project-${project.activityId || index}`,
      units: estimateProjectUnits(document, project),
      node: (
        <PreviewProject
          document={document}
          project={project}
          index={index}
        />
      ),
    });
  });

  return <A4PreviewPages items={items} />;
}

export function PortfolioExportPreview({
  document,
  profile,
  loading,
  embedded = false,
}: {
  document: PortfolioDocumentPayload | null;
  profile: PortfolioExportProfile | null;
  loading: boolean;
  embedded?: boolean;
}) {
  const projects = document ? getOrderedPortfolioProjects(document) : [];

  if (embedded) {
    return <PortfolioA4Preview document={document} profile={profile} loading={loading} />;
  }

  return (
    <section className="min-h-[720px] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {loading ? (
        <p className="text-sm text-slate-500">불러오는 중...</p>
      ) : !document ? (
        <p className="text-sm text-slate-500">저장된 포트폴리오가 없습니다.</p>
      ) : (
        <div className="mx-auto max-w-3xl">
          <PortfolioDocumentHeader document={document} profile={profile} />
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
  );
}
