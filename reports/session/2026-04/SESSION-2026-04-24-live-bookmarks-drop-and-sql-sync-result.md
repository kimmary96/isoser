# SESSION-2026-04-24 live bookmarks drop and SQL sync

## Changed Files
- `supabase/SQL.md`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why Changes Were Made
- 운영 SQL Editor 후속 확인에서 `public.bookmarks`가 비어 있고 다른 테이블의 inbound 참조도 없다는 사실이 확인된 뒤 실제로 삭제됐다.
- 저장소 코드 기준 bookmark 정본은 이미 `public.program_bookmarks`였으므로, live DB와 문서 스냅샷이 다시 어긋나지 않게 맞출 필요가 있었다.

## Preserved Behaviors
- 런타임 bookmark read/write 정본은 계속 `public.program_bookmarks`다.
- dashboard bookmark BFF, compare bookmark tab, detail/list bookmark state 초기화 흐름은 바뀌지 않는다.
- 이번 작업은 문서 정합성만 조정했고, 저장소 코드나 API 응답 shape는 바꾸지 않았다.

## Risks / Possible Regressions
- 저장소 밖 수동 SQL이나 외부 리포트가 legacy `public.bookmarks`를 직접 참조하고 있었다면 별도 후속 수정이 필요할 수 있다.
- `supabase/SQL.md`는 여전히 함수, 인덱스, RLS 전체 정본이 아니라 수동 스냅샷 참고 문서라서 운영 전체 스키마 증빙으로 단독 사용하면 안 된다.

## Follow-up Refactoring Candidates
- `supabase/SQL.md`를 테이블 스냅샷뿐 아니라 핵심 함수/인덱스까지 포함하는 운영 점검 문서로 재구성할지 검토
- `supabase/README.md`의 live verification 절차에 legacy drop 완료 체크 예시를 추가할지 검토

## Evidence
- 운영 SQL Editor 확인 결과:
  - `select to_regclass('public.bookmarks')` -> `null`
  - `select to_regclass('public.program_bookmarks')` -> `program_bookmarks`
