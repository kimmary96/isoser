# SESSION-2026-04-24 Program Canonical Validation Free Plan Guide Result

## Changed Files

- `docs/specs/program-canonical-validation-summary-v1.md`
- `docs/specs/supabase-free-plan-program-migration-ops-guide-v1.md`
- `docs/specs/README.md`
- `docs/refactoring-log.md`
- `reports/SESSION-2026-04-24-program-canonical-validation-free-plan-guide-result.md`

## Why Changes Were Made

- 이번 턴에서는 이미 끝낸 SQL 초안 작성 단계가 아니라, 실제 Supabase SQL Editor 검증 결과를 기준으로 “무엇이 통과했고 무엇이 free plan 때문에 보류인지”를 한 번 더 정리할 필요가 있었다.
- 사용자 요청대로 비개발자도 이해할 수 있는 최종 정리 문서와 free plan 대응 운영 가이드를 남겨, 다음 세션에서 같은 시행착오를 반복하지 않도록 했다.
- 특히 `program_source_records` full backfill과 `program_list_index` full refresh가 free plan에서 곧바로 용량 이슈를 만들었다는 점, `VACUUM FULL`은 단독 실행해야 한다는 점, DB 기본 날짜가 UTC라 KST 기준 모집 상태 계산이 별도로 필요했다는 점을 문서로 굳혔다.

## Preserved Behaviors

- 런타임 코드, API 응답, 실제 DB 스키마에는 이번 턴에 새 변경을 넣지 않았다.
- 기존 설계 문서와 SQL draft를 뒤집지 않고, 이미 확인된 검증 결과와 운영 제약만 정리했다.
- `docs/current-state.md`는 런타임 truth 문서라 이번처럼 문서 정리만 한 턴에서는 추가로 바꾸지 않았다.

## Risks / Possible Regressions

- 문서는 현재 세션의 SQL Editor 검증 결과를 기준으로 정리한 것이므로, 다른 Supabase 프로젝트나 유료 플랜 DB에서는 용량/속도 조건이 다를 수 있다.
- free plan 운영 가이드는 안전한 기본선에 가깝고, 모든 환경에서 최적이라는 뜻은 아니다.
- 현재 검증은 `program_list_index` 샘플 100건 기준까지 확인한 상태라, 전체 28,225건 full refresh까지 통과했다는 의미로 읽으면 안 된다.

## Follow-up Refactoring Candidates

- free plan에서도 부담이 덜한 `partial refresh` 전용 RPC 또는 SQL 함수 분리
- `program_list_index`에서 무거운 JSON 복제를 줄이는 경량 read model 설계
- `program_source_records`의 `raw_payload`, `source_specific`, `field_evidence` 보관 정책 재설계
- `summary_text`, `recruiting_status` 같은 사용자 표시용 파생 규칙을 serializer/API 계약 문서에도 명시
