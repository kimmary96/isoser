# Compare Page Detail Fields Result

## Changed files
- `backend/routers/programs.py`
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

## Preserved behaviors
- `/compare?ids=` URL 구조와 최대 3개 비교 슬롯 동작은 유지했다.
- 상세 API 호출이 실패해도 기존 `getProgram` 목록/단건 응답 기반으로 비교 페이지가 렌더링되도록 했다.
- 로그인 사용자에 한해 관련도 API를 호출하는 기존 흐름은 유지했다.

## Risks / possible regressions
- 비교 슬롯당 상세 API를 추가 호출하므로 비교 페이지 서버 렌더링 시 백엔드 호출이 최대 3건 늘어난다.
- 일부 K-Startup row는 `start_date/end_date`가 신청 기간 성격이므로 상세 API의 source별 날짜 해석을 우선 사용한다. 상세 API가 실패하면 기존 목록 날짜 fallback이 표시될 수 있다.
- `수집 키워드`는 `tech_stack`, `skills`, `tags`를 합친 보조 정보이므로 정식 스킬 매칭 근거로 쓰기에는 아직 약하다.

## Test points
- `npm run lint -- --file "app/(landing)/compare/page.tsx" --file "app/(landing)/compare/programs-compare-client.tsx" --file "app/(landing)/compare/compare-table-sections.tsx" --file "app/(landing)/compare/compare-relevance-section.tsx"`
- `npx tsc -p tsconfig.codex-check.json --noEmit`
- `backend\venv\Scripts\python.exe -m pytest backend/tests/test_programs_router.py backend/tests/test_work24_kstartup_field_mapping.py`

## Follow-up refactoring candidates
- 비교 페이지 전용 batch detail endpoint를 추가해 슬롯 3개를 한 번에 조회하면 서버 렌더링 호출 수를 줄일 수 있다.
- `programs.skills`를 collector normalizer에서 채워야 프로필 스킬 일치도 25% 가중치의 실효성이 올라간다.
- AI 적합도 응답에 지역 일치 신호를 별도 필드로 분리하면 주소 기반 추천 근거를 표에서 더 명확히 보여줄 수 있다.
