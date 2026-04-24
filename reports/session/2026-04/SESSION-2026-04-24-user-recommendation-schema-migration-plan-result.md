# SESSION-2026-04-24-user-recommendation-schema-migration-plan-result

## 변경 파일

- `docs/specs/user-recommendation-schema-migration-plan-v1.md`
- `docs/specs/README.md`
- `docs/refactoring-log.md`

## 왜 변경했는가

- 추천용 사용자 스키마 재정의 문서만으로는 실제 적용 순서가 부족했다.
- `profiles.target_job` 분리, `user_program_preferences`, `user_recommendation_profile`, `recommendations` 계약 정렬까지를 migration 단계로 끊어 실행 가능 문서로 남길 필요가 있었다.

## 보존한 동작

- 코드와 DB는 변경하지 않았다.
- 현재 추천/비교/프로필/이력서 기능은 그대로 유지된다.
- 이번 작업은 migration 설계 문서와 기록만 추가했다.

## 리스크 / 가능한 회귀

- 문서대로 구현할 때 `bio -> target_job` 백필 fallback을 오래 유지하면 다시 의미 충돌이 남을 수 있다.
- `recommendations` unique/index 정렬 단계는 실DB duplicate 상태를 먼저 확인하지 않으면 위험하다.

## 후속 리팩토링 후보

- 추천 정본 refresh 함수의 SQL/Python 책임 분리
- `user_program_events` 도입
- 활동 스킬 canonical normalization
