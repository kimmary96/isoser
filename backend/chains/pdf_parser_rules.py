# Shared rule tables for PDF resume parsing.
from dataclasses import dataclass

ALLOWED_ACTIVITY_TYPES = {"회사경력", "프로젝트", "대외활동", "학생활동"}

ACTIVITY_TYPE_ALIASES = {
    "인턴": "회사경력",
    "경력": "회사경력",
    "업무경험": "회사경력",
    "직무경험": "회사경력",
    "work": "회사경력",
    "experience": "회사경력",
    "프로젝트 경험": "프로젝트",
    "project": "프로젝트",
    "활동": "대외활동",
    "동아리": "대외활동",
    "봉사": "대외활동",
    "contest": "대외활동",
    "competition": "대외활동",
    "school": "학생활동",
    "학내활동": "학생활동",
    "학술활동": "학생활동",
}

CAREER_SECTION_HEADERS = {
    "career",
    "work experience",
    "experience",
    "professional experience",
    "employment",
    "경력",
    "경력사항",
    "재직경험",
}

NON_CAREER_SECTION_HEADERS = {
    "education",
    "educate",
    "skills",
    "skill",
    "projects",
    "project",
    "awards",
    "certifications",
    "certificate",
    "languages",
    "language",
    "activities",
    "activity",
    "profile",
    "summary",
    "자기소개",
    "학력",
    "기술",
    "기술 스택",
    "기술스택",
    "스킬",
    "언어",
    "프레임워크",
    "데이터베이스",
    "인프라",
    "ai ml",
    "aiml",
    "프로젝트",
    "수상",
    "자격증",
    "외국어",
    "활동",
}

CAREER_STOP_HEADERS = {
    "education",
    "educate",
    "projects",
    "project",
    "awards",
    "certifications",
    "certificate",
    "languages",
    "language",
    "activities",
    "activity",
    "학력",
    "프로젝트",
    "수상",
    "자격증",
    "외국어",
    "활동",
}

INTRO_KEYWORDS = (
    "폐업",
    "권고사직",
    "계약종료",
    "유지보수",
)

INTRO_LOWER_KEYWORDS = ("maintenance",)

CONTRIBUTION_KEYWORDS = (
    "단축",
    "절감",
    "개선",
    "최적화",
    "튜닝",
    "성과:",
    "구축",
    "설계",
    "개발",
    "기획",
    "운영",
    "관리",
    "주도",
    "리드",
    "검증",
    "구현",
    "제작",
    "자동화",
    "파이프라인",
    "동기화",
    "처리",
    "완료율",
    "장애",
)

CONTRIBUTION_LOWER_KEYWORDS = ("api 개발",)

ROLE_ONLY_EXACT = {
    "PM",
    "PO",
    "공사기사",
    "AI 엔지니어",
    "데이터 엔지니어",
    "머신러닝 엔지니어",
    "백엔드 개발자",
    "서비스 기획자",
    "프로덕트 매니저",
    "프론트엔드 개발자",
    "풀스택 개발자",
    "UI 디자이너",
    "UX 디자이너",
}

ROLE_ONLY_SUFFIXES = ("개발자", "기획자", "디자이너", "엔지니어", "매니저")

PROJECT_ACTION_KEYWORDS = ("관리", "기획", "개발", "수행", "주도")

METRIC_PATTERNS = (
    r"\d+\s*%",
    r"\d+\s*(?:건|명|시간|분|초|배|회|개|원|만원|억원)",
    r"\d+[,.]?\d*\s*(?:k|m|ms|s)\b",
)


@dataclass(frozen=True)
class SentenceScoreWeights:
    intro_keyword: int = 120
    metric: int = 70
    contribution_keyword: int = 50
    role_only: int = 90
    project_title_only: int = 90


SENTENCE_SCORE_WEIGHTS = SentenceScoreWeights()
