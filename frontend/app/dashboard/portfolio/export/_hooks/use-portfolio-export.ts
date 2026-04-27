"use client";

import { useEffect, useState } from "react";

import { getPortfolioExportData } from "@/lib/api/app";
import type { Activity, PortfolioDocumentPayload, SavedPortfolio } from "@/lib/types";

type PortfolioExportProfile = {
  name: string | null;
  avatar_url?: string | null;
  email: string | null;
  phone: string | null;
  self_intro: string | null;
  skills: string[] | null;
};

export function usePortfolioExport(portfolioId: string | null) {
  const [portfolio, setPortfolio] = useState<SavedPortfolio | null>(null);
  const [document, setDocument] = useState<PortfolioDocumentPayload | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [profile, setProfile] = useState<PortfolioExportProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPortfolioData = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await getPortfolioExportData(portfolioId);
        setPortfolio(result.portfolio);
        setDocument(result.document);
        setActivities(result.activities);
        setProfile(result.profile);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : "포트폴리오 PDF 데이터 로딩에 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };

    void fetchPortfolioData();
  }, [portfolioId]);

  return {
    portfolio,
    document,
    activities,
    profile,
    loading,
    error,
  };
}

