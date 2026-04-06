// 게스트 모드 유틸 - 로그인 없이 QA할 수 있도록 로컬 플래그/목업 데이터 제공
import type { Activity, CoverLetter, Resume } from "@/lib/types";

const GUEST_MODE_KEY = "isoser_guest_mode";
const GUEST_RESUME_KEY = "isoser_guest_resume";
const GUEST_COVER_LETTERS_KEY = "isoser_guest_cover_letters";

export function enableGuestMode(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GUEST_MODE_KEY, "1");
}

export function disableGuestMode(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(GUEST_MODE_KEY);
}

export function isGuestMode(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(GUEST_MODE_KEY) === "1";
}

export function getGuestActivities(): Activity[] {
  const now = new Date().toISOString();
  return [
    {
      id: "guest-activity-1",
      user_id: "guest",
      type: "프로젝트",
      title: "이커머스 추천 API 개발",
      period: "2024.03 ~ 2024.08",
      role: "백엔드 개발자",
      skills: ["Python", "FastAPI", "PostgreSQL"],
      description:
        "추천 모델 결과를 조회하는 API를 설계/구현하고 캐시 전략을 적용해 응답속도를 개선했습니다.",
      is_visible: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: "guest-activity-2",
      user_id: "guest",
      type: "대외활동",
      title: "대학생 IT 동아리 운영",
      period: "2023.01 ~ 2023.12",
      role: "운영진",
      skills: ["커뮤니케이션", "기획", "문서화"],
      description:
        "월간 세미나를 기획하고 운영 프로세스를 정비해 참여율을 높였습니다.",
      is_visible: true,
      created_at: now,
      updated_at: now,
    },
  ];
}

export function saveGuestResume(resume: Resume): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GUEST_RESUME_KEY, JSON.stringify(resume));
}

export function getGuestResume(): Resume | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(GUEST_RESUME_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Resume;
  } catch {
    return null;
  }
}

function defaultGuestCoverLetters(): CoverLetter[] {
  const now = new Date().toISOString();
  return [
    {
      id: "guest-cover-letter-1",
      user_id: "guest",
      title: "백엔드 개발자 지원 동기",
      company_name: "이소서테크",
      job_title: "백엔드 개발자",
      prompt_question: "지원 동기와 입사 후 포부를 작성해 주세요.",
      content:
        "사용자 문제를 구조적으로 해결하는 백엔드 개발에 강점을 갖고 있습니다. 이전 프로젝트에서 API 응답 시간을 개선하며 서비스 체감 품질을 높인 경험이 있습니다. 이소서테크에서도 데이터 흐름을 안정적으로 설계하고, 빠르게 실험 가능한 백엔드 기반을 만드는 데 기여하겠습니다.",
      tags: ["지원동기", "입사후포부"],
      created_at: now,
      updated_at: now,
    },
  ];
}

function loadGuestCoverLetters(): CoverLetter[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(GUEST_COVER_LETTERS_KEY);
  if (!raw) {
    const defaults = defaultGuestCoverLetters();
    window.localStorage.setItem(GUEST_COVER_LETTERS_KEY, JSON.stringify(defaults));
    return defaults;
  }
  try {
    const parsed = JSON.parse(raw) as CoverLetter[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const defaults = defaultGuestCoverLetters();
      window.localStorage.setItem(GUEST_COVER_LETTERS_KEY, JSON.stringify(defaults));
      return defaults;
    }
    return parsed;
  } catch {
    const defaults = defaultGuestCoverLetters();
    window.localStorage.setItem(GUEST_COVER_LETTERS_KEY, JSON.stringify(defaults));
    return defaults;
  }
}

export function getGuestCoverLetters(): CoverLetter[] {
  return loadGuestCoverLetters().sort((a, b) => {
    const left = Date.parse(a.updated_at);
    const right = Date.parse(b.updated_at);
    return right - left;
  });
}

export function getGuestCoverLetterById(id: string): CoverLetter | null {
  const found = loadGuestCoverLetters().find((item) => item.id === id);
  return found ?? null;
}

export function saveGuestCoverLetter(item: CoverLetter): void {
  if (typeof window === "undefined") return;
  const list = loadGuestCoverLetters();
  const idx = list.findIndex((entry) => entry.id === item.id);
  const next = idx >= 0
    ? list.map((entry, index) => (index === idx ? item : entry))
    : [item, ...list];
  window.localStorage.setItem(GUEST_COVER_LETTERS_KEY, JSON.stringify(next));
}

export function deleteGuestCoverLetter(id: string): void {
  if (typeof window === "undefined") return;
  const next = loadGuestCoverLetters().filter((item) => item.id !== id);
  window.localStorage.setItem(GUEST_COVER_LETTERS_KEY, JSON.stringify(next));
}
