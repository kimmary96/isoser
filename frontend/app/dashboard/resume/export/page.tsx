// PDF 출력 페이지 - react-pdf로 이력서 PDF 미리보기용 문서 생성
"use client";

import { useEffect, useMemo, useState } from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Document,
  Page,
  PDFDownloadLink,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import { getGuestActivities, getGuestResume, isGuestMode } from "@/lib/guest";
import { createBrowserClient } from "@/lib/supabase/client";
import type { Activity, Resume } from "@/lib/types";

const styles = StyleSheet.create({
  page: {
    paddingTop: 24,
    paddingBottom: 24,
    paddingHorizontal: 24,
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

function ResumeExportContent() {
  const supabase = useMemo(() => createBrowserClient(), []);
  const searchParams = useSearchParams();
  const resumeId = searchParams.get("resumeId");
  const [resume, setResume] = useState<Resume | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchResumeData = async () => {
      setLoading(true);
      setError(null);
      try {
        if (isGuestMode()) {
          const guestResume = getGuestResume();
          setResume(guestResume);
          setActivities(getGuestActivities());
          return;
        }

        let resumeRow: Resume | null = null;
        if (resumeId) {
          const { data, error: resumeError } = await supabase
            .from("resumes")
            .select("*")
            .eq("id", resumeId)
            .single();
          if (resumeError) {
            throw new Error(resumeError.message);
          }
          resumeRow = data;
        } else {
          const { data, error: resumeError } = await supabase
            .from("resumes")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (resumeError) {
            throw new Error(resumeError.message);
          }
          resumeRow = data;
        }

        if (!resumeRow) {
          setResume(null);
          setActivities([]);
          return;
        }

        setResume(resumeRow);
        const ids = resumeRow.selected_activity_ids ?? [];
        if (ids.length === 0) {
          setActivities([]);
          return;
        }

        const { data: activityRows, error: activityError } = await supabase
          .from("activities")
          .select("*")
          .in("id", ids);
        if (activityError) {
          throw new Error(activityError.message);
        }
        setActivities(activityRows || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "PDF 데이터 로딩에 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchResumeData();
  }, [resumeId, supabase]);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">PDF 출력</h1>
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 미리보기 영역 */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 min-h-[600px]">
            {loading ? (
              <p className="text-gray-400 text-sm">불러오는 중...</p>
            ) : !resume ? (
              <p className="text-gray-400 text-sm">저장된 이력서가 없습니다.</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-lg font-semibold text-gray-900">{resume.title}</p>
                  <p className="text-sm text-gray-500">지원 직무: {resume.target_job ?? "미입력"}</p>
                </div>
                <div className="space-y-3">
                  {activities.map((activity) => (
                    <div key={activity.id} className="border border-gray-200 rounded-lg p-3">
                      <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {activity.type} | {activity.period ?? "기간 미입력"}
                      </p>
                      <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">
                        {activity.description || "설명 없음"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 설정 */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-4">출력 설정</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    템플릿
                  </label>
                  <p className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700">
                    simple
                  </p>
                </div>
              </div>
            </div>

            {!loading && resume && (
              <PDFDownloadLink
                document={<ResumePdfDocument resume={resume} activities={activities} />}
                fileName={`${resume.title}.pdf`}
                className="block w-full px-4 py-3 bg-black text-white rounded-lg font-medium text-center hover:bg-gray-800 transition-colors"
              >
                {({ loading: pdfLoading }) => (pdfLoading ? "생성 중..." : "PDF 다운로드")}
              </PDFDownloadLink>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

export default function ResumeExportPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gray-50 flex items-center justify-center">
          <p className="text-gray-500">불러오는 중...</p>
        </main>
      }
    >
      <ResumeExportContent />
    </Suspense>
  );
}
