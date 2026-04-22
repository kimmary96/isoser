---
id: TASK-2026-04-22-1618-program-detail-page
status: draft
type: feature
title: 프로그램 상세 페이지 시안 기반 UI 구현 및 실제 상세 API 데이터 연결
priority: high
planned_by: codex
planned_at: 2026-04-22T16:18:28+09:00
planned_against_commit: 26572fc6e9ca08d65d9151711e426bc53cd28051
planned_files: frontend/app/(landing)/programs/page.tsx, frontend/app/(landing)/programs/[id]/page.tsx, frontend/components/landing/program-card-helpers.ts, frontend/lib/api/backend.ts, frontend/lib/types/index.ts, backend/routers/programs.py, backend/tests/test_programs_router.py, docs/current-state.md, docs/refactoring-log.md
planned_worktree_fingerprint: 8a5967cf38374a474d9df7fdb5202e4370acbb88e6007c856c8cabb6109e28cf
---

# Goal

`/programs` 목록에서 `상세 보기`를 눌렀을 때 열리는 `/programs/[id]` 상세 페이지를 제공 HTML 시안(`C:\Users\User\Downloads\isoser-program-detail.html`)과 최대한 유사한 레이아웃/분위기/구조로 개선한다.

핵심 목표는 두 가지다.

1. HTML 시안의 섹션 순서, 시각적 위계, 카드 구조, 우측 사이드바, 탭 이동, 목차 구조를 현재 Next.js/App Router 구조에 맞게 React 컴포넌트로 구현한다.
2. 실제 상세 API 응답값을 사용해 화면을 채우고, 데이터가 없는 섹션은 가짜 문구 없이 숨기거나 축약한다.

# Current Known State

- 현재 목록 페이지의 상세 진입은 `frontend/app/(landing)/programs/page.tsx`에서 `href={`/programs/${program.id}`}`로 연결된다.
- 현재 상세 페이지 파일은 `frontend/app/(landing)/programs/[id]/page.tsx`다.
- 현재 상세 페이지는 `getProgramDetail(id)`를 통해 상세 전용 API를 사용한다.
- 현재 백엔드 상세 API는 `backend/routers/programs.py`의 `GET /programs/{program_id}/detail`이며 `ProgramDetailResponse`를 반환한다.
- `docs/current-state.md`에도 상세 API와 상세 페이지가 이미 일부 구현되어 있고, 값이 없는 provider/location/description/선택 운영 정보는 필드별 `정보 없음` 대신 숨김 처리하는 방향이라고 기록되어 있다.

# Required First Steps

구현 전에 반드시 아래를 먼저 수행한다.

1. 현재 상세 페이지 진입 구조 확인
   - `/programs`에서 상세 보기 클릭 시 어떤 route로 이동하는지 확인한다.
   - 현재 상세 페이지 파일 위치를 확인한다.
   - 현재 상세 API 호출 방식을 확인한다.
   - 현재 상세 페이지가 어떤 데이터를 받고 있는지 확인한다.
2. 상세 페이지에 필요한 데이터 계약(view model)을 섹션별로 먼저 정리한다.
3. 섹션별 렌더링 정책을 먼저 정의한다.
4. 수정 대상 파일 목록을 먼저 정리한다.
5. 데이터 매핑표를 먼저 작성한 뒤 실제 구현한다.
6. 구현 후 검증 결과를 보고한다.

# Data Mapping Requirements

구현 전에 아래 필드를 실제 API/DB/view model 기준으로 분류하고, result report에 매핑표를 남긴다.

## A. 원본/DB/API에서 직접 연결 가능한 필드

- `title`
- `provider`
- `organizer` / `ministry`
- `location`
- `description`
- `summary`
- `source_url` / `apply_url` / `link`
- `start_date` / `end_date`
- `application_deadline`
- `support_type`
- `teaching_method`
- `fee` / `tuition`
- `support_amount`
- `tags`
- `category`
- `source`
- `status`
- `compare_meta` 내부 메타
- `schedule_text`
- `eligibility`

