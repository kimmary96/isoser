---
id: TASK-2026-04-16-1530-adsense-slots
status: queued
type: feature
title: "구글 애드센스 Phase 1 — 공개 페이지에 광고 슬롯 삽입"
planned_at: 2026-04-16T15:30:00+09:00
planned_against_commit: e72482dca8efd55213792a8a6e10159b62e9b891
auto_recovery_attempts: 2
---

# Goal

런칭 즉시 최소 수익을 확보하기 위해, 비로그인 공개 페이지(랜딩, 프로그램 목록, 프로그램 상세)에 구글 애드센스 광고 슬롯을 삽입한다.

사업계획서 Phase 1 수익원에 해당하며, 현재 코드베이스에는 GA(Google Analytics)만 있고 애드센스 관련 공용 슬롯 컴포넌트는 아직 없다.

# Context

사업계획서 8-2항: "Phase 1 — 구글 애드센스. 초기 유저가 없을 때 자동 광고로 최소 수익 확보. 세팅만 하면 즉시 동작."

현재 상태:
- `frontend/app/layout.tsx`에는 GA(`G-P5JGXM9KQJ`) 스크립트만 있고, 애드센스 스크립트는 없다
- `frontend/components/AdSlot.tsx`는 아직 없다
- `frontend/app/(landing)/landing-a/page.tsx`는 async server page이며, 현재 `LandingACtaSection` 다음에 `LandingAFooter`를 직접 조합한다
- `frontend/app/(landing)/landing-a/_components.tsx`에는 `LandingACtaSection`, `LandingAFooter`, `LandingAProgramsSection` 등 공개 랜딩 섹션이 정의되어 있다
- `frontend/app/(landing)/programs/page.tsx`는 `RecommendedProgramsSection` 뒤에 필터 `aside`와 결과 `section`이 있는 공개 목록 페이지다
- `frontend/app/(landing)/programs/[id]/page.tsx`는 공개 상세 페이지이며, 현재 본문은 단일 주요 카드 섹션으로 렌더링된다
- 위 공개 페이지 관련 파일들은 현재 worktree에서 이미 수정 중이므로, 재실행 시에도 touched area를 다시 확인하고 현재 변경을 덮어쓰지 않는 최소 삽입만 수행해야 한다

# 작업 상세

## 1. 애드센스 스크립트 로드

- `frontend/app/layout.tsx`의 `<head>`에 애드센스 스크립트를 추가한다
- `<Script src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXX" crossOrigin="anonymous" strategy="afterInteractive" />`
- 애드센스 Publisher ID(`ca-pub-XXXXXXXX`)는 환경변수 `NEXT_PUBLIC_ADSENSE_CLIENT`로 관리한다
- 환경변수가 비어 있으면 스크립트를 로드하지 않는다 (개발 환경에서 불필요한 로드 방지)

## 2. 공용 AdSlot 컴포넌트 생성

- `frontend/components/AdSlot.tsx` 생성
- props: `slotId: string`, `format?: string` (기본값 `"auto"`), `className?: string`
- `NEXT_PUBLIC_ADSENSE_CLIENT`가 비어 있으면 null 반환 (광고 미노출)
- 로그인 사용자 중 향후 프리미엄 플래그(`is_premium`)가 있으면 null 반환할 수 있도록 확장 여지를 주석으로 남긴다

## 3. 광고 슬롯 배치

사업계획서 광고 상품 위치를 참고하되, Phase 1은 애드센스 자동 광고가 아니라 수동 슬롯 최소 배치만 수행한다. 현재 페이지 구조를 유지한 채 아래 위치에만 최소 삽입한다:

| 위치 | 페이지 | 슬롯 타입 |
|---|---|---|
| 프로그램 목록 결과 카드 컨테이너 시작부 또는 추천 섹션 다음 공개 컨텐츠 시작부 | `frontend/app/(landing)/programs/page.tsx` | 가로 배너 1개 |
| 프로그램 상세 주요 카드 섹션 하단 | `frontend/app/(landing)/programs/[id]/page.tsx` | 콘텐츠 하단 배너 1개 |
| 랜딩 `LandingACtaSection` 이후, `LandingAFooter` 이전 | `frontend/app/(landing)/landing-a/page.tsx` 또는 이를 유지하는 최소 위치 | 콘텐츠 하단 배너 1개 |

