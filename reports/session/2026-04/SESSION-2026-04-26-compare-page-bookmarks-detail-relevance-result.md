# Compare Page Bookmarks Detail Relevance Result

## Changed files
- `frontend/app/(landing)/compare/program-select-modal.tsx`
- `frontend/app/(landing)/compare/page.tsx`
- `frontend/app/(landing)/compare/programs-compare-client.tsx`
- `frontend/app/(landing)/compare/compare-formatters.ts`
- `frontend/app/(landing)/compare/compare-copy.ts`
- `frontend/app/(landing)/compare/compare-suggestions.ts`
- `frontend/app/dashboard/dashboard-copy.ts`
- `frontend/app/dashboard/page.tsx`
- `frontend/app/dashboard/_hooks/use-dashboard-recommendations.ts`
- `frontend/app/dashboard/_components/dashboard-program-cards.tsx`
- `frontend/app/dashboard/_components/dashboard-calendar-section.tsx`
- `frontend/app/api/dashboard/recommended-programs/route.ts`
- `frontend/app/api/dashboard/recommend-calendar/route.ts`
- `frontend/app/(landing)/compare/compare-value-getters.ts`
- `frontend/app/(landing)/compare/compare-table-sections.tsx`
- `frontend/app/(landing)/compare/compare-relevance-section.tsx`
- `frontend/app/(landing)/programs/page.tsx`
- `frontend/app/(landing)/programs/[id]/program-detail-client.tsx`
- `frontend/app/api/programs/compare-search/route.ts`
- `frontend/app/api/dashboard/bookmarks/route.ts`
- `frontend/lib/api/backend.ts`
- `frontend/lib/api/app.ts`
- `frontend/lib/server/program-card-summary.ts`
- `frontend/lib/program-display.ts`
- `frontend/lib/types/index.ts`
- `backend/routers/programs.py`
- `backend/tests/test_programs_router.py`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made
- 로그인 직후 비교 모달이 서버 렌더링 시점의 `isLoggedIn` 값에 막혀 `program_bookmarks`를 조회하지 못할 수 있었다.
- 비교 표가 상세 페이지에서 이미 쓰는 `ProgramDetailResponse` 항목을 충분히 보여주지 못했고, 비용 명칭과 일부 분류/참여 시간 값이 중복되거나 모호했다.
- AI 적합도 UI가 `user_recommendation_profile`와 관련 스키마 근거를 충분히 드러내지 못했고, backend `behavior` 점수도 실제 행동 DB 신호와 직접 연결되어 있지 않았다.
- 후속 리팩토링으로 비교 표 formatter와 표 값 추출을 전용 helper로 분리해 렌더링 컴포넌트의 책임을 줄였다. 이후 AI 적합도 UI는 다시 3개 핵심 행으로 간소화했다.
- 상세 페이지는 중복 추천 대상/배지 문구가 그대로 반복될 수 있어 chip/list dedupe와 안정적인 key 조합으로 렌더링을 보강했다.
- 설계 재검토 결과 비교 선택 UI가 전용 `ProgramSelectSummary` 계약을 계속 써 대시보드 찜 카드와 공개 프로그램 목록 규칙에서 다시 갈라질 수 있어, `ProgramCardItem(program + context)` 기반으로 통합했다.
- 스크린샷 기준으로 검색/추천 후보에 마감 공고가 섞이고, 소개 섹션이 기관명을 훈련 설명처럼 표시하며, 김호준 사용자 기준 적합도가 0%로만 보이는 문제가 남아 있었다.
- DB 확인 결과 `김 호 준` 프로필은 존재하고 `program_bookmarks` 6건, `calendar_program_selections` 3건, `user_recommendation_profile` 정본과 visible activities 2건도 존재했다. 따라서 찜 탭 문제는 데이터 부재가 아니라 BFF read 경로/RLS/세션 취약성으로 분류했다.
- 사용자가 보고 있던 `localhost:3000`은 현재 작업 트리의 Next dev server였고, backend는 8000번 `uvicorn main:app`로 확인됐다. `/programs`가 열리지 않는 직접 원인은 8000 backend의 `/programs/filter-options?recruiting_only=true`가 약 29초 걸려 SSR 진입을 붙잡는 병목이었다.
- 스크린샷의 비교 항목 3건(`0efa9c1d-...`, `156a8018-...`, `0deff885-...`)에서 `운영 방식`, `신청 방법`, `선발 절차`, `만족도`, `후기 수`가 `데이터 미수집`으로 보이는 원인을 DB/API에서 확인했다. Work24 원천 row가 앞의 두 항목에는 `teaching_method/application_method/selection_process`를 제공하지 않고, 세 번째 항목만 `teaching_method=온라인`을 가진다. 만족도/등록 인원은 원천 메타에 0값이 있어 미수집이 아니라 `평점 없음`/`0개`로 보여야 했다.
- 하단 `비교에 추가해볼 만한 프로그램`이 공개 browse 후보만 보여줘 `추천`이라는 문구와 실제 기준이 어긋났다. 기존 찜/대시보드 추천/프로그램 목록 검색 규칙을 재사용해 비교 맥락에 맞는 후보 우선순위로 재구성했다.
- 비교페이지 문구가 `적합도`, `관련도`, `분석`, `프로필 기준`, `추천`처럼 섞여 있어 같은 기능을 다르게 해석하게 만들었다. 사용자-facing 문구를 `커리어 핏`, `과정`, `내 이력` 중심으로 통일하고 copy를 `compare-copy.ts`로 모았다.
- 후속 리팩토링 후보였던 upstream 에러 detail 노출 완화와 대시보드 추천/캘린더 용어 통일을 진행했다. 대시보드 프로그램/일정 copy는 `dashboard-copy.ts`로 모으고, 추천/관련도/찜콩 표현을 `커리어 핏/과정/담기` 흐름으로 맞췄다.
- 후속 리팩토링 후보 중 우선순위가 높았던 비교 하단 후보 조립 책임 분리를 진행했다. `page.tsx`에 길게 있던 후보 조립 로직을 `compare-suggestions.ts`로 옮겨 page 컴포넌트의 책임을 줄였다.

