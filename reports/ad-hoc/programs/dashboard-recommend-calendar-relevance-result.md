# Dashboard Recommend Calendar Relevance Result

## Changed files

- `backend/routers/programs.py`
- `backend/tests/test_programs_router.py`
- `frontend/app/api/dashboard/recommend-calendar/route.ts`
- `frontend/app/dashboard/page.tsx`
- `frontend/lib/types/index.ts`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made

- `/programs`에서 맞춤 추천 섹션을 제거하면서, 기존 추천 규칙과 관련도 근거를 대시보드 추천 캘린더에서 계속 볼 수 있어야 했다.
- 캘린더 추천은 이미 `relevance_score`, `urgency_score`, `final_score`로 정렬되지만, 프론트 카드에는 관련도 배지와 추천 사유가 충분히 노출되지 않았다.
- 대시보드 진입 시 추천 상류 호출이 길어지면 추천 카드 영역이 skeleton 상태로 오래 남아, 첫 화면에서 확인 가능한 정보가 부족했다.

## Preserved behaviors

- `GET /programs/recommend/calendar`의 기존 만료 프로그램 제외, `final_score desc`, `deadline asc` 정렬을 유지했다.
- 추천 데이터가 없거나 백엔드 호출이 실패할 때 공개 프로그램을 모집 마감순으로 fallback 노출하는 BFF 동작을 유지했다.
- 대시보드 캘린더 적용/초기화, 서버 저장, localStorage fallback 동작은 변경하지 않았다.
- 상류 추천이 지연되어도 공개 프로그램 fallback이 빠르게 반환되도록 BFF timeout을 추가했다.
- 기본 추천 목록은 15분 localStorage cache로 즉시 표시한 뒤 최신 응답으로 갱신하도록 했다.

## Risks / possible regressions

- 캐시 추천 row에는 원본 추천 사유가 저장되어 있지 않아, 캐시 경로는 새로 계산한 관련도 배지와 기본 캐시 사유를 표시한다.
- fallback 공개 프로그램은 개인화 추천이 아니므로 관련도 배지와 맞춤 키워드를 비워 둔다.
- 캐시된 기본 추천은 최대 15분 동안 stale할 수 있지만, 화면 진입 후 백그라운드 최신 요청으로 갱신된다.

## Follow-up refactoring candidates

- 추천 캐시에 `fit_keywords`, `relevance_reasons`, `relevance_badge`를 저장해 캐시 경로에서도 fresh recommendation과 같은 사유를 보여준다.
- 대시보드 추천 카드와 `/programs` 카드의 관련도 표시 UI를 공통 컴포넌트로 분리한다.
- 운영 데이터가 충분하면 `/api/dashboard/recommend-calendar` fallback 응답 시간을 2초대까지 줄일 수 있도록 backend 목록 fallback query를 더 좁힌다.

## Verification results

- Passed: `npm run lint -- --file app/dashboard/page.tsx --file app/api/dashboard/recommend-calendar/route.ts --file lib/types/index.ts`
- Passed: `npx tsc -p tsconfig.codex-check.json --noEmit`
- Passed: `backend\venv\Scripts\python.exe -m pytest backend\tests\test_programs_router.py -q`
- Passed: `agent-browser open http://localhost:3001/dashboard`; unauthenticated access redirected to login and no Next.js error overlay was detected
- Passed: `Invoke-WebRequest http://localhost:3001/api/dashboard/recommend-calendar`; returned `200` in about 4.4 seconds with timeout fallback available
