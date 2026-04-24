# Compare Page Detail Fields Result

## Changed files
- `backend/routers/programs.py`
- `backend/rag/collector/program_field_mapping.py`
- `backend/rag/collector/normalizer.py`
- `backend/tests/conftest.py`
- `backend/tests/test_programs_router.py`
- `backend/tests/test_work24_kstartup_field_mapping.py`
- `frontend/app/(landing)/compare/page.tsx`
- `frontend/app/(landing)/compare/program-select-modal.tsx`
- `frontend/app/(landing)/compare/programs-compare-client.tsx`
- `frontend/app/(landing)/compare/compare-table-sections.tsx`
- `frontend/app/(landing)/compare/compare-relevance-section.tsx`
- `frontend/app/(landing)/programs/page.tsx`
- `frontend/app/(landing)/programs/[id]/page.tsx`
- `frontend/app/(landing)/programs/[id]/program-detail-client.tsx`
- `frontend/app/(landing)/programs/bookmark-state-provider.tsx`
- `frontend/app/(landing)/programs/program-card.tsx`
- `frontend/app/(landing)/programs/program-bookmark-button.tsx`
- `frontend/app/(landing)/programs/programs-filter-bar.tsx`
- `frontend/app/(landing)/programs/recommended-programs-section.tsx`
- `frontend/app/api/dashboard/bookmarks/[programId]/route.ts`
- `frontend/app/api/dashboard/recommended-programs/route.ts`
- `frontend/lib/api/backend.ts`
- `frontend/lib/types/index.ts`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made
- 비교 페이지가 목록 API의 얕은 `Program` 필드만 사용해 고용24, K-Startup, SeSAC 등에서 상세 API로 이미 정규화한 공통 정보가 표에 나오지 않았다.
- 비교 슬롯 3개가 각각 상세 API를 호출하지 않도록 `/programs/details/batch`를 추가해 필요한 상세 정보를 한 번에 조회한다.
- 비교 슬롯 3개가 각각 기본 프로그램 API를 호출하지 않도록 `/programs/batch`도 추가해 기본 정보 조회를 한 번으로 줄였다.
- `programs.skills`는 컬럼은 있으나 운영 데이터에서 비어 있을 가능성이 커서, 확정적인 기술 스택 비교처럼 보이는 라벨을 낮출 필요가 있었다.
- 주소 필드 기반 지역 신호는 기술 키워드와 다른 성격이므로 AI 적합도에서 별도 점수로 분리할 필요가 있었다.
- 프로그램 목록 페이지의 남은 구조 작업으로 맞춤 추천, 마감 임박, 전체 프로그램 섹션과 찜 전용 카드 액션을 반영했다.
- 후속 후보였던 선발 절차/채용 연계 필터는 텍스트 fallback 기반으로 추가했고, 스킬 키워드 사전은 보안, 모바일, 게임, 반도체 등 운영 후보군을 더 포괄하도록 확장했다.
- 목록/추천 카드 초기 렌더링 시 기존 찜 상태를 `program_bookmarks`에서 prefetch해 별 버튼 상태에 반영한다.
- 프로그램 목록 화면에서 같은 프로그램이 추천/마감임박/전체 목록에 중복 노출될 때 찜 상태가 카드별로 어긋나지 않도록 공유 상태를 추가했다.
- 하드코딩되어 있던 운영 기관, 추천 대상, 선발 절차, 채용 연계 필터 옵션을 실제 프로그램 데이터에서 추출하도록 `/programs/filter-options`를 추가했다.
- 상세 페이지 북마크 버튼이 DB mutation 없이 로컬 상태만 바꾸던 문제를 목록과 같은 BFF mutation 흐름으로 맞췄다.
- 비교 프로그램 선택 모달도 `/programs/filter-options`를 재사용해 전체 검색 탭에서 실제 데이터 기반 옵션으로 프로그램을 좁힐 수 있게 했다.

## Preserved behaviors
- `/compare?ids=` URL 구조와 최대 3개 비교 슬롯 동작은 유지했다.
- 상세 API 호출이 실패해도 기존 `getProgram` 목록/단건 응답 기반으로 비교 페이지가 렌더링되도록 했다.
- 로그인 사용자에 한해 관련도 API를 호출하는 기존 흐름은 유지했다.
- 기존 단건 `GET /programs/{program_id}/detail` 응답 builder를 batch endpoint에서도 재사용해 날짜/비용/대상 매핑 기준을 유지했다.
- `ProgramCard`가 `/programs` provider 밖에서 렌더링되는 경우에는 기존처럼 `initialBookmarked` 기반 로컬 상태로 동작한다.
- 필터 옵션 조회가 실패하거나 실제 데이터에서 옵션을 만들 수 없으면 기존 정적 옵션으로 fallback한다.
- 상세 페이지의 공유 버튼과 신청 링크, 상세 섹션 렌더링 구조는 유지했다.
- 비교 모달의 기존 찜 목록 탭과 검색어 기반 전체 검색 흐름은 유지했고, 옵션 조회 실패가 검색 실패로 번지지 않게 했다.