## Preserved behaviors
- `/compare?ids=` URL 구조, 최대 3개 비교 슬롯, batch 기본/상세 조회 fallback은 유지했다.
- 비로그인 사용자는 찜 탭에서 로그인 안내를 계속 본다.
- 관련도 계산은 로그인 사용자에게만 제공되며, 기존 `relevance_score`, `skill_match_score`, `region_match_score` 계약을 유지했다.
- 비교 추가 동작은 계속 program id만 URL `ids`에 반영한다.
- 커리어 핏 계산 API, 점수 산식, 후보 조립 우선순위는 유지하고 화면 문구와 copy 관리 위치만 정리했다.
- 대시보드 추천 API, 캘린더 API, 찜/캘린더 저장 동작은 유지하고 화면 문구와 fallback reason만 정리했다.
- 비교 하단 후보의 우선순위, 모집중 필터, 중복 제외, 맞춤 후보 timeout, 공개 fallback은 그대로 유지했다.

## Risks / possible regressions
- 비로그인 사용자가 찜 탭을 열 때도 `/api/dashboard/bookmarks` 확인 요청이 1회 발생한다.
- 검색 탭은 입력 즉시 자동 검색 대신 검색 버튼 또는 Enter로 검색어를 적용한다.
- compare-search 응답이 `ProgramSelectSummary[]`에서 `ProgramCardItem[]`로 바뀌었으므로, 구형 compare-search 소비자가 있으면 타입/응답 shape가 맞지 않는다. 현재 저장소 코드 기준 소비자는 비교 모달뿐이다.
- 찜 탭은 인증 확인 후 service-role read fallback을 사용한다. 사용자 id는 현재 쿠키 세션에서만 얻고, 데이터 조회만 서버 권한으로 수행한다.
- compare-search는 BFF 단계에서 마감/비활성 후보를 한 번 더 제외하므로, backend가 의도적으로 archive 검색을 제공하더라도 비교 모달에는 노출되지 않는다.
- `/programs` 기본 browse 진입은 정적 filter option으로 먼저 렌더된다. 필터를 적용한 화면에서는 기존처럼 동적 option을 시도하지만 3.5초 제한 후 정적 fallback으로 내려간다.
- SSR 초기 찜 카드는 페이지 요청 시점의 쿠키 세션 기준이다. 브라우저에서 새로 찜한 직후 이미 열린 비교 모달은 클라이언트 재조회가 성공해야 최신 상태로 갱신된다.
- 하단 후보의 맞춤 추천 단계는 `/programs/recommend`를 3.5초 안에서만 기다린다. 추천 API가 느리거나 실패하면 유사 검색/공개 모집중 fallback 후보로 계속 렌더링한다.
- 비교/대시보드 client fallback은 사용자 copy로 매핑하지만, 다른 화면이나 브라우저 개발자 도구의 raw API 응답에는 backend detail이 그대로 남을 수 있다.
- 전체 `backend/tests/test_programs_router.py`는 기존 endpoint 테스트 일부가 실제 Supabase로 새는 문제가 남아 전체 실행 기준으로 실패한다.

