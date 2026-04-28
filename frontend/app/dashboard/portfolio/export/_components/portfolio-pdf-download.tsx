"use client";

import { useState } from "react";
import {
  Document,
  Font,
  Page,
  pdf,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import {
  getOrderedPortfolioProjects,
  getPortfolioProjectDisplaySections,
  getPortfolioProjectSummary,
  getPortfolioProjectTitle,
  getPortfolioProjectReviewTags,
  isPortfolioPlaceholderText,
} from "@/lib/portfolio-document";
import type { PortfolioDocumentPayload, PortfolioImagePlacement, PortfolioProjectDraft } from "@/lib/types";

type PortfolioPdfProfile = {
  name: string | null;
  email: string | null;
  phone: string | null;
  self_intro: string | null;
};

Font.register({
  family: "ResumePretendard",
  fonts: [
    {
      src: "/fonts/Pretendard-Regular.woff",
      fontWeight: 400,
    },
    {
      src: "/fonts/Pretendard-Bold.woff",
      fontWeight: 700,
    },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 30,
    fontFamily: "ResumePretendard",
    fontSize: 10,
    lineHeight: 1.55,
    color: "#0f172a",
  },
  documentTitle: {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 10,
    color: "#475569",
  },
  intro: {
    marginTop: 10,
    padding: 10,
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    color: "#475569",
  },
  project: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  eyebrow: {
    fontSize: 8,
    color: "#2563eb",
    fontWeight: 700,
    marginBottom: 4,
  },
  projectTitle: {
    fontSize: 15,
    fontWeight: 700,
    marginBottom: 4,
  },
  summary: {
    color: "#334155",
    marginBottom: 8,
  },
  meta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 8,
  },
  metaItem: {
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 6,
    backgroundColor: "#f1f5f9",
    color: "#475569",
    fontSize: 8,
  },
  section: {
    marginTop: 9,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 3,
  },
  body: {
    color: "#334155",
  },
  bullet: {
    marginTop: 2,
    color: "#334155",
  },
  metricRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 5,
  },
  metric: {
    width: "31%",
    padding: 7,
    borderRadius: 8,
    backgroundColor: "#fff7ed",
  },
  metricValue: {
    fontSize: 13,
    fontWeight: 700,
    color: "#b45309",
  },
  metricLabel: {
    marginTop: 2,
    fontSize: 8,
    color: "#475569",
  },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  imageBox: {
    width: "48%",
  },
  image: {
    width: "100%",
    height: 130,
    objectFit: "cover",
    borderRadius: 8,
  },
  imagePlaceholder: {
    marginTop: 8,
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    color: "#64748b",
    fontSize: 8,
  },
  caption: {
    marginTop: 3,
    fontSize: 8,
    color: "#64748b",
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 8,
  },
  tag: {
    paddingVertical: 2,
    paddingHorizontal: 5,
    borderRadius: 999,
    backgroundColor: "#fffbeb",
    color: "#92400e",
    fontSize: 8,
  },
});

function imagesForSection(
  document: PortfolioDocumentPayload,
  project: PortfolioProjectDraft,
  sectionKey: PortfolioImagePlacement["sectionKey"]
): PortfolioImagePlacement[] {
  return document.imagePlacements
    .filter((placement) => placement.activityId === project.activityId && placement.sectionKey === sectionKey)
    .sort((a, b) => a.order - b.order);
}

function PortfolioPdfImages({ placements }: { placements: PortfolioImagePlacement[] }) {
  if (placements.length === 0) return null;

  return (
    <View style={styles.imageGrid}>
      {placements.map((placement) => (
        <View key={placement.id} style={styles.imageBox}>
          <Text style={styles.imagePlaceholder}>
            이미지: {placement.captionDraft || "캡션 확인 필요"}
          </Text>
        </View>
      ))}
    </View>
  );
}

function trimPdfText(value: string | null | undefined, limit = 900): string | null {
  const normalized = value?.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  if (isPortfolioPlaceholderText(normalized)) return null;
  return normalized.length > limit ? `${normalized.slice(0, limit)}...` : normalized;
}

function getPdfMetrics(project: PortfolioProjectDraft) {
  return project.portfolio.quantified_result.metrics
    .map((metric) => {
      const value = trimPdfText(metric.value, 40);
      if (!value || isPortfolioPlaceholderText(value)) return null;
      const label = trimPdfText(metric.label, 80);
      return {
        value,
        label: label && !isPortfolioPlaceholderText(label) ? label : null,
      };
    })
    .filter((metric): metric is { value: string; label: string | null } => Boolean(metric));
}

