# Isoser API Contract

기준일: 2026-04-14  
기준 코드베이스: `frontend/app/api/*`, `backend/routers/*`

이 문서는 현재 구현된 API 계약을 정리한 운영용 문서다.  
Swagger/OpenAPI를 대체하는 완전한 스키마 문서는 아니고, 프론트와 백엔드가 실제로 주고받는 요청/응답 shape를 코드 기준으로 정리한 계약서다.

## 1. 계층 구조

이 프로젝트는 API가 2층으로 나뉜다.

1. Next.js App API
   - 경로: `frontend/app/api/*`
   - 역할: 브라우저와 같은 오리진에서 동작하는 BFF
   - 인증: Supabase 서버 세션 쿠키 사용
   - 용도: 대시보드 CRUD, 인증 흐름, 파일 업로드, 백엔드 프록시

2. FastAPI Backend
   - 경로: `backend/routers/*`
   - 기본 주소 예시: `http://localhost:8000`
   - 역할: AI/추천/분석/동기화 로직
   - 인증: 일부는 Bearer access token, 일부는 admin secret, 일부는 공개 호출

## 2. 공통 규칙

### 2.1 인증

- Next API 대부분은 로그인 세션 필수
- 인증 실패 시 보통 `400` 또는 `401`로 `{ "error": "로그인이 필요합니다." }` 혹은 `{ "user": null }`
- FastAPI `bookmarks`, `programs/recommend` 일부는 `Authorization: Bearer <supabase_access_token>` 사용
- FastAPI `admin/sync/programs`는 `Authorization: <ADMIN_SECRET_KEY>` 사용

### 2.2 에러 응답

현재 JSON 응답을 반환하는 Next API는 아래 포맷으로 통일했다. redirect 기반 route(`GET /api/auth/google`, `GET /auth/callback`)는 예외다.

- Next API 대부분:
```json
{ "error": "에러 메시지", "code": "BAD_REQUEST" }
```

- 주요 Next API에서 사용 중인 `code`
  - `BAD_REQUEST`
  - `UNAUTHORIZED`
  - `FORBIDDEN`
  - `NOT_FOUND`
  - `CONFLICT`
  - `UNPROCESSABLE`
  - `UPSTREAM_ERROR`
  - `INTERNAL_ERROR`

- FastAPI 대부분:
```json
{ "detail": "에러 메시지" }
```

- `coach/feedback` validation 일부:
```json
{ "detail": "에러 메시지", "error_code": "VALIDATION_ERROR" }
```

### 2.3 날짜/시간

- 대부분 ISO string 저장값을 그대로 반환
- 예: `created_at`, `updated_at`

## 3. Next.js App API

## 3.1 Auth

### `GET /api/auth/google`

- 목적: Google OAuth 시작
- 인증: 불필요
- 응답:
  - 성공: Supabase OAuth URL로 redirect
  - 실패: 에러 응답 또는 redirect 실패

### `POST /api/auth/signout`

- 목적: 로그아웃
- 인증: 세션 필요
- 응답:
```json
{ "ok": true }
```

### `GET /auth/callback`

- 목적: Supabase code exchange 후 `/dashboard` 또는 `/onboarding` redirect
- 브라우저에서 직접 호출하는 페이지가 아니라 서버 route

## 3.2 Dashboard Common

### `GET /api/dashboard/me`

