"use client";

import Image from "next/image";
import type { ReactNode } from "react";

import { getActivityMetaItems } from "@/lib/activity-display";
import { getResumeActivityBodyLines } from "@/lib/resume-display";
import { normalizeResumeActivityLineOverrides } from "@/lib/resume-line-overrides";
import { getResumeProfileHighlightSections } from "@/lib/resume-profile";
import type { Activity, Resume, ResumeBuilderProfile } from "@/lib/types";

type A4PreviewItem = {
  key: string;
  node: ReactNode;
  units: number;
  keepWithNext?: boolean;
};

const A4_PAGE_UNIT_LIMIT = 54;

function isCareerActivity(activity: Activity): boolean {
  return activity.type === "회사경력";
}

function estimateTextRows(text: string | null | undefined, charsPerRow = 82): number {
  const normalized = text?.trim();
  if (!normalized) return 0;
  return normalized
    .split(/\n+/)
    .map((line) => Math.max(1, Math.ceil(line.trim().length / charsPerRow)))
    .reduce((sum, rows) => sum + rows, 0);
}

function paginateA4Items(items: A4PreviewItem[]): A4PreviewItem[][] {
  const pages: A4PreviewItem[][] = [];
  let currentPage: A4PreviewItem[] = [];
  let currentUnits = 0;

  items.forEach((item, index) => {
    const nextUnits = item.keepWithNext ? items[index + 1]?.units ?? 0 : 0;
    const shouldStartNextPage =
      currentPage.length > 0 &&
      (currentUnits + item.units > A4_PAGE_UNIT_LIMIT ||
        currentUnits + item.units + nextUnits > A4_PAGE_UNIT_LIMIT);

    if (shouldStartNextPage) {
      pages.push(currentPage);
      currentPage = [];
      currentUnits = 0;
    }

    currentPage.push(item);
    currentUnits += item.units;
  });

  if (currentPage.length > 0) pages.push(currentPage);
  return pages.length > 0 ? pages : [[]];
}

function estimateActivityUnits(
  activity: Activity,
  activityLineOverrides: ReturnType<typeof normalizeResumeActivityLineOverrides>
): number {
  const metaItems = getActivityMetaItems(activity);
  const bodyLines = getResumeActivityBodyLines(activity, activityLineOverrides);
  const bodyUnits = bodyLines.reduce(
    (sum, line) => sum + Math.max(1, estimateTextRows(line, 76)),
    0
  );

  return Math.max(7, 4 + (metaItems.length > 0 ? 1 : 0) + bodyUnits);
}

function estimateHighlightUnits(profile: ResumeBuilderProfile | null): number {
  const sections = getResumeProfileHighlightSections(profile);
  if (sections.length === 0) return 0;
  const itemCount = sections.reduce((sum, section) => sum + section.items.length, 0);
  return Math.max(5, 3 + Math.ceil(itemCount / 3));
}

function ExportProfileIntro({ profile }: { profile: ResumeBuilderProfile | null }) {
  if (!profile?.self_intro) return null;
  return (
    <section className="rounded-xl border border-blue-50 bg-[#f8fbff] p-3">
      <p className="text-[11px] font-semibold tracking-widest text-slate-400">
        PROFESSIONAL PROFILE
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{profile.self_intro}</p>
    </section>
  );
}

