---
id: TASK-2026-04-16-1535-seo-metadata-jsonld
status: queued
type: feature
title: "SEO 강화 — 프로그램 페이지 메타태그 + JSON-LD 구조화 데이터"
planned_at: 2026-04-16T15:35:00+09:00
planned_against_commit: TODO_CURRENT_HEAD
---

# Goal

검색 엔진과 AI 엔진(ChatGPT, Perplexity 등)이 이소서의 프로그램 정보를 인덱싱하고 인용할 수 있도록, 공개 프로그램 페이지에 페이지별 메타태그와 JSON-LD 구조화 데이터를 추가한다.

사업계획서 8-3항 "AEO(AI Engine Optimization): ChatGPT/Perplexity가 이소서 콘텐츠를 소스로 인용하게 만들기. `/programs/[id]` 페이지에 JSON-LD 구조화 데이터 삽입."

현재 상태:
- 루트 `layout.tsx`에 고정 metadata만 있음 ("AI 이력서 코치")
- `/programs` 목록, `/programs/[id]` 상세 페이지에 metadata/generateMetadata 없음
- JSON-LD 구조화 데이터 전무
- 사업계획서 정체성이 "취업 정보 허브"인데 메타 설명이 "이력서 코치"로 되어 있어 불일치

# 작업 상세

## 1. 루트 metadata 갱신

- `frontend/app/layout.tsx`의 기본 metadata를 v2 정체성에 맞게 수정한다
- title: "이소서 — 국가 취업 지원 정보 허브" (또는 유사한 v2 기준 타이틀)
- description: 정보 허브 + AI 코치 도구 역할을 반영

## 2. 프로그램 목록 페이지 metadata

- `frontend/app/(landing)/programs/page.tsx`에 정적 metadata export 또는 generateMetadata 추가
- title: "국비 교육·취업 지원 프로그램 목록 | 이소서"
- description: 카테고리, 지역 필터, 마감 임박 등 핵심 기능 안내
- Open Graph 태그 포함 (og:title, og:description, og:type, og:url)

## 3. 프로그램 상세 페이지 dynamic metadata + JSON-LD

- `frontend/app/(landing)/programs/[id]/page.tsx`에 `generateMetadata` 함수 추가
- 프로그램 데이터를 서버에서 fetch해서 동적 title/description 생성
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

- JSON-LD는 `<script type="application/ld+json">`으로 페이지 `<head>`에 삽입
- Next.js의 `generateMetadata` + `<script>` 패턴 또는 컴포넌트 방식 사용

## 4. 랜딩 페이지 metadata

- `frontend/app/(landing)/landing-a/page.tsx`에 정적 metadata 추가 (이미 있으면 v2 정체성 기준으로 갱신)
- 비교 페이지(`/compare`)도 기본 metadata 추가

# Acceptance Criteria

1. 루트 metadata의 title과 description이 v2 정체성("취업 지원 정보 허브")을 반영한다
2. `/programs` 페이지에 고유한 title, description, Open Graph 태그가 있다
3. `/programs/[id]` 상세 페이지에 프로그램명 기반 동적 title과 description이 생성된다
4. `/programs/[id]` 상세 페이지에 `application/ld+json` 타입의 JSON-LD 스크립트가 `<head>`에 포함된다
5. JSON-LD가 Google Rich Results Test(https://search.google.com/test/rich-results)에서 에러 없이 파싱된다
6. 프로그램 데이터의 null 필드가 있어도 JSON-LD 생성에 에러가 없다 (null 필드는 해당 속성 생략)
7. 기존 페이지 렌더링과 동작에 영향 없다

# Constraints

- 백엔드 수정 없음. 기존 프로그램 데이터 API 그대로 사용
- JSON-LD 스키마는 schema.org 표준을 따른다
- 프로그램 상세 데이터 fetch는 기존 `getProgram` 또는 서버 컴포넌트 패턴을 재사용한다
- 실행 전 `planned_against_commit`을 현재 HEAD로 교체할 것
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