## B. 있으면 보여주고 없으면 섹션 축소 또는 숨김

- `review_count`
- `rating`
- `employment_rate`
- `capacity_total`
- `capacity_remaining`
- `phone`
- `email`
- `manager_name`
- `certifications`
- `tech_stack`
- `curriculum_summary`
- `target_audience`
- `benefits`

## C. 현재 데이터 소스에 없을 가능성이 높으므로 기본 숨김 또는 후순위 fallback 처리

- 커리큘럼 주차별 아코디언
- 수강 후기 카드 목록
- FAQ 목록
- 취업 지원 칩 목록
- 추천 대상 리스트
- AI 매칭 배너 세부 문구
- 이벤트 배너
- 유사 프로그램 카드

# Rendering Policy

- 값이 있는 섹션은 시안처럼 풍부하게 보여준다.
- 값이 핵심 1~2개만 있으면 축약형 카드로 보여준다.
- 값이 전혀 없으면 섹션 전체를 숨긴다.
- `정보 없음` 문구를 개별 필드마다 반복 표시하지 않는다.
- 후기, FAQ, 주차별 커리큘럼, 유사 프로그램은 실제 데이터가 없으면 렌더링하지 않는다.
- 상세 페이지 전체가 비어 보이지 않도록 상단 hero, 요약, 기관 정보, 일정, 신청 버튼 영역은 실제 데이터 조합을 우선 사용한다.
- 최소 fallback은 제목 미정, 링크 없음 같은 사용자 흐름 보호가 필요한 곳에만 쓴다.

# Implementation Scope

## 1. Hero 영역

- 프로그램명
- 배지: 카테고리, 지원유형, 상태 등 실제 데이터 기반
- 운영기관/주관기관
- 모집마감 / 교육기간 / 수업형태 / 수강료 / 남은정원(있을 때만)
- 썸네일: 실제 이미지가 없으면 `source` 또는 `category` 기반 아이콘/이니셜 fallback

## 2. 상단 탭 네비게이션

- 프로그램 요약
- 커리큘럼
- 후기
- Q&A
- 데이터 없는 탭은 숨기거나 비활성화한다.

## 3. 좌측 본문 카드 섹션

가능한 실제 데이터가 있을 때만 렌더링한다.

- 프로그램 요약
- 교육기관 정보
- 일정 & 수업
- 추천 대상
- 학습 목표
- 수강료 & 지원금
- 지원 자격 & 절차
- 취업 지원
- 추가 안내
- 커리큘럼
- 수강 후기
- Q&A
- 유사 프로그램

## 4. 우측 사이드바

- 모집 상태
- 마감일
- 기간
- 지역
- 수강료
- 카드 필요 여부
- 신청 버튼
- 북마크/공유 버튼
- 빠른 목차(anchor)

## 5. 인터랙션

- 탭 클릭 시 해당 섹션으로 스크롤 이동
- 목차 active 상태 변경
- 커리큘럼 아코디언
- FAQ 아코디언
- 북마크 버튼 UI 상태 토글
- 반응형 동작 유지

# Design Requirements

- 제공 HTML 시안의 레이아웃, 섹션 순서, 시각적 위계, 카드 구조, 사이드바 구조, 탭 이동, 목차 구조를 최대한 반영한다.
- HTML 시안의 클래스명과 스타일을 그대로 복붙하지 않는다.
- 현재 프로젝트 구조에 맞는 React/Next.js 컴포넌트로 구현한다.
- 가능하면 상세 페이지를 큰 단일 파일로 만들지 않고, `Hero`, `Sidebar`, `SectionCard`, `Accordion`, `TOC` 등으로 분리한다.
- 기존 프로젝트의 Tailwind 체계와 디자인 토큰을 우선 활용한다.
- 모바일/태블릿/데스크톱 반응형을 반드시 고려한다.
- 기존 공개 랜딩 헤더/티커 사용 여부는 현재 상세 페이지 패턴과 시안 유사도 사이에서 최소 변경으로 판단한다.

