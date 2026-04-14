"use client";

import { useEffect, useState } from "react";

import { getResumeExportData } from "@/lib/api/app";
import { getGuestActivities, getGuestResume, isGuestMode } from "@/lib/guest";
import type { Activity, Resume } from "@/lib/types";

export function useResumeExport(resumeId: string | null) {
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
          setResume(getGuestResume());
          setActivities(getGuestActivities());
          return;
        }

        const result = await getResumeExportData(resumeId);
        const resumeRow = result.resume;

        if (!resumeRow) {
          setResume(null);
          setActivities([]);
          return;
        }

        setResume(resumeRow);
        setActivities(result.activities);
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
    loading,
    error,
  };
}
