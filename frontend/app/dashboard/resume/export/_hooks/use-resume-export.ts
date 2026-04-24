"use client";

import { useEffect, useState } from "react";

import { getResumeExportData } from "@/lib/api/app";
import type { Activity, Resume, ResumeBuilderProfile } from "@/lib/types";

export function useResumeExport(resumeId: string | null) {
  const [resume, setResume] = useState<Resume | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [profile, setProfile] = useState<ResumeBuilderProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchResumeData = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getResumeExportData(resumeId);
        const resumeRow = result.resume;

        if (!resumeRow) {
          setResume(null);
          setActivities([]);
          setProfile(null);
          return;
        }

        setResume(resumeRow);
        setActivities(result.activities);
        setProfile(result.profile);
      } catch (e) {
        setError(e instanceof Error ? e.message : "PDF 데이터 로딩에 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };

    void fetchResumeData();
  }, [resumeId]);

  return {
    resume,
    activities,
    profile,
    loading,
    error,
  };
}