# Data Connection Requirements

- 현재 상세 API 응답 구조를 우선 사용한다.
- API 응답에 없는 필드는 임의 하드코딩하지 않는다.
- 프론트용 derived field는 안전하게 계산할 수 있다.
  - 모집마감 D-day
  - 기간 텍스트
  - 수업형태 라벨
  - 상태 badge
- `compare_meta` 또는 source metadata 안에 값이 있으면 활용 가능 여부를 검토한다.
- `source_url` / `apply_url` / `link`가 있으면 신청 버튼에 연결한다.
- 신청 링크가 없으면 신청 버튼은 숨기거나 비활성화한다.

# Strict No-Fake-Data Constraints

- 후기 데이터가 없는데 가짜 후기 카드를 하드코딩하지 않는다.
- FAQ 데이터가 없는데 가짜 질문을 넣지 않는다.
- 커리큘럼 데이터가 없는데 주차별 더미 내용을 생성하지 않는다.
- 유사 프로그램 API 또는 related data가 없으면 유사 프로그램 섹션을 숨긴다.
- 데이터가 연결되지 않은 상태에서 UI만 먼저 완성하지 않는다.
- 먼저 핵심 정보가 채워지는 버전을 완성한 뒤 후순위 섹션을 붙인다.

# User Flow

1. 사용자가 `/programs` 목록 페이지에 들어간다.
2. 프로그램 카드의 `상세 보기`를 누른다.
3. `/programs/[id]` 상세 페이지가 열린다.
4. 상세 API 응답 기반으로 Hero와 주요 정보가 먼저 보인다.
5. 사용자는 탭 또는 우측 목차를 눌러 요약, 커리큘럼, 후기, Q&A 등 존재하는 섹션으로 이동한다.
6. 신청 링크가 있으면 신청 버튼으로 원본/신청 페이지를 새 탭에서 열 수 있다.
7. 데이터가 부족한 프로그램도 페이지가 깨지지 않고, 빈 섹션이나 `정보 없음` 반복 없이 자연스럽게 축약된다.

# Acceptance Criteria

1. `/programs` 페이지에서 `상세 보기` 클릭 시 기존처럼 `/programs/[id]`로 이동한다.
2. `/programs/[id]`는 기존 상세 전용 API `GET /programs/{program_id}/detail`을 사용한다.
3. 상세 페이지가 제공 HTML 시안과 유사한 Hero, 탭, 본문/사이드바 2열 구조, 빠른 목차 구조를 가진다.
4. 실제 데이터가 있는 프로그램은 기관명, 지역, 설명, 기간, 수강료/지원금, 신청 링크 등이 정상 노출된다.
5. 데이터가 없는 후기/FAQ/주차별 커리큘럼/유사 프로그램은 가짜 데이터 없이 숨겨진다.
6. 필드마다 `정보 없음`이 반복 표시되지 않는다.
7. 탭 클릭과 우측 목차 클릭 시 해당 섹션으로 스크롤 이동한다.
8. 목차 active 상태가 현재 보고 있는 섹션에 맞게 갱신된다.
9. 커리큘럼/FAQ 실제 데이터가 있을 때만 아코디언으로 렌더링되고, 없으면 탭/섹션이 숨겨지거나 비활성화된다.
10. 북마크 버튼은 UI 상태 토글이 가능하다. 서버 저장은 이번 범위에 포함하지 않아도 된다.
11. 모바일에서 본문과 사이드바가 자연스럽게 단일 컬럼으로 전환되고 가로 스크롤이 발생하지 않는다.
12. 기존 `/programs`, `/compare`, landing-a/c, 추천/비교 API 동작을 깨뜨리지 않는다.
13. TypeScript strict 기준을 유지하고 `any` 사용은 피한다.

