---
id: TASK-2026-04-15-0951-programs-hub-mvp
status: queued
type: feature
title: 프로그램 허브 MVP — /programs 페이지 + HRD-Net 데이터 수집 파이프라인
priority: high
planned_by: claude
planned_at: 2026-04-15T09:51:00+09:00
planned_against_commit: d125cd47caeee7055d2d33977e37352377035102
---

# Goal

HRD-Net 공공 API(data.go.kr)에서 훈련 프로그램 데이터를 수집해 Supabase `programs` 테이블에 저장하고, 이를 `/programs` 공개 페이지에서 사이드바 필터 + 카드 그리드 형태로 보여준다.

이 페이지는 이소서의 핵심 유입 경로다. 로그인 없이 누구나 접근할 수 있어야 하며, 랜딩 페이지에서 자연스럽게 진입할 수 있어야 한다.

UI 초안 참조 파일은 `cowork/drafts/isoser-programs.html`이다. 이 파일은 cowork draft이므로 실행 기준 문서는 본 packet이며, 구현 시에는 draft의 레이아웃·컬러·컴포넌트 구조를 참고하되 저장소 실제 경로와 Next.js 구조에 맞게 변환한다.

**Drift 주의:** `programs` 테이블은 현재 Supabase에 존재하지 않는다. 이 Task에서 `supabase/migrations/`에 신규 migration 파일을 추가해야 한다. 구현 러너는 실행 전 Supabase 테이블 목록과 기존 migration 파일을 확인해 충돌 여부를 검증한다.

# User Flow

- 비로그인 사용자가 `/programs`에 직접 접근하거나 랜딩 페이지에서 진입한다
- 다크 헤더에서 전체 프로그램 수와 정렬 옵션(마감 임박순 / 최신순)을 확인한다
- 왼쪽 사이드바에서 카테고리, 지역, 수업방식 필터를 선택한다
- "모집중만 보기" 토글을 켜서 마감된 프로그램을 제외한다
- 카드 그리드에서 D-day 배지·수업방식·우수훈련기관 배지를 보며 원하는 프로그램을 찾는다
- 카드를 클릭하면 `/programs/[id]` 경로로 이동한다. 상세 페이지는 이번 Task 범위 밖이므로 404가 반환되는 것은 허용되며, 링크만 올바르게 연결되어 있어야 한다

# UI Requirements

**컬러 시스템** (`cowork/drafts/isoser-programs.html` 기준, Tailwind arbitrary value 또는 CSS 변수로 적용)

| 변수 | 값 | 용도 |
|---|---|---|
| `--ink` | `#0A0F1E` | 다크 배경, 주요 텍스트 |
| `--blue` | `#2563EB` | 주요 액션, 선택 상태 |
| `--fire` | `#F97316` | CTA, 활성 정렬 버튼 |
| `--red` | `#EF4444` | D-day 마감 임박 (D-3 이하) |
| `--amber` | `#F59E0B` | D-day 주의 (D-4 ~ D-7) |
| `--green` | `#22C55E` | 무료 지원 배지 |
| `--violet` | `#7C3AED` | AI·데이터 카테고리 |
| `--surface` | `#F1F5F9` | 페이지 배경 |

폰트는 기존 프로젝트 기준인 Pretendard를 사용한다 (draft의 Noto Sans KR 적용 금지).

**레이아웃**

