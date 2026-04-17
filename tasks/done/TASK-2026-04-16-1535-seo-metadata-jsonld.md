---
id: TASK-2026-04-16-1535-seo-metadata-jsonld
status: queued
type: feature
title: "SEO 강화 — 프로그램 페이지 메타태그 + JSON-LD 구조화 데이터"
planned_at: 2026-04-16T15:35:00+09:00
planned_against_commit: 2aa310d1960e554268cd8b42b63d382f4f73415b
auto_recovery_attempts: 1
---

# Goal

검색 엔진과 AI 엔진(ChatGPT, Perplexity 등)이 이소서의 프로그램 정보를 인덱싱하고 인용할 수 있도록, 공개 프로그램 페이지에 페이지별 메타태그와 JSON-LD 구조화 데이터를 추가한다.

사업계획서 8-3항 "AEO(AI Engine Optimization): ChatGPT/Perplexity가 이소서 콘텐츠를 소스로 인용하게 만들기. `/programs/[id]` 페이지에 JSON-LD 구조화 데이터 삽입."

현재 상태:
- 루트 `layout.tsx`에 고정 metadata만 있음 ("AI 이력서 코치")
- `/programs` 목록, `/programs/[id]` 상세 페이지에 metadata/generateMetadata 없음
- JSON-LD 구조화 데이터 전무
- 사업계획서 정체성이 "취업 정보 허브"인데 메타 설명이 "이력서 코치"로 되어 있어 불일치
- `frontend/app/(landing)/programs/page.tsx`, `frontend/app/(landing)/landing-a/page.tsx`, `frontend/app/(landing)/compare/page.tsx`는 현재 worktree에서 이미 로컬 수정 중이며, SEO 작업은 이 변경들을 덮어쓰지 않는 additive 변경으로만 수행해야 함
- `frontend/app/(landing)/programs/[id]/page.tsx`는 현재 `getProgram(id)`를 직접 사용해 상세 데이터를 읽고 있으므로, dynamic metadata와 JSON-LD는 이 기존 fetch 패턴을 재사용하는 범위에서만 추가해야 함

# 작업 상세

## 1. 루트 metadata 갱신

- `frontend/app/layout.tsx`의 기본 metadata를 v2 정체성에 맞게 수정한다
- title: "이소서 — 국가 취업 지원 정보 허브" (또는 유사한 v2 기준 타이틀)
- description: 정보 허브 + AI 코치 도구 역할을 반영
- 기존 GA 설정 및 `<head>`의 다른 동작은 유지한다

## 2. 프로그램 목록 페이지 metadata

- `frontend/app/(landing)/programs/page.tsx`의 기존 검색/필터 UI와 데이터 로딩 로직은 유지한 채, 정적 metadata export 또는 generateMetadata만 additive하게 추가한다
- title: "국비 교육·취업 지원 프로그램 목록 | 이소서"
- description: 카테고리, 지역 필터, 마감 임박 등 핵심 기능 안내
- Open Graph 태그 포함 (og:title, og:description, og:type, og:url)

## 3. 프로그램 상세 페이지 dynamic metadata + JSON-LD

- `frontend/app/(landing)/programs/[id]/page.tsx`에 `generateMetadata` 함수 추가
- 기존 `getProgram(id)` 패턴을 재사용해 프로그램 데이터를 서버에서 fetch하고, 동적 title/description 생성
- title: `{프로그램명} | 이소서`
- description: `{기관명}에서 운영하는 {카테고리} 프로그램. {지역}, {기간}`

JSON-LD 구조화 데이터 (`EducationalOccupationalProgram` 또는 `Course` schema):

```json
{
  "@context": "https://schema.org",
  "@type": "Course",
  "name": "{프로그램명}",
  "provider": {
    "@type": "Organization",
    "name": "{기관명}"
  },
  "description": "{프로그램 설명}",
  "educationalLevel": "{카테고리}",
  "locationCreated": {
    "@type": "Place",
    "address": "{지역}"
  },
  "startDate": "{start_date}",
  "endDate": "{end_date}",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "KRW",
    "description": "{support_type}"
  }
}
```

- JSON-LD는 `<script type="application/ld+json">`으로 서버 렌더링된 페이지 HTML에 포함한다
- Next.js App Router에서 현재 페이지 구조를 깨지 않는 방식으로 추가한다. 꼭 필요한 경우가 아니면 레이아웃 재구성이나 별도 head 파일 추가는 피한다

## 4. 랜딩 페이지 metadata

- `frontend/app/(landing)/landing-a/page.tsx`에 현재 랜딩 A 조합 로직과 섹션 구성을 유지한 채 정적 metadata 추가 (이미 있으면 v2 정체성 기준으로 갱신)
- 비교 페이지(`/compare`)도 현재 비교 로직과 query normalization을 유지한 채 기본 metadata 추가

# Acceptance Criteria

1. 루트 metadata의 title과 description이 v2 정체성("취업 지원 정보 허브")을 반영한다
2. `/programs` 페이지에 고유한 title, description, Open Graph 태그가 있다
3. `/programs/[id]` 상세 페이지에 프로그램명 기반 동적 title과 description이 생성된다
4. `/programs/[id]` 상세 페이지에 `application/ld+json` 타입의 JSON-LD 스크립트가 서버 렌더링된 HTML에 포함된다
5. JSON-LD가 Google Rich Results Test(https://search.google.com/test/rich-results)에서 에러 없이 파싱된다
6. 프로그램 데이터의 null 필드가 있어도 JSON-LD 생성에 에러가 없다 (null 필드는 해당 속성 생략)
7. 기존 페이지 렌더링과 동작에 영향 없다
8. 현재 worktree의 `/programs`, `/landing-a`, `/compare` 로컬 변경을 되돌리거나 재구성하지 않는다

# Constraints

- 백엔드 수정 없음. 기존 프로그램 데이터 API 그대로 사용
- JSON-LD 스키마는 schema.org 표준을 따른다
- 프로그램 상세 데이터 fetch는 기존 `getProgram` 또는 서버 컴포넌트 패턴을 재사용한다
- 현재 worktree에서 이미 수정된 `frontend/app/(landing)/programs/page.tsx`, `frontend/app/(landing)/landing-a/page.tsx`, `frontend/app/(landing)/compare/page.tsx`는 SEO 메타데이터 추가 외의 목적 변경 금지
- 기존 `layout.tsx`의 GA 설정은 건드리지 않는다

# Non-goals

- sitemap.xml 자동 생성 (별도 Task)
- robots.txt 최적화
- 콘텐츠 마케팅용 블로그/뉴스 페이지
- 프로그램 외 페이지(대시보드, 활동 등)의 SEO

# Edge Cases

- `programs/[id]`에서 존재하지 않는 ID 접근 시: 404 반환, JSON-LD 미생성
- 프로그램 데이터에 title/provider 등 필수 필드가 null인 경우: JSON-LD에서 해당 속성 생략, name만 없으면 JSON-LD 자체를 미삽입
- Open Graph 이미지가 없는 경우: 기본 이소서 OG 이미지 fallback 사용

# Transport Notes

- 로컬 실행: `tasks/inbox/TASK-2026-04-16-1535-seo-metadata-jsonld.md`
- 원격 실행: `tasks/remote/TASK-2026-04-16-1535-seo-metadata-jsonld.md`
