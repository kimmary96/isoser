"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  listActivities,
  listSavedPortfolios,
  requestPortfolioFitAnalysis,
  savePortfolioDocument,
} from "@/lib/api/app";
import { convertActivity } from "@/lib/api/backend";
import {
  attachActivityImagesToPortfolio,
  createPortfolioDocumentPayload,
  createPortfolioProjectDraft,
  getOrderedPortfolioProjects,
  getPortfolioProjectDisplaySections,
  getPortfolioProjectSummary,
  getPortfolioProjectTitle,
  normalizePortfolioDocumentPayload,
  reorderPortfolioProjects,
  updatePortfolioImagePlacement,
} from "@/lib/portfolio-document";
import type {
  Activity,
  ActivityConvertRequest,
  PortfolioDocumentPayload,
  PortfolioFitAnalysis,
  PortfolioImagePlacement,
  PortfolioProjectDraft,
  PortfolioSectionOverrides,
  SavedPortfolio,
} from "@/lib/types";

const PENDING_PORTFOLIO_CONVERSION_KEY = "isoser:pending-portfolio-conversion";

const SECTION_LABELS: Record<PortfolioImagePlacement["sectionKey"], string> = {
  overview: "프로젝트 개요",
  problemDefinition: "문제 정의",
  techDecision: "기술 선택 근거",
  implementation: "구현",
  result: "성과",
  troubleshooting: "트러블슈팅/회고",
};

const ACTIVITY_FILTER_TABS = ["전체", "회사경력", "프로젝트", "대외활동", "학생활동"] as const;

function buildPortfolioConvertPayload(activity: Activity): ActivityConvertRequest["activity"] {
  return {
    id: activity.id,
    type: activity.type,
    title: activity.title,
    organization: activity.organization ?? null,
    team_size: activity.team_size ?? null,
    team_composition: activity.team_composition ?? null,
    my_role: activity.my_role ?? activity.role ?? null,
    contributions: activity.contributions ?? [],
    period: activity.period,
    role: activity.role,
    skills: activity.skills ?? [],
    description: activity.description,
    star_situation: activity.star_situation ?? null,
    star_task: activity.star_task ?? null,
    star_action: activity.star_action ?? null,
    star_result: activity.star_result ?? null,
  };
}

function summarizeJobPosting(text: string): string | null {
  const compacted = text.trim().replace(/\s+/g, " ");
  if (!compacted) return null;
  return compacted.length > 220 ? `${compacted.slice(0, 220)}...` : compacted;
}

function hydrateDocumentWithActivities(
  document: PortfolioDocumentPayload | null,
  activities: Activity[]
): PortfolioDocumentPayload | null {
  if (!document) return null;
  const activityMap = new Map(activities.map((activity) => [activity.id, activity]));
  return {
    ...document,
    projects: document.projects.map((project) => {
      const activity = activityMap.get(project.activityId);
      return {
        ...project,
        sourceActivity:
          project.sourceActivity ??
          (activity
            ? {
                id: activity.id,
                title: activity.title,
                type: activity.type,
                period: activity.period,
                role: activity.my_role ?? activity.role,
                skills: activity.skills ?? [],
              }
            : null),
        portfolio: attachActivityImagesToPortfolio(project.portfolio, activity),
      };
    }),
  };
}

function resolveActivityPreview(activity: Activity): string {
  return (
    activity.description ||
    activity.contributions?.join(" ") ||
    activity.star_result ||
    activity.star_action ||
    "성과저장소 STAR와 기여내용을 보강하면 포트폴리오 품질이 좋아집니다."
  );
}
function findFitItem(fitAnalysis: PortfolioFitAnalysis | null, activityId: string) {
  return fitAnalysis?.activities.find((item) => item.activityId === activityId);
}