- 최대 너비 1200px, 수평 중앙 정렬
- 페이지 상단: 다크(#0A0F1E) 배경 헤더 — 타이틀("국가 취업 지원 프로그램"), 총 건수, 정렬 버튼
- 본문: 사이드바(220px, sticky top-20) + 메인 컨텐츠 2-column grid
- 정렬 옵션은 마감 임박순·최신순 2가지로 한다 (관련도순은 로그인 기반이므로 이번 범위 제외)

**사이드바 필터**

- 최상단: "모집중만 보기" 토글 (`is_recruiting = true` 기준 필터링)
- 카테고리 accordion (기본 펼침, 단일 선택): 전체 / AI·데이터 / IT·개발 / 디자인 / 경영·마케팅 / 창업 / 기타. 각 항목 오른쪽에 해당 건수 표시
- 지역 accordion (기본 펼침, 체크박스 다중 선택): 서울 / 경기 / 부산 / 대전·충청 / 대구·경북 / 온라인
- 수업방식 accordion (기본 접힘, 체크박스): 온라인 / 오프라인 / 혼합
- 하단: 필터 초기화 버튼
- accordion 헤더 클릭으로 접기/펼치기 가능

**메인 컨텐츠**

- 결과 바: 현재 필터 기준 건수 표시 + 그리드/리스트 뷰 전환 버튼
- 활성 필터 태그: 선택된 필터를 태그로 나열, 각 태그의 X 클릭 시 해당 필터 제거
- 카드 그리드: 3열 (768px 이하 2열, 480px 이하 1열)
- 하단 페이지네이션: 1페이지 20건

**프로그램 카드** (`cowork/drafts/isoser-programs.html` 카드 구조 참조)

| 요소 | 표시 조건 및 규칙 |
|---|---|
| 출처 (card-src) | `source` 컬럼값 (HRD-Net / 고용24 / K-디지털 등) |
| D-day 배지 | `recruit_end_date` 기준. D-3 이하 빨강, D-4~7 주황, D-8~14 노랑, D-15 이상 초록. `recruit_end_date`가 null이면 배지 미표시 |
| 프로그램명 | 최대 2줄 line-clamp |
| 훈련 기간 | `start_date ~ end_date` |
| 카테고리 태그 | AI·데이터(보라) / IT·개발(파랑) / 디자인(핑크) / 경영·마케팅(초록) / 창업(주황) / 기타(회색) |
| 지원율 배지 | `support_type` 값 기준. "무료" 초록, "일부 지원" 파랑, 그 외 미표시 |
| 수업방식 태그 | `teaching_method` 값 기준. 온라인(하늘) / 오프라인(보라) / 혼합(초록) |
| 우수훈련기관 배지 | `is_certified = true`인 경우에만 표시 (amber 배지) |
| AD 배지 | `is_ad = true`인 경우 카드 우측 상단에 "AD" 표시. 광고 카드 배경은 draft 기준 구분. 실제 광고 운영 로직은 이번 범위 밖 |
| 카드 링크 | `href="/programs/{programs.id}"` — id는 Supabase `programs.id` (UUID) |
| 호버 효과 | border blue, translateY(-2px), blue shadow |
| 마감 임박 카드 | `recruit_end_date` 기준 D-3 이하인 경우 border red |

**검색**

- 위치는 `cowork/drafts/isoser-programs.html` 배치 참조
- `name` 컬럼 기준 텍스트 검색 (ILIKE 또는 Supabase `ilike` 필터)
- 검색과 필터 동시 적용 가능

**빈 상태**

- 검색/필터 결과 0건: "조건에 맞는 프로그램이 없습니다" + 필터 초기화 버튼
- `programs` 테이블 전체가 비어 있을 때: "현재 등록된 프로그램이 없습니다"

# Acceptance Criteria

1. `/programs`가 비로그인 상태로 접근 가능하다. 현재 middleware는 `/onboarding`과 `/dashboard/*`만 보호하므로 별도 수정 불필요 — 구현 러너는 실행 전 middleware가 변경되지 않았는지 확인한다
2. `programs` 테이블에 1건 이상 데이터가 있을 때 카드 그리드가 정상 렌더링된다
3. 카테고리 선택 시 해당 카테고리만 노출되고, 전체 선택 시 전체가 노출된다
4. 지역 체크박스 다중 선택이 동작한다 (서울 + 온라인 동시 선택 포함)
5. "모집중만 보기" 토글 ON 시 `is_recruiting = false`인 카드가 목록에서 제외된다
6. `name` 기준 검색어 입력 시 결과가 좁혀지고, 검색어 제거 시 전체가 복원된다
7. D-day 배지가 `recruit_end_date` 기준으로 정확히 계산되며 색상 분기가 맞다. `recruit_end_date`가 null인 카드에는 D-day 배지가 없다
8. 20건 초과 시 페이지네이션이 동작하고, 페이지 이동 시 목록이 올바르게 교체된다
9. 각 카드에 `href="/programs/{UUID}"` 링크가 존재한다. 상세 페이지가 없어 404가 반환되는 것은 허용이다
10. 수집 엔드포인트 중복 호출 시 `hrd_id` 기준으로 upsert되어 중복 행이 생기지 않는다
11. `HRD_NET_API_KEY` 환경 변수 미설정 시 수집 엔드포인트가 500이 아닌 명확한 에러 메시지를 담은 4xx 또는 503을 반환한다

# Constraints

- HRD-Net API 키는 `backend/.env`의 `HRD_NET_API_KEY`로만 관리. 프론트엔드 환경 변수에 절대 노출 금지
- 브라우저에서 Supabase 직접 호출 금지. Next.js Server Component 또는 Route Handler 경유
- Render 무료 티어 512MB 메모리 한계: 수집 시 페이지 단위 배치 처리. 전체 데이터를 한 번에 메모리에 올리지 않는다
- `programs` 테이블 migration은 `supabase/migrations/`에 새 SQL 파일로 추가. 기존 migration 파일 수정 금지
- middleware.ts의 인증 보호 라우트(`/onboarding`, `/dashboard/*`) 변경 금지
- 폰트는 Pretendard 유지. Noto Sans KR 혼입 금지
- 카테고리 매핑 로직은 HRD-Net 실제 API 응답의 직종 코드 또는 분류 필드를 기준으로 작성. 구현 러너가 data.go.kr 문서에서 필드명을 확인 후 결정하며, 확인 전까지 임의로 하드코딩하지 않는다

# Non-goals

- `/programs/[id]` 상세 페이지 구현
- 북마크 기능 (`program_bookmarks` 테이블 포함)
- HRD-Net 수집 자동화 (cron, GitHub Action, scheduler)
- AI 맞춤 추천 (`recommendations` 테이블 포함)
- 광고 카드 실제 운영 로직 (`is_ad` 컬럼 및 AD 배지 컴포넌트만 준비)
- 부트캠프 비교 기능 (카드의 비교 추가 UI)
- 로그인 사용자 개인화 (관련도순 정렬 포함)
- 서울 지역구 하위 필터

# Edge Cases

- HRD-Net API 호출 실패: 수집 엔드포인트는 에러 로그 후 HTTP 에러를 반환하고, 기존 `programs` 테이블 데이터는 변경하지 않는다
- `programs` 테이블 전체 빈 상태: 빈 상태 UI 노출
- 검색 + 필터 조합 결과 0건: 빈 상태 UI + 필터 초기화 버튼
- `recruit_end_date`가 null인 프로그램: D-day 배지 미표시. "모집중만 보기" 토글 적용 시 `is_recruiting` 컬럼 기준으로 판단
- HRD-Net API 응답 구조 변경 가능성: `raw_data JSONB`에 원본 응답 전체 보관. 필드 변경 시 `raw_data`에서 재파싱 가능하도록 한다
- 카테고리 매핑 실패 (HRD-Net 코드를 이소서 카테고리로 변환 불가): "기타"로 fallback 처리
- 동시에 여러 필터가 적용된 상태에서 특정 필터만 태그 X로 제거: 나머지 필터는 유지된다

# Open Questions

1. HRD-Net API 실제 엔드포인트 URL, 인증 방식, 페이지네이션 파라미터명 — 구현 러너가 data.go.kr 문서 확인 필요
2. HRD-Net 직종 코드 또는 분류 필드명 — 이소서 카테고리(AI·데이터 / IT·개발 / 디자인 / 경영·마케팅 / 창업 / 기타) 매핑 기준을 구현 러너가 응답 확인 후 결정
3. 수집 주기 — 수동 트리거로 시작하되, cron 도입 여부는 데이터 freshness 요건이 결정되면 별도 Task로 다룬다

# Transport Notes

- Local execution target: `tasks/inbox/TASK-2026-04-15-0951-programs-hub-mvp.md`
- Remote fallback target: `tasks/remote/TASK-2026-04-15-0951-programs-hub-mvp.md`
- 실행 전 현재 HEAD가 `d125cd47caeee7055d2d33977e37352377035102`인지 확인한다. 다른 commit이라면 drift 검토 후 `planned_against_commit`을 실제 HEAD로 교체하고 본문에서 영향받는 섹션을 재검토한다
