import Image from "next/image";
import type { ReactNode } from "react";
import type { Activity } from "@/lib/types";
import { getActivityMetaItems } from "@/lib/activity-display";
import { getResumeActivityBodyLines } from "@/lib/resume-display";
import { getResumeProfileHighlightSections } from "@/lib/resume-profile";
import { MAX_RESUME_OVERRIDE_LINES_PER_ACTIVITY } from "@/lib/resume-line-overrides";
import type { AppliedResumeRewriteLines } from "../_lib/resume-rewrite";

type ResumeProfile = {
  name: string;
  bio?: string;
  avatar_url?: string | null;
  email: string;
  phone: string;
  self_intro: string;
  skills: string[];
  awards: string[];
  certifications: string[];
  languages: string[];
} | null;

type ResumePreviewPaneProps = {
  profile: ResumeProfile;
  bioInput: string;
  onBioInputChange: (value: string) => void;
  onBioSave: () => Promise<void>;
  bioSaving: boolean;
  targetJob: string;
  selectedCareerActivities: Activity[];
  selectedProjectActivities: Activity[];
  selectedSkillsList: string[];
  selectedQuestions: string[];
  activityLineOverrides: AppliedResumeRewriteLines;
  onActivityLineOverrideChange: (activityId: string, lineIndex: number, text: string) => void;
  onActivityLineOverrideAdd: (activityId: string) => void;
  onActivityLineOverrideRemove: (activityId: string, lineIndex: number) => void;
  onActivityLineOverrideClear: (activityId: string) => void;
};

type ActivityResumeEntryProps = {
  activity: Activity;
  index: number;
  showSkills?: boolean;
  activityLineOverrides: AppliedResumeRewriteLines;
  onActivityLineOverrideChange: (activityId: string, lineIndex: number, text: string) => void;
  onActivityLineOverrideAdd: (activityId: string) => void;
  onActivityLineOverrideRemove: (activityId: string, lineIndex: number) => void;
  onActivityLineOverrideClear: (activityId: string) => void;
};

type ResumePreviewItem = {
  key: string;
  node: ReactNode;
  units: number;
  keepWithNext?: boolean;
};

const A4_PAGE_UNIT_LIMIT = 54;

function estimateTextRows(text: string | null | undefined, charsPerRow = 74): number {
  const normalized = text?.trim();
  if (!normalized) return 0;
  return normalized
    .split(/\n+/)
    .map((line) => Math.max(1, Math.ceil(line.trim().length / charsPerRow)))
    .reduce((sum, rows) => sum + rows, 0);
}

function estimateActivityUnits(
  activity: Activity,
  showSkills: boolean,
  activityLineOverrides: AppliedResumeRewriteLines
): number {
  const overrideLines = activityLineOverrides[activity.id] ?? [];
  const hasOverride = overrideLines.length > 0;
  const lines = hasOverride
    ? overrideLines
    : getResumeActivityBodyLines(activity, activityLineOverrides);
  const metaUnits = getActivityMetaItems(activity).length > 0 ? 1 : 0;
  const lineUnits = lines.reduce(
    (sum, line) => sum + Math.max(1, estimateTextRows(line, 76)),
    0
  );
  const skillUnits =
    showSkills && Array.isArray(activity.skills) && activity.skills.length > 0
      ? Math.ceil(activity.skills.length / 5)
      : 0;
  const editControlUnits = hasOverride ? 3 : 0;

  return Math.max(8, 5 + metaUnits + lineUnits + skillUnits + editControlUnits);
}

function estimateProfileHighlightUnits(profile: ResumeProfile): number {
  const sections = getResumeProfileHighlightSections(profile);
  if (sections.length === 0) return 0;
  const itemRows = sections.reduce(
    (sum, section) =>
      sum + section.items.reduce((sectionSum, item) => sectionSum + estimateTextRows(item, 30), 0),
    0
  );
  return Math.max(5, 2 + sections.length + Math.ceil(itemRows / 2));
}

