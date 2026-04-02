// 게스트 모드 유틸 - 로그인 없이 QA할 수 있도록 로컬 플래그/목업 데이터 제공
import type { Activity, Resume } from "@/lib/types";

const GUEST_MODE_KEY = "isoser_guest_mode";
const GUEST_RESUME_KEY = "isoser_guest_resume";

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
