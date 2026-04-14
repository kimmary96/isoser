"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { getGuestActivities, isGuestMode } from "@/lib/guest";
import type { Activity, MatchAnalysisRecord, Profile } from "@/lib/types";
import { useProfilePage } from "./_hooks/use-profile-page";
import { ProfileCompletionCard } from "./_components/profile-completion-card";
import { ProfileEditModal } from "./_components/profile-edit-modal";
import { ProfileHeroSection } from "./_components/profile-hero-section";

const EMPTY_PROFILE: Profile = {
  id: "",
  name: null,
  bio: null,
  portfolio_url: null,
  email: null,
  phone: null,
  education: null,
  career: [],
  education_history: [],
  awards: [],
  certifications: [],
  languages: [],
  skills: [],
  self_intro: "",
  created_at: "",
  updated_at: "",
};

type EditableSection = "career" | "education_history" | "awards" | "certifications" | "languages" | "skills" | "self_intro";
type CareerEntry = {
  company: string;
  position: string;
  start: string;
  end: string;
};

type CareerCard = {
  company: string;
  position: string;
  period: string;
  activities: Activity[];
};

function toPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ko-KR");
}

function toArray(value: string[] | null | undefined): string[] {
  return Array.isArray(value) ? value : [];
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, "").toLowerCase();
}

function parseCareerLine(line: string): CareerEntry {
  const trimmed = line.trim();
  if (!trimmed) {
    return { company: "", position: "", start: "", end: "" };
  }

  const pipeParts = trimmed.split("|").map((part) => part.trim()).filter(Boolean);
  if (pipeParts.length >= 4) {
    return {
      company: pipeParts[0],
      position: pipeParts[1],
      start: pipeParts[2],
      end: pipeParts[3],
    };
  }

  if (pipeParts.length >= 3) {
    const [start, end] = splitPeriod(pipeParts.slice(2).join(" | "));
    return {
      company: pipeParts[0],
      position: pipeParts[1],
      start,
      end,
    };
  }

  const slashParts = trimmed.split("/").map((part) => part.trim()).filter(Boolean);
  if (slashParts.length >= 3) {
    const [start, end] = splitPeriod(slashParts.slice(2).join(" / "));
    return {
      company: slashParts[0],
      position: slashParts[1],
      start,
      end,
    };
  }

  return {
    company: trimmed,
    position: "",
    start: "",
    end: "",
  };
}

function isStructuredCareerLine(line: string): boolean {
  const text = line.trim();
  if (!text) return false;
  const hasSeparator = text.includes("|") || text.includes("/");
  const hasDateToken = /\d{4}(?:[./-]\d{1,2})?/.test(text) || /현재|present|now/i.test(text);
  return hasSeparator || hasDateToken;
}

function getCareerItemsFromActivities(activities: Activity[]): string[] {
  const careerActivities = activities
    .filter((activity) => activity.type === "회사경력")
    .sort((a, b) => getActivitySortValue(b) - getActivitySortValue(a));

  const unique = new Set<string>();
  careerActivities.forEach((activity) => {
    const line = serializeCareerEntry({
      company: activity.title || "",
      position: activity.role || "",
      ...toCareerPeriodParts(activity.period || ""),
    });
    if (line) unique.add(line);
  });

  return [...unique];
}

function serializeCareerEntry(entry: CareerEntry): string {
  const company = entry.company.trim();
  const position = entry.position.trim();
  const start = entry.start.trim();
  const end = entry.end.trim();

  if (!company && !position && !start && !end) {
    return "";
  }

  if (!position && !start && !end) {
    return company;
  }

  return [company || "-", position || "-", start || "-", end || "-"].join(" | ");
}

function splitPeriod(periodText: string): [string, string] {
  const normalized = periodText.replace(/–|—|-/g, "~");
  const parts = normalized.split("~").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return ["", ""];
  if (parts.length === 1) return [parts[0], ""];
  return [parts[0], parts[1]];
}