function paginateResumeItems(items: ResumePreviewItem[]): ResumePreviewItem[][] {
  const pages: ResumePreviewItem[][] = [];
  let currentPage: ResumePreviewItem[] = [];
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

function ActivityResumeEntry({
  activity,
  index,
  showSkills = false,
  activityLineOverrides,
  onActivityLineOverrideChange,
  onActivityLineOverrideAdd,
  onActivityLineOverrideRemove,
  onActivityLineOverrideClear,
}: ActivityResumeEntryProps) {
  const metaItems = getActivityMetaItems(activity);
  const overrideLines = activityLineOverrides[activity.id] ?? [];
  const hasOverride = overrideLines.length > 0;
  const bodyLines = hasOverride
    ? []
    : getResumeActivityBodyLines(activity, activityLineOverrides);
  const canAddLine = overrideLines.length < MAX_RESUME_OVERRIDE_LINES_PER_ACTIVITY;

  return (
    <div className="flex gap-3">
      <div
        className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${
          index === 0 ? "bg-[#094cb2]" : "bg-slate-300"
        }`}
      />
      <div className="flex-1">
        <div className="mb-1 flex items-start justify-between">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-950">{activity.title}</h3>
            {hasOverride && (
              <span className="mt-1 inline-block rounded-full bg-[#eef6ff] px-1.5 py-0.5 text-[10px] font-medium text-[#094cb2]">
                AI 적용
              </span>
            )}
          </div>
          <span className="ml-4 flex-shrink-0 text-xs text-slate-400">{activity.period}</span>
        </div>
        {metaItems.length > 0 && (
          <p className="mb-1 text-[11px] leading-relaxed text-slate-400">
            {metaItems.join(" · ")}
          </p>
        )}
        {hasOverride ? (
          <div className="space-y-2">
            {overrideLines.map((line, lineIndex) => (
              <div key={`${activity.id}-override-line-${lineIndex}`} className="flex gap-2">
                <span className="pt-2 text-xs leading-relaxed text-slate-400">-</span>
                <textarea
                  value={line}
                  onChange={(e) =>
                    onActivityLineOverrideChange(activity.id, lineIndex, e.target.value)
                  }
                  rows={2}
                  aria-label={`${activity.title} 적용 문장 ${lineIndex + 1}`}
                  className="min-h-[44px] flex-1 resize-none overflow-y-auto rounded-lg border border-blue-100 bg-[#eef6ff] px-2 py-1.5 text-xs leading-relaxed text-slate-700 outline-none focus:border-[#094cb2] focus:bg-white"
                />
                {overrideLines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onActivityLineOverrideRemove(activity.id, lineIndex)}
                    className="self-start rounded-lg border border-slate-200 px-2 py-1.5 text-[10px] font-medium text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                  >
                    삭제
                  </button>
                )}
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onActivityLineOverrideAdd(activity.id)}
                disabled={!canAddLine}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-[10px] font-medium text-slate-600 hover:border-blue-200 hover:bg-[#eef6ff] hover:text-[#094cb2] disabled:opacity-50"
              >
                문장 추가
              </button>
              <button
                type="button"
                onClick={() => onActivityLineOverrideClear(activity.id)}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-[10px] font-medium text-slate-500 hover:border-slate-300 hover:bg-slate-50"
              >
                원문 복귀
              </button>
            </div>
          </div>
        ) : (
          bodyLines.length > 0 && (
            <ul className="space-y-1">
              {bodyLines.map((line, lineIndex) => (
                <li
                  key={`${activity.id}-line-${lineIndex}`}
                  className="text-xs leading-relaxed text-slate-600"
                >
                  - {line}
                </li>
              ))}
            </ul>
          )
        )}
        {showSkills && Array.isArray(activity.skills) && activity.skills.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {activity.skills.map((skill, skillIndex) => (
              <span
                key={`${skill}-${skillIndex}`}
                className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500"
              >
                {skill}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ResumeHeaderBlock({
  profile,
  bioInput,
  onBioInputChange,
  onBioSave,
  bioSaving,
  targetJob,
}: {
  profile: ResumeProfile;
  bioInput: string;
  onBioInputChange: (value: string) => void;
  onBioSave: () => Promise<void>;
  bioSaving: boolean;
  targetJob: string;
}) {
  return (
    <div className="flex items-start justify-between border-b border-slate-200 pb-4">
      <div className="flex min-w-0 items-start gap-4">
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
        <div className="min-w-0">
          <h1
            className="mb-1 text-3xl font-bold text-slate-950"
            style={{ fontFamily: "Pretendard, sans-serif" }}
          >
            {profile?.name || "이름을 입력해주세요"}
          </h1>
          <input
            type="text"
            value={bioInput}
            onChange={(e) => onBioInputChange(e.target.value)}
            onBlur={() => void onBioSave()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void onBioSave();
              }
            }}
            placeholder="5년차 마케터 | 브랜드 기획 전문"
            className="mt-0.5 w-full border-b border-transparent bg-transparent text-sm text-slate-500 outline-none focus:border-slate-300"
          />
          {targetJob && <p className="mt-0.5 text-sm text-slate-500">{targetJob}</p>}
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-400">
            {profile?.email && <span>✉ {profile.email}</span>}
            {profile?.phone && <span>☎ {profile.phone}</span>}
          </div>
          {bioSaving && <p className="mt-1 text-[11px] text-slate-400">bio 저장 중...</p>}
        </div>
      </div>
      <p className="shrink-0 text-xs text-slate-400">Seoul, South Korea</p>
    </div>
  );
}

function ResumeSectionTitle({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold tracking-widest text-slate-400">
      {children}
    </p>
  );
}

function ProfessionalProfileBlock({ selfIntro }: { selfIntro: string }) {
  return (
    <div>
      <ResumeSectionTitle>PROFESSIONAL PROFILE</ResumeSectionTitle>
      <p className="mt-2 text-xs leading-relaxed text-slate-600">{selfIntro}</p>
    </div>
  );
}

function ProfileHighlightsBlock({ profile }: { profile: ResumeProfile }) {
  const sections = getResumeProfileHighlightSections(profile);
  if (sections.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-3">
      <ResumeSectionTitle>AWARDS · CERTIFICATIONS · LANGUAGE</ResumeSectionTitle>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {sections.map((section) => (
          <div key={section.key} className="min-w-0">
            <p className="text-[11px] font-bold text-slate-700">{section.title}</p>
            <div className="mt-1 space-y-0.5">
              {section.items.map((item, index) => (
                <p
                  key={`${section.key}-${item}-${index}`}
                  className="text-[11px] leading-5 text-slate-600"
                >
                  {item}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SkillsBlock({ selectedSkillsList }: { selectedSkillsList: string[] }) {
  return (
    <div>
      <ResumeSectionTitle>SKILLS</ResumeSectionTitle>
      <div className="mt-3 flex flex-wrap gap-2">
        {selectedSkillsList.map((skill, index) => (
          <span
            key={`${skill}-${index}`}
            className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
          >
            {skill}
          </span>
        ))}
      </div>
    </div>
  );
}

function CoverLetterQuestionBlock({ question }: { question: string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-bold text-slate-700">{question}</p>
      <div className="flex h-16 items-center justify-center rounded-xl border border-dashed border-slate-200">
        <p className="text-xs text-slate-300">내용을 입력해주세요</p>
      </div>
    </div>
  );
}

function EmptyResumePreviewBlock() {
  return (
    <div className="py-16 text-center text-slate-300">
      <p className="mb-2 text-base">왼쪽에서 항목을 선택하세요.</p>
      <p className="text-sm">경력, 프로젝트, 기술스택 순으로 구성됩니다.</p>
    </div>
  );
}

export function ResumePreviewPane({
  profile,
  bioInput,
  onBioInputChange,
  onBioSave,
  bioSaving,
  targetJob,
  selectedCareerActivities,
  selectedProjectActivities,
  selectedSkillsList,
  selectedQuestions,
  activityLineOverrides,
  onActivityLineOverrideChange,
  onActivityLineOverrideAdd,
  onActivityLineOverrideRemove,
  onActivityLineOverrideClear,
}: ResumePreviewPaneProps) {
  const profileHighlightSections = getResumeProfileHighlightSections(profile);
  const isEmpty =
    selectedCareerActivities.length === 0 &&
    selectedProjectActivities.length === 0 &&
    selectedSkillsList.length === 0 &&
    selectedQuestions.length === 0 &&
    profileHighlightSections.length === 0 &&
    !profile?.self_intro;
  const previewItems: ResumePreviewItem[] = [
    {
      key: "resume-header",
      units: 12,
      node: (
        <ResumeHeaderBlock
          profile={profile}
          bioInput={bioInput}
          onBioInputChange={onBioInputChange}
          onBioSave={onBioSave}
          bioSaving={bioSaving}
          targetJob={targetJob}
        />
      ),
    },
  ];

  if (profile?.self_intro) {
    previewItems.push({
      key: "professional-profile",
      units: Math.max(6, 3 + estimateTextRows(profile.self_intro, 82)),
      node: <ProfessionalProfileBlock selfIntro={profile.self_intro} />,
    });
  }

  if (selectedCareerActivities.length > 0) {
    previewItems.push({
      key: "work-heading",
      units: 2,
      keepWithNext: true,
      node: <ResumeSectionTitle>WORK EXPERIENCE</ResumeSectionTitle>,
    });
    selectedCareerActivities.forEach((activity, index) => {
      previewItems.push({
        key: `career-${activity.id}`,
        units: estimateActivityUnits(activity, false, activityLineOverrides),
        node: (
          <ActivityResumeEntry
            activity={activity}
            index={index}
            activityLineOverrides={activityLineOverrides}
            onActivityLineOverrideChange={onActivityLineOverrideChange}
            onActivityLineOverrideAdd={onActivityLineOverrideAdd}
            onActivityLineOverrideRemove={onActivityLineOverrideRemove}
            onActivityLineOverrideClear={onActivityLineOverrideClear}
          />
        ),
      });
    });
  }

  if (profileHighlightSections.length > 0) {
    previewItems.push({
      key: "profile-highlights",
      units: estimateProfileHighlightUnits(profile),
      node: <ProfileHighlightsBlock profile={profile} />,
    });
  }

  if (selectedProjectActivities.length > 0) {
    previewItems.push({
      key: "project-heading",
      units: 2,
      keepWithNext: true,
      node: <ResumeSectionTitle>KEY EXPERIENCE</ResumeSectionTitle>,
    });
    selectedProjectActivities.forEach((activity, index) => {
      previewItems.push({
        key: `project-${activity.id}`,
        units: estimateActivityUnits(activity, true, activityLineOverrides),
        node: (
          <ActivityResumeEntry
            activity={activity}
            index={index}
            showSkills
            activityLineOverrides={activityLineOverrides}
            onActivityLineOverrideChange={onActivityLineOverrideChange}
            onActivityLineOverrideAdd={onActivityLineOverrideAdd}
            onActivityLineOverrideRemove={onActivityLineOverrideRemove}
            onActivityLineOverrideClear={onActivityLineOverrideClear}
          />
        ),
      });
    });
  }

  if (selectedSkillsList.length > 0) {
    previewItems.push({
      key: "skills",
      units: 4 + Math.ceil(selectedSkillsList.length / 5),
      node: <SkillsBlock selectedSkillsList={selectedSkillsList} />,
    });
  }

  if (selectedQuestions.length > 0) {
    previewItems.push({
      key: "cover-heading",
      units: 2,
      keepWithNext: true,
      node: <ResumeSectionTitle>COVER LETTER</ResumeSectionTitle>,
    });
    selectedQuestions.forEach((question, index) => {
      previewItems.push({
        key: `question-${question}-${index}`,
        units: 6,
        node: <CoverLetterQuestionBlock question={question} />,
      });
    });
  }

  if (isEmpty) {
    previewItems.push({
      key: "empty",
      units: 12,
      node: <EmptyResumePreviewBlock />,
    });
  }

  const pages = paginateResumeItems(previewItems);

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white/82 px-8 py-3 backdrop-blur-sm">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-blue-100 bg-[#eef6ff] px-4 py-2">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-slate-400"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <span className="text-sm text-slate-400">문서 검색...</span>
        </div>
        <div className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
          A4 {pages.length}페이지 예상
        </div>
      </div>

      <div className="flex-1 bg-[#e8edf5] p-8">
        <div className="mx-auto flex w-full max-w-[210mm] flex-col gap-8">
          {pages.map((pageItems, pageIndex) => (
            <section
              key={`a4-page-${pageIndex}`}
              className="relative mx-auto aspect-[210/297] w-[210mm] max-w-full overflow-hidden bg-white shadow-[0_22px_60px_rgba(15,23,42,0.16)] ring-1 ring-slate-200"
            >
              <div className="h-full overflow-hidden px-[14mm] pb-[18mm] pt-[14mm]">
                <div className="space-y-5">
                  {pageItems.map((item) => (
                    <div key={item.key}>{item.node}</div>
                  ))}
                </div>
              </div>
              <div className="absolute bottom-[7mm] right-[14mm] rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                {pageIndex + 1} / {pages.length}
              </div>
              {pageIndex < pages.length - 1 && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#e0621a]" />
              )}
            </section>
          ))}
          <p className="text-center text-xs text-slate-500">
            A4 210 x 297mm 기준의 화면 미리보기입니다. 내용이 길면 다음 페이지로 나뉘어 표시됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
