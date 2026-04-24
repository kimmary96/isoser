"use client";

import Link from "next/link";

import MiniCalendar from "@/components/MiniCalendar";
import {
  formatProgramTrainingPeriod,
  toProgramDateKey,
} from "@/lib/program-display";

import {
  DashboardBookmarkedProgramCard,
  DashboardRecommendationProgramCard,
  DashboardRecommendationSkeletonCard,
} from "./_components/dashboard-program-cards";
import {
  DASHBOARD_CATEGORY_OPTIONS,
  DASHBOARD_REGION_OPTIONS,
  useDashboardRecommendations,
} from "./_hooks/use-dashboard-recommendations";

export default function DashboardPage() {
  const {
    userName,
    bookmarkedPrograms,
    bookmarksLoading,
    bookmarksError,
    appliedCalendarPrograms,
    selectedDate,
    setSelectedDate,
    selectedCategory,
    setSelectedCategory,
    selectedRegion,
    setSelectedRegion,
    loading,
    calendarSaveStatus,
    filteredPrograms,
    calendarPrograms,
    appliedProgramIds,
    handleApplyToCalendar,
    clearAppliedCalendarPrograms,
    emptyMessage,
  } = useDashboardRecommendations();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            안녕하세요, {userName}님
          </h1>
        </header>

        <section id="recommend-calendar" className="scroll-mt-6">
          <MiniCalendar
            programs={calendarPrograms.map((program) => ({
              title: program.title || "제목 없음",
              deadline: program.deadline || undefined,
              isApplied: appliedProgramIds.has(String(program.id ?? "")),
            }))}
            selectedDate={selectedDate}
            onDateClick={(date) => {
              setSelectedDate((current) => (current === date ? null : date));
            }}
            focusDate={appliedCalendarPrograms[0]?.deadline ?? null}
          />
        </section>

        <section className="mb-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">찜한 훈련</h2>
              <p className="mt-1 text-sm text-slate-500">
                프로그램 목록과 상세 페이지에서 북마크한 훈련이 여기에 저장됩니다.
              </p>
            </div>
            <Link href="/compare" className="text-sm font-semibold text-blue-600 hover:text-blue-700">
              비교 페이지에서 보기
            </Link>
          </div>

          {bookmarksLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <DashboardRecommendationSkeletonCard key={`bookmark-skeleton-${index}`} />
              ))}
            </div>
          ) : bookmarksError ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center">
              <p className="text-sm text-slate-500">찜한 훈련을 불러오지 못했습니다.</p>
            </div>
          ) : bookmarkedPrograms.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {bookmarkedPrograms.slice(0, 6).map((item) => (
                <DashboardBookmarkedProgramCard
                  key={`bookmarked-${String(item.program.id)}`}
                  item={item}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center">
              <p className="text-sm text-slate-500">아직 찜한 훈련이 없습니다.</p>
              <Link
                href="/programs"
                className="mt-4 inline-flex rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                프로그램 찾기
              </Link>
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
              AI 맞춤 취업 지원 캘린더
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {appliedCalendarPrograms.length > 0
                ? "선택한 부트캠프 일정이 이번 달 마감 일정에 적용되었습니다."
                : "추천 부트캠프에서 캘린더에 적용할 일정을 선택하세요."}
            </p>
          </div>

          {appliedCalendarPrograms.length > 0 ? (
            <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-emerald-800">적용된 부트캠프 일정</p>
                  <div className="mt-3 space-y-2">
                    {appliedCalendarPrograms.map((program) => (
                      <p key={String(program.id)} className="text-sm text-emerald-900">
                        {program.title || "제목 없음"} · {formatProgramTrainingPeriod(program.start_date, program.end_date)}
                      </p>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearAppliedCalendarPrograms}
                  className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-sm font-semibold text-emerald-700"
                >
                  초기화
                </button>
              </div>
            </div>
          ) : null}

          {calendarSaveStatus ? (
            <p className="mb-6 text-sm text-slate-500">{calendarSaveStatus}</p>
          ) : null}

          <div className="mb-6 space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">카테고리</p>
              <div className="flex flex-wrap gap-2">
                {DASHBOARD_CATEGORY_OPTIONS.map((option) => {
                  const isActive = selectedCategory === option.value;
                  return (
                    <button
                      key={`category-${option.label}`}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(option.value);
                        setSelectedRegion(null);
                      }}
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">지역</p>
              <div className="flex flex-wrap gap-2">
                {DASHBOARD_REGION_OPTIONS.map((option) => {
                  const isActive = selectedRegion === option.value;
                  return (
                    <button
                      key={`region-${option.label}`}
                      type="button"
                      onClick={() => {
                        setSelectedRegion(option.value);
                        setSelectedCategory(null);
                      }}
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 9 }).map((_, index) => (
                <DashboardRecommendationSkeletonCard key={`skeleton-${index}`} />
              ))}
            </div>
          ) : filteredPrograms.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredPrograms.map((item, index) => {
                const cardDateKey = toProgramDateKey(item.program.deadline);
                return (
                <DashboardRecommendationProgramCard
                  key={`${item.program.link ?? item.program.title ?? "program"}-${index}`}
                  cardId={cardDateKey ? `card-${cardDateKey}` : undefined}
                  item={item}
                  isApplied={appliedProgramIds.has(String(item.program.id ?? ""))}
                  onApplyToCalendar={handleApplyToCalendar}
                />
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
              <p className="text-sm text-slate-500">{emptyMessage}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
