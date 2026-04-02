// 메인 대시보드 페이지 - 프로필/활동 카드/확장 이력 정보(DB 저장) 표시
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { getGuestActivities, isGuestMode } from "@/lib/guest";
import { createBrowserClient } from "@/lib/supabase/client";
import type { Activity, Profile } from "@/lib/types";

const EMPTY_PROFILE: Profile = {
  id: "",
  name: null,
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

function toArray(value: string[] | null | undefined): string[] {
  return Array.isArray(value) ? value : [];
}

function toLines(value: string[] | null | undefined): string {
  return toArray(value).join("\n");
}

function fromLines(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function SectionList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-3">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400">저장된 정보가 없습니다.</p>
      ) : (
        <ul className="space-y-2 text-sm text-gray-700">
          {items.map((item, idx) => (
            <li key={`${title}-${idx}`} className="leading-relaxed">• {item}</li>
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

  const [skillsInput, setSkillsInput] = useState("");
  const [careerInput, setCareerInput] = useState("");
  const [educationInput, setEducationInput] = useState("");
  const [awardsInput, setAwardsInput] = useState("");
  const [certsInput, setCertsInput] = useState("");
  const [languagesInput, setLanguagesInput] = useState("");

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
            email: "guest@local",
            phone: "-",
            education: "게스트 모드",
            career: ["게스트 QA 경력"],
            education_history: ["게스트 학력"],
            awards: [],
            certifications: [],
            languages: ["한국어"],
            skills: ["FastAPI", "Next.js"],
            self_intro: "게스트 모드에서 기능을 점검 중입니다.",
          };
          setProfile(guestProfile);
          setActivities(getGuestActivities());
          setCareerInput(toLines(guestProfile.career));
          setEducationInput(toLines(guestProfile.education_history));
          setAwardsInput(toLines(guestProfile.awards));
          setCertsInput(toLines(guestProfile.certifications));
          setLanguagesInput(toLines(guestProfile.languages));
          return;
        }

        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData.user) {
          throw new Error("로그인이 필요합니다.");
        }

        const [{ data: profileRow, error: profileError }, { data: activityRows, error: activityError }] =
          await Promise.all([
            supabase.from("profiles").select("*").eq("id", authData.user.id).maybeSingle(),
            supabase.from("activities").select("*").eq("is_visible", true).order("created_at", { ascending: false }),
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
        };

        setProfile(normalizedProfile);
        setActivities(activityRows || []);

        setCareerInput(toLines(normalizedProfile.career));
        setEducationInput(toLines(normalizedProfile.education_history));
        setAwardsInput(toLines(normalizedProfile.awards));
        setCertsInput(toLines(normalizedProfile.certifications));
        setLanguagesInput(toLines(normalizedProfile.languages));
      } catch (e) {
        setError(e instanceof Error ? e.message : "대시보드 데이터를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [supabase]);

  const addSkill = () => {
    const value = skillsInput.trim();
    if (!value) return;

    const current = toArray(profile.skills);
    if (current.includes(value)) {
      setSkillsInput("");
      return;
    }

    setProfile({ ...profile, skills: [...current, value] });
    setSkillsInput("");
  };

  const removeSkill = (skill: string) => {
    setProfile({
      ...profile,
      skills: toArray(profile.skills).filter((item) => item !== skill),
    });
  };

  const saveProfileExtra = async () => {
    setSaving(true);
    setError(null);

    try {
      const payload = {
        career: fromLines(careerInput),
        education_history: fromLines(educationInput),
        awards: fromLines(awardsInput),
        certifications: fromLines(certsInput),
        languages: fromLines(languagesInput),
        skills: toArray(profile.skills),
        self_intro: profile.self_intro ?? "",
      };

      if (isGuestMode()) {
        setProfile({ ...profile, ...payload });
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        throw new Error("로그인이 필요합니다.");
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", authData.user.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      setProfile({ ...profile, ...payload });
    } catch (e) {
      setError(e instanceof Error ? e.message : "프로필 저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const careerItems = fromLines(careerInput);
  const educationItems = fromLines(educationInput).length > 0
    ? fromLines(educationInput)
    : [profile.education ?? ""].filter(Boolean);
  const awardItems = fromLines(awardsInput);
  const certItems = fromLines(certsInput);
  const languageItems = fromLines(languagesInput);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900">내 프로필</h1>
          <div className="flex gap-2">
            <Link href="/dashboard/onboarding" className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">
              PDF 다시 분석
            </Link>
            <Link href="/dashboard/activities" className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              활동 관리
            </Link>
            <Link href="/dashboard/match" className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              매칭 분석
            </Link>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-gray-500">불러오는 중...</div>
        ) : (
          <>
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-5 lg:col-span-2">
                <h2 className="font-semibold text-gray-900 mb-3">기본 정보</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-700">
                  <p><span className="text-gray-500">이름:</span> {profile.name || "-"}</p>
                  <p><span className="text-gray-500">이메일:</span> {profile.email || "-"}</p>
                  <p><span className="text-gray-500">전화번호:</span> {profile.phone || "-"}</p>
                  <p><span className="text-gray-500">최종 학력:</span> {profile.education || "-"}</p>
                </div>

                <div className="mt-5 space-y-2">
                  <label className="text-sm font-medium text-gray-700">자기소개</label>
                  <textarea
                    value={profile.self_intro ?? ""}
                    onChange={(e) => setProfile({ ...profile, self_intro: e.target.value })}
                    placeholder="자기소개 내용을 입력하세요."
                    rows={4}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400 resize-none"
                  />
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="font-semibold text-gray-900 mb-3">스킬</h2>
                <div className="flex gap-2 mb-3">
                  <input
                    value={skillsInput}
                    onChange={(e) => setSkillsInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addSkill();
                      }
                    }}
                    placeholder="예: FastAPI"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400"
                  />
                  <button onClick={addSkill} className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm">추가</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {toArray(profile.skills).length === 0 ? (
                    <p className="text-sm text-gray-400">스킬이 없습니다.</p>
                  ) : (
                    toArray(profile.skills).map((skill) => (
                      <button
                        key={skill}
                        onClick={() => removeSkill(skill)}
                        className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"
                      >
                        {skill} ×
                      </button>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-2">내 경력 입력</h3>
                <textarea value={careerInput} onChange={(e) => setCareerInput(e.target.value)} rows={6} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400 resize-none" placeholder="줄바꿈으로 여러 항목 입력" />
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-2">학력 입력</h3>
                <textarea value={educationInput} onChange={(e) => setEducationInput(e.target.value)} rows={6} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400 resize-none" placeholder="줄바꿈으로 여러 항목 입력" />
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-2">수상경력 입력</h3>
                <textarea value={awardsInput} onChange={(e) => setAwardsInput(e.target.value)} rows={6} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400 resize-none" placeholder="줄바꿈으로 여러 항목 입력" />
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-2">자격증 입력</h3>
                <textarea value={certsInput} onChange={(e) => setCertsInput(e.target.value)} rows={6} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400 resize-none" placeholder="줄바꿈으로 여러 항목 입력" />
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-2">외국어 입력</h3>
                <textarea value={languagesInput} onChange={(e) => setLanguagesInput(e.target.value)} rows={6} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400 resize-none" placeholder="줄바꿈으로 여러 항목 입력" />
              </div>
            </section>

            <div className="flex justify-end">
              <button
                onClick={saveProfileExtra}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "저장 중..." : "프로필 입력 저장"}
              </button>
            </div>

            <section className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 mb-3">활동 카드</h2>
              {activities.length === 0 ? (
                <p className="text-sm text-gray-400">저장된 활동이 없습니다.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {activities.map((activity) => (
                    <Link
                      key={activity.id}
                      href={`/dashboard/activities/${activity.id}`}
                      className="rounded-xl border border-gray-200 p-4 hover:border-gray-400 transition-colors bg-gray-50"
                    >
                      <p className="text-xs text-gray-500">{activity.type}</p>
                      <p className="font-semibold text-gray-900 mt-1">{activity.title}</p>
                      <p className="text-xs text-gray-500 mt-1">{activity.period || "기간 미입력"}</p>
                      <p className="text-sm text-gray-700 mt-2">{activity.description || "설명 없음"}</p>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <SectionList title="내 경력" items={careerItems} />
              <SectionList title="학력" items={educationItems} />
              <SectionList title="수상경력" items={awardItems} />
              <SectionList title="자격증" items={certItems} />
              <SectionList title="외국어" items={languageItems} />
            </section>
          </>
        )}
      </div>
    </main>
  );
}
