"use client";

import { PencilButton, ReadonlyListSection } from "./profile-section-editors";
import type { CareerCard } from "../_lib/profile-page";

type ProfileCareerCardSectionProps = {
  careerCards: CareerCard[];
  onEditCareer: () => void;
};

export function ProfileCareerCardSection({
  careerCards,
  onEditCareer,
}: ProfileCareerCardSectionProps) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold tracking-tight text-slate-950">🗂 경력</h3>
        <PencilButton onClick={onEditCareer} label="경력 수정" />
      </div>
      {careerCards.length === 0 ? (
        <p className="text-sm text-slate-400">저장된 경력이 없습니다.</p>
      ) : (
        careerCards.map((card, index) => (
          <div key={`${card.company}-${card.position}-${index}`} className="mb-4">
            <div className="mb-1 flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">{card.company}</p>
                <p className="text-xs text-slate-500">{card.position}</p>
              </div>
              <p className="ml-2 shrink-0 text-xs text-slate-400">{card.period}</p>
            </div>
            <div className="mt-2 space-y-1 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              {card.activities.map((activity, activityIndex) => (
                <p key={`${activity.title}-${activityIndex}`} className="text-xs text-slate-600">
                  - {activity.title}
                </p>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

type ProfileListCardProps = {
  title: string;
  items: string[];
  emptyMessage: string;
  onEdit: () => void;
};

export function ProfileListCard({
  title,
  items,
  emptyMessage,
  onEdit,
}: ProfileListCardProps) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
      <ReadonlyListSection
        title={title}
        items={items}
        emptyMessage={emptyMessage}
        onEdit={onEdit}
      />
    </div>
  );
}

type ProfileFooterActionsProps = {
  hasPortfolioUrl: boolean;
  onOpenSettings: () => void;
  onOpenPortfolio: () => void;
};

export function ProfileFooterActions({
  hasPortfolioUrl,
  onOpenSettings,
  onOpenPortfolio,
}: ProfileFooterActionsProps) {
  return (
    <div className="mb-8 flex justify-end gap-3">
      <button
        type="button"
        onClick={onOpenSettings}
        className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
      >
        ⚙ 설정
      </button>
      <button
        type="button"
        onClick={onOpenPortfolio}
        className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        {hasPortfolioUrl ? "포트폴리오 링크 열기" : "포트폴리오 링크 설정"}
      </button>
    </div>
  );
}