export default function PortfolioPage() {
  const router = useRouter();
  const [portfolioPreview, setPortfolioPreview] = useState<PortfolioDocumentPayload | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [savedPortfolios, setSavedPortfolios] = useState<SavedPortfolio[]>([]);
  const [selectedActivityIds, setSelectedActivityIds] = useState<string[]>([]);
  const [activityFilter, setActivityFilter] = useState<(typeof ACTIVITY_FILTER_TABS)[number]>("전체");
  const [targetJob, setTargetJob] = useState("");
  const [jobPostingText, setJobPostingText] = useState("");
  const [fitAnalysis, setFitAnalysis] = useState<PortfolioFitAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [fitLoading, setFitLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const activityMap = useMemo(
    () => new Map(activities.map((activity) => [activity.id, activity])),
    [activities]
  );

  const selectedActivities = useMemo(
    () =>
      selectedActivityIds
        .map((activityId) => activityMap.get(activityId))
        .filter((activity): activity is Activity => Boolean(activity)),
    [activityMap, selectedActivityIds]
  );

  const filteredActivities = useMemo(
    () =>
      activityFilter === "전체"
        ? activities
        : activities.filter((activity) => activity.type === activityFilter),
    [activities, activityFilter]
  );

  const orderedProjects = portfolioPreview ? getOrderedPortfolioProjects(portfolioPreview) : [];

  useEffect(() => {
    if (typeof window === "undefined") return;

    const raw = window.sessionStorage.getItem(PENDING_PORTFOLIO_CONVERSION_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as { portfolio?: unknown };
      const document = normalizePortfolioDocumentPayload(parsed.portfolio);
      setPortfolioPreview(document);
      setSelectedActivityIds(document?.selectedActivityIds ?? []);
    } catch {
      window.sessionStorage.removeItem(PENDING_PORTFOLIO_CONVERSION_KEY);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [activityResult, portfolioResult] = await Promise.all([
          listActivities(),
          listSavedPortfolios().catch(() => ({ portfolios: [] })),
        ]);
        if (!mounted) return;

        const nextActivities = activityResult.activities;
        setActivities(nextActivities);
        setSavedPortfolios(portfolioResult.portfolios);
        setPortfolioPreview((current) => hydrateDocumentWithActivities(current, nextActivities));
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError instanceof Error ? loadError.message : "포트폴리오 데이터를 불러오지 못했습니다.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadData();

    return () => {
      mounted = false;
    };
  }, []);

  const toggleActivity = (activityId: string) => {
    setSelectedActivityIds((current) =>
      current.includes(activityId)
        ? current.filter((id) => id !== activityId)
        : [...current, activityId]
    );
  };

  const handleAnalyzeFit = async () => {
    if (fitLoading) return;

    setFitLoading(true);
    setError(null);
    setStatusMessage(null);
    try {
      const result = await requestPortfolioFitAnalysis({
        targetJob: targetJob || null,
        jobPostingText: jobPostingText || null,
        recommendLimit: 3,
      });
      setFitAnalysis(result.analysis);
      if (selectedActivityIds.length === 0 && result.recommendedActivityIds.length > 0) {
        setSelectedActivityIds(result.recommendedActivityIds);
      }
      setStatusMessage("공고 기준 추천 프로젝트를 계산했습니다.");
    } catch (fitError) {
      setError(fitError instanceof Error ? fitError.message : "공고 적합도 분석에 실패했습니다.");
    } finally {
      setFitLoading(false);
    }
  };

  const applyRecommendations = () => {
    if (!fitAnalysis?.recommendedActivityIds.length) return;
    setSelectedActivityIds(fitAnalysis.recommendedActivityIds);
    setStatusMessage("추천 프로젝트 3개를 선택했습니다. 필요하면 직접 추가하거나 제외할 수 있습니다.");
  };

  const generatePortfolioDocument = async (sourceActivities: Activity[]) => {
    const projects: PortfolioProjectDraft[] = [];
    const buildDocument = () =>
      createPortfolioDocumentPayload({
        title: `포트폴리오 ${new Date().toISOString().slice(0, 10)}`,
        targetJob: targetJob || null,
        jobPostingSummary: summarizeJobPosting(jobPostingText),
        projects,
        projectOrder: sourceActivities
          .map((activity) => activity.id)
          .filter((activityId) => projects.some((project) => project.activityId === activityId)),
        fitAnalysis,
      });

    const syncGeneratedDocument = () => {
      const document = buildDocument();
      setPortfolioPreview(document);
      setSelectedActivityIds(document.selectedActivityIds);
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          PENDING_PORTFOLIO_CONVERSION_KEY,
          JSON.stringify({ portfolio: document })
        );
      }
      return document;
    };

    for (const activity of sourceActivities) {
      const result = await convertActivity({
        target: "portfolio",
        activity: buildPortfolioConvertPayload(activity),
      });
      if (!result.portfolio) {
        throw new Error(`${activity.title} 포트폴리오 변환 결과를 받지 못했습니다.`);
      }
      const fitItem = findFitItem(fitAnalysis, activity.id);
      projects.push(
        createPortfolioProjectDraft({
          portfolio: result.portfolio,
          activity,
          fitScore: fitItem?.score,
          fitReasons: fitItem?.strongReasons ?? [],
          gapNotes: fitItem?.gapReasons ?? [],
        })
      );
      syncGeneratedDocument();
    }

    return syncGeneratedDocument();
  };

  const handleGenerateSelected = async () => {
    if (generating) return;
    if (selectedActivities.length === 0) {
      setError("포트폴리오에 포함할 성과를 먼저 선택해 주세요.");
      return;
    }

    setGenerating(true);
    setError(null);
    setStatusMessage(null);
    try {
      await generatePortfolioDocument(selectedActivities);
      setStatusMessage("선택한 성과로 포트폴리오 초안을 만들었습니다.");
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "포트폴리오 초안 생성에 실패했습니다.");
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateSingle = async (activity: Activity) => {
    if (generating) return;

    setGenerating(true);
    setError(null);
    setStatusMessage(null);
    try {
      const document = await generatePortfolioDocument([activity]);
      const saved = await savePortfolioDocument({
        title: document.title,
        sourceActivityId: activity.id,
        selectedActivityIds: document.selectedActivityIds,
        portfolio: document,
      });
      setSavedPortfolios((current) => [
        {
          id: saved.id,
          title: document.title,
          sourceActivityId: activity.id,
          selectedActivityIds: document.selectedActivityIds,
          portfolio: document,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ...current.filter((item) => item.id !== saved.id),
      ]);
      setStatusMessage("단일 활동 포트폴리오 초안을 저장했습니다.");
      router.push(`/dashboard/documents?portfolioId=${encodeURIComponent(saved.id)}`);
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "포트폴리오 초안 생성에 실패했습니다.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSavePortfolio = async () => {
    if (!portfolioPreview || saving) return;
    const sourceActivityId = portfolioPreview.selectedActivityIds[0];
    if (!sourceActivityId) {
      setError("저장할 포트폴리오의 대표 성과를 찾지 못했습니다.");
      return;
    }

    setSaving(true);
    setError(null);
    setStatusMessage(null);
    try {
      const saved = await savePortfolioDocument({
        title: portfolioPreview.title,
        sourceActivityId,
        selectedActivityIds: portfolioPreview.selectedActivityIds,
        portfolio: portfolioPreview,
      });
      setSavedPortfolios((current) => [
        {
          id: saved.id,
          title: portfolioPreview.title,
          sourceActivityId,
          selectedActivityIds: portfolioPreview.selectedActivityIds,
          portfolio: portfolioPreview,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ...current.filter((item) => item.id !== saved.id),
      ]);
      setStatusMessage("포트폴리오 문서를 저장했습니다.");
      router.push(`/dashboard/documents?portfolioId=${encodeURIComponent(saved.id)}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "포트폴리오 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const openSavedPortfolio = (saved: SavedPortfolio) => {
    const document = hydrateDocumentWithActivities(
      normalizePortfolioDocumentPayload(saved.portfolio, {
        fallbackTitle: saved.title,
      }),
      activities
    );
    setPortfolioPreview(document);
    setSelectedActivityIds(document?.selectedActivityIds ?? saved.selectedActivityIds ?? []);
    setStatusMessage("저장된 포트폴리오 초안을 열었습니다.");
  };

  const updatePreview = (next: PortfolioDocumentPayload) => {
    setPortfolioPreview(next);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(
        PENDING_PORTFOLIO_CONVERSION_KEY,
        JSON.stringify({ portfolio: next })
      );
    }
  };

  const updateDocumentTitle = (title: string) => {
    if (!portfolioPreview) return;
    updatePreview({
      ...portfolioPreview,
      title,
    });
  };

  const updateProjectOverrides = (
    activityId: string,
    patch: Partial<PortfolioSectionOverrides>
  ) => {
    if (!portfolioPreview) return;
    updatePreview({
      ...portfolioPreview,
      projects: portfolioPreview.projects.map((project) =>
        project.activityId === activityId
          ? {
              ...project,
              sectionOverrides: {
                ...project.sectionOverrides,
                ...patch,
              },
            }
          : project
      ),
    });
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f3f6fb]">
        <div className="rounded-2xl border border-slate-200 bg-white px-8 py-6 text-sm text-slate-500 shadow-sm">
          포트폴리오 데이터를 불러오는 중입니다...
        </div>
      </main>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f3f6fb] text-slate-950">
      <ActivitySelectionPanel
        activities={filteredActivities}
        totalCount={activities.length}
        selectedActivityIds={selectedActivityIds}
        activityFilter={activityFilter}
        fitAnalysis={fitAnalysis}
        generating={generating}
        onFilterChange={setActivityFilter}
        onToggleActivity={toggleActivity}
        onGenerateSingle={handleGenerateSingle}
        onGenerateSelected={handleGenerateSelected}
      />

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="border-b border-slate-200 bg-white/95 px-6 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-bold text-[#094cb2]">포트폴리오 빌더</p>
              <input
                value={portfolioPreview?.title ?? "성과저장소 기반 포트폴리오"}
                onChange={(event) => updateDocumentTitle(event.target.value)}
                disabled={!portfolioPreview}
                className="mt-1 w-full max-w-2xl rounded-xl border border-transparent bg-transparent px-0 py-1 text-2xl font-bold text-slate-950 outline-none transition focus:border-blue-100 focus:bg-blue-50/40 focus:px-3 disabled:text-slate-950"
              />
              <p className="mt-1 text-sm text-slate-500">
                선택 {selectedActivityIds.length}개 · 미리보기 {orderedProjects.length}개 프로젝트
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleSavePortfolio()}
                disabled={!portfolioPreview || saving}
                className="rounded-xl bg-[#071a36] px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "저장 중..." : "포트폴리오 저장"}
              </button>
            </div>
          </div>
          {(error || statusMessage) && (
            <div className="mt-3 grid gap-2">
              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              )}
              {statusMessage && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                  {statusMessage}
                </div>
              )}
            </div>
          )}
        </header>

        <section className="min-h-0 flex-1 overflow-y-auto px-4 py-6 lg:px-8">
          <PortfolioPreview
            document={portfolioPreview}
            projects={orderedProjects}
            onMoveProject={(activityId, direction) => {
              if (!portfolioPreview) return;
              updatePreview(reorderPortfolioProjects(portfolioPreview, activityId, direction));
            }}
            onUpdateProject={updateProjectOverrides}
          />
        </section>
      </main>

      <RightControlPanel
        activities={activities}
        activityMap={activityMap}
        selectedActivityIds={selectedActivityIds}
        savedPortfolios={savedPortfolios}
        document={portfolioPreview}
        fitAnalysis={fitAnalysis}
        fitLoading={fitLoading}
        targetJob={targetJob}
        jobPostingText={jobPostingText}
        onTargetJobChange={setTargetJob}
        onJobPostingTextChange={setJobPostingText}
        onAnalyzeFit={handleAnalyzeFit}
        onApplyRecommendations={applyRecommendations}
        onAddRecommendedActivity={(activityId) => {
          if (!selectedActivityIds.includes(activityId)) {
            setSelectedActivityIds((current) => [...current, activityId]);
          }
        }}
        onOpenSavedPortfolio={openSavedPortfolio}
        onImageUpdate={(placementId, patch) => {
          if (!portfolioPreview) return;
          updatePreview(updatePortfolioImagePlacement(portfolioPreview, placementId, patch));
        }}
      />
    </div>
  );
}

function ActivitySelectionPanel({
  activities,
  totalCount,
  selectedActivityIds,
  activityFilter,
  fitAnalysis,
  generating,
  onFilterChange,
  onToggleActivity,
  onGenerateSingle,
  onGenerateSelected,
}: {
  activities: Activity[];
  totalCount: number;
  selectedActivityIds: string[];
  activityFilter: (typeof ACTIVITY_FILTER_TABS)[number];
  fitAnalysis: PortfolioFitAnalysis | null;
  generating: boolean;
  onFilterChange: (filter: (typeof ACTIVITY_FILTER_TABS)[number]) => void;
  onToggleActivity: (activityId: string) => void;
  onGenerateSingle: (activity: Activity) => void | Promise<void>;
  onGenerateSelected: () => void | Promise<void>;
}) {
  return (
    <aside className="flex h-full w-80 flex-shrink-0 flex-col border-r border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.04)] 2xl:w-[21rem]">
      <div className="border-b border-slate-100 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-[#094cb2]">성과저장소</p>
            <h2 className="mt-1 text-lg font-bold text-slate-950">포트폴리오 소스</h2>
          </div>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500">
            {selectedActivityIds.length}/{totalCount}
          </span>
        </div>
        <button
          type="button"
          onClick={() => void onGenerateSelected()}
          disabled={generating || selectedActivityIds.length === 0}
          className="mt-4 w-full rounded-xl bg-[#094cb2] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#073b8c] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {generating ? "초안 생성 중..." : "선택 성과로 초안 생성"}
        </button>
      </div>

      <div className="border-b border-slate-100 px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          {ACTIVITY_FILTER_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => onFilterChange(tab)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                activityFilter === tab
                  ? "bg-[#071a36] text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-orange-200 hover:text-orange-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-4">
        {activities.length > 0 ? (
          activities.map((activity) => {
            const isSelected = selectedActivityIds.includes(activity.id);
            const analysis = findFitItem(fitAnalysis, activity.id);
            return (
              <article
                key={activity.id}
                onClick={() => onToggleActivity(activity.id)}
                className={`cursor-pointer rounded-2xl border p-3.5 transition-all ${
                  isSelected ? "border-blue-200 bg-[#eef6ff]" : "border-slate-200 bg-white hover:border-orange-200"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-[#fff1e6] px-2 py-0.5 text-[11px] font-semibold text-[#c94f12]">
                        {activity.type}
                      </span>
                      {analysis && (
                        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-[#094cb2]">
                          {analysis.score}점
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-[13px] font-bold leading-snug text-slate-950">
                      {activity.title}
                    </p>
                    {activity.period && <p className="mt-1 text-[11px] text-slate-400">{activity.period}</p>}
                    <p className="mt-1.5 line-clamp-2 text-[11px] leading-4 text-slate-500">
                      {resolveActivityPreview(activity)}
                    </p>
                    {(activity.skills ?? []).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(activity.skills ?? []).slice(0, 3).map((skill) => (
                          <span key={skill} className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void onGenerateSingle(activity);
                      }}
                      disabled={generating}
                      className="mt-2 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      단일 초안 저장
                    </button>
                  </div>
                  <div
                    className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-2 transition-all ${
                      isSelected ? "border-[#094cb2] bg-[#094cb2]" : "border-slate-300"
                    }`}
                  >
                    {isSelected && (
                      <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    )}
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm leading-6 text-slate-500">
            선택할 성과가 없습니다.
          </p>
        )}
      </div>
    </aside>
  );
}

function RightControlPanel({
  activities,
  activityMap,
  selectedActivityIds,
  savedPortfolios,
  document,
  fitAnalysis,
  fitLoading,
  targetJob,
  jobPostingText,
  onTargetJobChange,
  onJobPostingTextChange,
  onAnalyzeFit,
  onApplyRecommendations,
  onAddRecommendedActivity,
  onOpenSavedPortfolio,
  onImageUpdate,
}: {
  activities: Activity[];
  activityMap: Map<string, Activity>;
  selectedActivityIds: string[];
  savedPortfolios: SavedPortfolio[];
  document: PortfolioDocumentPayload | null;
  fitAnalysis: PortfolioFitAnalysis | null;
  fitLoading: boolean;
  targetJob: string;
  jobPostingText: string;
  onTargetJobChange: (value: string) => void;
  onJobPostingTextChange: (value: string) => void;
  onAnalyzeFit: () => void | Promise<void>;
  onApplyRecommendations: () => void;
  onAddRecommendedActivity: (activityId: string) => void;
  onOpenSavedPortfolio: (saved: SavedPortfolio) => void;
  onImageUpdate: (
    placementId: string,
    patch: Partial<Pick<PortfolioImagePlacement, "sectionKey" | "captionDraft">>
  ) => void;
}) {
  return (
    <aside className="flex h-full w-[22rem] flex-shrink-0 flex-col gap-4 overflow-y-auto border-l border-slate-200 bg-white p-4 shadow-[0_12px_32px_rgba(15,23,42,0.04)] 2xl:w-[23rem]">
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-bold text-slate-950">공고 핏 분석</h2>
        <label className="mt-4 block text-xs font-semibold text-slate-500">지원 직무</label>
        <input
          value={targetJob}
          onChange={(event) => onTargetJobChange(event.target.value)}
          placeholder="예: 백엔드 개발자"
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#094cb2]"
        />
        <label className="mt-3 block text-xs font-semibold text-slate-500">공고 내용</label>
        <textarea
          value={jobPostingText}
          onChange={(event) => onJobPostingTextChange(event.target.value)}
          placeholder="주요업무, 자격요건, 우대사항을 붙여넣으세요."
          className="mt-1 min-h-28 w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm leading-5 outline-none focus:border-[#094cb2]"
        />
        <button
          type="button"
          onClick={() => void onAnalyzeFit()}
          disabled={fitLoading || activities.length === 0}
          className="mt-3 w-full rounded-xl border border-[#094cb2] px-3 py-2 text-sm font-semibold text-[#094cb2] transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {fitLoading ? "분석 중..." : "관련도 높은 3개 추천"}
        </button>
      </section>

      {fitAnalysis && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-slate-950">추천 프로젝트</h2>
            <button
              type="button"
              onClick={onApplyRecommendations}
              className="rounded-lg bg-[#fff1e6] px-2 py-1 text-xs font-semibold text-[#b84b12] hover:bg-[#ffe4d1]"
            >
              추천 적용
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {fitAnalysis.recommendedActivityIds.map((activityId, index) => {
              const activity = activityMap.get(activityId);
              const analysis = findFitItem(fitAnalysis, activityId);
              if (!activity || !analysis) return null;
              const isSelected = selectedActivityIds.includes(activityId);
              return (
                <button
                  key={activityId}
                  type="button"
                  onClick={() => onAddRecommendedActivity(activityId)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    isSelected
                      ? "border-[#094cb2] bg-blue-50"
                      : "border-blue-100 bg-blue-50/70 hover:border-[#094cb2]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-bold text-[#094cb2]">추천 {index + 1}</p>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-slate-700">
                      {analysis.score}점
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-950">{activity.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">
                    {analysis.strongReasons[0]}
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <ImagePlacementPanel document={document} onUpdate={onImageUpdate} />

      {savedPortfolios.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-bold text-slate-950">저장된 포트폴리오</h2>
          <div className="mt-3 space-y-2">
            {savedPortfolios.slice(0, 5).map((saved) => (
              <div key={saved.id} className="rounded-xl border border-slate-100 p-3">
                <button
                  type="button"
                  onClick={() => onOpenSavedPortfolio(saved)}
                  disabled={!saved.portfolio}
                  className="block w-full text-left disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <p className="line-clamp-1 text-sm font-semibold text-slate-900">{saved.title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {new Date(saved.updatedAt).toLocaleDateString("ko-KR")} 저장
                  </p>
                </button>
                <Link
                  href={`/dashboard/portfolio/export?portfolioId=${saved.id}`}
                  className="mt-2 inline-block rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  PDF 내보내기
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}
    </aside>
  );
}

function PortfolioPreview({
  document,
  projects,
  onMoveProject,
  onUpdateProject,
}: {
  document: PortfolioDocumentPayload | null;
  projects: PortfolioProjectDraft[];
  onMoveProject: (activityId: string, direction: "up" | "down") => void;
  onUpdateProject: (activityId: string, patch: Partial<PortfolioSectionOverrides>) => void;
}) {
  if (!document) {
    return (
      <div className="mx-auto flex min-h-[720px] max-w-[840px] items-center justify-center rounded-[18px] border border-dashed border-slate-200 bg-white px-6 text-center shadow-sm">
        <div>
          <p className="text-lg font-bold text-slate-800">왼쪽에서 성과를 고르고 초안을 생성하세요.</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            초안은 생성되는 즉시 이 영역에 누적 표시되고, 각 섹션을 바로 수정할 수 있습니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[860px]">
      <div className="rounded-[18px] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="border-b border-slate-200 pb-6">
          <p className="text-xs font-bold uppercase tracking-wide text-[#094cb2]">Portfolio</p>
          <h2 className="mt-2 text-3xl font-bold text-slate-950">{document.title}</h2>
        {document.targetJob && (
          <p className="mt-2 text-sm font-semibold text-slate-600">지원 직무: {document.targetJob}</p>
        )}
        {document.jobPostingSummary && (
          <p className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
            {document.jobPostingSummary}
          </p>
        )}
        </div>

        <div className="mt-8 space-y-10">
          {projects.map((project, index) => (
            <PortfolioProjectSection
              key={project.activityId || `${project.portfolio.project_overview.title}-${index}`}
              document={document}
              project={project}
              index={index}
              onMoveProject={onMoveProject}
              onUpdateProject={onUpdateProject}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function PortfolioProjectSection({
  document,
  project,
  index,
  onMoveProject,
  onUpdateProject,
}: {
  document: PortfolioDocumentPayload;
  project: PortfolioProjectDraft;
  index: number;
  onMoveProject: (activityId: string, direction: "up" | "down") => void;
  onUpdateProject: (activityId: string, patch: Partial<PortfolioSectionOverrides>) => void;
}) {
  const overview = project.portfolio.project_overview;
  const displaySections = getPortfolioProjectDisplaySections(project);
  const imagesBySection = document.imagePlacements
    .filter((placement) => placement.activityId === project.activityId)
    .sort((a, b) => a.order - b.order)
    .reduce<Record<string, PortfolioImagePlacement[]>>((acc, placement) => {
      acc[placement.sectionKey] = [...(acc[placement.sectionKey] ?? []), placement];
      return acc;
    }, {});

  return (
    <article className="border-b border-slate-200 pb-10 last:border-b-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-slate-400">PROJECT {index + 1}</p>
          <input
            value={getPortfolioProjectTitle(project)}
            onChange={(event) => onUpdateProject(project.activityId, { projectTitle: event.target.value })}
            className="mt-1 w-full rounded-xl border border-transparent bg-transparent px-0 py-1 text-2xl font-bold text-slate-950 outline-none transition focus:border-blue-100 focus:bg-blue-50/60 focus:px-3"
          />
          <EditableTextarea
            value={getPortfolioProjectSummary(project)}
            onChange={(value) => onUpdateProject(project.activityId, { overviewSummary: value })}
            className="mt-2"
            rows={3}
          />
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => onMoveProject(project.activityId, "up")}
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50"
          >
            위
          </button>
          <button
            type="button"
            onClick={() => onMoveProject(project.activityId, "down")}
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50"
          >
            아래
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
        <InfoLine label="기간" value={overview.period || "기간 미입력"} />
        <InfoLine label="역할" value={overview.role || project.portfolio.role_clarification.content || "역할 미입력"} />
        <InfoLine label="조직" value={overview.organization || "조직 미입력"} />
        <InfoLine label="팀" value={overview.team_composition || (overview.team_size ? `${overview.team_size}명` : "팀 정보 미입력")} />
      </div>

      {overview.skills.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {overview.skills.map((skill) => (
            <span key={skill} className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-[#094cb2]">
              {skill}
            </span>
          ))}
        </div>
      )}

      {project.fitScore !== undefined && (
        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
          <p className="text-xs font-bold text-[#094cb2]">공고핏 {project.fitScore}점</p>
          {project.fitReasons?.[0] && <p className="mt-1 text-xs leading-5 text-slate-600">{project.fitReasons[0]}</p>}
          {project.gapNotes && project.gapNotes.length > 0 && (
            <p className="mt-1 text-xs leading-5 text-amber-700">보강: {project.gapNotes[0]}</p>
          )}
        </div>
      )}

      <RenderImages placements={imagesBySection.overview ?? []} />
      {displaySections.map((section) => {
        const placements = imagesBySection[section.key] ?? [];
        const metrics =
          section.key === "result" ? project.portfolio.quantified_result.metrics : [];

        return (
          <PortfolioTextBlock
            key={section.key}
            sectionKey={section.key}
            title={section.title}
            text={section.text}
            onChange={(value) =>
              onUpdateProject(project.activityId, buildSectionOverridePatch(section.key, value))
            }
          >
            {section.highlights.length > 0 && (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-600">
                {section.highlights.map((highlight) => (
                  <li key={highlight}>{highlight}</li>
                ))}
              </ul>
            )}
            {metrics.length > 0 && (
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {metrics.map((metric) => (
                  <div
                    key={`${metric.value}-${metric.label}`}
                    className="rounded-xl bg-[#fff1e6] px-3 py-3"
                  >
                    <p className="text-lg font-bold text-[#b84b12]">{metric.value}</p>
                    <p className="mt-1 text-xs leading-4 text-slate-600">{metric.label}</p>
                  </div>
                ))}
              </div>
            )}
            <RenderImages placements={placements} />
          </PortfolioTextBlock>
        );
      })}

      {project.reviewTags.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-1.5">
          {project.reviewTags.map((tag) => (
            <span key={tag} className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
              {tag}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="rounded-lg bg-slate-50 px-3 py-2">
      <span className="font-semibold text-slate-700">{label}</span>
      <span className="mx-1 text-slate-300">/</span>
      {value}
    </p>
  );
}

function buildSectionOverridePatch(
  sectionKey: Exclude<PortfolioImagePlacement["sectionKey"], "overview" | "troubleshooting">,
  value: string
): Partial<PortfolioSectionOverrides> {
  if (sectionKey === "problemDefinition") return { problemDefinition: value };
  if (sectionKey === "techDecision") return { techDecision: value };
  if (sectionKey === "implementation") return { implementationSummary: value };
  return { resultSummary: value };
}

function EditableTextarea({
  value,
  onChange,
  rows = 4,
  className = "",
}: {
  value: string | null;
  onChange: (value: string) => void;
  rows?: number;
  className?: string;
}) {
  return (
    <textarea
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value)}
      rows={rows}
      className={`w-full resize-y rounded-xl border border-transparent bg-transparent px-0 py-2 text-sm leading-7 text-slate-600 outline-none transition focus:border-blue-100 focus:bg-blue-50/50 focus:px-3 ${className}`}
    />
  );
}

function PortfolioTextBlock({
  sectionKey,
  title,
  text,
  onChange,
  children,
}: {
  sectionKey: Exclude<PortfolioImagePlacement["sectionKey"], "overview" | "troubleshooting">;
  title: string;
  text: string | null;
  onChange: (value: string) => void;
  children?: ReactNode;
}) {
  return (
    <section className="mt-6 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-[#094cb2]" />
        <h4 className="text-base font-bold text-slate-950">{title}</h4>
      </div>
      <EditableTextarea
        value={text}
        onChange={onChange}
        rows={sectionKey === "implementation" ? 5 : 4}
        className="mt-2"
      />
      {children}
    </section>
  );
}

function RenderImages({ placements }: { placements: PortfolioImagePlacement[] }) {
  if (placements.length === 0) return null;
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
          {(placement.captionDraft || placement.needsUserCheck) && (
            <figcaption className="px-3 py-2 text-xs leading-5 text-slate-500">
              {placement.captionDraft || "이미지 캡션 확인 필요"}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}

function ImagePlacementPanel({
  document,
  onUpdate,
}: {
  document: PortfolioDocumentPayload | null;
  onUpdate: (
    placementId: string,
    patch: Partial<Pick<PortfolioImagePlacement, "sectionKey" | "captionDraft">>
  ) => void;
}) {
  if (!document || document.imagePlacements.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-slate-950">이미지 배치</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          선택한 성과에 이미지가 있으면 섹션별 배치를 조정할 수 있습니다.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-bold text-slate-950">이미지 배치</h2>
      <div className="mt-3 space-y-3">
        {document.imagePlacements.map((placement, index) => (
          <div key={placement.id} className="rounded-xl border border-slate-100 p-3">
            <div className="flex gap-3">
              <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                <Image
                  src={placement.imageUrl}
                  alt={`포트폴리오 이미지 ${index + 1}`}
                  fill
                  sizes="80px"
                  unoptimized
                  className="object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <label className="block text-xs font-semibold text-slate-500">배치 섹션</label>
                <select
                  value={placement.sectionKey}
                  onChange={(event) =>
                    onUpdate(placement.id, {
                      sectionKey: event.target.value as PortfolioImagePlacement["sectionKey"],
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-[#094cb2]"
                >
                  {Object.entries(SECTION_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  value={placement.captionDraft ?? ""}
                  onChange={(event) => onUpdate(placement.id, { captionDraft: event.target.value })}
                  placeholder="캡션 초안"
                  className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-[#094cb2]"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
