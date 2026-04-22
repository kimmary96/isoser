# Compare Page Detail Fields Result

## Changed files
- `backend/routers/programs.py`
- `backend/rag/collector/program_field_mapping.py`
- `backend/rag/collector/normalizer.py`
- `backend/tests/conftest.py`
- `backend/tests/test_programs_router.py`
- `backend/tests/test_work24_kstartup_field_mapping.py`
- `frontend/app/(landing)/compare/page.tsx`
- `frontend/app/(landing)/compare/programs-compare-client.tsx`
- `frontend/app/(landing)/compare/compare-table-sections.tsx`
- `frontend/app/(landing)/compare/compare-relevance-section.tsx`
- `frontend/lib/api/backend.ts`
- `frontend/lib/types/index.ts`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made
- 비교 페이지가 목록 API의 얕은 `Program` 필드만 사용해 고용24, K-Startup, SeSAC 등에서 상세 API로 이미 정규화한 공통 정보가 표에 나오지 않았다.
- 비교 슬롯 3개가 각각 상세 API를 호출하지 않도록 `/programs/details/batch`를 추가해 필요한 상세 정보를 한 번에 조회한다.
- `programs.skills`는 컬럼은 있으나 운영 데이터에서 비어 있을 가능성이 커서, 확정적인 기술 스택 비교처럼 보이는 라벨을 낮출 필요가 있었다.
- 주소 필드 기반 지역 신호는 기술 키워드와 다른 성격이므로 AI 적합도에서 별도 점수로 분리할 필요가 있었다.

## Preserved behaviors
- `/compare?ids=` URL 구조와 최대 3개 비교 슬롯 동작은 유지했다.
- 상세 API 호출이 실패해도 기존 `getProgram` 목록/단건 응답 기반으로 비교 페이지가 렌더링되도록 했다.
- 로그인 사용자에 한해 관련도 API를 호출하는 기존 흐름은 유지했다.
- 기존 단건 `GET /programs/{program_id}/detail` 응답 builder를 batch endpoint에서도 재사용해 날짜/비용/대상 매핑 기준을 유지했다.

## Risks / possible regressions
- 비교 상세 데이터는 이제 batch 1회로 조회하지만, 목록용 `getProgram` 단건 호출은 기존처럼 슬롯별로 남아 있다. 필요하면 다음 단계에서 목록/상세 통합 batch로 줄일 수 있다.
- 일부 K-Startup row는 `start_date/end_date`가 신청 기간 성격이므로 상세 API의 source별 날짜 해석을 우선 사용한다. 상세 API가 실패하면 기존 목록 날짜 fallback이 표시될 수 있다.
- `skills` 추출은 보수적인 키워드 룰 기반이라 누락은 가능하다. 잘못된 과매칭을 피하기 위해 사전 범위를 좁게 유지했다.

## Test points
- `npm run lint -- --file "app/(landing)/compare/page.tsx" --file "app/(landing)/compare/programs-compare-client.tsx" --file "app/(landing)/compare/compare-table-sections.tsx" --file "app/(landing)/compare/compare-relevance-section.tsx"`
- `npm run lint -- --file "app/(landing)/compare/page.tsx" --file "app/(landing)/compare/compare-relevance-section.tsx" --file "lib/api/backend.ts" --file "lib/types/index.ts"`
- `npx tsc -p tsconfig.codex-check.json --noEmit`
- `.\backend\venv\Scripts\python.exe -m pytest backend/tests/test_programs_router.py backend/tests/test_work24_kstartup_field_mapping.py -q`

## Follow-up refactoring candidates
- 비교 페이지의 `getProgram` 단건 호출도 batch 조회로 통합하면 서버 렌더링 호출 수를 더 줄일 수 있다.
- 스킬 키워드 사전은 운영 데이터 샘플을 보면서 직무군별로 확장할 필요가 있다.
- 지역 매칭은 현재 문자열 포함 기준이므로, 장기적으로 시도/시군구 표준 코드 기반 정규화가 필요하다.