- 목적: 현재 로그인 사용자 최소 정보 조회
- 응답:
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "displayName": "홍길동",
    "avatarUrl": "https://..."
  }
}
```

- 인증 없음/세션 없음:
```json
{ "user": null }
```
상태코드 `401`

### `GET /api/dashboard/recommended-programs`

- 목적: 로그인 사용자 기준 추천 프로그램 9개 조회
- 내부적으로 FastAPI `POST /programs/recommend` 호출
- 응답:
```json
{
  "programs": [
    {
      "id": "program-id",
      "title": "프로그램명"
    }
  ]
}
```

## 3.3 Profile

### `GET /api/dashboard/profile`

- 목적: 프로필 페이지 초기 데이터 조회
- 응답:
```json
{
  "profile": {
    "id": "uuid",
    "name": "홍길동",
    "bio": "",
    "portfolio_url": "",
    "email": "user@example.com",
    "phone": "010-0000-0000",
    "education": "학력 문자열 또는 null",
    "career": [],
    "education_history": [],
    "awards": [],
    "certifications": [],
    "languages": [],
    "skills": [],
    "self_intro": "",
    "created_at": "...",
    "updated_at": "..."
  },
  "activities": [],
  "matchAnalyses": []
}
```

### `PATCH /api/dashboard/profile`

- 목적: 프로필 일부 필드 업데이트
- Body(JSON): 아래 필드 중 일부
```json
{
  "career": ["..."],
  "education_history": ["..."],
  "awards": ["..."],
  "certifications": ["..."],
  "languages": ["..."],
  "skills": ["..."],
  "self_intro": "...",
  "bio": "...",
  "email": "...",
  "phone": "...",
  "portfolio_url": "..."
}
```

- 응답:
```json
{ "profile": { "...": "updated profile row" } }
```

### `PUT /api/dashboard/profile`

- 목적: 프로필 기본 정보 + 아바타 업로드 저장
- Content-Type: `multipart/form-data`
- Form fields:
  - `name` required
  - `bio`
  - `email`
  - `phone`
  - `portfolio_url`
  - `current_avatar_url`
  - `avatar` file

- 응답:
```json
{ "profile": { "...": "updated profile row" } }
```

## 3.4 Activities

### `GET /api/dashboard/activities`

- 응답:
```json
{ "activities": [Activity] }
```

### `POST /api/dashboard/activities`

- 목적: 활동 생성
- Body(JSON):
```json
{
  "type": "회사경력 | 프로젝트 | 대외활동 | 학생활동",
  "title": "활동명",
  "period": "2024.01 ~ 2024.06",
  "role": "역할",
  "skills": ["React", "FastAPI"],
  "description": "소개",
  "organization": "조직명",
  "team_size": 4,
  "team_composition": "구성",
  "my_role": "담당 역할",
  "contributions": ["..."],
  "image_urls": ["https://..."],
  "is_visible": true
}
```

- 응답:
```json
{ "activity": { "...": "created row" } }
```

### `GET /api/dashboard/activities/:id`

- 응답:
```json
{ "activity": { "...": "activity row" } }
```

### `PATCH /api/dashboard/activities/:id`

- 목적: 활동 전체/부분 업데이트
- Body(JSON): `activities` 테이블 컬럼에 대응하는 자유 shape
- 응답:
```json
{ "activity": { "...": "updated row" } }
```

### `DELETE /api/dashboard/activities/:id`

- 응답:
```json
{ "id": "activity-id" }
```

### `POST /api/dashboard/activities/images`

- 목적: 활동 이미지 업로드
- Content-Type: `multipart/form-data`
- Form fields:
  - `activityId`
  - `files` multiple

- 응답:
```json
{ "urls": ["https://public-image-url"] }
```

### `POST /api/dashboard/activities/coach-session`

- 목적: 활동 코치 세션 저장
- Body(JSON):
```json
{
  "sessionId": "session-id",
  "activityId": "activity-id",
  "messages": []
}
```

- 응답:
```json
{ "ok": true }
```

## 3.5 Resume / Documents / Export

### `GET /api/dashboard/resume`

- 목적: 이력서 작성 초기 데이터
- 응답:
```json
{
  "activities": [],
  "profile": {
    "name": "홍길동",
    "bio": "",
    "email": "user@example.com",
    "phone": "010-0000-0000",
    "self_intro": "",
    "skills": []
  }
}
```

### `POST /api/dashboard/resume`

- 목적: 이력서 저장
- Body(JSON):
```json
{
  "title": "이력서 제목",
  "target_job": "백엔드 개발자",
  "template_id": "simple",
  "selected_activity_ids": ["activity-id-1", "activity-id-2"]
}
```

- 응답:
```json
{ "id": "resume-id" }
```

### `GET /api/dashboard/documents`

- 목적: 문서 목록 조회
- 현재 구현상 `resumes` 목록 반환
- 응답:
```json
{ "documents": [] }
```

### `GET /api/dashboard/resume-export?resumeId=<id>`

- 목적: PDF 출력용 이력서 + 활동 데이터 조회
- `resumeId` 생략 시 최신 이력서 1건
- 응답:
```json
{
  "resume": { "...": "resume row" },
  "activities": []
}
```

또는 이력서 없음:
```json
{
  "resume": null,
  "activities": []
}
```

## 3.6 Match

### `GET /api/dashboard/match`

- 목적: 저장된 분석 카드 + 이력서 선택 옵션 조회
- 응답:
```json
{
  "savedAnalyses": [
    {
      "id": "analysis-id",
      "job_title": "회사 직무",
      "job_posting": "공고 전문",
      "total_score": 84,
      "grade": "A",
      "summary": "요약",
      "created_at": "2026-04-14T00:00:00Z",
      "result": null
    }
  ],
  "resumeOptions": [
    {
      "id": "resume-id",
      "title": "이력서 제목",
      "target_job": "백엔드 개발자",
      "selected_activity_ids": [],
      "created_at": "..."
    }
  ]
}
```

### `POST /api/dashboard/match`

- 목적: 공고 매칭 분석 실행 후 저장
- Body(JSON):
```json
{
  "companyName": "회사명",
  "positionName": "직무명",
  "jobPosting": "공고 전문",
  "analysisMode": "resume | activity",
  "selectedResumeId": "resume-id"
}
```

- 응답:
```json
{
  "analysis": {
    "id": "analysis-id",
    "job_title": "회사명 직무명",
    "job_posting": "공고 전문",
    "total_score": 84,
    "grade": "A",
    "summary": "요약",
    "created_at": "...",
    "result": {
      "total_score": 84,
      "grade": "A",
      "summary": "..."
    }
  }
}
```

주의:
- 구형 DB 스키마 fallback 시 `result`가 `null`일 수 있음

### `DELETE /api/dashboard/match?id=<analysis-id>`

- 응답:
```json
{ "id": "analysis-id" }
```

## 3.7 Cover Letters

### `GET /api/dashboard/cover-letters`

- 응답:
```json
{ "coverLetters": [] }
```

### `POST /api/dashboard/cover-letters`

- Body(JSON):
```json
{
  "title": "자기소개서 제목",
  "company_name": "회사명",
  "job_title": "직무명",
  "prompt_question": "문항",
  "content": "전체 내용",
  "qa_items": [
    { "question": "문항1", "answer": "답변1" }
  ],
  "tags": ["지원동기", "협업"]
}
```

- 응답:
```json
{ "coverLetter": { "...": "created row" } }
```

### `GET /api/dashboard/cover-letters/:id`

- 응답:
```json
{ "coverLetter": { "...": "cover letter row" } }
```

### `PATCH /api/dashboard/cover-letters/:id`

- Body: `POST /api/dashboard/cover-letters`와 동일 shape
- 응답:
```json
{ "coverLetter": { "...": "updated row" } }
```

### `DELETE /api/dashboard/cover-letters/:id`

- 응답:
```json
{ "id": "cover-letter-id" }
```

### `POST /api/dashboard/cover-letters/coach`

- 목적: 자기소개서 코칭 프록시
- 구현상 내부적으로 백엔드 코치 API를 호출
- 응답:
  - 백엔드 코치 응답을 그대로 전달

## 3.8 Onboarding

### `POST /api/onboarding`

- Body(JSON):
```json
{
  "profile": {
    "name": "홍길동",
    "email": "user@example.com",
    "phone": "010-0000-0000",
    "bio": "",
    "education": "대학교",
    "career": [],
    "education_history": [],
    "awards": [],
    "certifications": [],
    "languages": [],
    "skills": [],
    "self_intro": ""
  },
  "activities": [
    {
      "title": "프로젝트명",
      "type": "프로젝트"
    }
  ]
}
```

- 응답:
```json
{ "ok": true }
```

## 3.9 Summary

### `POST /api/summary`

- 목적: Gemini 요약 생성
- Body(JSON):
```json
{ "prompt": "요약 대상 텍스트" }
```

- 응답:
```json
{ "summary": "생성된 요약" }
```

- 제약:
  - `Content-Type: application/json`
  - `prompt` 필수
  - `prompt.length <= 6000`

## 4. FastAPI Backend

Base URL 예시: `http://localhost:8000`

