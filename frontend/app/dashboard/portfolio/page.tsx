"use client";

import { useEffect, useState } from "react";
import type { PortfolioConversionResponse } from "@/lib/types";

const PENDING_PORTFOLIO_CONVERSION_KEY = "isoser:pending-portfolio-conversion";

export default function PortfolioPage() {
  const [portfolioPreview, setPortfolioPreview] =
    useState<PortfolioConversionResponse | null>(null);

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

  const clearPreview = () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(PENDING_PORTFOLIO_CONVERSION_KEY);
    }
    setPortfolioPreview(null);
  };

  if (!portfolioPreview) {
    return (
      <div className="p-8 text-gray-400">
        포트폴리오 기능은 준비 중입니다.
      </div>
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