function toCareerPeriodParts(periodText: string): Pick<CareerEntry, "start" | "end"> {
  const [start, end] = splitPeriod(periodText);
  return { start, end };
}

function formatCareerPeriod(entry: CareerEntry): string {
  const start = entry.start.trim();
  const end = entry.end.trim();
  if (!start && !end) return "";
  if (!end) return start;
  return `${start} ~ ${end}`;
}

function parsePeriodRange(periodText: string): { start: number; end: number } | null {
  const normalized = periodText.replace(/~|–|—|-/g, "~");
  const segments = normalized.split("~").map((segment) => segment.trim()).filter(Boolean);

  const parsePoint = (value: string): number | null => {
    if (!value) return null;
    if (/현재|present|now/i.test(value)) return Number.MAX_SAFE_INTEGER;

    const match = value.match(/(\d{4})(?:[.\/-]?(\d{1,2}))?/);
    if (!match) return null;
    const year = Number(match[1]);
    const month = match[2] ? Number(match[2]) : 1;
    if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
    return year * 100 + Math.max(1, Math.min(month, 12));
  };

  if (segments.length === 1) {
    const point = parsePoint(segments[0]);
    return point ? { start: point, end: point } : null;
  }

  const start = parsePoint(segments[0]);
  const end = parsePoint(segments[1]);
  if (!start || !end) return null;
  return { start, end };
}

function getActivitySortValue(activity: Activity): number {
  const period = parsePeriodRange(activity.period || "");
  if (period) return period.end;

  const createdAt = Date.parse(activity.created_at);
  if (Number.isFinite(createdAt)) return createdAt;

  return 0;
}

function isPeriodOverlapped(a: string, b: string): boolean {
  const rangeA = parsePeriodRange(a);
  const rangeB = parsePeriodRange(b);
  if (!rangeA || !rangeB) return false;
  return rangeA.start <= rangeB.end && rangeB.start <= rangeA.end;
}

function getLinkedActivities(career: CareerEntry, activities: Activity[]): Activity[] {
  const companyKey = normalizeText(career.company);
  const periodText = formatCareerPeriod(career);

  const linked = activities.filter((activity) => {
    if (!companyKey && !periodText) return false;

    const textBlob = normalizeText(`${activity.title} ${activity.description || ""}`);
    const companyMatched = companyKey.length > 1 && textBlob.includes(companyKey);
    const periodMatched = Boolean(periodText && activity.period && isPeriodOverlapped(periodText, activity.period));

    return companyMatched || periodMatched;
  });

  return [...linked].sort((a, b) => getActivitySortValue(b) - getActivitySortValue(a));
}

function buildCareerCards(careerItems: string[], activities: Activity[]): CareerCard[] {
  // profiles.career(또는 활동 기반 fallback) 구조화 라인으로 카드 구성
  const parsed = careerItems
    .filter(isStructuredCareerLine)
    .map(parseCareerLine)
    .filter((item) => item.company || item.position || item.start || item.end);

  if (parsed.length === 0) return [];

  const grouped = new Map<string, CareerEntry[]>();
  parsed.forEach((entry) => {
    const key = normalizeText(entry.company || "미분류");
    const list = grouped.get(key) || [];
    list.push(entry);
    grouped.set(key, list);
  });

  const manualCards: CareerCard[] = [];

  grouped.forEach((entries) => {
    const sortedEntries = [...entries].sort((a, b) => {
      const endA = parsePeriodRange(formatCareerPeriod(a))?.end || 0;
      const endB = parsePeriodRange(formatCareerPeriod(b))?.end || 0;
      return endB - endA;
    });

    const primary = sortedEntries[0];
    const linked = new Map<string, Activity>();

    sortedEntries.forEach((entry) => {
      getLinkedActivities(entry, activities).forEach((activity) => {
        linked.set(activity.id, activity);
      });
    });

    const linkedActivities = [...linked.values()].sort(
      (a, b) => getActivitySortValue(b) - getActivitySortValue(a)
    );

    manualCards.push({
      company: primary.company || "미입력",
      position: primary.position || "미입력",
      period: formatCareerPeriod(primary) || "미입력",
      activities: linkedActivities,
    });
  });

  return manualCards.sort((a, b) => {
    const endA = parsePeriodRange(a.period)?.end || 0;
    const endB = parsePeriodRange(b.period)?.end || 0;
    return endB - endA;
  });
}

function PencilButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700"
      aria-label={label}
      title={label}
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 11l6-6 3 3-6 6H9v-3z" />
      </svg>
    </button>
  );
}

function ModalFrame({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl rounded-xl border border-gray-200 bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="닫기"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function ListEditorModal({
  open,
  title,
  initialItems,
  onClose,
  onSave,
  placeholder,
  saving,
}: {
  open: boolean;
  title: string;
  initialItems: string[];
  onClose: () => void;
  onSave: (items: string[]) => Promise<void>;
  placeholder: string;
  saving: boolean;
}) {
  const [items, setItems] = useState<string[]>(initialItems);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems, open]);

  const updateItem = (index: number, value: string) => {
    setItems((prev) => prev.map((item, idx) => (idx === index ? value : item)));
  };

  const deleteItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const addItem = () => {
    setItems((prev) => [...prev, ""]);
  };

  const handleSave = async () => {
    const cleaned = items.map((item) => item.trim()).filter(Boolean);
    await onSave(cleaned);
    onClose();
  };

  return (
    <ModalFrame open={open} title={title} onClose={onClose}>
      <div className="space-y-3">
        {items.length === 0 && <p className="text-sm text-gray-400">등록된 항목이 없습니다.</p>}
        {items.map((item, idx) => (
          <div key={`${title}-${idx}`} className="flex gap-2">
            <input
              value={item}
              onChange={(e) => updateItem(idx, e.target.value)}
              placeholder={placeholder}
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
            />
            <button
              type="button"
              onClick={() => deleteItem(idx)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              삭제
            </button>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={addItem}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          + 항목 추가
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </ModalFrame>
  );
}

function CareerEditorModal({
  open,
  initialItems,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  initialItems: string[];
  onClose: () => void;
  onSave: (items: string[]) => Promise<void>;
  saving: boolean;
}) {
  const [entries, setEntries] = useState<CareerEntry[]>([]);

  useEffect(() => {
    const parsed = initialItems.map(parseCareerLine);
    setEntries(parsed.length > 0 ? parsed : [{ company: "", position: "", start: "", end: "" }]);
  }, [initialItems, open]);

  const updateEntry = (index: number, patch: Partial<CareerEntry>) => {
    setEntries((prev) => prev.map((entry, idx) => (idx === index ? { ...entry, ...patch } : entry)));
  };

  const addEntry = () => {
    setEntries((prev) => [...prev, { company: "", position: "", start: "", end: "" }]);
  };

  const deleteEntry = (index: number) => {
    setEntries((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSave = async () => {
    const serialized = entries
      .map(serializeCareerEntry)
      .map((line) => line.trim())
      .filter(Boolean);

    await onSave(serialized);
    onClose();
  };

  return (
    <ModalFrame open={open} title="경력 수정" onClose={onClose}>
      <div className="space-y-3">
        {entries.map((entry, idx) => (
          <div key={`career-${idx}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.1fr_1.9fr_auto] lg:items-end">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">재직 기간</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={entry.start}
                    onChange={(e) => updateEntry(idx, { start: e.target.value })}
                    placeholder="2024.09"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                  />
                  <input
                    value={entry.end}
                    onChange={(e) => updateEntry(idx, { end: e.target.value })}
                    placeholder="2025.12 또는 현재"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">회사 정보</label>
                  <input
                    value={entry.company}
                    onChange={(e) => updateEntry(idx, { company: e.target.value })}
                    placeholder="회사명"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">직무명</label>
                  <input
                    value={entry.position}
                    onChange={(e) => updateEntry(idx, { position: e.target.value })}
                    placeholder="Game Designer/PM"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => deleteEntry(idx)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 hover:bg-slate-100"
              >
                삭제
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={addEntry}
          className="rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          + 추가하기
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </ModalFrame>
  );
}

function ReadonlyListSection({
  title,
  items,
  onEdit,
  emptyMessage,
}: {
  title: string;
  items: string[];
  onEdit: () => void;
  emptyMessage: string;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold tracking-tight text-slate-950">{title}</h3>
        <PencilButton onClick={onEdit} label={`${title} 수정`} />
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-slate-400">{emptyMessage}</p>
      ) : (
        <ul className="space-y-2 text-sm text-slate-700">
          {items.map((item, idx) => (
            <li key={`${title}-${idx}`} className="rounded-2xl bg-slate-50 px-3 py-3 leading-relaxed">
              {item}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [editing, setEditing] = useState<EditableSection | null>(null);
  const [activeTab, setActiveTab] = useState<string>("회사경력");
  const {
    profile,
    activities,
    matchAnalyses,
    loading,
    saving,
    error,
    setError,
    updateProfileSection,
    isProfileModalOpen,
    setIsProfileModalOpen,
    profileModalSaving,
    profileNameInput,
    setProfileNameInput,
    profileBioInput,
    setProfileBioInput,
    profileEmailInput,
    setProfileEmailInput,
    profilePhoneInput,
    setProfilePhoneInput,
    profilePortfolioUrlInput,
    setProfilePortfolioUrlInput,
    avatarPreviewUrl,
    fileInputRef,
    handleAvatarFileChange,
    handleSaveProfileModal,
  } = useProfilePage();

  const rawCareerItems = toArray(profile.career);
  const structuredCareerItems = rawCareerItems.filter(isStructuredCareerLine);
  const derivedCareerItems = getCareerItemsFromActivities(activities);
  const careerItems = structuredCareerItems.length > 0 ? structuredCareerItems : derivedCareerItems;
  const educationItems =
    toArray(profile.education_history).length > 0
      ? toArray(profile.education_history)
      : [profile.education ?? ""].filter(Boolean);
  const awardItems = toArray(profile.awards);
  const certItems = toArray(profile.certifications);
  const languageItems = toArray(profile.languages);
  const skillItems = toArray(profile.skills);
  const careerCards = buildCareerCards(careerItems, activities);
  const tabs = [
    { label: "회사 프로젝트", type: "회사경력" },
    { label: "개인 프로젝트", type: "개인프로젝트" },
    { label: "대외 활동", type: "대외활동" },
    { label: "학생 활동", type: "학생활동" },
  ];
  const tabActivities = activities.filter((a) => {
    const activityType = a.type as string;
    return activeTab === "개인프로젝트"
      ? activityType === "프로젝트" || activityType === "개인프로젝트"
      : activityType === activeTab;
  });
  const recommendedRate =
    matchAnalyses.length > 0
      ? matchAnalyses.filter((item) => item.total_score >= 75).length / matchAnalyses.length
      : 0;
  const recentMatchAnalyses = matchAnalyses.slice(0, 3);
  const completionScore = useMemo(() => {
    let score = 0;
    if (!profile) return 0;

    const profileAny = profile as Profile & {
      avatar_url?: string | null;
      bio?: string | null;
      education?: string[] | string | null;
    };

    if (profileAny.avatar_url) score += 10;
    if (profile.name) score += 10;
    if (profile.email) score += 10;
    if (profile.phone) score += 10;
    if (profileAny.bio || profile.self_intro) score += 10;
    if (toArray(profile.skills).length > 0) score += 10;
    if (toArray(profile.career).length > 0) score += 10;

    const educationSource = Array.isArray(profileAny.education)
      ? profileAny.education
      : [profileAny.education ?? ""].filter(Boolean);
    if (toArray(educationSource).length > 0) score += 10;

    const activityCount = activities.length;
    if (activityCount >= 2) score += 20;
    else if (activityCount === 1) score += 10;

    return Math.min(score, 100);
  }, [profile, activities]);
  const profileAny = profile as Profile & { avatar_url?: string | null };

  return (
    <div className="min-h-screen bg-[#f3f6fb] px-6 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <ProfileCompletionCard completionScore={completionScore} />

        {error && <p className="text-sm text-red-600">{error}</p>}

        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-slate-500 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">불러오는 중...</div>
        ) : (
          <>
            <ProfileHeroSection
              profile={profile as Profile & { avatar_url?: string | null; portfolio_url?: string | null }}
              skillItems={skillItems}
              onOpenProfileModal={() => setIsProfileModalOpen(true)}
              onEditSelfIntro={() => setEditing("self_intro")}
              onEditSkills={() => setEditing("skills")}
            />

            <div className="mb-6">
              <div className="flex gap-2 mb-4 flex-wrap">
                {tabs.map((tab) => {
                  const count = activities.filter((a) => {
                    const activityType = a.type as string;
                    return tab.type === "개인프로젝트"
                      ? activityType === "프로젝트" || activityType === "개인프로젝트"
                      : activityType === tab.type;
                  }).length;
                  return (
                    <button
                      key={tab.type}
                      onClick={() => setActiveTab(tab.type)}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                        activeTab === tab.type ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {tab.label}
                      <span className={`text-xs ${activeTab === tab.type ? "text-gray-300" : "text-gray-400"}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => router.push("/dashboard/activities")}
                  className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500 hover:bg-slate-50"
                >
                  ⚙ 활동 관리
                </button>
              </div>

              <div className="flex gap-4 overflow-x-auto pb-2">
                {tabActivities.map((activity) => (
                  <div
                    key={activity.id}
                    onClick={() => router.push(`/dashboard/activities/${activity.id}`)}
                    className="flex-shrink-0 w-56 overflow-hidden rounded-3xl border border-slate-200 bg-white cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(15,23,42,0.08)]"
                    style={{ height: "220px" }}
                  >
                    <div className="flex h-28 items-center justify-center bg-[linear-gradient(135deg,#dbeafe,#e2e8f0)]">
                      <span className="text-2xl text-slate-400">🖼</span>
                    </div>
                    <div className="p-3">
                      <p className="mb-1 text-xs text-slate-400">{activity.period}</p>
                      <p className="line-clamp-2 text-sm font-semibold text-slate-900">{activity.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">{activity.description}</p>
                    </div>
                  </div>
                ))}
                <div
                  onClick={() => router.push("/dashboard/activities/new")}
                  className="flex-shrink-0 flex w-24 flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-slate-300 bg-white cursor-pointer text-slate-400 hover:text-slate-600"
                  style={{ height: "220px" }}
                >
                  <span className="text-2xl">+</span>
                  <span className="text-xs">활동 추가</span>
                </div>
              </div>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-6">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold tracking-tight text-slate-950">🗂 경력</h3>
                  <PencilButton onClick={() => setEditing("career")} label="경력 수정" />
                </div>
                {careerCards.length === 0 ? (
                  <p className="text-sm text-slate-400">저장된 경력이 없습니다.</p>
                ) : (
                  careerCards.map((card, i) => (
                    <div key={i} className="mb-4">
                      <div className="flex justify-between items-start mb-1">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{card.company}</p>
                          <p className="text-xs text-slate-500">{card.position}</p>
                        </div>
                        <p className="ml-2 shrink-0 text-xs text-slate-400">{card.period}</p>
                      </div>
                      <div className="mt-2 space-y-1 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        {card.activities.map((act, j) => (
                          <p key={j} className="text-xs text-slate-600">- {act.title}</p>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
                <ReadonlyListSection
                  title="🎓 학력"
                  items={educationItems}
                  emptyMessage="학력을 입력해주세요."
                  onEdit={() => setEditing("education_history")}
                />
              </div>
            </div>

            <div className="mb-6 grid grid-cols-3 gap-6">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
                <ReadonlyListSection
                  title="🏆 수상경력"
                  items={awardItems}
                  emptyMessage="수상 경력을 입력하세요."
                  onEdit={() => setEditing("awards")}
                />
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
                <ReadonlyListSection
                  title="📋 자격증"
                  items={certItems}
                  emptyMessage="자격증을 입력하세요."
                  onEdit={() => setEditing("certifications")}
                />
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
                <ReadonlyListSection
                  title="🌐 외국어"
                  items={languageItems}
                  emptyMessage="외국어를 입력하세요."
                  onEdit={() => setEditing("languages")}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mb-8">
              <button className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
                ⚙ 설정
              </button>
              <button
                type="button"
                onClick={() => {
                  const portfolioUrl = (profile as Profile & { portfolio_url?: string | null }).portfolio_url;
                  if (portfolioUrl) {
                    window.open(portfolioUrl, "_blank", "noopener,noreferrer");
                    return;
                  }
                  setIsProfileModalOpen(true);
                }}
                className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                {(profile as Profile & { portfolio_url?: string | null }).portfolio_url ? "포트폴리오 링크 열기" : "포트폴리오 링크 설정"}
              </button>
            </div>
          </>
        )}
      </div>

      <CareerEditorModal
        open={editing === "career"}
        initialItems={careerItems}
        saving={saving}
        onClose={() => setEditing(null)}
        onSave={async (items) => updateProfileSection({ career: items })}
      />

      <ListEditorModal
        open={editing === "education_history"}
        title="학력 수정"
        initialItems={educationItems}
        placeholder="학력 항목 입력"
        saving={saving}
        onClose={() => setEditing(null)}
        onSave={async (items) => updateProfileSection({ education_history: items })}
      />

      <ListEditorModal
        open={editing === "awards"}
        title="수상 수정"
        initialItems={awardItems}
        placeholder="수상 항목 입력"
        saving={saving}
        onClose={() => setEditing(null)}
        onSave={async (items) => updateProfileSection({ awards: items })}
      />

      <ListEditorModal
        open={editing === "certifications"}
        title="자격증 수정"
        initialItems={certItems}
        placeholder="자격증 항목 입력"
        saving={saving}
        onClose={() => setEditing(null)}
        onSave={async (items) => updateProfileSection({ certifications: items })}
      />

      <ListEditorModal
        open={editing === "skills"}
        title="스킬 수정"
        initialItems={skillItems}
        placeholder="스킬 입력"
        saving={saving}
        onClose={() => setEditing(null)}
        onSave={async (items) => updateProfileSection({ skills: items })}
      />

      <ListEditorModal
        open={editing === "languages"}
        title="외국어 수정"
        initialItems={languageItems}
        placeholder="외국어 항목 입력"
        saving={saving}
        onClose={() => setEditing(null)}
        onSave={async (items) => updateProfileSection({ languages: items })}
      />

      <ListEditorModal
        open={editing === "self_intro"}
        title="자기소개 수정"
        initialItems={[profile.self_intro || ""]}
        placeholder="자기소개 입력"
        saving={saving}
        onClose={() => setEditing(null)}
        onSave={async (items) => updateProfileSection({ self_intro: items[0] ?? "" })}
      />

      <ProfileEditModal
        open={isProfileModalOpen}
        avatarPreviewUrl={avatarPreviewUrl}
        fileInputRef={fileInputRef}
        onAvatarFileChange={handleAvatarFileChange}
        profileNameInput={profileNameInput}
        onProfileNameInputChange={setProfileNameInput}
        profileBioInput={profileBioInput}
        onProfileBioInputChange={setProfileBioInput}
        profileEmailInput={profileEmailInput}
        onProfileEmailInputChange={setProfileEmailInput}
        profilePhoneInput={profilePhoneInput}
        onProfilePhoneInputChange={setProfilePhoneInput}
        profilePortfolioUrlInput={profilePortfolioUrlInput}
        onProfilePortfolioUrlInputChange={setProfilePortfolioUrlInput}
        profileModalSaving={profileModalSaving}
        onClose={() => setIsProfileModalOpen(false)}
        onSave={handleSaveProfileModal}
      />
    </div>
  );
}
