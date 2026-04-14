"use client";

import {
  Document,
  Font,
  Page,
  PDFDownloadLink,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import type { Activity, Resume } from "@/lib/types";

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
    marginBottom: 8,
    fontWeight: 700,
  },
  subtitle: {
    fontSize: 10,
    marginBottom: 12,
    color: "#666666",
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
}: {
  resume: Resume;
  activities: Activity[];
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.title}>{resume.title}</Text>
          <Text style={styles.subtitle}>지원 직무: {resume.target_job ?? "미입력"}</Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>활동</Text>
          {activities.map((activity) => (
            <View key={activity.id} style={{ marginBottom: 8 }}>
              <Text style={styles.itemTitle}>{activity.title}</Text>
              <Text style={styles.itemMeta}>
                {activity.type} | {activity.period ?? "기간 미입력"} | {activity.role ?? "역할 미입력"}
              </Text>
              <Text style={styles.itemBody}>{activity.description ?? ""}</Text>
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
}: {
  resume: Resume;
  activities: Activity[];
}) {
  return (
    <PDFDownloadLink
      document={<ResumePdfDocument resume={resume} activities={activities} />}
      fileName={`${resume.title}.pdf`}
      className="block w-full rounded-lg bg-black px-4 py-3 text-center font-medium text-white transition-colors hover:bg-gray-800"
    >
      {({ loading }) => (loading ? "생성 중..." : "PDF 다운로드")}
    </PDFDownloadLink>
  );
}