## Test points
- 로그인 후 프로그램 목록/상세에서 찜한 프로그램이 `/compare` 선택 모달의 `찜한 프로그램` 탭에 보이는지 확인한다.
- 선택 모달 전체 검색 탭에서 검색창이 스크롤 중 상단에 남고, 검색 버튼/Enter로 결과가 갱신되는지 확인한다.
- 선택 모달의 찜 탭 카드와 대시보드 찜 카드가 같은 프로그램 id, 마감, 비용, 운영기관 데이터를 보여주는지 확인한다.
- 검색어가 없는 전체 검색 탭은 공개 `/programs/list` 기본 browse 후보를, 검색어가 있는 경우는 search 후보를 보여주는지 확인한다.
- 비교 표에서 훈련비/자부담금, 과정 분류, NCS, 운영 방식, 참여 시간, 신청 방법, 선발 절차가 상세 페이지와 같은 의미로 보이는지 확인한다.
- AI 적합도 섹션에서 `종합 적합도`, `매칭 키워드`, `AI 코멘트 한스푼` 3개 행만 표시되고, 활동/프로젝트 키워드가 맞을 때 종합 적합도 퍼센트가 상향 반영되는지 확인한다.
- 소개 섹션에 기관명만 있는 프로그램은 `소개` 섹션 자체가 숨겨지는지 확인한다.
- 김호준 프로필 기준으로 개발 관련 프로그램은 직무/활동/준비도 근거가 점수에 반영되고, 찜/캘린더에 있는 프로그램은 behavior 5점과 해당 사유가 붙는지 확인한다.
- 하단 후보가 현재 비교 중인 id를 제외하고, 찜한 프로그램/비교 항목 유사/내 프로필 기준/모집중 공개 후보 라벨 중 하나를 보여주는지 확인한다.
- 비교페이지와 선택 모달에서 `적합도/관련도/분석/프로필 기준` 같은 혼재 표현이 사라지고 `커리어 핏/과정/내 이력` 흐름으로 보이는지 확인한다.
- 대시보드 추천 strip, 찜 strip, 추천 카드, 캘린더 섹션에서 `AI 추천`, `관련도`, `추천관리`, `찜콩` 같은 표현이 사용자 화면에 남지 않았는지 확인한다.
- 비교 하단 후보가 리팩토링 전과 같은 우선순위와 최대 4개 노출 계약을 유지하는지 확인한다.