# Constraints

- 기존 동작 유지가 최우선이다.
- 큰 리팩토링보다 점진적 개선을 우선한다.
- 단순 정적 HTML 복사 금지.
- 기존 라우팅과 기존 programs 상세 진입 흐름을 깨뜨리지 않는다.
- 불필요한 CSS 파일 추가보다 Tailwind와 기존 패턴을 우선한다.
- API 계약 변경이 필요하면 최소 범위로 제한하고 백엔드 테스트를 함께 갱신한다.
- 현재 worktree가 dirty 상태이므로 구현자는 관련 파일의 기존 변경을 되돌리지 말고, 충돌 가능성을 먼저 확인한다.

# Non-goals

- 후기, FAQ, 유사 프로그램 데이터를 새로 생성하거나 가짜로 채우기.
- 북마크 서버 저장 기능 구현.
- 새로운 추천/관련 프로그램 API를 처음부터 설계.
- 대규모 디자인 시스템 교체.
- 프로그램 수집/백필 파이프라인 수정.
- 인증/대시보드/비교 페이지 동작 변경.

# Edge Cases

- 상세 API가 404를 반환하면 기존처럼 `notFound()` 흐름을 유지한다.
- 상세 API가 실패하면 기존 Next.js 에러 처리 흐름을 깨지 않는다.
- `title`만 있고 나머지 정보가 거의 없는 프로그램도 Hero와 최소 CTA 영역이 깨지지 않는다.
- 신청 링크가 없으면 신청 버튼을 숨기거나 비활성 상태로 표시한다.
- 날짜가 invalid string이면 원문을 보존하거나 안전한 fallback으로 표시한다.
- `compare_meta` 값이 객체가 아니거나 예상과 다르면 무시한다.
- 긴 제목/기관명/지역명이 모바일에서 레이아웃을 밀어내지 않는다.

# Required Report Format

구현 완료 후 `reports/TASK-2026-04-22-1618-program-detail-page-result.md`에 아래 순서로 한국어 보고서를 작성한다.

1. 현재 상세페이지 진입 구조
2. 수정 대상 파일 목록
3. 섹션별 데이터 매핑표
4. 실제 구현한 섹션
5. 숨김 처리한 섹션과 이유
6. API 응답과 연결한 필드 목록
7. 반응형/인터랙션 구현 여부
8. 테스트/검증 결과
9. 남은 데이터 공백과 후속 작업 제안

보고서에는 변경 이유, 영향 범위, 리스크, 테스트 포인트, 추가 리팩토링 후보도 포함한다.

# Suggested Verification

- `npm --prefix frontend run lint`
- `npx --prefix frontend tsc -p frontend/tsconfig.codex-check.json --noEmit` 또는 저장소 기존 타입체크 명령
- 관련 단위 테스트가 있으면 `frontend/lib/program-filters.test.ts` 등 영향 범위 테스트 실행
- 백엔드 상세 API 계약을 바꾼 경우 `backend\venv\Scripts\python.exe -m pytest backend/tests/test_programs_router.py -q`
- 가능하면 로컬 dev server에서 `/programs` → 상세 보기 → `/programs/[id]` 진입을 브라우저로 확인
- 모바일 폭에서 상세 페이지가 깨지지 않는지 확인

# Open Questions

- 실제 유사 프로그램 API 또는 related data가 현재 존재하는지 구현 단계에서 확인해야 한다.
- 커리큘럼/FAQ/후기 데이터가 `compare_meta` 또는 별도 필드에 실제로 존재하는지 구현 단계에서 확인해야 한다.
- 제공 HTML 시안의 ticker/nav까지 상세 페이지에 그대로 반영할지, 기존 공개 랜딩 공통 헤더를 유지할지는 구현자가 현재 UX 일관성 기준으로 판단한다.