## 4.1 Health

### `GET /`
```json
{ "status": "ok", "service": "이소서 API" }
```

### `GET /health`
```json
{
  "status": "ok",
  "service": "이소서 API",
  "chroma": {}
}
```

## 4.2 Programs

### `GET /programs/`

- Query:
  - `q`
  - `category`
  - `regions` (repeatable)
  - `recruiting_only`
  - `sort` (`deadline | latest`)
  - `scope`
  - `region_detail`
  - `limit`
  - `offset`

- 응답:
  - `programs` 테이블 row array

### `GET /programs/count`

- 목적: `/programs` 목록 화면의 총 결과 수 조회
- Query:
  - `q`
  - `category`
  - `regions` (repeatable)
  - `recruiting_only`
  - `scope`
  - `region_detail`

- 응답:
```json
{ "count": 57 }
```

### `GET /programs/popular`

- 응답:
  - 광고 제외 인기 프로그램 배열

### `GET /programs/{program_id}`

- 응답:
  - 단일 프로그램 row

### `POST /programs/recommend`

- Auth:
  - 없으면 기본 목록 추천
  - 있으면 `Authorization: Bearer <supabase_access_token>`

- Body(JSON):
```json
{ "top_k": 9 }
```

- 응답:
```json
{
  "items": [
    {
      "program_id": "id",
      "score": 0.87,
      "reason": "추천 이유",
      "fit_keywords": ["React", "PM"],
      "program": {
        "id": "id",
        "title": "프로그램명"
      }
    }
  ]
}
```