## Verification
- `npm run lint -- --file "app/(landing)/compare/program-select-modal.tsx" --file "app/(landing)/compare/programs-compare-client.tsx" --file "app/(landing)/compare/compare-table-sections.tsx" --file "app/(landing)/compare/compare-relevance-section.tsx"`: passed.
- `npx tsc -p tsconfig.codex-check.json --noEmit`: passed.
- `python -m py_compile backend\routers\programs.py`: passed.
- `backend\venv\Scripts\python.exe -m pytest backend\tests\test_programs_router.py -q -k "compute_program_relevance_items"`: passed.
- `backend\venv\Scripts\python.exe -m pytest backend\tests\test_programs_router.py::test_filter_options_use_facet_snapshot_for_default_browse -q`: passed.
- 후속 리팩토링 이후 같은 frontend lint/typecheck, backend py_compile, relevance pytest를 재실행해 통과했다.
- `compare-value-getters.ts` 분리 후 `npm run lint -- --file "app/(landing)/compare/compare-formatters.ts" --file "app/(landing)/compare/compare-value-getters.ts" --file "app/(landing)/compare/compare-table-sections.tsx" --file "app/(landing)/compare/compare-relevance-section.tsx" --file "app/(landing)/compare/programs-compare-client.tsx" --file "app/(landing)/compare/page.tsx"`: passed.
- `compare-value-getters.ts` 분리 후 `npx tsc -p tsconfig.codex-check.json --noEmit`: passed.
- `ProgramCardItem` 통합 후 `npm run lint -- --file "app/(landing)/compare/program-select-modal.tsx" --file "app/(landing)/compare/programs-compare-client.tsx" --file "app/(landing)/compare/page.tsx" --file "app/api/programs/compare-search/route.ts" --file "lib/types/index.ts" --file "lib/program-display.ts" --file "lib/api/backend.ts"`: passed.
- `ProgramCardItem` 통합 후 `npx tsc -p tsconfig.codex-check.json --noEmit`: passed.
- `ProgramCardItem` 통합 후 `python -m py_compile backend\routers\programs.py backend\tests\test_programs_router.py`: passed.
- `ProgramCardItem` 통합 후 `backend\venv\Scripts\python.exe -m pytest backend\tests\test_programs_router.py -q -k "compute_program_relevance_items"`: passed.
- 기존 3000 포트의 node 서버는 `/compare`, `/landing-c` 모두 404를 반환해 최신 작업 트리 서버로 보지 않았다. 별도 `http://127.0.0.1:3001` dev server를 시작한 뒤 `/compare` smoke는 200을 반환했다.
- 후속 수정 후 `npm run lint -- --file "app/(landing)/compare/program-select-modal.tsx" --file "app/(landing)/compare/programs-compare-client.tsx" --file "app/(landing)/compare/page.tsx" --file "app/(landing)/compare/compare-table-sections.tsx" --file "app/(landing)/compare/compare-value-getters.ts" --file "app/api/programs/compare-search/route.ts" --file "app/api/dashboard/bookmarks/route.ts" --file "lib/api/app.ts" --file "lib/program-display.ts" --file "lib/server/program-card-summary.ts" --file "lib/types/index.ts"`: passed.
- 후속 수정 후 `npx tsc -p tsconfig.codex-check.json --noEmit`: passed.
- 후속 수정 후 `python -m py_compile backend\routers\programs.py backend\tests\test_programs_router.py`: passed.
- 후속 수정 후 `backend\venv\Scripts\python.exe -m pytest backend\tests\test_programs_router.py -q -k "compute_program_relevance_items"`: passed.
- `http://127.0.0.1:3000/api/programs/compare-search?limit=30&recruiting_only=true`: 30건 중 `days_left < 0` 또는 `is_active=false` 0건, 최소 `days_left=0`.
- `http://127.0.0.1:3000/api/programs/compare-search?q=AI&limit=30&recruiting_only=true`: 24건 중 `days_left < 0` 또는 `is_active=false` 0건, 최소 `days_left=0`.
- 비로그인 쿠키 없는 `/api/dashboard/bookmarks` smoke는 401을 즉시 반환했다. Google OAuth 대리 로그인은 계정 자격 증명/브라우저 세션 접근 없이 수행하지 않았다.
- Supabase direct check: `김 호 준` user id `ebd4b7c2-f946-420c-abb7-471a262d746c`, bookmarks 6건, recommendation profile ready, activities 2건, calendar selections 3건 확인.
- Direct relevance check: 김호준 기준 AI 스프레드시트/프론트엔드 개발 과정은 score 0.63, 마케팅 과정은 0.28, 찜/캘린더 행동이 있는 과정은 behavior 5점 포함 score 0.33으로 계산됨을 확인했다.
- 서버 확인: `localhost:3000` listener PID 15432는 `D:\02_2025_AI_Lab\isoser\frontend\node_modules\next\dist\server\lib\start-server.js`, 8000 listener PID 24736은 `python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000`로 확인했다.
- 병목 확인: `http://127.0.0.1:8000/programs/filter-options?recruiting_only=true`는 로컬 측정 기준 29,266ms가 걸렸다.
- 수정 후 smoke: `http://127.0.0.1:3000/programs`는 200 응답, 4,917ms, HTML length 465,805로 복구됐다.
- 수정 후 smoke: `http://127.0.0.1:3000/api/programs/compare-search?limit=30&recruiting_only=true`는 200 응답, 30건, closed 후보 0건으로 확인됐다.
- 수정 후 detail probe: `0efa9c1d-...`, `156a8018-...`, `0deff885-...` 모두 backend 8000 detail 200 응답. 앞의 두 row는 운영 방식/신청 방법/선발 절차/평점/후기 필드가 비어 있고, 세 번째 row는 `teaching_method=온라인`만 존재하는 것을 확인했다.
- 수정 후 smoke: `http://127.0.0.1:3000/compare?ids=0efa9c1d-1a25-45f0-a632-dd25456a7192%2C156a8018-3039-4bc1-b3d8-10cba1e57843%2C0deff885-f564-4ba7-ad60-d1c05ecd40c9`는 200 응답, 신청 방법 fallback/선발 절차 fallback 포함, 기관명뿐인 소개 섹션 미렌더링을 확인했다.
- AI 적합도 간소화 후 `npm run lint -- --file "app/(landing)/compare/compare-relevance-section.tsx" --file "app/(landing)/compare/programs-compare-client.tsx"`: passed.
- AI 적합도 간소화 후 `npx tsc -p tsconfig.codex-check.json --noEmit`: passed.
- AI 적합도 간소화 후 `python -m py_compile backend\routers\programs.py backend\tests\test_programs_router.py`: passed.
- AI 적합도 간소화 후 `backend\venv\Scripts\python.exe -m pytest backend\tests\test_programs_router.py -q -k "compute_program_relevance_items"`: passed.
- AI 적합도 간소화 후 compare smoke: `http://127.0.0.1:3000/compare?ids=73e2fa68-0f2f-4d52-a031-2f2ee4d094f5%2C4d73cf8f-f178-4b6c-8f50-0341d4c32013%2C15342a4a-e072-4792-9ce2-dbb687629daf`는 200 응답, `종합 적합도`, `매칭 키워드`, `AI 코멘트 한스푼` 문구 포함을 확인했다.
- 비교 표 항목 정리 후 `운영 방식`, `비용 유형`, `후기 수` 행을 제거했고, `getReviewCountLabel` 전용 getter도 제거했다.
- 하단 후보 우선순위 수정 후 `npm run lint -- --file "app/(landing)/compare/page.tsx" --file "app/(landing)/compare/programs-compare-client.tsx"`: passed.
- 하단 후보 우선순위 수정 후 `npx tsc -p tsconfig.codex-check.json --noEmit`: passed.
- 하단 후보 우선순위 수정 후 compare smoke: `http://127.0.0.1:3000/compare?ids=73e2fa68-0f2f-4d52-a031-2f2ee4d094f5%2Cc4d73cf8-f178-4b6c-8f50-0341d4c32013%2C15342a4a-e072-4792-9ce2-dbb687629daf`는 200 응답, 새 하단 후보 설명 문구 포함을 확인했다.
- 비교 copy 정리 후 `npm run lint -- --file "app/(landing)/compare/compare-copy.ts" --file "app/(landing)/compare/page.tsx" --file "app/(landing)/compare/programs-compare-client.tsx" --file "app/(landing)/compare/program-select-modal.tsx" --file "app/(landing)/compare/compare-relevance-section.tsx"`: passed.
- 비교 copy 정리 후 `npx tsc -p tsconfig.codex-check.json --noEmit`: passed.
- 비교 copy 정리 후 `rg -n "적합도|관련도|분석|프로필 기준|Google로|찜한 프로그램|프로그램 선택|프로그램명|프로그램 추가|나에게 가장 적합" "frontend/app/(landing)/compare"`: no matches.
- 비교 copy 정리 후 compare smoke: `http://127.0.0.1:3000/compare?ids=73e2fa68-0f2f-4d52-a031-2f2ee4d094f5%2Cc4d73cf8-f178-4b6c-8f50-0341d4c32013%2C15342a4a-e072-4792-9ce2-dbb687629daf`는 200 응답, `커리어 핏`/`내 이력과 비교하면 더 정확해져요` 포함, 기존 `로그인하면 내 프로필 기준 관련도` 문구 미포함을 확인했다.
- 대시보드 copy 정리 후 `rg -n "추천 프로그램|관련도|적합도|AI 추천|추천관리|찜한 훈련|찜콩|프로필을 완성|추천 근거|캘린더 추천|맞춤 취업 지원|프로필 기준|내 프로필 기준" frontend/app/dashboard frontend/app/api/dashboard/recommended-programs/route.ts frontend/app/api/dashboard/recommend-calendar/route.ts frontend/components/programs "frontend/app/(landing)/compare"`: no matches.
- 대시보드 copy 정리 후 `npm run lint -- --file "app/dashboard/dashboard-copy.ts" --file "app/dashboard/page.tsx" --file "app/dashboard/_hooks/use-dashboard-recommendations.ts" --file "app/dashboard/_components/dashboard-program-cards.tsx" --file "app/dashboard/_components/dashboard-calendar-section.tsx" --file "app/api/dashboard/recommended-programs/route.ts" --file "app/api/dashboard/recommend-calendar/route.ts" --file "app/(landing)/compare/page.tsx" --file "app/(landing)/compare/programs-compare-client.tsx" --file "app/(landing)/compare/program-select-modal.tsx"`: passed.
- 대시보드 copy 정리 후 `npx tsc -p tsconfig.codex-check.json --noEmit`: passed.
- 대시보드 copy 정리 후 compare smoke: `http://127.0.0.1:3000/compare?...`는 200 응답, `커리어 핏` 포함, `관련도` 미포함을 확인했다.
- 대시보드 copy 정리 후 비로그인 `/dashboard` smoke는 기존대로 `/login?redirectedFrom=%2Fdashboard` 307 redirect를 반환했다.
- `compare-suggestions.ts` 분리 후 `npm run lint -- --file "app/(landing)/compare/page.tsx" --file "app/(landing)/compare/compare-suggestions.ts"`: passed.
- `compare-suggestions.ts` 분리 후 `npx tsc -p tsconfig.codex-check.json --noEmit`: passed.

## Follow-up refactoring candidates
- 비교 표 row 정의가 길어지고 있어 섹션별 row 배열을 별도 module로 나눌 수 있다.
- 비교 모달 검색은 검색어 적용형으로 바뀌었으므로, 필요하면 최근 검색어나 초기 인기 검색 결과 copy를 별도 설계할 수 있다.
- `compare-relevance`와 대시보드 추천 serializer의 response builder를 route-local helper에서 별도 recommendation service module로 분리할 수 있다.
- dashboard와 compare 각각에 생긴 copy 객체를 장기적으로 `frontend/lib/copy/program-surfaces.ts` 같은 공용 copy module로 합칠 수 있다.
- `formatProgramRelevanceText`처럼 아직 이름에 relevance가 남은 내부 helper는 화면 영향이 없지만, 추후 커리어 핏 naming으로 별도 deprecation path를 잡을 수 있다.
