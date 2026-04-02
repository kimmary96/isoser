// 메인 대시보드 페이지 - 프로필/활동 카드/확장 이력 정보 표시
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { getGuestActivities, isGuestMode } from "@/lib/guest";
import { getProfileExtra, setProfileExtra, type ProfileExtraData } from "@/lib/profile_extra";
import { createBrowserClient } from "@/lib/supabase/client";
import type { Activity, Profile } from "@/lib/types";

const EMPTY_PROFILE: Profile = {
  id: "",
  name: null,
  email: null,
  phone: null,
  education: null,
  created_at: "",
  updated_at: "",
};

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
  const [extra, setExtra] = useState<ProfileExtraData>(getProfileExtra());

  const [skillsInput, setSkillsInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        if (isGuestMode()) {
          setProfile({
            ...EMPTY_PROFILE,
            id: "guest",
            name: "게스트 사용자",
            email: "guest@local",
            phone: "-",
            education: "게스트 모드",
          });
          setActivities(getGuestActivities());
          setExtra(getProfileExtra());
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

        if (profileRow) {
          setProfile(profileRow);
        }
        setActivities(activityRows || []);
        setExtra(getProfileExtra());
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
    if (extra.skills.includes(value)) {
      setSkillsInput("");
      return;
    }
    setExtra({ ...extra, skills: [...extra.skills, value] });
    setSkillsInput("");
  };

  const removeSkill = (skill: string) => {
    setExtra({ ...extra, skills: extra.skills.filter((item) => item !== skill) });
  };

  const saveExtra = async () => {
    setSaving(true);
    try {
      setProfileExtra(extra);
    } finally {
      setSaving(false);
    }
  };

  const careerItems = extra.career;
  const educationItems = extra.education_history.length > 0 ? extra.education_history : [profile.education ?? ""];
  const awardItems = extra.awards;
  const certItems = extra.certifications;
  const languageItems = extra.languages;

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
                    value={extra.self_intro}
                    onChange={(e) => setExtra({ ...extra, self_intro: e.target.value })}
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
                  {extra.skills.length === 0 ? (
                    <p className="text-sm text-gray-400">스킬이 없습니다.</p>
                  ) : (
                    extra.skills.map((skill) => (
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
                <button
                  onClick={saveExtra}
                  disabled={saving}
                  className="mt-4 w-full px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "저장 중..." : "프로필 입력 저장"}
                </button>
              </div>
            </section>

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
                      <p className="text-sm text-gray-700 mt-2 ">{activity.description || "설명 없음"}</p>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <SectionList title="내 경력" items={careerItems} />
              <SectionList title="학력" items={educationItems.filter(Boolean)} />
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
