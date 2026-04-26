# SESSION-2026-04-26 Program Detail Fee And Meta Result

## Changed files
- `backend/schemas/programs.py`
- `backend/services/program_detail_builder.py`
- `backend/tests/test_programs_router.py`
- `frontend/lib/types/index.ts`
- `frontend/lib/server/program-detail-fallback.ts`
- `frontend/app/(landing)/programs/[id]/program-detail-client.tsx`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made
- 상세 페이지의 `수강료/지원금` 명칭이 현재 프로그램 데이터 정책과 맞지 않아 `훈련비/자부담금`으로 바꿔야 했다.
- 상세 API가 이미 조회하는 분류, 원천, 참여시간, 신청방법, 선발절차 같은 메타가 화면에 충분히 노출되지 않았다.
- `support_amount`가 총 훈련비와 같은 값인 경우 단순 라벨 변경만 하면 총액을 자부담금처럼 오표기할 위험이 있었다.

## What changed
- 상세 화면 hero, sidebar, fee section의 비용 라벨을 `훈련비`, `자부담금`으로 통일했다.
- `ProgramDetailResponse`에 source/category/NCS/deadline/cost/participation/application/selection metadata를 추가했다.
- 프론트 상세 페이지에 `상세 정보` 섹션을 추가하고, 값이 있는 상세 메타만 fact grid로 표시한다.
- 자부담금은 검증 자부담 또는 detail self-pay/out-of-pocket 증거를 우선하고, 증거 없이 훈련비 이상인 금액은 표시하지 않는다.

## Preserved behaviors
- 상세 페이지 route, apply link, bookmark/share, 기존 section 렌더링 방식은 유지했다.
- 기존 `fee`/`support_amount` API field 이름은 유지해 비교 페이지와 batch detail 호출 호환성을 깨지 않았다.
- 값이 없는 메타는 화면에 노출하지 않아 빈 항목이 늘어나지 않는다.

## Verification
- `backend\venv\Scripts\python.exe -m pytest backend\tests\test_programs_router.py -q -k "program_detail_response"`
- `backend\venv\Scripts\python.exe -m py_compile backend\schemas\programs.py backend\services\program_detail_builder.py backend\routers\programs.py`
- `npx --prefix frontend tsc -p frontend\tsconfig.codex-check.json --noEmit --pretty false`
- Local API smoke: `GET http://127.0.0.1:8001/programs/{id}/detail` returned `fee`, conservative `support_amount`, `source`, `category`, `deadline`, `participation_time`, and `display_categories`.

## Risks / possible regressions
- 상세 화면에 표시되는 메타가 많아졌으므로, 일부 공고는 요약 영역의 fact count가 이전보다 늘어난다.
- `support_amount`를 보수적으로 숨기는 정책 때문에 명시 self-pay evidence가 없는 일부 기존 row는 자부담금이 비어 보일 수 있다. 부정확한 자부담 표시를 피하기 위한 의도된 동작이다.

## Follow-up refactoring candidates
- 상세 페이지 섹션 빌더를 `program-detail-client.tsx`에서 별도 helper로 분리해 테스트 가능한 순수 로직으로 낮추기
- 상세 API의 비용 필드를 장기적으로 `training_fee` / `self_pay_amount` 같은 명시 이름으로 새로 추가하고 legacy `fee/support_amount` bridge를 점진 축소하기
