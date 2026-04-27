# SESSION-2026-04-26 Dashboard QA Fixes Result

## changed files

- `frontend/app/dashboard/page.tsx`
- `frontend/app/dashboard/_hooks/use-dashboard-recommendations.ts`
- `frontend/app/dashboard/_hooks/recommend-calendar-cache.ts`
- `frontend/app/dashboard/_hooks/recommend-calendar-cache.test.ts`
- `frontend/app/api/dashboard/bookmarks/route.ts`
- `frontend/app/api/dashboard/recommended-programs/route.ts`
- `frontend/app/api/dashboard/recommend-calendar/route.ts`
- `frontend/lib/api/app.ts`
- `frontend/app/dashboard/dashboard-copy.ts`
- `frontend/lib/program-card-items.ts`
- `frontend/lib/program-card-items.test.ts`
- `frontend/lib/server/program-card-summary.ts`
- `frontend/lib/server/program-card-summary.test.ts`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## why changes were made

- 대시보드 QA에서 확인된 인사말 위치, 상단 헤더 높이, 왼쪽 작은 달력 영역 폭, 오늘 성과 집계 기준, 커리어 핏 추천 점수/정렬, 찜한 과정 카드 hover clipping 문제를 직접 수정했다. 이후 인사말은 왼쪽 사이드 최상단, 작은 달력 위로 순서를 조정했다.
- `오늘의 성과` 표시 순서를 자기소개서가 이력서 위에 오도록 바꾸고, 이력서 아래에 포트폴리오 당일 저장 건수를 추가했다.
- 대시보드 하단 카드의 D-day를 공통 badge 규칙으로 오른쪽 상단에만 표시하고, 기존 HOT/NEW badge와 본문 마감일 중복 표기를 제거했다.
- 커리어 핏 점수가 0%로 보이던 원인은 `relevance_score=0`이 양수 `score/final_score` fallback을 막는 score helper 우선순위였다. helper가 양수 점수를 우선 사용하도록 수정했다.
- 커리어 핏 추천에서 마감된 과정이 보이지 않도록 추천 BFF 응답과 클라이언트 localStorage 캐시 사용 경로에 같은 마감 제외 helper를 적용했다. 후속 보정으로 날짜상 모집중인 카드가 stale `is_open/is_active=false` flag 때문에 숨겨지지 않도록 날짜 신호를 우선한다.
- 추천 BFF가 성공 응답으로 빈 추천을 반환하거나 마감 제외 후 0건이 되어도 섹션을 비우지 않도록, 백엔드 추천 엔진 -> 사용자 DB 용어 직접 매칭 -> 모집중 품질 fallback 순서로 최대 5개를 채우는 단계형 추천 조립을 추가했다.
- 추천 카드가 계속 비던 추가 원인은 추천 BFF fallback의 Supabase direct 조회가 `program_list_index` statement timeout을 내면 API가 400으로 끝나는 경로였다. 추천 BFF도 먼저 빠른 backend `/programs/list?recruiting_only=true&sort=deadline` fallback을 쓰고, Supabase direct fallback은 로컬 날짜 기준 `deadline >= 오늘`으로 조회하도록 보강했다.
- read-model fallback이 stale `is_open=true` 과거 마감 row를 먼저 가져온 뒤 화면 필터에서 전부 제외할 수 있어, deadline-ordered fallback의 read-model 조회 기준을 `is_open=true`에서 `deadline >= today`로 바꿨다.
- 한 번 추천이 로딩되면 재진입 시 빠르게 보이도록 추천 localStorage 캐시를 `isoser:dashboard-recommended-programs:v3` 6시간 TTL로 바꾸고, 모집중 카드가 있으면 즉시 표시하도록 했다.
- 공개 fallback 카드는 화면에 점수나 퍼센트를 노출하지 않고, 내부 보충/정렬 기준으로만 사용한다.
- 후속 기준 변경으로 `내 커리어 핏 추천`은 70점 threshold와 카드의 `커리어 핏 N%` 텍스트를 제거했다. 추천 순서는 BFF가 사용자 DB 기반 매칭과 품질 fallback을 합쳐 정하고, 프론트는 그 순서를 그대로 따른다.
- 찜한 과정이 빈 목록처럼 보이는 문제를 줄이기 위해 `/api/dashboard/bookmarks`는 `program_bookmarks`가 비어 있으면 legacy `bookmarks` 테이블도 확인하고, 카드 summary는 `programs` 테이블을 먼저 읽어 read-model timeout 영향을 줄인다.
- 찜한 과정 클라이언트 조회 timeout은 15초로 늘렸고, 10분 localStorage 캐시가 있으면 재진입 시 먼저 보여준 뒤 최신 응답으로 갱신한다. 로딩/오류 상태도 빈 상태와 구분해 표시한다.
- `오늘의 성과` 하위 항목 아이콘/라벨/건수 글자 크기를 12px로 조정했다.
- 달력 내부 글자는 유지하고, 캘린더 툴바/왼쪽 정보 패널/하단 추천·찜 카드의 작은 글자를 `찜한 과정` 제목과 같은 15px 기준으로 키웠다.
- 커리어 핏 추천 strip이 캘린더/마감 fallback 데이터와 섞여 0% 카드가 먼저 보일 수 있어, 추천 전용 BFF와 단계형 보충 순서를 사용하도록 맞췄다.

## preserved behaviors

