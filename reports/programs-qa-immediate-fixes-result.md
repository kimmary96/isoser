# Programs QA Immediate Fixes Result

## changed files

- `frontend/app/(landing)/programs/programs-filter-bar.tsx`
- `frontend/app/(landing)/programs/[id]/page.tsx`
- `frontend/app/(landing)/programs/[id]/program-detail-client.tsx`
- `frontend/app/(landing)/programs/[id]/not-found.tsx`
- `backend/routers/programs.py`
- `backend/tests/test_programs_router.py`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## why changes were made

- QA에서 정렬 변경이 실제 URL/query에 안정적으로 반영되지 않는 문제가 확인됐다.
- 다중 필터 메뉴가 열린 상태에서는 사용자가 선택값을 적용하는 흐름이 불명확했다.
- 잘못된 program id 접근 시 내부 Supabase 오류가 사용자 화면에 노출될 수 있었다.
- 상세 페이지 공유 버튼은 성공/실패 안내가 없어 사용자가 동작 결과를 알 수 없었다.

## preserved behaviors

- 기존 `/programs` 검색, 카테고리, 지역/비용/참여 시간/운영 기관/추천 대상/선발 절차/채용 연계 URL query 계약은 유지했다.
- 목록/상세의 기존 bookmark BFF mutation 경로는 유지했다.
- 상세 페이지의 값 없는 섹션 숨김 방식과 신청 링크 노출 조건은 유지했다.
- 존재하지 않는 UUID program id는 계속 404로 처리한다.

## risks / possible regressions

- 정렬을 버튼형 커스텀 메뉴에서 select로 단순화해 시각적 형태가 약간 달라졌다.
- 다중 필터는 선택 후 `선택 적용`을 누르는 흐름이 추가되어, 사용자가 기존처럼 상단 `검색` 버튼을 눌러도 동작하지만 메뉴 내부 적용 버튼도 함께 안내된다.
- 공유 버튼의 클립보드 API는 브라우저 권한/환경에 따라 실패할 수 있으며, 이 경우 실패 안내를 표시한다.

## verification

- `backend\venv\Scripts\python.exe -m pytest backend/tests/test_programs_router.py`
  - 44 passed
- `npx tsc -p tsconfig.codex-check.json --noEmit`
  - passed
- Browser QA
  - `/programs` 로딩 및 오류 오버레이 없음 확인
  - 정렬 select를 `최신순`으로 변경하면 `sort=latest` URL query와 active chip 반영 확인
  - 지역 필터에서 `서울` 선택 후 `선택 적용` 클릭 시 `regions=서울` URL query 반영 확인
  - `/programs/not-a-real-program-id/detail` backend 응답 404 확인
  - `/programs/not-a-real-program-id` 상세 화면에서 내부 Supabase 오류가 노출되지 않는 것 확인
  - 상세 공유 버튼의 복사 성공/실패 안내 렌더링 경로 확인

## follow-up refactoring candidates

- programs 필터바의 커스텀 메뉴와 native select 스타일을 더 일관되게 정리한다.
- 모바일에서는 엑셀형 테이블 대신 행 압축 카드 뷰를 별도로 제공해 가로 스크롤 피로를 줄인다.
- 목록/상세 공유 버튼을 공용 `ShareButton` 컴포넌트로 분리해 다른 공개 페이지에서도 같은 복사/실패 안내를 재사용한다.
