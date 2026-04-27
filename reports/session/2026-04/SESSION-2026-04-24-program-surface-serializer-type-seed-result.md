# SESSION-2026-04-24 Program Surface Serializer Type Seed Result

## 변경 파일

- `backend/routers/programs.py`
- `backend/tests/test_programs_router.py`
- `frontend/lib/types/index.ts`
- `frontend/app/api/dashboard/recommended-programs/route.ts`
- `frontend/app/api/dashboard/recommend-calendar/route.ts`
- `docs/current-state.md`
- `docs/refactoring-log.md`
- `reports\session\2026-04\SESSION-2026-04-24-program-surface-serializer-type-seed-result.md`

## 변경 이유

- 다음 자연스러운 구현 묶음은 backend 내부 serializer 분리와 frontend surface 타입 병행 추가였다.
- 바로 endpoint/BFF를 갈아엎기 전에, 먼저 backend 안에 `base -> card/list -> legacy wrapper` 뿌리를 만들고 frontend에 새 surface 타입을 심어 두어야 이후 전환이 덜 위험하다.
- 이번 턴은 그 첫 단계로, 공개 API 모양은 그대로 둔 채 내부 formatter 중복을 줄이는 준비 작업에 집중했다.
- 추가로 대시보드 추천/캘린더 BFF도 새 `ProgramSurfaceContext`를 내부에서 먼저 조립한 뒤 현재 legacy 응답 shape로 다시 평탄화하도록 정리해, 다음 턴의 BFF 전환 부담을 조금 더 줄였다.

## 유지한 동작

- `GET /programs`, `GET /programs/list`, 추천, 캘린더 추천, 상세 응답의 공개 계약은 이번 턴에 바꾸지 않았다.
- 추천과 캘린더는 여전히 `ProgramRecommendItem`, `CalendarRecommendItem`, `ProgramListItem` wrapper를 유지한다.
- frontend도 기존 `Program` monolith 타입을 그대로 남겨 현재 화면/BFF 호출부를 깨지 않게 유지했다.
- `frontend/app/api/dashboard/recommended-programs/route.ts`와 `frontend/app/api/dashboard/recommend-calendar/route.ts`도 최종 반환 JSON 모양은 유지했다.

## 리스크 / 가능한 회귀

- 내부 serializer helper가 생기면서 추천/캘린더/상세가 새 helper를 타기 시작했으므로, derived field 계산이 기존과 달라지지 않는지 계속 봐야 한다.
- `frontend/lib/types/index.ts`에 새 타입이 추가됐지만 아직 실제 consumer가 넓게 쓰지 않기 때문에, 이후 전환 단계에서 snake_case/camelCase drift를 다시 점검해야 한다.
- 이번 턴은 additive seed 단계라서, 중복 타입이 잠시 늘어난 상태다.
- TypeScript compiler CLI가 로컬에 설치돼 있지 않아 `tsc --noEmit` 검사는 이번 턴에 실행하지 못했다.

## 테스트 포인트

- `backend\venv\Scripts\python.exe - <<py_compile>>` 방식으로 `backend/routers/programs.py` 문법 확인
- `backend\venv\Scripts\python.exe -m pytest backend/tests/test_programs_router.py -k "surface_serializers_split_base_and_card_layers or serialize_program_recommendation_uses_card_summary_serializer or recommend_programs or recommend_calendar"`
- 결과: `9 passed`
- `npx tsc -p frontend/tsconfig.json --noEmit`는 로컬 `typescript` CLI 부재로 실행하지 못함

## 추가 리팩토링 후보

- `backend/routers/programs.py::_serialize_program_list_row()`에서 더 나아가 `ProgramCardSummary` / `ProgramListRow` 전용 serializer 함수를 endpoint 레벨에서 직접 사용하도록 이동
- `frontend/app/api/dashboard/recommended-programs/route.ts`의 `_reason/_fit_keywords/_score` 직접 주입 제거
- `frontend/app/api/dashboard/recommend-calendar/route.ts` fallback `program: Program` 구조를 `program + context`로 축소