function PortfolioPdfProject({
  document,
  project,
  index,
}: {
  document: PortfolioDocumentPayload;
  project: PortfolioProjectDraft;
  index: number;
}) {
  const overview = project.portfolio.project_overview;
  const displaySections = getPortfolioProjectDisplaySections(project, { hidePlaceholders: true });
  const reviewTags = getPortfolioProjectReviewTags(project);
  const summary = trimPdfText(getPortfolioProjectSummary(project), 600);

  return (
    <View style={styles.project}>
      <Text style={styles.eyebrow}>PROJECT {index + 1}</Text>
      <Text style={styles.projectTitle}>{getPortfolioProjectTitle(project)}</Text>
      {summary && <Text style={styles.summary}>{summary}</Text>}
      <View style={styles.meta}>
        <Text style={styles.metaItem}>기간: {overview.period || "기간 미입력"}</Text>
        <Text style={styles.metaItem}>역할: {overview.role || project.portfolio.role_clarification.content || "역할 미입력"}</Text>
        {overview.organization && <Text style={styles.metaItem}>조직: {overview.organization}</Text>}
        {overview.skills.slice(0, 6).map((skill) => (
          <Text key={skill} style={styles.metaItem}>
            {skill}
          </Text>
        ))}
      </View>
      <PortfolioPdfImages placements={imagesForSection(document, project, "overview")} />
      {displaySections.map((section) => {
        const placements = imagesForSection(document, project, section.key);
        const metrics = section.key === "result" ? getPdfMetrics(project) : [];
        const hasContent =
          Boolean(section.text) ||
          section.highlights.length > 0 ||
          metrics.length > 0 ||
          placements.length > 0;
        if (!hasContent) return null;

        return (
          <View key={section.key} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.text && <Text style={styles.body}>{trimPdfText(section.text)}</Text>}
            {section.highlights.map((highlight) => (
              <Text key={highlight} style={styles.bullet}>
                - {trimPdfText(highlight, 260)}
              </Text>
            ))}
            {metrics.length > 0 && (
              <View style={styles.metricRow}>
                {metrics.map((metric) => (
                  <View key={`${metric.value}-${metric.label}`} style={styles.metric}>
                    <Text style={styles.metricValue}>{metric.value}</Text>
                    {metric.label && <Text style={styles.metricLabel}>{metric.label}</Text>}
                  </View>
                ))}
              </View>
            )}
            <PortfolioPdfImages placements={placements} />
          </View>
        );
      })}
      {reviewTags.length > 0 && (
        <View style={styles.tagRow}>
          {reviewTags.map((tag) => (
            <Text key={tag} style={styles.tag}>
              {tag}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

function PortfolioPdfDocument({
  document,
  profile,
}: {
  document: PortfolioDocumentPayload;
  profile: PortfolioPdfProfile | null;
}) {
  const projects = getOrderedPortfolioProjects(document);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>{document.title}</Text>
        <Text style={styles.subtitle}>
          {[profile?.name, document.targetJob ? `지원 직무: ${document.targetJob}` : null, profile?.email, profile?.phone]
            .filter(Boolean)
            .join(" · ")}
        </Text>
        {profile?.self_intro && <Text style={styles.intro}>{trimPdfText(profile.self_intro, 700)}</Text>}
        {projects.slice(0, 1).map((project, index) => (
          <PortfolioPdfProject
            key={project.activityId || `${project.portfolio.project_overview.title}-${index}`}
            document={document}
            project={project}
            index={index}
          />
        ))}
      </Page>
      {projects.slice(1).map((project, index) => (
        <Page
          key={project.activityId || `${project.portfolio.project_overview.title}-${index + 1}`}
          size="A4"
          style={styles.page}
        >
          <PortfolioPdfProject document={document} project={project} index={index + 1} />
        </Page>
      ))}
    </Document>
  );
}

function sanitizePdfFileName(value: string): string {
  const normalized = value.replace(/[\\/:*?"<>|]+/g, "_").trim();
  return normalized || "portfolio";
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function downloadPortfolioPdf({
  document,
  profile,
}: {
  document: PortfolioDocumentPayload;
  profile: PortfolioPdfProfile | null;
}) {
  const blob = await pdf(<PortfolioPdfDocument document={document} profile={profile} />).toBlob();
  downloadBlob(blob, `${sanitizePdfFileName(document.title)}.pdf`);
}

export function PortfolioPdfDownload({
  document,
  profile,
}: {
  document: PortfolioDocumentPayload;
  profile: PortfolioPdfProfile | null;
}) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDownload = async () => {
    if (downloading) return;

    setDownloading(true);
    setDownloadError(null);
    try {
      await downloadPortfolioPdf({ document, profile });
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "포트폴리오 PDF 생성 중 오류가 발생했습니다.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void handleDownload()}
        disabled={downloading}
        className="block w-full rounded-xl bg-[#071a36] px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
      >
        {downloading ? "PDF 생성 중..." : "PDF 다운로드"}
      </button>
      {downloadError && <p className="text-xs leading-relaxed text-red-600">{downloadError}</p>}
    </div>
  );
}
