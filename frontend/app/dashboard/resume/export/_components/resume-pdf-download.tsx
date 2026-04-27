"use client";

import { useState } from "react";
import {
  Document,
  Font,
  Image as PdfImage,
  Page,
  pdf,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import type { Activity, Resume, ResumeBuilderProfile } from "@/lib/types";
import { getActivityMetaItems } from "@/lib/activity-display";
import { normalizeResumeActivityLineOverrides } from "@/lib/resume-line-overrides";
import { getResumeActivityBodyLines } from "@/lib/resume-display";
import { getResumeProfileHighlightSections } from "@/lib/resume-profile";

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

const styles = StyleSheet.create({
  page: {
    paddingTop: 24,
    paddingBottom: 24,
    paddingHorizontal: 24,
    fontFamily: "ResumePretendard",
    fontSize: 11,
    lineHeight: 1.4,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
  },
  subtitle: {
    fontSize: 10,
    color: "#666666",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  identityBlock: {
    flexDirection: "row",
    flex: 1,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 12,
    marginRight: 12,
    objectFit: "cover",
  },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 12,
    marginRight: 12,
    backgroundColor: "#F3F4F6",
    color: "#9CA3AF",
    fontSize: 20,
    textAlign: "center",
    paddingTop: 14,
  },
  identityText: {
    flex: 1,
  },
  contactLine: {
    marginTop: 6,
    fontSize: 9,
    color: "#777777",
  },
  documentLabel: {
    fontSize: 9,
    color: "#999999",
  },
  section: {
    marginBottom: 10,
  },
  compactSection: {
    marginBottom: 9,
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
  },
  sectionTitle: {
    fontSize: 12,
    marginBottom: 4,
    fontWeight: 700,
  },
  profileBody: {
    fontSize: 9,
    color: "#374151",
  },
  highlightGrid: {
    flexDirection: "row",
    gap: 8,
  },
  highlightColumn: {
    width: "31%",
  },
  highlightTitle: {
    fontSize: 9,
    fontWeight: 700,
    marginBottom: 2,
    color: "#374151",
  },
  highlightItem: {
    fontSize: 8,
    color: "#4B5563",
    marginBottom: 1,
  },
  itemTitle: {
    fontSize: 11,
    fontWeight: 700,
  },
  itemMeta: {
    fontSize: 10,
    color: "#555555",
  },
  itemBody: {
    marginTop: 2,
    fontSize: 10,
  },
});

function isCareerActivity(activity: Activity): boolean {
  return activity.type === "회사경력";
}

function ResumePdfProfileIntro({ profile }: { profile: ResumeBuilderProfile | null }) {
  if (!profile?.self_intro) return null;

  return (
    <View style={styles.compactSection} wrap={false}>
      <Text style={styles.sectionTitle}>PROFESSIONAL PROFILE</Text>
      <Text style={styles.profileBody}>{profile.self_intro}</Text>
    </View>
  );
}

function ResumePdfProfileHighlights({ profile }: { profile: ResumeBuilderProfile | null }) {
  const sections = getResumeProfileHighlightSections(profile);
  if (sections.length === 0) return null;

  return (
    <View style={styles.compactSection} wrap={false}>
      <Text style={styles.sectionTitle}>AWARDS · CERTIFICATIONS · LANGUAGE</Text>
      <View style={styles.highlightGrid}>
        {sections.map((section) => (
          <View key={section.key} style={styles.highlightColumn}>
            <Text style={styles.highlightTitle}>{section.title}</Text>
            {section.items.map((item, index) => (
              <Text key={`${section.key}-${item}-${index}`} style={styles.highlightItem}>
                {item}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

function ResumePdfActivitiesSection({
  title,
  activities,
  activityLineOverrides,
}: {
  title: string;
  activities: Activity[];
  activityLineOverrides: ReturnType<typeof normalizeResumeActivityLineOverrides>;
}) {
  if (activities.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {activities.map((activity) => {
        const metaItems = getActivityMetaItems(activity);
        const bodyLines = getResumeActivityBodyLines(activity, activityLineOverrides);

        return (
          <View key={activity.id} style={{ marginBottom: 8 }}>
            <Text style={styles.itemTitle}>{activity.title}</Text>
            <Text style={styles.itemMeta}>
              {activity.type} | {activity.period ?? "기간 미입력"} |{" "}
              {activity.role ?? "역할 미입력"}
            </Text>
            {metaItems.length > 0 && (
              <Text style={styles.itemMeta}>{metaItems.join(" · ")}</Text>
            )}
            {bodyLines.map((line, index) => (
              <Text key={`${activity.id}-pdf-line-${index}`} style={styles.itemBody}>
                - {line}
              </Text>
            ))}
          </View>
        );
      })}
    </View>
  );
}

function ResumePdfDocument({
  resume,
  activities,
  profile,
}: {
  resume: Resume;
  activities: Activity[];
  profile: ResumeBuilderProfile | null;
}) {
  const activityLineOverrides = normalizeResumeActivityLineOverrides(
    resume.activity_line_overrides
  );
  const careerActivities = activities.filter(isCareerActivity);
  const projectActivities = activities.filter((activity) => !isCareerActivity(activity));

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.identityBlock}>
            {profile?.avatar_url ? (
              <PdfImage src={profile.avatar_url} style={styles.avatar} />
            ) : (
              <Text style={styles.avatarFallback}>사진</Text>
            )}
            <View style={styles.identityText}>
              <Text style={styles.title}>{profile?.name || resume.title}</Text>
              {profile?.bio && <Text style={styles.subtitle}>{profile.bio}</Text>}
              <Text style={styles.subtitle}>지원 직무: {resume.target_job ?? "미입력"}</Text>
              {(profile?.email || profile?.phone) && (
                <Text style={styles.contactLine}>
                  {[profile?.email, profile?.phone].filter(Boolean).join(" · ")}
                </Text>
              )}
            </View>
          </View>
          <Text style={styles.documentLabel}>{resume.title}</Text>
        </View>
        <ResumePdfProfileIntro profile={profile} />
        <ResumePdfActivitiesSection
          title="WORK EXPERIENCE"
          activities={careerActivities}
          activityLineOverrides={activityLineOverrides}
        />
        <ResumePdfProfileHighlights profile={profile} />
        <ResumePdfActivitiesSection
          title="KEY EXPERIENCE"
          activities={projectActivities}
          activityLineOverrides={activityLineOverrides}
        />
      </Page>
    </Document>
  );
}

function sanitizePdfFileName(value: string): string {
  const normalized = value.replace(/[\\/:*?"<>|]+/g, "_").trim();
  return normalized || "resume";
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

export function ResumePdfDownload({
  resume,
  activities,
  profile,
}: {
  resume: Resume;
  activities: Activity[];
  profile: ResumeBuilderProfile | null;
}) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDownload = async () => {
    if (downloading) return;

    setDownloading(true);
    setDownloadError(null);
    try {
      const blob = await pdf(
        <ResumePdfDocument resume={resume} activities={activities} profile={profile} />
      ).toBlob();
      downloadBlob(blob, `${sanitizePdfFileName(resume.title)}.pdf`);
    } catch (error) {
      setDownloadError(
        error instanceof Error ? error.message : "PDF 생성 중 오류가 발생했습니다."
      );
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
        className="block w-full rounded-lg bg-black px-4 py-3 text-center font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-wait disabled:opacity-60"
      >
        {downloading ? "생성 중..." : "PDF 다운로드"}
      </button>
      {downloadError && <p className="text-xs leading-relaxed text-red-600">{downloadError}</p>}
    </div>
  );
}
