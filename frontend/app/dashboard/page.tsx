"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { getGuestActivities, isGuestMode } from "@/lib/guest";
import { createBrowserClient } from "@/lib/supabase/client";
import type { Activity, MatchAnalysisRecord, Profile } from "@/lib/types";

const EMPTY_PROFILE: Profile = {
  id: "",
  name: null,
  bio: null,
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
  period: string;
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
    return { company: "", position: "", period: "" };
  }

  const pipeParts = trimmed.split("|").map((part) => part.trim()).filter(Boolean);
  if (pipeParts.length >= 3) {
    return {
      company: pipeParts[0],
      position: pipeParts[1],
      period: pipeParts.slice(2).join(" | "),
    };
  }

  const slashParts = trimmed.split("/").map((part) => part.trim()).filter(Boolean);
  if (slashParts.length >= 3) {
    return {
      company: slashParts[0],
      position: slashParts[1],
      period: slashParts.slice(2).join(" / "),
    };
  }

  return {
    company: trimmed,
    position: "",
    period: "",
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
      period: activity.period || "",
    });
    if (line) unique.add(line);
  });

  return [...unique];
}

function serializeCareerEntry(entry: CareerEntry): string {
  const company = entry.company.trim();
  const position = entry.position.trim();
  const period = entry.period.trim();

  if (!company && !position && !period) {
    return "";
  }

  if (!position && !period) {
    return company;
  }

  return [company || "-", position || "-", period || "-"].join(" | ");
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

  const linked = activities.filter((activity) => {
    if (!companyKey && !career.period) return false;

    const textBlob = normalizeText(`${activity.title} ${activity.description || ""}`);
    const companyMatched = companyKey.length > 1 && textBlob.includes(companyKey);
    const periodMatched = Boolean(career.period && activity.period && isPeriodOverlapped(career.period, activity.period));

    return companyMatched || periodMatched;
  });

  return [...linked].sort((a, b) => getActivitySortValue(b) - getActivitySortValue(a));
}

