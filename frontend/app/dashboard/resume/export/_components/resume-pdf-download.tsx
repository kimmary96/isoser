"use client";

import {
  Document,
  Font,
  Image as PdfImage,
  Page,
  PDFDownloadLink,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import type { Activity, Resume, ResumeBuilderProfile } from "@/lib/types";
import { getActivityMetaItems, getActivityResumeLines } from "@/lib/activity-display";

Font.register({
  family: "NotoSansKR",
  fonts: [
    {
      src: "https://fonts.gstatic.com/ea/notosanskr/v2/NotoSansKR-Regular.otf",
      fontWeight: 400,
    },
    {
      src: "https://fonts.gstatic.com/ea/notosanskr/v2/NotoSansKR-Bold.otf",
      fontWeight: 700,
    },
  ],
});

const styles = StyleSheet.create({
  page: {
    paddingTop: 24,
    paddingBottom: 24,
    paddingHorizontal: 24,
    fontFamily: "NotoSansKR",
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
  sectionTitle: {
    fontSize: 12,
    marginBottom: 4,
    fontWeight: 700,
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

function ResumePdfDocument({
  resume,
  activities,
  profile,
}: {
  resume: Resume;
  activities: Activity[];
  profile: ResumeBuilderProfile | null;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.identityBlock}>
            {profile?.avatar_url ? (
              <PdfImage src={profile.avatar_url} style={styles.avatar} />
            ) : (
              <Text style={styles.avatarFallback}>👤</Text>
            )}
            <View style={styles.identityText}>
              <Text style={styles.title}>{profile?.name || resume.title}</Text>
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
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>활동</Text>
          {activities.map((activity) => (
            <View key={activity.id} style={{ marginBottom: 8 }}>
              <Text style={styles.itemTitle}>{activity.title}</Text>
              <Text style={styles.itemMeta}>
                {activity.type} | {activity.period ?? "기간 미입력"} | {activity.role ?? "역할 미입력"}
              </Text>
              {getActivityMetaItems(activity).length > 0 && (
                <Text style={styles.itemMeta}>{getActivityMetaItems(activity).join(" · ")}</Text>
              )}
              {getActivityResumeLines(activity)
                .slice(getActivityMetaItems(activity).length > 0 ? 1 : 0)
                .map((line, index) => (
                  <Text key={`${activity.id}-pdf-line-${index}`} style={styles.itemBody}>
                    - {line}
                  </Text>
                ))}
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
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
  return (
    <PDFDownloadLink
      document={<ResumePdfDocument resume={resume} activities={activities} profile={profile} />}
      fileName={`${resume.title}.pdf`}
      className="block w-full rounded-lg bg-black px-4 py-3 text-center font-medium text-white transition-colors hover:bg-gray-800"
    >
      {({ loading }) => (loading ? "생성 중..." : "PDF 다운로드")}
    </PDFDownloadLink>
  );
}
