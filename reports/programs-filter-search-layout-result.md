# Programs Filter Search Layout Result

## 변경 파일
- `frontend/app/(landing)/programs/page.tsx`
- `frontend/app/(landing)/programs/programs-filter-bar.tsx`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## 변경 이유
- 목록 필터에 `선발 절차`, `채용 연계`가 남아 있어 사용자가 필터를 과하게 좁히는 느낌이 있었다.
- 검색창과 검색 버튼이 필터 버튼들과 같은 줄에 있어, 필터 선택 후 검색을 실행하는 흐름이 한눈에 구분되지 않았다.

## 변경 내용
- `/programs` 필터 UI에서 `선발 절차`, `채용 연계` 필터를 제거했다.
- 해당 두 필터는 목록 페이지의 active chip, 목록/count API 요청, 페이지네이션 URL 유지 대상에서도 제외했다.
- 검색창, `검색` 버튼, `초기화` 버튼을 필터 드롭다운 아래 별도 줄로 이동했다.
- 검색 줄의 `검색` 버튼과 `초기화` 버튼 폭/높이를 필터 토글 1칸과 같은 기준으로 맞췄다.
- 정렬 UI를 native select가 아니라 기존 필터와 같은 커스텀 토글로 되돌려 `마감 임박순`/`최신순`이 같은 디자인으로 보이게 했다.
- 기존 `추가 필터 펼치기`와 `최근 마감 공고 포함` 옵션은 유지했다.

## 보존한 동작
- 검색어 기반 검색, 카테고리, 수업 방식, 지역, 비용, 참여 시간, 운영 기관, 추천 대상, 정렬은 유지했다.
- 비교 프로그램 선택 모달과 backend `/programs/filter-options` 계약은 변경하지 않았다.
- 테이블의 `선발절차·키워드`, `채용연계` 표시 컬럼은 데이터 확인용으로 유지했다.

## 검증
- `frontend` 폴더에서 `npx tsc -p tsconfig.codex-check.json --noEmit`: 통과
- 브라우저에서 `/programs` 확인:
  - 상단 필터에 `선발 절차`, `채용 연계` 버튼이 보이지 않음
  - `검색` 입력칸, `검색` 버튼, `초기화` 버튼이 필터 아래 줄에 나열됨
  - `카테고리`, `정렬`, `검색`, `초기화`가 모두 `133px x 48px`로 같은 토글 크기 확인
  - `정렬` 토글에서 `최신순` 클릭 시 `sort=latest` URL 반영 확인
  - 기존 `selection_processes`, `employment_links` URL 파라미터가 있어도 목록이 비지 않고 해당 필터 chip이 표시되지 않음
  - 검색창에 `AI` 입력 후 검색 시 `/programs?...&q=AI`로 이동 확인

## 리스크 / 가능한 회귀
- 기존 URL에 `selection_processes`, `employment_links`가 남아 있어도 목록 페이지는 이를 더 이상 반영하지 않는다.
- 여러 필터와 검색어를 함께 제출하면 빈 hidden field가 URL에 남을 수 있다. 화면 동작에는 영향이 없지만 URL 정리 후보다.

## 추가 리팩토링 후보
- `buildProgramsHref`와 form submit에서 빈 값 query를 제거하는 공통 정리 helper를 만들면 URL이 더 깔끔해진다.
- 목록 페이지와 비교 모달의 필터 구성을 별도 설정 객체로 분리하면 화면별 필터 차이를 더 안전하게 관리할 수 있다.
