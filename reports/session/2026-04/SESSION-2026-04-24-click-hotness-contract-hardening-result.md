# SESSION-2026-04-24 click hotness contract hardening result

## changed files

- `backend/routers/programs.py`
- `backend/tests/test_programs_router.py`
- `docs/refactoring-log.md`

## why changes were made

- `click_hotness_score` fallback 계산식이 Python과 SQL migration에 숫자 상수 형태로 중복돼 있어, 한쪽만 바뀌어도 drift가 날 수 있었다.
- 기존 동작을 바꾸지 않으면서 drift 위험을 줄이기 위해 backend 계산식을 상수/헬퍼로 분리하고, migration formula까지 테스트로 함께 고정했다.

## impact scope

- Backend only: `popular` 정렬 fallback 계산 helper와 관련 회귀 테스트
- Docs: 리팩토링 로그 추가

## preserved behaviors

- read-model row에 `click_hotness_score`가 있으면 계속 그 값을 우선 사용한다.
- fallback 점수는 최근 7일 상세 조회수 우선, 누적 조회수 cap, `recommended_score` 가산 구조를 유지한다.
- 기존 `popular` 정렬, `Live Board`, detail-view 집계 경로는 바꾸지 않았다.

## risks / possible regressions

- SQL migration은 여전히 별도 언어 경계에 있으므로 완전한 단일 소스 공유는 아니다.
- 추정: 향후 DB에 새 migration으로 `program_list_click_hotness_score`를 재정의할 때 이 테스트를 같이 갱신하지 않으면 의도된 변경도 회귀로 잡힐 수 있다.

## test points

- `backend\\venv\\Scripts\\python.exe -m pytest backend\\tests\\test_programs_router.py -q`

## follow-up refactoring candidates

- `program_list_click_hotness_score` SQL helper를 별도 migration/문서 spec로 추출해 운영 DB 쪽 변경 절차를 더 명확히 하기
- read-model refresh SQL과 backend fallback 정렬 규약을 compare fixture 형태로 더 강하게 고정하기
- 사용자/세션 단위 dedupe 정책이 확정되면 click hotness score 입력 데이터 자체를 더 보수적으로 바꾸기