function buildCareerCards(careerItems: string[], activities: Activity[]): CareerCard[] {
  // profiles.career(또는 활동 기반 fallback) 구조화 라인으로 카드 구성
  const parsed = careerItems
    .filter(isStructuredCareerLine)
    .map(parseCareerLine)
    .filter((item) => item.company || item.position || item.period);

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
      const endA = parsePeriodRange(a.period)?.end || 0;
      const endB = parsePeriodRange(b.period)?.end || 0;
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
      period: primary.period || "미입력",
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
    setEntries(parsed.length > 0 ? parsed : [{ company: "", position: "", period: "" }]);
  }, [initialItems, open]);

  const updateEntry = (index: number, patch: Partial<CareerEntry>) => {
    setEntries((prev) => prev.map((entry, idx) => (idx === index ? { ...entry, ...patch } : entry)));
  };

  const addEntry = () => {
    setEntries((prev) => [...prev, { company: "", position: "", period: "" }]);
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
          <div key={`career-${idx}`} className="rounded-lg border border-gray-200 p-3">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <input
                value={entry.company}
                onChange={(e) => updateEntry(idx, { company: e.target.value })}
                placeholder="회사/조직"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
              />
              <input
                value={entry.position}
                onChange={(e) => updateEntry(idx, { position: e.target.value })}
                placeholder="직무/포지션"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
              />
              <input
                value={entry.period}
                onChange={(e) => updateEntry(idx, { period: e.target.value })}
                placeholder="기간 (예: 2024.01 ~ 2025.03)"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
              />
            </div>
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => deleteEntry(idx)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
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
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          + 경력 추가
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
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-bold text-gray-900" style={{ fontFamily: "Noto Serif, serif" }}>{title}</h3>
        <PencilButton onClick={onEdit} label={`${title} 수정`} />
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-gray-400">{emptyMessage}</p>
      ) : (
        <ul className="space-y-2 text-sm text-gray-700">
          {items.map((item, idx) => (
            <li key={`${title}-${idx}`} className="rounded-lg bg-gray-50 px-3 py-2 leading-relaxed">
              {item}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function DashboardPage() {
  const supabase = useMemo(() => createBrowserClient(), []);

  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [matchAnalyses, setMatchAnalyses] = useState<MatchAnalysisRecord[]>([]);
  const [editing, setEditing] = useState<EditableSection | null>(null);
  const [activeTab, setActiveTab] = useState<string>("회사경력");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        if (isGuestMode()) {
          const guestProfile: Profile = {
            ...EMPTY_PROFILE,
            id: "guest",
            name: "게스트 사용자",
            bio: "게스트 QA 엔지니어",
            email: "guest@local",
            phone: "-",
            education: "게스트 모드",
            career: ["게스트 회사 | QA 엔지니어 | 2024.01 ~ 현재"],
            education_history: ["게스트 학력"],
            awards: [],
            certifications: [],
            languages: ["한국어"],
            skills: ["FastAPI", "Next.js"],
            self_intro: "게스트 모드에서 기능을 점검 중입니다.",
          };
          setProfile(guestProfile);
          setActivities(getGuestActivities());
          setMatchAnalyses([
            {
              id: "guest-analysis-1",
              user_id: "guest",
              job_title: "QA Engineer",
              job_posting: "QA Engineer 공고",
              total_score: 78,
              grade: "A",
              summary: "테스트 자동화 경험과 협업 역량이 공고와 잘 맞습니다.",
              matched_keywords: ["테스트 자동화", "API 검증", "협업"],
              missing_keywords: ["모바일 QA"],
              recommended_activities: ["guest-activity-1"],
              created_at: new Date().toISOString(),
            },
          ]);
          return;
        }

        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData.user) {
          throw new Error("로그인이 필요합니다.");
        }

        const [
          { data: profileRow, error: profileError },
          { data: activityRows, error: activityError },
          { data: matchRows, error: matchError },
        ] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", authData.user.id).maybeSingle(),
          supabase.from("activities").select("*").eq("is_visible", true).order("created_at", { ascending: false }),
          supabase
            .from("match_analyses")
            .select("*")
            .eq("user_id", authData.user.id)
            .order("created_at", { ascending: false })
            .limit(10),
        ]);

        if (profileError) {
          throw new Error(profileError.message);
        }
        if (activityError) {
          throw new Error(activityError.message);
        }

        const normalizedProfile: Profile = {
          ...EMPTY_PROFILE,
          ...(profileRow ?? {}),
          career: toArray(profileRow?.career),
          education_history: toArray(profileRow?.education_history),
          awards: toArray(profileRow?.awards),
          certifications: toArray(profileRow?.certifications),
          languages: toArray(profileRow?.languages),
          skills: toArray(profileRow?.skills),
          self_intro: profileRow?.self_intro ?? "",
          bio: profileRow?.bio ?? "",
        };

        setProfile(normalizedProfile);
        setActivities(activityRows || []);
        if (matchError) {
          console.warn("match_analyses 조회 실패:", matchError.message);
          setMatchAnalyses([]);
        } else {
          setMatchAnalyses((matchRows as MatchAnalysisRecord[] | null) ?? []);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "대시보드 데이터를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [supabase]);

  const updateProfileSection = async (patch: Partial<Profile>) => {
    setSaving(true);
    setError(null);

    try {
      if (isGuestMode()) {
        setProfile((prev) => ({ ...prev, ...patch }));
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        throw new Error("로그인이 필요합니다.");
      }

      const payload: Record<string, unknown> = {};
      if (patch.career !== undefined) payload.career = patch.career;
      if (patch.education_history !== undefined) payload.education_history = patch.education_history;
      if (patch.awards !== undefined) payload.awards = patch.awards;
      if (patch.certifications !== undefined) payload.certifications = patch.certifications;
      if (patch.languages !== undefined) payload.languages = patch.languages;
      if (patch.skills !== undefined) payload.skills = patch.skills;
      if (patch.self_intro !== undefined) payload.self_intro = patch.self_intro;
      if (patch.bio !== undefined) payload.bio = patch.bio;

      const { error: updateError } = await supabase.from("profiles").update(payload).eq("id", authData.user.id);
      if (updateError) {
        throw new Error(updateError.message);
      }

      setProfile((prev) => ({ ...prev, ...patch }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 중 오류가 발생했습니다.");
      throw e;
    } finally {
      setSaving(false);
    }
  };

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
    <div className="p-8">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <section className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "Noto Serif, serif" }}>내 이력 완성도</h2>
            <div className="flex flex-col items-end gap-2">
              <Link href="/dashboard/onboarding" className="text-white rounded-xl px-6 py-2.5 text-sm font-semibold" style={{ background: "linear-gradient(135deg, #094cb2, #3b82f6)" }}>
                기존 이력서로 한번에 채우기
              </Link>
              <p className="text-2xl font-bold text-blue-600">{completionScore}%</p>
            </div>
          </div>
          <div className="mt-4 h-2 w-full rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full transition-all duration-500"
              style={{ width: `${completionScore}%`, backgroundColor: "#094cb2" }}
            />
          </div>
        </section>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {loading ? (
          <div className="rounded-2xl bg-white p-8 text-gray-500 shadow-sm">불러오는 중...</div>
        ) : (
          <>
            <div className="flex gap-6 mb-6">
              <div className="w-56 flex-shrink-0">
                <div className="bg-gray-700 rounded-2xl overflow-hidden relative h-[200px]">
                  {profileAny.avatar_url ? (
                    <img src={profileAny.avatar_url} alt="profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gray-600" />
                  )}
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60">
                    <p className="text-white font-bold text-lg leading-tight">{profile.name || "사용자"}</p>
                    <p className="text-gray-300 text-sm">{profileAny.bio || "직무를 입력해주세요"}</p>
                  </div>
                </div>
              </div>

              <div className="flex-1">
                <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-500">자기소개</p>
                    <button onClick={() => setEditing("self_intro")} className="text-gray-400 hover:text-gray-600 text-xs">편집</button>
                  </div>
                  <p className="text-gray-700 text-sm leading-relaxed mb-3">
                    {profile.self_intro ? profile.self_intro : "자기소개를 생성해보세요."}
                  </p>
                  {!profile.self_intro && (
                    <div className="outline outline-1 outline-gray-200/20 rounded-xl p-3 text-center">
                      <p className="text-gray-400 text-sm mb-2">자기소개 생성하기</p>
                      <button className="outline outline-1 outline-gray-200/20 rounded-lg px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
                        생성하기
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex gap-4 text-sm text-gray-500 flex-wrap">
                  {profile.phone && <span>📞 {profile.phone}</span>}
                  {profile.email && <span>✉️ {profile.email}</span>}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-bold text-sm text-gray-900" style={{ fontFamily: "Noto Serif, serif" }}>Skills</p>
                  <button onClick={() => setEditing("skills")} className="text-gray-400 hover:text-gray-600 text-xs">편집</button>
                </div>
                <div className="space-y-3">
                  {toArray(profile.skills).slice(0, 5).map((skill, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-700">{skill}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full">
                        <div className="h-1.5 bg-gray-900 rounded-full" style={{ width: "80%" }} />
                      </div>
                    </div>
                  ))}
                  {toArray(profile.skills).length === 0 && (
                    <p className="text-gray-400 text-xs">스킬을 추가해주세요.</p>
                  )}
                </div>
              </div>
            </div>

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
                        activeTab === tab.type ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-100"
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
                  onClick={() => setEditing("career")}
                  className="flex items-center gap-1 px-4 py-2 rounded-full text-sm text-gray-500 bg-white hover:bg-gray-100"
                >
                  ⚙ 활동 관리
                </button>
              </div>

              <div className="flex gap-4 overflow-x-auto pb-2">
                {tabActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex-shrink-0 w-56 bg-gray-100 rounded-2xl overflow-hidden cursor-pointer hover:bg-gray-200 transition-all"
                    style={{ height: "220px" }}
                  >
                    <div className="h-28 bg-gray-300 flex items-center justify-center">
                      <span className="text-gray-400 text-2xl">🖼</span>
                    </div>
                    <div className="p-3">
                      <p className="text-xs text-gray-400 mb-1">{activity.period}</p>
                      <p className="text-sm font-bold text-gray-900 line-clamp-2">{activity.title}</p>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{activity.description}</p>
                    </div>
                  </div>
                ))}
                <div
                  className="flex-shrink-0 w-24 flex flex-col items-center justify-center gap-2 cursor-pointer text-gray-400 hover:text-gray-600"
                  style={{ height: "220px" }}
                >
                  <span className="text-2xl">+</span>
                  <span className="text-xs">활동 추가</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-6">
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900" style={{ fontFamily: "Noto Serif, serif" }}>🗂 경력</h3>
                  <button onClick={() => setEditing("career")} className="text-gray-400 hover:text-gray-600 text-xs">편집</button>
                </div>
                {careerCards.length === 0 ? (
                  <p className="text-gray-400 text-sm">저장된 경력이 없습니다.</p>
                ) : (
                  careerCards.map((card, i) => (
                    <div key={i} className="mb-4">
                      <div className="flex justify-between items-start mb-1">
                        <div>
                          <p className="font-bold text-sm text-gray-900">{card.company}</p>
                          <p className="text-xs text-gray-500">{card.position}</p>
                        </div>
                        <p className="text-xs text-gray-400 flex-shrink-0 ml-2">{card.period}</p>
                      </div>
                      <div className="outline outline-1 outline-gray-200/20 pl-3 space-y-1 mt-2 rounded-lg">
                        {card.activities.map((act, j) => (
                          <p key={j} className="text-xs text-gray-600">- {act.title}</p>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <ReadonlyListSection
                  title="🎓 학력"
                  items={educationItems}
                  emptyMessage="학력을 입력해주세요."
                  onEdit={() => setEditing("education_history")}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6 mb-6">
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <ReadonlyListSection
                  title="🏆 수상경력"
                  items={awardItems}
                  emptyMessage="수상 경력을 입력하세요."
                  onEdit={() => setEditing("awards")}
                />
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <ReadonlyListSection
                  title="📋 자격증"
                  items={certItems}
                  emptyMessage="자격증을 입력하세요."
                  onEdit={() => setEditing("certifications")}
                />
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <ReadonlyListSection
                  title="🌐 외국어"
                  items={languageItems}
                  emptyMessage="외국어를 입력하세요."
                  onEdit={() => setEditing("languages")}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mb-8">
              <button className="flex items-center gap-2 outline outline-1 outline-gray-200/20 rounded-xl px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                ⚙ 설정
              </button>
              <button className="flex items-center gap-2 bg-gray-900 text-white rounded-xl px-5 py-2 text-sm font-medium hover:bg-gray-700">
                프로필 링크 공유하기
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
    </div>
  );
}