## 4. 대시보드 제외

- `frontend/app/dashboard/` 하위 페이지에는 광고 슬롯을 넣지 않는다
- 체류 도구(성과저장소, AI 코치, 이력서 등)는 무료이되 광고 없는 공간으로 유지
- 현재 공개 페이지의 기존 데이터 fetch, 추천 섹션, 필터, 비교추가 동작은 변경하지 않는다

# Acceptance Criteria

1. `NEXT_PUBLIC_ADSENSE_CLIENT` 환경변수가 설정되어 있으면 `adsbygoogle.js` 스크립트가 로드된다
2. 환경변수가 비어 있으면 스크립트가 로드되지 않고 광고 슬롯도 렌더링되지 않는다
3. `/programs` 페이지에 최소 1개의 광고 슬롯이 표시된다
4. `/programs/[id]` 상세 페이지에 최소 1개의 광고 슬롯이 표시된다
5. 랜딩 페이지에 최소 1개의 광고 슬롯이 표시된다
6. `/dashboard` 하위 페이지에는 광고 슬롯이 없다
7. `AdSlot` 컴포넌트가 `frontend/components/AdSlot.tsx`에 공용으로 존재한다
8. 기존 페이지 레이아웃이 광고 삽입으로 인해 깨지지 않는다
9. 모바일(375px)에서 광고가 화면을 과도하게 차지하지 않는다
10. 현재 `/programs`의 추천 섹션, 필터, 페이지네이션과 `/landing-a`의 기존 섹션 순서는 광고 삽입 외에 바뀌지 않는다

# Constraints

- 실제 애드센스 Publisher ID는 환경변수로만 관리. 코드에 직접 삽입 금지
- 대시보드 영역에 광고 삽입 금지
- 기존 페이지 컴포넌트 구조를 최소한으로 변경 (`layout.tsx` 스크립트 추가, `AdSlot` 공용 컴포넌트 추가, 현재 섹션/컨테이너 내부에 슬롯 삽입만 허용)
- 광고 자동 최적화(Auto Ads)는 이 Task에서 설정하지 않음. 수동 슬롯만 배치
- 현재 worktree 기준 관련 공개 페이지 파일에 진행 중 변경이 있으므로, 실행 시에도 touched area 재검증 후 최소 삽입만 수행할 것
- 현재 코드 기준으로 존재 여부가 확인된 touched area는 `frontend/app/layout.tsx`, `frontend/app/(landing)/landing-a/page.tsx`, `frontend/app/(landing)/landing-a/_components.tsx`, `frontend/app/(landing)/programs/page.tsx`, `frontend/app/(landing)/programs/[id]/page.tsx`, `frontend/components/AdSlot.tsx`(신규)다

# Non-goals

- 애드센스 계정 생성/승인 (운영 영역)
- Phase 2 훈련기관 직접 광고 상품 (별도 Task)
- 광고 제거 구독 (`is_premium` 기반, Phase 2.5)
- 광고 A/B 테스트
- 프로그램 카드의 `is_ad` 필드 기반 스폰서 카드 표시

# Edge Cases

- 애드센스 승인 전에도 슬롯 코드가 에러 없이 렌더링되어야 한다 (빈 공간 또는 미노출)
- 광고 차단기(AdBlock) 사용 시 레이아웃 깨짐 없이 정상 동작해야 한다
- SSR에서 `window`/`document` 참조 오류 방지 (`use client` 또는 dynamic import)
- `frontend/app/(landing)/programs/page.tsx`의 `RecommendedProgramsSection`, 검색/필터, 페이지네이션 로직을 광고 작업 중 손상하지 않아야 한다
- `frontend/app/(landing)/programs/[id]/page.tsx`의 JSON-LD 삽입과 notFound/error 처리 흐름을 유지해야 한다

# Transport Notes

- 로컬 실행: `tasks/inbox/TASK-2026-04-16-1530-adsense-slots.md`
- 원격 실행: `tasks/remote/TASK-2026-04-16-1530-adsense-slots.md`