function ExportProfileHighlights({ profile }: { profile: ResumeBuilderProfile | null }) {
  const sections = getResumeProfileHighlightSections(profile);
  if (sections.length === 0) return null;

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
      <p className="text-[11px] font-semibold tracking-widest text-slate-400">
        AWARDS · CERTIFICATIONS · LANGUAGE
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {sections.map((section) => (
          <div key={section.key}>
            <p className="text-xs font-bold text-slate-800">{section.title}</p>
            <div className="mt-1 space-y-1">
              {section.items.map((item, index) => (
                <p key={`${section.key}-${item}-${index}`} className="text-xs text-slate-600">
                  {item}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ExportResumeHeader({
  resume,
  profile,
}: {
  resume: Resume;
  profile: ResumeBuilderProfile | null;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
      <div className="flex items-start gap-4">
        <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100">
          {profile?.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt={`${profile.name || "프로필"} 아바타`}
              width={80}
              height={80}
              sizes="80px"
              unoptimized
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-2xl text-slate-300">👤</span>
          )}
        </div>
        <div>
          <p className="text-xl font-bold text-slate-950">
            {profile?.name || resume.title}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            지원 직무: {resume.target_job ?? "미입력"}
          </p>
          {profile?.bio && <p className="text-sm text-slate-500">{profile.bio}</p>}
          {(profile?.email || profile?.phone) && (
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-400">
              {profile?.email && <span>✉ {profile.email}</span>}
              {profile?.phone && <span>☎ {profile.phone}</span>}
            </div>
          )}
        </div>
      </div>
      <p className="shrink-0 text-xs text-slate-400">{resume.title}</p>
    </div>
  );
}

function ExportSectionTitle({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold tracking-widest text-slate-400">
      {children}
    </p>
  );
}

function ExportActivityCard({
  activity,
  activityLineOverrides,
}: {
  activity: Activity;
  activityLineOverrides: ReturnType<typeof normalizeResumeActivityLineOverrides>;
}) {
  const metaItems = getActivityMetaItems(activity);
  const bodyLines = getResumeActivityBodyLines(activity, activityLineOverrides);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-sm font-bold text-slate-950">{activity.title}</p>
      <p className="mt-1 text-xs text-slate-500">
        {activity.type} | {activity.period ?? "기간 미입력"}
      </p>
      {metaItems.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">{metaItems.join(" · ")}</p>
      )}
      <div className="mt-2 space-y-1">
        {bodyLines.map((line, index) => (
          <p key={`${activity.id}-export-preview-${index}`} className="text-sm leading-6 text-slate-600">
            - {line}
          </p>
        ))}
      </div>
    </div>
  );
}

function ExportActivityList({
  title,
  activities,
  activityLineOverrides,
}: {
  title: string;
  activities: Activity[];
  activityLineOverrides: ReturnType<typeof normalizeResumeActivityLineOverrides>;
}) {
  if (activities.length === 0) return null;

  return (
    <section className="space-y-3">
      <ExportSectionTitle>{title}</ExportSectionTitle>
      {activities.map((activity) => (
        <ExportActivityCard
          key={activity.id}
          activity={activity}
          activityLineOverrides={activityLineOverrides}
        />
      ))}
    </section>
  );
}

function A4PreviewPages({ items }: { items: A4PreviewItem[] }) {
  const pages = paginateA4Items(items);

  return (
    <div className="mx-auto flex w-full max-w-[210mm] flex-col gap-6">
      {pages.map((pageItems, pageIndex) => (
        <section
          key={`resume-a4-page-${pageIndex}`}
          className="relative mx-auto aspect-[210/297] w-[210mm] max-w-full overflow-hidden bg-white shadow-[0_22px_60px_rgba(15,23,42,0.16)] ring-1 ring-slate-200"
          aria-label={`이력서 A4 미리보기 ${pageIndex + 1}페이지`}
        >
          <div className="h-full overflow-hidden px-[14mm] pb-[18mm] pt-[14mm]">
            <div className="space-y-4">
              {pageItems.map((item) => (
                <div key={item.key}>{item.node}</div>
              ))}
            </div>
          </div>
          <div className="absolute bottom-[7mm] right-[14mm] rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium text-slate-400">
            {pageIndex + 1} / {pages.length}
          </div>
        </section>
      ))}
    </div>
  );
}

function ResumeA4Preview({
  resume,
  activities,
  profile,
  loading,
}: {
  resume: Resume | null;
  activities: Activity[];
  profile: ResumeBuilderProfile | null;
  loading: boolean;
}) {
  const activityLineOverrides = normalizeResumeActivityLineOverrides(
    resume?.activity_line_overrides
  );
  const careerActivities = activities.filter(isCareerActivity);
  const projectActivities = activities.filter((activity) => !isCareerActivity(activity));

  if (loading) {
    return (
      <A4PreviewPages
        items={[{ key: "loading", units: 8, node: <p className="text-sm text-slate-500">불러오는 중...</p> }]}
      />
    );
  }

  if (!resume) {
    return (
      <A4PreviewPages
        items={[{ key: "empty", units: 8, node: <p className="text-sm text-slate-500">저장된 이력서가 없습니다.</p> }]}
      />
    );
  }

  const items: A4PreviewItem[] = [
    {
      key: "resume-header",
      units: 12,
      node: <ExportResumeHeader resume={resume} profile={profile} />,
    },
  ];

  if (profile?.self_intro) {
    items.push({
      key: "resume-intro",
      units: Math.max(6, 3 + estimateTextRows(profile.self_intro, 82)),
      node: <ExportProfileIntro profile={profile} />,
    });
  }

  if (careerActivities.length > 0) {
    items.push({
      key: "career-heading",
      units: 2,
      keepWithNext: true,
      node: <ExportSectionTitle>WORK EXPERIENCE</ExportSectionTitle>,
    });
    careerActivities.forEach((activity) => {
      items.push({
        key: `career-${activity.id}`,
        units: estimateActivityUnits(activity, activityLineOverrides),
        node: (
          <ExportActivityCard
            activity={activity}
            activityLineOverrides={activityLineOverrides}
          />
        ),
      });
    });
  }

  if (estimateHighlightUnits(profile) > 0) {
    items.push({
      key: "profile-highlights",
      units: estimateHighlightUnits(profile),
      node: <ExportProfileHighlights profile={profile} />,
    });
  }

  if (projectActivities.length > 0) {
    items.push({
      key: "project-heading",
      units: 2,
      keepWithNext: true,
      node: <ExportSectionTitle>KEY EXPERIENCE</ExportSectionTitle>,
    });
    projectActivities.forEach((activity) => {
      items.push({
        key: `project-${activity.id}`,
        units: estimateActivityUnits(activity, activityLineOverrides),
        node: (
          <ExportActivityCard
            activity={activity}
            activityLineOverrides={activityLineOverrides}
          />
        ),
      });
    });
  }

  return <A4PreviewPages items={items} />;
}

export function ResumeExportPreview({
  resume,
  activities,
  profile,
  loading,
  embedded = false,
}: {
  resume: Resume | null;
  activities: Activity[];
  profile: ResumeBuilderProfile | null;
  loading: boolean;
  embedded?: boolean;
}) {
  const activityLineOverrides = normalizeResumeActivityLineOverrides(
    resume?.activity_line_overrides
  );
  const careerActivities = activities.filter(isCareerActivity);
  const projectActivities = activities.filter((activity) => !isCareerActivity(activity));

  if (embedded) {
    return (
      <ResumeA4Preview
        resume={resume}
        activities={activities}
        profile={profile}
        loading={loading}
      />
    );
  }

  return (
    <div
      className="min-h-[600px] rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      {loading ? (
        <p className="text-sm text-slate-500">불러오는 중...</p>
      ) : !resume ? (
        <p className="text-sm text-slate-500">저장된 이력서가 없습니다.</p>
      ) : (
        <div className="space-y-4">
          <ExportResumeHeader resume={resume} profile={profile} />
          <div className="space-y-3">
            <ExportProfileIntro profile={profile} />
            <ExportActivityList
              title="WORK EXPERIENCE"
              activities={careerActivities}
              activityLineOverrides={activityLineOverrides}
            />
            <ExportProfileHighlights profile={profile} />
            <ExportActivityList
              title="KEY EXPERIENCE"
              activities={projectActivities}
              activityLineOverrides={activityLineOverrides}
            />
          </div>
        </div>
      )}
    </div>
  );
}
