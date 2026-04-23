# Programs Filter Bar Redesign Result

## changed files

- `frontend/app/(landing)/programs/page.tsx`
- `frontend/app/(landing)/programs/programs-filter-bar.tsx`
- `frontend/lib/api/backend.ts`
- `frontend/lib/types/index.ts`
- `backend/routers/programs.py`
- `backend/tests/test_programs_router.py`
- `supabase/migrations/20260422212000_add_programs_category_detail.sql`
- `supabase/migrations/20260422213000_add_programs_cost_time_filters.sql`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## why changes were made

- `programs` 페이지의 기존 필터는 왼쪽 사이드바에 길게 배치되어 검색 중심 탐색 흐름이 약했다.
- 실제 백엔드 API가 지원하는 필터만 사용해 상단 검색 중심 필터 바로 재구성했다.
- 기존 `teaching_methods` API 파라미터와 `sort=latest` 지원을 페이지 URL query와 목록/count 호출에 연결했다.
- 세부 카테고리를 큰 카테고리로만 매핑하던 임시 구조를 `programs.category_detail` DB 컬럼과 API 파라미터로 승격했다.
- 카테고리 항목 클릭 후 선택 상태가 바뀌지 않아 적용되지 않는 문제를 막기 위해 필터 바를 클라이언트 상태 기반으로 전환했다.
- 카테고리 선택 후 메뉴가 열려 남아 있던 문제를 줄이기 위해 선택 즉시 닫히는 공통 드롭다운 UI로 바꿨다.
- 온/오프라인, 지역, 정렬도 카테고리와 같은 드롭다운 디자인으로 통일했다.
- 지역 필터를 시·도 단위 다중 선택으로 확장하고, 비용/참여 시간 필터를 추가했다.
- 비용/참여 시간은 운영 DB 컬럼 적용 전에도 기존 `cost`, `support_type`, `compare_meta`, 일정, 제목/설명 텍스트에서 보수적으로 분류해 동작하도록 연결했다.
- 운영 DB에 적용할 수 있도록 `cost_type`, `participation_time` 분류 컬럼과 trigger/index migration을 추가했다.

## preserved behaviors

- 기본 노출은 기존처럼 모집중 공고만 마감 임박순으로 보여준다.
- 기존 카드형 리스트, 상세 보기 버튼, 비교에 추가 버튼, 지원 링크 흐름을 유지했다.
- 검색은 기존 백엔드 검색 계약을 그대로 사용한다.
- 페이지네이션은 기존 URL query 상태를 유지하며 이동한다.
- `category_detail` migration이 운영 DB에 아직 적용되지 않은 경우에도 backend가 큰 카테고리 기준으로 fallback한다.
- 기존 카드형 리스트의 정보 구조와 상세 보기/비교/지원 링크 흐름은 유지했다.

## risks / possible regressions

- `teaching_method` 값이 운영 DB에 충분히 채워지지 않은 공고는 온/오프라인 필터 선택 시 결과에서 제외될 수 있다.
- `category_detail` 자동 분류는 제목/설명/태그/스킬 키워드 기반이므로 일부 공고는 세부 카테고리 보정이 필요할 수 있다.
- 비용/참여 시간 자동 분류는 기존 데이터에서 추론하므로, 비용이 비어 있거나 운영 시간이 명시되지 않은 공고는 해당 필터 결과에서 빠질 수 있다.
- 현재 백엔드는 비용순, 소스별 필터, 지원 유형 필터를 목록 API에서 직접 지원하지 않아 이번 UI에는 넣지 않았다.
- 추가 필터 영역은 서버 렌더링 form 기반이므로 필터 적용은 제출 후 페이지 갱신 방식이다.

## follow-up refactoring candidates

- 프로그램 카드 렌더링을 `ProgramCard` 컴포넌트로 분리해 `page.tsx` 책임을 줄인다.
- 백엔드에 `source`, `support_type`, `cost` 필터와 비용순 정렬 계약을 추가한 뒤 상단 필터에 연결한다.
- 운영 DB의 `teaching_method`, `cost`, `support_type`, `cost_type`, `participation_time` 채움률을 확인해 제한적 필터를 정식 DB 필터로 승격할지 결정한다.

## verification

- `frontend`: `npm run lint`
- `frontend`: `npx tsc --noEmit -p tsconfig.codex-check.json`
- `backend`: `backend\venv\Scripts\python.exe -m pytest backend\tests\test_programs_router.py -q`
- `Invoke-WebRequest`: `http://localhost:3000/programs?regions=서울&cost_types=free-no-card&participation_times=part-time` 200 응답 확인
- `agent-browser`: `http://localhost:3001/programs` 로드, Next 오류 overlay 없음, 상단 검색/필터와 기존 카드 CTA 렌더 확인
- `Invoke-WebRequest`: `http://localhost:3001/programs` 200 응답과 카테고리 메뉴 텍스트 포함 확인
- `Invoke-WebRequest`: `http://localhost:3000/programs` 200 응답, `현재 결과` 문구 제거, `웹개발`/`데이터·AI` 카테고리 텍스트 포함 확인
- `Invoke-WebRequest`: `http://localhost:3000/programs?category_detail=data-ai` 200 응답과 `카테고리: 데이터·AI` 활성 chip 확인
- Browser check note: 이후 로컬 dev server/backend 연결이 지연되어 `agent-browser open http://localhost:3000/programs`는 네트워크 timeout으로 완료하지 못했다. 정적 검증과 서버 렌더 응답 기준으로 UI 변경은 확인했다.
