# SESSION-2026-04-24-user-recommendation-schema-review-result

## 변경 파일

- `docs/specs/user-recommendation-schema-v1.md`
- `docs/specs/README.md`
- `docs/refactoring-log.md`

## 왜 변경했는가

- 맞춤형 프로그램 추천에 필요한 사용자 정보가 `profiles` 하나에 섞여 있고, 실제 추천 로직이 읽는 필드와 UI/DB 의미가 어긋나 있었다.
- 특히 `희망 직무`가 정식 컬럼이 아니라 `bio`로 흘러 들어가는 문제, `recommendations` 캐시 계약이 `SQL.md`와 드리프트한 문제, 거주지와 추천 선호 지역이 분리되지 않은 문제가 커서 기준 문서가 필요했다.
- `supabase/SQL.md`를 현재 실DB 스냅샷 기준으로 두고, 코드가 실제로 읽는 추천 입력과 비교해 권장 사용자 추천 스키마를 문서화했다.

## 보존한 동작

- 코드와 DB는 변경하지 않았다.
- 현재 추천 API, 프로필 UI, 활동/이력서 저장 흐름은 그대로 유지된다.
- 이번 작업은 설계/문서화만 수행했다.

## 리스크 / 가능한 회귀

- 문서 기준과 실제 구현이 어긋나면 이후 migration/API 작업에서 다시 drift가 생길 수 있다.
- `SQL.md`를 실DB 기준으로 봤을 때도, migration 체인과 문서 사이의 차이를 계속 방치하면 추천 캐시나 프로필 의미 충돌이 재발할 수 있다.

## 후속 리팩토링 후보

- `profiles.bio`와 `target_job` 의미 분리
- `user_program_preferences`, `user_recommendation_profile` 도입
- `recommendations` 캐시 계약과 `SQL.md` 정합성 복구
- 행동 신호 저장용 `user_program_events` 설계
