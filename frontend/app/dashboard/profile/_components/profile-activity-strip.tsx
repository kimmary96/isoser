"use client";

import type { Activity } from "@/lib/types";

type ActivityTab = {
  label: string;
  type: string;
};

type ProfileActivityStripProps = {
  tabs: ActivityTab[];
  activeTab: string;
  activities: Activity[];
  tabActivities: Activity[];
  onSelectTab: (tab: string) => void;
  onManageActivities: () => void;
  onOpenActivity: (id: string) => void;
  onCreateActivity: () => void;
};

export function ProfileActivityStrip({
  tabs,
  activeTab,
  activities,
  tabActivities,
  onSelectTab,
  onManageActivities,
  onOpenActivity,
  onCreateActivity,
}: ProfileActivityStripProps) {
  return (
    <div className="mb-6">
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const count = activities.filter((activity) => {
            const activityType = activity.type as string;
            return tab.type === "개인프로젝트"
              ? activityType === "프로젝트" || activityType === "개인프로젝트"
              : activityType === tab.type;
          }).length;

          return (
            <button
              key={tab.type}
              type="button"
              onClick={() => onSelectTab(tab.type)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                activeTab === tab.type
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {tab.label}
              <span
                className={`text-xs ${
                  activeTab === tab.type ? "text-gray-300" : "text-gray-400"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={onManageActivities}
          className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500 hover:bg-slate-50"
        >
          ⚙ 활동 관리
        </button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {tabActivities.map((activity) => (
          <div
            key={activity.id}
            onClick={() => onOpenActivity(activity.id)}
            className="w-56 flex-shrink-0 cursor-pointer overflow-hidden rounded-3xl border border-slate-200 bg-white transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(15,23,42,0.08)]"
            style={{ height: "220px" }}
          >
            <div className="flex h-28 items-center justify-center bg-[linear-gradient(135deg,#dbeafe,#e2e8f0)]">
              <span className="text-2xl text-slate-400">🖼</span>
            </div>
            <div className="p-3">
              <p className="mb-1 text-xs text-slate-400">{activity.period}</p>
              <p className="line-clamp-2 text-sm font-semibold text-slate-900">
                {activity.title}
              </p>
              <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                {activity.description}
              </p>
            </div>
          </div>
        ))}

        <div
          onClick={onCreateActivity}
          className="flex w-24 flex-shrink-0 cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-slate-300 bg-white text-slate-400 hover:text-slate-600"
          style={{ height: "220px" }}
        >
          <span className="text-2xl">+</span>
          <span className="text-xs">활동 추가</span>
        </div>
      </div>
    </div>
  );
}