### `POST /programs/sync`

- 목적: collector 동기화 백그라운드 실행
- 응답:
```json
{ "message": "동기화 시작됨", "status": "running" }
```

## 4.3 Match

### `POST /match/analyze`

- Body(JSON):
```json
{
  "job_posting": "공고 전문",
  "activities": [
    {
      "id": "activity-id",
      "title": "활동명",
      "description": "설명"
    }
  ],
  "profile_context": {
    "name": "홍길동",
    "skills": ["React", "FastAPI"]
  }
}
```

- 응답:
```json
{
  "total_score": 84,
  "grade": "A",
  "summary": "요약",
  "matched_keywords": [],
  "missing_keywords": [],
  "recommended_activities": [],
  "detailed_scores": []
}
```

### `POST /match/rewrite?user_id=<uuid>`

- Body(JSON): `MatchRewriteRequest`
```json
{
  "job_posting_text": "공고 텍스트",
  "job_title": "직무명",
  "activity_ids": ["activity-id"],
  "section_type": "요약 | 회사경력 | 프로젝트 | 대외활동 | 학생활동"
}
```

- 응답:
  - `MatchRewriteResponse` 스키마
  - 실제로는 공고 기반 rewrite 결과, 추천 문장, 보완 포인트 포함

### `POST /match/extract-job-image`

- Content-Type: `multipart/form-data`
- Form field: `file`
- 응답:
```json
{ "job_posting_text": "OCR/비전 추출 결과" }
```

### `POST /match/extract-job-pdf`

- Content-Type: `multipart/form-data`
- Form field: `file`
- 응답:
```json
{ "job_posting_text": "PDF 텍스트" }
```

## 4.4 Coach

### `POST /coach/feedback`