- 대시보드의 큰 월간 캘린더, 날짜 선택, 일정 유형 필터, 찜 표시, 캘린더 담기 동작은 유지했다.
- 추천/찜 카드의 기존 상세 이동, 비교 이동, `/programs` 탐색 링크는 유지했다.
- 추천 localStorage 캐시는 6시간 TTL의 v3 key로 유지하며, 이전 캘린더 fallback 0% cache가 추천 strip을 덮지 않게 분리했다.
- 추천 캐시는 기존 key를 새 v3 key로 분리해 오래된 15분 캘린더 캐시와 섞이지 않는다.
- D-day 색상/문구 계산은 공통 `ProgramDeadlineBadge`와 `getProgramDeadlineBadgeData` 규칙을 재사용했다.
- 추천 결과 정렬, 카드 클릭, 캘린더 담기 동작은 유지했다.

## risks / possible regressions

- 왼쪽 사이드 폭은 320px 고정이라 더 좁은 화면에서는 카테고리 chip이나 성과 텍스트 줄바꿈이 늘어날 수 있다.
- 오른쪽 큰 월간 달력은 5행/35칸 표시라, 월 시작 요일과 일수 조합에 따라 6번째 주가 필요한 달은 마지막 주 일부 날짜가 화면에 표시되지 않을 수 있다.
- 하단 추천/찜 strip은 5컬럼 grid로 고정되어 좁은 viewport에서는 카드 내부 제목/버튼 줄바꿈이 늘어날 수 있다.
- 왼쪽 카테고리 chip을 제거하면서 기존 카테고리별 큰 달력 이벤트 필터도 함께 제거됐다. 상단의 일정 유형 체크 필터는 유지된다.
- `오늘의 성과`는 브라우저 로컬 날짜 기준 생성일만 본다. 프로필/성과/이력서/자기소개서는 `created_at`, 포트폴리오는 BFF 응답의 `createdAt`을 사용하므로 서버/KST 기준과 브라우저 timezone이 다르면 자정 근처 집계가 달라질 수 있다.
- deadline/days_left가 없고 `is_open/is_active`도 비어 있는 과정은 명시적인 마감 신호가 없으므로 추천에서 유지된다.
- 추천 fallback은 개인화 추천이 비었을 때 섹션 공백을 막기 위한 모집중 공개 후보라, 사용자 DB 근거가 약한 경우에도 품질/마감 기준 카드가 보충될 수 있다. 화면에는 퍼센트를 표시하지 않아 정렬 점수를 관련도처럼 오해하는 위험은 줄였다.
- 사용자 DB 용어 직접 매칭은 프로필/활동/이력서/자기소개서/포트폴리오/찜 데이터의 텍스트 신호 기반이므로, 사용자가 기록한 정보가 적으면 공개 모집중 품질 fallback 비중이 커진다.
- 추천 API가 backend fallback까지 실패하면 Supabase direct fallback을 시도한다. 운영 DB의 deadline/order 인덱스 상태가 나쁘면 이 경로는 여전히 느릴 수 있으나, read-model timeout은 legacy fallback으로 넘기도록 완화했다.
- 6시간 localStorage 캐시는 재진입 속도를 높이지만, 사용자가 오래 열어 둔 브라우저에서는 최신 추천 반영이 background refresh 이후에 갱신된다.
- 찜한 과정 10분 localStorage 캐시는 서버 최신 상태보다 먼저 보일 수 있다. 최신 응답이 도착하면 다시 덮어쓴다.
- 15px 기준으로 올린 카드/패널 텍스트는 긴 과정명이나 기관명이 많은 데이터에서 줄바꿈과 말줄임이 더 자주 발생할 수 있다.
- 인증 세션 없이 브라우저에서 `/dashboard`는 로그인 화면으로 redirect되어 실제 김지원 계정 데이터 기반 visual QA는 수행하지 못했다.

## verification

- `npx tsc --noEmit --pretty false`: passed.
- `npm run test -- program-card-items.test.ts`: passed.
- `npm run test -- program-card-items.test.ts`: passed after sandbox `spawn EPERM` 때문에 권한 상승 재시도.
- `npm run test -- program-card-items.test.ts recommend-calendar-cache.test.ts program-card-summary.test.ts`: passed.
- `npx tsc --noEmit --pretty false`: passed after 찜한 과정 fallback/cache, 오늘의 성과 12px 변경.
- `npx tsc --noEmit --pretty false`: passed after 추천 threshold 제거, BFF 순서 유지, 카드 퍼센트 제거.
- `http://localhost:3000/api/dashboard/recommended-programs`: 최초에는 Supabase statement timeout 400을 재현했고, 단계형 fallback 보강 후 비인증 로컬 호출에서도 0.58초에 5개 `dashboard_quality_open_fallback` item을 반환함을 확인했다.
- `npx playwright screenshot ... http://localhost:3001/dashboard`: 로그인 화면으로 redirect됨을 확인. 인증 세션 부재로 실제 대시보드 화면의 데이터 QA는 코드 경로 검토로 대체했다.

## follow-up refactoring candidates

- 대시보드의 `MiniCalendar`와 큰 캘린더가 날짜 cell 계산을 각각 들고 있으므로 공용 helper/component로 더 줄일 수 있다.
- `useDashboardRecommendations`의 추천 cache 파일명이 아직 `recommend-calendar-cache`라 의미가 넓어졌다. 추천 전용 cache helper로 이름을 분리하면 추후 혼동을 줄일 수 있다.
- Supabase direct fallback의 `deadline >= today order deadline limit` 경로는 DB index와 statement timeout 영향을 받는다. 운영에서는 `program_list_index(deadline)` 또는 모집중 read-model materialized 후보를 별도로 점검하는 것이 좋다.
- 왼쪽 320px 고정 폭은 QA 요구를 만족하지만, 태블릿 이하에서는 responsive width 토큰으로 완화하는 후속 검토가 필요하다.