## Risks / possible regressions
- 비교 페이지의 기본/상세 프로그램 조회는 모두 batch endpoint를 사용한다.
- 일부 K-Startup row는 `start_date/end_date`가 신청 기간 성격이므로 상세 API의 source별 날짜 해석을 우선 사용한다. 상세 API가 실패하면 기존 목록 날짜 fallback이 표시될 수 있다.
- `skills` 추출은 보수적인 키워드 룰 기반이라 모든 기술명을 포괄하지는 않는다. 다만 고용24/K-Startup/SeSAC의 제목, 설명, 대상, 사업 유형, NCS 코드까지 입력 신호를 넓혔다.
- `/programs` 공유 찜 상태는 현재 화면 안의 카드만 동기화한다. 상세 페이지나 대시보드처럼 별도 화면의 북마크 상태는 기존 각 화면의 조회/상태 흐름을 따른다.
- 동적 필터 옵션은 현재 구조화 컬럼이 부족한 선발 절차/채용 연계/추천 대상 일부를 텍스트 키워드로 추출하므로, 누락 가능성이 있다.
- 상세 페이지 북마크 상태는 페이지 진입 시 서버에서 초기화된다. 이미 열린 다른 탭이나 다른 화면까지 실시간 동기화하지는 않는다.
- 비교 모달 필터 옵션은 목록 필터와 같은 텍스트 기반 추출 한계를 공유한다.

## Test points
- `npm run lint -- --file "app/(landing)/compare/page.tsx" --file "app/(landing)/compare/programs-compare-client.tsx" --file "app/(landing)/compare/compare-table-sections.tsx" --file "app/(landing)/compare/compare-relevance-section.tsx"`
- `npm run lint -- --file "app/(landing)/compare/page.tsx" --file "app/(landing)/compare/compare-relevance-section.tsx" --file "lib/api/backend.ts" --file "lib/types/index.ts"`
- `npm run lint -- --file "app/(landing)/compare/page.tsx" --file "app/(landing)/programs/page.tsx" --file "app/(landing)/programs/program-card.tsx" --file "app/(landing)/programs/recommended-programs-section.tsx" --file "app/(landing)/programs/programs-filter-bar.tsx" --file "app/api/dashboard/bookmarks/[programId]/route.ts" --file "lib/api/backend.ts" --file "lib/types/index.ts"`
- `npx tsc -p tsconfig.codex-check.json --noEmit`
- `.\backend\venv\Scripts\python.exe -m pytest backend/tests/test_programs_router.py backend/tests/test_work24_kstartup_field_mapping.py -q`
- `npm run lint -- --file "app/(landing)/programs/page.tsx" --file "app/(landing)/programs/programs-filter-bar.tsx" --file "lib/api/backend.ts" --file "lib/types/index.ts"`
- `npm run lint -- --file "app/(landing)/programs/page.tsx" --file "app/(landing)/programs/program-card.tsx" --file "app/(landing)/programs/recommended-programs-section.tsx"`
- `npm run lint -- --file "app/(landing)/programs/page.tsx" --file "app/(landing)/programs/program-card.tsx" --file "app/(landing)/programs/recommended-programs-section.tsx" --file "app/(landing)/programs/bookmark-state-provider.tsx"`
- `npm run lint -- --file "app/(landing)/programs/page.tsx" --file "lib/api/backend.ts" --file "lib/types/index.ts"`
- `npm run lint -- --file "app/(landing)/programs/page.tsx" --file "app/(landing)/programs/[id]/page.tsx" --file "app/(landing)/programs/[id]/program-detail-client.tsx" --file "app/(landing)/programs/program-bookmark-button.tsx" --file "lib/api/backend.ts" --file "lib/types/index.ts"`
- `npm run lint -- --file "app/(landing)/compare/program-select-modal.tsx" --file "lib/api/backend.ts" --file "lib/types/index.ts"`
- `.\backend\venv\Scripts\python.exe -m pytest backend/tests/test_programs_router.py -q`

## Follow-up refactoring candidates
- 스킬 키워드 사전은 운영 데이터 샘플을 보면서 직무군별로 확장할 필요가 있다.
- 지역 매칭은 시/도 정규화와 인접권역까지 반영했지만, 장기적으로 행정구역 코드 기반 정규화로 옮길 수 있다.
- 선발 절차/채용 연계 필터는 텍스트 fallback으로 동작하지만, 운영 DB에 정식 구조화 컬럼이 생기면 `compare_meta` 우선 매칭으로 좁힐 수 있다.
- 찜 상태 prefetch는 프로그램 목록 페이지 범위에 적용됐고, 다른 카드 UI에도 동일 패턴을 재사용할 수 있다.
- 찜 상태 공유 provider는 `/programs` 화면 범위에 머물러 있으므로, 상세/대시보드까지 즉시 동기화가 필요해지면 bookmark cache나 전역 store로 승격할 수 있다.
- 필터 옵션 추출은 향후 `programs.target`, `selection_process`, `employment_link` 같은 구조화 컬럼이 안정화되면 텍스트 키워드 fallback보다 구조화 컬럼 우선으로 전환할 수 있다.