- Body(JSON):
```json
{
  "mode": "feedback | intro_generate",
  "session_id": "optional-session-id",
  "user_id": "optional-user-id",
  "activity_description": "활동 설명",
  "activity_type": "프로젝트",
  "org_name": "조직명",
  "period": "2024.01 ~ 2024.06",
  "team_size": 4,
  "role": "백엔드 개발",
  "skills": ["FastAPI", "PostgreSQL"],
  "contribution": "기여 내용",
  "job_title": "백엔드 개발자",
  "section_type": "프로젝트",
  "selected_suggestion_index": 0,
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

- 응답:
  - `mode=feedback`
```json
{
  "session_id": "session-id",
  "feedback": "...",
  "rewrite_suggestions": [],
  "structure_diagnosis": {},
  "missing_elements": [],
  "iteration_count": 1,
  "updated_history": []
}
```
  - `mode=intro_generate`
    - `IntroGenerateResponse` 스키마

### `GET /coach/sessions?user_id=<uuid>`

- 응답:
```json
[
  {
    "id": "session-id",
    "user_id": "uuid",
    "job_title": "백엔드 개발자",
    "section_type": "프로젝트",
    "activity_description": "...",
    "iteration_count": 1,
    "last_feedback": "...",
    "suggestion_type": "structure",
    "missing_elements": [],
    "created_at": "...",
    "updated_at": "..."
  }
]
```

### `GET /coach/sessions/{session_id}?user_id=<uuid>`

- 응답:
```json
{
  "id": "session-id",
  "user_id": "uuid",
  "job_title": "백엔드 개발자",
  "section_type": "프로젝트",
  "activity_description": "...",
  "iteration_count": 1,
  "last_feedback": "...",
  "last_suggestions": [],
  "selected_suggestion_index": 0,
  "last_structure_diagnosis": {},
  "restored_history": []
}
```

## 4.5 Company

### `POST /company/insight`

- Body(JSON):
```json
{ "company_name": "카카오" }
```

- 응답:
```json
{
  "summary": "...",
  "signals": [],
  "sources": [],
  "note": "..."
}
```

## 4.6 Skills

### `GET /skills/suggest?role=<text>&limit=<n>`

- 응답:
```json
{
  "input_role": "프론트엔드 개발자",
  "normalized_job_key": "frontend_engineer",
  "display_name_ko": "프론트엔드 개발자",
  "job_family": "software",
  "job_bucket": "frontend",
  "matched_alias": "프론트엔드 개발자",
  "recommended_skill_tags": ["React", "TypeScript"],
  "evidence_keywords": [],
  "source_refs": []
}
```

## 4.7 Bookmarks

### `GET /bookmarks`

- Header: `Authorization: Bearer <supabase_access_token>`
- 응답:
```json
{
  "items": [
    {
      "program_id": "program-id",
      "created_at": "...",
      "program": {
        "id": "program-id",
        "title": "프로그램명"
      }
    }
  ]
}
```

### `POST /bookmarks/{program_id}`

- Header: `Authorization: Bearer <supabase_access_token>`
- 응답:
```json
{
  "program_id": "program-id",
  "created_at": "...",
  "program": {}
}
```

### `DELETE /bookmarks/{program_id}`

- Header: `Authorization: Bearer <supabase_access_token>`
- 응답:
```json
{ "ok": true }
```

## 4.8 Admin

### `POST /admin/sync/programs`

- Header: `Authorization: <ADMIN_SECRET_KEY>`
- Query:
  - `start_dt`
  - `end_dt`
  - `area_code`
  - `ncs_code`

- 응답:
```json
{
  "synced": 120,
  "chroma_synced": 100,
  "chroma_skipped": 20,
  "duration_seconds": 12.4
}
```

## 5. 현재 계약상 주의사항

1. 에러 포맷이 완전히 통일되어 있지 않다.
   Next API(JSON route)는 `error + code`로 통일됐고, FastAPI는 `detail` 위주다.

2. 일부 route는 DB 스키마 fallback 로직을 가진다.
   - `profiles.bio`
   - `cover_letters.qa_items`
   - `match_analyses.analysis_payload`

3. `NEXT_PUBLIC_BACKEND_URL`은 Next API 내부 프록시에서 사용 중이다.
   브라우저에서 직접 FastAPI를 치는 패턴은 현재 대시보드 핵심 경로에서 제거된 상태다.

4. 문서 목록 API는 현재 `resumes`만 반환한다.
   이름은 `documents`지만 실제 도메인은 이력서 중심이다.

## 6. 문서 업데이트 규칙

다음 중 하나가 바뀌면 이 문서를 같이 갱신한다.

- route 추가/삭제
- request body 필드 변경
- response 필드 변경
- 인증 방식 변경
- 에러 포맷 변경
