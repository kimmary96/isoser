// 프로필 확장 정보 로컬 저장 유틸 - DB 스키마 외 필드를 브라우저에 보관
import type { ParsedProfile } from "@/lib/types";

const PROFILE_EXTRA_KEY = "isoser_profile_extra";

export interface ProfileExtraData {
  career: string[];
  education_history: string[];
  awards: string[];
  certifications: string[];
  languages: string[];
  skills: string[];
  self_intro: string;
}

const EMPTY_EXTRA: ProfileExtraData = {
  career: [],
  education_history: [],
  awards: [],
  certifications: [],
  languages: [],
  skills: [],
  self_intro: "",
};

export function getProfileExtra(): ProfileExtraData {
  if (typeof window === "undefined") return EMPTY_EXTRA;
  const raw = window.localStorage.getItem(PROFILE_EXTRA_KEY);
  if (!raw) return EMPTY_EXTRA;

  try {
    const parsed = JSON.parse(raw) as Partial<ProfileExtraData>;
    return {
      career: parsed.career ?? [],
      education_history: parsed.education_history ?? [],
      awards: parsed.awards ?? [],
      certifications: parsed.certifications ?? [],
      languages: parsed.languages ?? [],
      skills: parsed.skills ?? [],
      self_intro: parsed.self_intro ?? "",
    };
  } catch {
    return EMPTY_EXTRA;
  }
}

export function setProfileExtra(value: ProfileExtraData): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PROFILE_EXTRA_KEY, JSON.stringify(value));
}

export function mergeParsedProfileToExtra(profile: ParsedProfile): ProfileExtraData {
  const prev = getProfileExtra();
  return {
    career: profile.career ?? prev.career,
    education_history: profile.education_history ?? prev.education_history,
    awards: profile.awards ?? prev.awards,
    certifications: profile.certifications ?? prev.certifications,
    languages: profile.languages ?? prev.languages,
    skills: profile.skills ?? prev.skills,
    self_intro: profile.self_intro ?? prev.self_intro,
  };
}
