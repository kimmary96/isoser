# SESSION-2026-04-26 Programs Runtime Source Filter Verification Result

## Changed files
- `frontend/app/(landing)/programs/page.tsx`
- `frontend/app/(landing)/programs/page-filters.ts`
- `frontend/app/(landing)/programs/page-filters.test.ts`
- `backend/services/program_list_filters.py`
- `backend/services/program_list_queries.py`
- `backend/routers/programs.py`
- `backend/tests/test_programs_router.py`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made
- `/programs`의 운영기관 필터가 실제로는 동일 source family를 서로 다른 식별자로 취급하고 있었다.
- 프런트 filter-options는 `K-Startup 창업진흥원` 같은 raw value를 받아 `sources=kstartup` query를 선택값으로 복원하지 못했고, 브라우저에서는 필터가 무시된 채 기본 300 browse 결과가 그대로 보였다.
- 프런트만 canonical query 값을 쓰도록 바꾸면 이번에는 백엔드가 `source in ("kstartup")`를 exact match로 적용해 `0건`으로 떨어졌다.
- 추가로 로컬 검증 중 repo root `uvicorn ... --reload`가 `frontend/.next` 변경까지 감시해 백엔드를 재시작시키는 실행 함정이 확인돼, `/programs`의 간헐적 `fetch failed` 원인을 별도로 기록할 필요가 있었다.

## What changed
- 프런트 `page-filters.ts`에 운영기관 dynamic option canonicalization을 추가했다.
  - `K-Startup 창업진흥원` -> `kstartup / K-Startup`
  - `sesac`, `SeSAC`, `새싹` 계열 -> `sesac / SeSAC`
  - `고용24`, `work24` 계열 -> `고용24 / 고용24`
- `page.tsx`는 source filter-options를 받을 때만 canonicalizer를 적용해 기존 target option 동작은 유지했다.
- 백엔드 `program_list_filters.py`는 source canonical value와 raw alias 집합을 공통 helper로 정리했다.
  - filter-options response는 canonical `value`를 내린다.
  - `source` facet snapshot도 같은 canonical 값으로 내려간다.
- 백엔드 `routers/programs.py`는 incoming `sources` query를 canonical 기준으로 alias 확장해 read-model/legacy path 모두에서 같은 source family를 exact filter로 읽게 맞췄다.
- 후속 QA에서 `기타 기관`이 0건으로 나오는 문제가 확인되어, `sources=other`는 read-model/source exact query가 아니라 legacy scan + 후처리 경로를 타도록 고정했다.
- `기타 기관` 판정은 `source`만 보지 않고 `provider`도 함께 본다. `source=K-Startup 창업진흥원`이어도 `provider=도봉구청/서울경제진흥원`처럼 canonical K-Startup 자체가 아닌 기관이면 기타 기관에 포함한다.
- `sources=other`가 포함된 목록 요청은 DB 단계에서 작은 page `limit/offset`을 먼저 적용하지 않고 최대 scan 후 후처리 pagination을 적용한다. 그래서 count와 실제 첫 페이지 item 수가 어긋나지 않는다.

## Preserved behaviors
- browse 300 기본 계약 유지
- 광고 row / Closing Soon / D-day / 참여시간 / 운영기관 BI 렌더링 구조 유지
- 기존 API shape 유지 (`sources`는 여전히 list[str] query, filter-options response shape 동일)
- DB 스키마 변경 없음

## Verification
- 브라우저 QA
  - `http://localhost:3000/programs` -> `전체 프로그램 300개`
  - `?teaching_methods=온라인` -> `전체 프로그램 72개`, 첫 3개 제목이 기본 browse와 다름
  - `?category_detail=ncs-20` -> `전체 프로그램 30개`, 첫 3개 제목이 기본 browse와 다름
  - `?sources=kstartup` -> `전체 프로그램 1개`, active chip 노출, 첫 row가 K-Startup 공고 1건으로 축소
- 직접 API 확인
  - `GET /programs/filter-options?recruiting_only=true` -> `sources=[{"value":"고용24"},{"value":"kstartup"}]`
  - `GET /programs/count?...&sources=kstartup` -> `{"count":1}`
  - `GET /programs/list?...&sources=kstartup` -> K-Startup 공고 1건 반환
  - `GET http://127.0.0.1:8001/programs/list?limit=5&recruiting_only=true&sources=other` -> `count=24`, `itemCount=5`, 첫 결과에 `도봉구 청년창업센터장`, `서울경제진흥원` 포함
  - `GET http://127.0.0.1:8001/programs/count?recruiting_only=true&sources=other` -> `{"count":24}`
- 자동화 체크
  - `backend\venv\Scripts\python.exe -m pytest backend/tests/test_programs_router.py -q -k "extract_program_filter_options or filter_options_from_facet_snapshot or expands_canonical_source_aliases or should_apply_work24_default_mix"`
  - `backend\venv\Scripts\python.exe -m py_compile backend\routers\programs.py backend\services\program_list_filters.py backend\tests\test_programs_router.py`
  - `npm --prefix frontend test -- "app/(landing)/programs/page-filters.test.ts" "app/(landing)/programs/page-helpers.test.ts"`
  - `npm --prefix frontend run lint -- --file "app/(landing)/programs/page.tsx" --file "app/(landing)/programs/page-filters.ts" --file "app/(landing)/programs/page-filters.test.ts"`
  - `npx --prefix frontend tsc -p frontend/tsconfig.codex-check.json --noEmit --pretty false`
  - `backend\venv\Scripts\python.exe -m pytest backend\tests\test_programs_router.py -q -k "source"`

## Risks / possible regressions
- canonical source alias 집합은 현재 `고용24/kstartup/sesac` 중심이다. 새 provider family가 추가되면 같은 helper에 alias를 더 넣어야 한다.
- repo root `uvicorn ... --reload`는 여전히 실행하면 `.next` 변경에 흔들릴 수 있다. 이번 작업은 코드 계약을 맞춘 것이고, 로컬 실행 명령 자체를 강제로 바꾸지는 않았다.
- `backend/tests/test_programs_router.py` 전체 실행은 현재 live Supabase/read-model/auth 상태에 영향받는 기존 테스트가 있어, 이번 변경 검증은 touched-area subset으로 제한했다.

## Follow-up refactoring candidates
- `/programs` source family canonicalization을 frontend/backend 양쪽에 흩어두지 말고 shared contract 문서 또는 generated enum으로 정리
- 로컬 backend starter를 `backend/` cwd + bounded reload dir 기준 스크립트로 통일해 `.next` watch 재시작 문제를 구조적으로 제거
- `/programs` 브라우저 QA를 E2E로 고정해 `count/order/source chip` 회귀를 자동 감지
