"use client";

import { useEffect, useState } from "react";
import { listActivities, listSavedPortfolios, savePortfolioDocument } from "@/lib/api/app";
import { convertActivity } from "@/lib/api/backend";
import type {
  Activity,
  ActivityConvertRequest,
  PortfolioConversionResponse,
  SavedPortfolio,
} from "@/lib/types";

const PENDING_PORTFOLIO_CONVERSION_KEY = "isoser:pending-portfolio-conversion";

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

export default function PortfolioPage() {
  const [portfolioPreview, setPortfolioPreview] =
    useState<PortfolioConversionResponse | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [generatingActivityId, setGeneratingActivityId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedPortfolios, setSavedPortfolios] = useState<SavedPortfolio[]>([]);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const raw = window.sessionStorage.getItem(PENDING_PORTFOLIO_CONVERSION_KEY);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as {
        portfolio?: PortfolioConversionResponse;
      };
      setPortfolioPreview(parsed.portfolio ?? null);
    } catch {
      window.sessionStorage.removeItem(PENDING_PORTFOLIO_CONVERSION_KEY);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      setLoadingActivities(true);
      setError(null);

      try {
        const [activityResult, portfolioResult] = await Promise.all([
          listActivities(),
          listSavedPortfolios().catch(() => ({ portfolios: [] })),
        ]);
        if (!mounted) return;
        setActivities(activityResult.activities);
        setSavedPortfolios(portfolioResult.portfolios);
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError instanceof Error ? loadError.message : "활동 목록을 불러오지 못했습니다.");
      } finally {
        if (mounted) {
          setLoadingActivities(false);
        }
      }
    };

    void loadData();

    return () => {
      mounted = false;
    };
  }, []);

  const clearPreview = () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(PENDING_PORTFOLIO_CONVERSION_KEY);
    }
    setPortfolioPreview(null);
  };

  const handleGeneratePortfolio = async (activity: Activity) => {
    setGeneratingActivityId(activity.id);
    setError(null);
    setSaveStatus(null);

    try {
      const result = await convertActivity({
        target: "portfolio",
        activity: buildPortfolioConvertPayload(activity),
      });
      if (!result.portfolio) {
        throw new Error("포트폴리오 변환 결과를 받지 못했습니다.");
      }
      const portfolio = result.portfolio;
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          PENDING_PORTFOLIO_CONVERSION_KEY,
          JSON.stringify({ activityId: activity.id, portfolio })
        );
      }
      try {
        const saved = await savePortfolioDocument({
          title: portfolio.project_overview.title,
          sourceActivityId: activity.id,
          portfolio,
        });
        setSavedPortfolios((current) => [
          {
            id: saved.id,
            title: portfolio.project_overview.title,
            sourceActivityId: activity.id,
            selectedActivityIds: [activity.id],
            portfolio,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          ...current.filter((item) => item.id !== saved.id),
        ]);
        setSaveStatus("포트폴리오 초안이 서버에 저장되었습니다.");
      } catch {
        setSaveStatus("서버 저장에는 실패했지만, 현재 브라우저에서 초안을 확인할 수 있습니다.");
      }
      setPortfolioPreview(portfolio);
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "포트폴리오 초안 생성에 실패했습니다.");
    } finally {
      setGeneratingActivityId(null);
    }
  };

  if (!portfolioPreview) {
    return (
      <main className="min-h-screen bg-gray-50 px-4 py-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
            <p className="text-sm font-semibold text-emerald-600">포트폴리오 생성</p>
            <h1 className="mt-2 text-3xl font-bold text-gray-900">활동 기반 포트폴리오 초안</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-600">
              성과 저장소에 있는 활동을 선택하면 발표용 최소 포트폴리오 초안을 바로 생성합니다.
            </p>
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          {saveStatus ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {saveStatus}
            </div>
          ) : null}

          {loadingActivities ? (
            <div className="rounded-3xl border border-gray-200 bg-white p-8 text-sm text-gray-500 shadow-sm">
              활동 목록을 불러오는 중입니다...
            </div>
          ) : (
            <>
              {savedPortfolios.length > 0 ? (
                <section className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
                  <h2 className="text-xl font-semibold text-gray-900">저장된 포트폴리오 초안</h2>
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    {savedPortfolios.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => item.portfolio && setPortfolioPreview(item.portfolio)}
                        className="rounded-2xl border border-gray-200 px-4 py-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={!item.portfolio}
                      >
                        <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {new Date(item.updatedAt).toLocaleDateString("ko-KR")} 저장
                        </p>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              {activities.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {activities.map((activity) => (
                    <article key={activity.id} className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                      <p className="text-xs font-semibold text-gray-400">{activity.type}</p>
                      <h2 className="mt-2 line-clamp-2 text-lg font-semibold text-gray-900">{activity.title}</h2>
                      <p className="mt-2 text-sm text-gray-500">{activity.period || "기간 미입력"}</p>
                      <p className="mt-3 line-clamp-3 text-sm leading-6 text-gray-600">
                        {activity.description || activity.contributions?.join(" ") || "활동 설명을 보완하면 더 좋은 초안을 만들 수 있습니다."}
                      </p>
                      <button
                        type="button"
                        onClick={() => void handleGeneratePortfolio(activity)}
                        disabled={generatingActivityId === activity.id}
                        className="mt-5 rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                      >
                        {generatingActivityId === activity.id ? "초안 생성 중..." : "포트폴리오 초안 생성"}
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-8 text-sm text-gray-500">
                  생성할 활동이 없습니다. 먼저 성과 저장소에서 활동을 저장해주세요.
                </div>
              )}
            </>
          )}
        </div>
      </main>
    );
  }

  const overview = portfolioPreview.project_overview;
  const result = portfolioPreview.quantified_result;
  const implementation = portfolioPreview.implementation_detail;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-3xl border border-emerald-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold text-emerald-600">
                포트폴리오 초안 미리보기
              </p>
              <h1 className="mt-2 text-3xl font-bold text-gray-900">
                {overview.title}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-600">
                {overview.summary}
              </p>
            </div>
            <button
              type="button"
              onClick={clearPreview}
              className="rounded-2xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
            >
              미리보기 닫기
            </button>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {(overview.skills || []).map((skill) => (
              <span
                key={skill}
                className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"
              >
                {skill}
              </span>
            ))}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <InfoCard label="활동 유형" value={overview.activity_type} />
            <InfoCard label="조직" value={overview.organization || "-"} />
            <InfoCard label="기간" value={overview.period || "-"} />
            <InfoCard
              label="역할"
              value={overview.role || portfolioPreview.role_clarification.content}
            />
            <InfoCard
              label="팀 구성"
              value={overview.team_composition || "-"}
            />
            <InfoCard
              label="팀 규모"
              value={overview.team_size ? `${overview.team_size}명` : "-"}
            />
          </div>
        </div>

        <SectionCard
          title={portfolioPreview.problem_definition.label}
          content={portfolioPreview.problem_definition.content}
        />
        <SectionCard
          title={portfolioPreview.tech_decision.label}
          content={portfolioPreview.tech_decision.content}
        />

        <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">
            {implementation.label}
          </h2>
          <p className="mt-3 text-sm leading-7 text-gray-600">
            {implementation.summary}
          </p>
          {implementation.highlights.length > 0 && (
            <div className="mt-4 space-y-2">
              {implementation.highlights.map((highlight) => (
                <p
                  key={highlight}
                  className="rounded-2xl bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-600"
                >
                  {highlight}
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">{result.label}</h2>
          <p className="mt-3 text-sm leading-7 text-gray-600">{result.summary}</p>
          {result.metrics.length > 0 && (
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {result.metrics.map((metric) => (
                <div
                  key={`${metric.label}-${metric.value}`}
                  className="rounded-2xl bg-emerald-50 p-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                    {metric.label}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-emerald-800">
                    {metric.value}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <SectionCard
          title={portfolioPreview.role_clarification.label}
          content={portfolioPreview.role_clarification.content}
        />

        {(portfolioPreview.missing_elements.length > 0 ||
          portfolioPreview.review_tags.length > 0) && (
          <div className="grid gap-4 md:grid-cols-2">
            <TagPanel
              title="보완 필요 요소"
              tags={portfolioPreview.missing_elements}
              emptyText="현재 보완 필요 요소가 없습니다."
              tone="amber"
            />
            <TagPanel
              title="검토 태그"
              tags={portfolioPreview.review_tags}
              emptyText="현재 검토 태그가 없습니다."
              tone="slate"
            />
          </div>
        )}
      </div>
    </main>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-gray-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-gray-700">{value}</p>
    </div>
  );
}

function SectionCard({ title, content }: { title: string; content: string }) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-600">
        {content}
      </p>
    </div>
  );
}

function TagPanel({
  title,
  tags,
  emptyText,
  tone,
}: {
  title: string;
  tags: string[];
  emptyText: string;
  tone: "amber" | "slate";
}) {
  const toneClass =
    tone === "amber"
      ? "bg-amber-50 text-amber-700"
      : "bg-slate-100 text-slate-700";

  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      {tags.length === 0 ? (
        <p className="mt-3 text-sm text-gray-400">{emptyText}</p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className={`rounded-full px-3 py-1 text-xs font-medium ${toneClass}`}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
