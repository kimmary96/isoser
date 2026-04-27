# SESSION-2026-04-26-landing-c-speed-and-feed-followup-result

## 변경 파일
- `frontend/lib/program-display.ts`
- `frontend/lib/program-display.test.ts`
- `frontend/lib/server/program-card-summary.ts`
- `frontend/lib/server/program-card-summary.test.ts`
- `frontend/lib/types/index.ts`
- `frontend/lib/server/public-programs-fallback.ts`
- `supabase/migrations/20260426152000_fix_landing_chip_snapshot_function_live_schema.sql`
- `frontend/app/(landing)/landing-c/page.tsx`
- `frontend/app/(landing)/landing-c/_program-feed.tsx`
- `frontend/components/landing/LandingHeader.tsx`
- `frontend/app/page.tsx`
- `frontend/lib/server/public-program-snapshot-utils.ts`
- `frontend/lib/server/public-programs-fallback.test.ts`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## 왜 변경했는가
- 랜딩 첫 진입과 칩 전환이 여전히 느렸고, keyword가 없는 단순 칩 탐색에서도 runtime fetch 비용이 컸다.
- `무료`/`창업` 칩은 legacy fallback 날짜 기준이 UTC여서 KST 기준 이미 지난 공고가 섞일 수 있었다.
- 카드의 `본인부담금` 라벨은 바뀌었지만 일부 고용24 row에서 여전히 총 훈련비가 표시되고 있었다.
- 검색창은 현재 랜딩 칩 UX와 충돌하고 빈 결과를 자주 만들어, 공개 탐색 퍼널에 더 이상 맞지 않았다.

## 무엇을 바꿨는가
- `landing-c`는 keyword가 없을 때 backend `/programs/list`를 기본 경로로 쓰지 않고, `program_landing_chip_snapshots`와 cached direct Supabase read만으로 Opportunity feed와 Live Board를 구성하도록 줄였다.
- 랜딩 snapshot 조회는 `오늘(KST)` row만 고집하지 않고 가장 최근 snapshot을 재사용하도록 바꿨다. 그래서 자정 refresh가 아직 안 돌았거나 local DB가 하루 늦어도 바로 snapshot 기반 카드가 뜬다.
- snapshot이 아예 없을 때는 하루 1회만 만드는 in-memory chip fallback cache를 추가했다. 이 cache는 read-model browse 후보와 bounded legacy open row를 한 번 합쳐 `무료/창업/온라인` 등 각 칩 24개 후보를 만들어두므로, 칩 클릭마다 `programs`를 1000개씩 다시 스캔하지 않는다.
- `landing-c/page.tsx`의 keywordless 보충 top-up scan을 제거했다. 기본 칩 클릭은 snapshot 또는 그 대체 cache만 쓰고, 무거운 `loadPublicFilteredProgramFallbackRows()`는 수동 keyword URL에서만 남긴다.
- 공개 fallback 날짜 기준을 KST로 통일하고 `무료`/`창업`을 포함한 legacy fallback 후보에서 마감 지난 공고를 제외했다.
- 랜딩 Opportunity feed 검색 input과 적용 버튼을 제거하고, 칩 버튼만 남겼다.
- 문구를 `자주찾는 검색어로 공고를 빠르게 탐색합니다`, `더 많은 공고를 탐색하고 싶다면 '프로그램 더보기' 버튼을 누르세요`, `프로그램 더보기`, `프로그램 탐색`으로 정리했다.
- summary bridge가 `compare_meta`를 summary row까지 보존하도록 바꾸고, 비용 helper는 `self_payment/out_of_pocket/real_man`을 `subsidy_amount`보다 먼저 보도록 정리했다. 그래서 summary `subsidy_amount`가 총 훈련비로 들어온 row도 실제 본인부담금이 있으면 그 값을 먼저 노출한다.
- 루트 `/`는 `permanentRedirect("/landing-c")`로 바꿨다.
- 후속 live DB 확인에서 landing snapshot 함수가 `public.programs.application_url`를 직접 참조해 실제 운영 스키마에서 실패하고 있음을 확인했고, corrective migration으로 `program_source_records.application_url`과 `programs.service_meta/compare_meta`를 쓰도록 재정의했다. migration 적용 시 snapshot backfill도 한 번 같이 시도한다.

## 유지한 동작
- keyword 검색 URL(`?q=...`)은 서버 경로에서 계속 동작한다. 다만 랜딩 UI에서 검색창만 제거했다.
- snapshot이 없거나 오늘 snapshot이 아직 없어도 가장 최근 snapshot 또는 in-memory fallback cache로 Opportunity feed는 계속 복구된다.
- 기존 칩 의미(`무료`, `온라인`, `창업` 등)와 최소 6개 top-up 계약은 유지한다.

## 리스크 / 가능 회귀
- keyword 없는 칩 탐색은 speed를 위해 backend 경유를 거의 제거했기 때문에, backend serializer에서만 제공하던 신규 표시 필드는 snapshot/direct summary 경로에 별도 반영이 필요할 수 있다.
- Live Board는 이제 backend가 아니라 direct read-model cached query를 쓰므로, backend sort 로직과 완전히 동일하게 진화하지는 않는다.
- root redirect는 307에서 308으로 바뀌므로 일부 로컬 브라우저 캐시에서 한 번 더 redirect behavior 차이를 볼 수 있다.
- 본인부담금 추정은 `compare_meta.self_payment/out_of_pocket/real_man`을 우선 사용한다. 원천 수집기가 다른 필드 이름으로만 실제 자부담을 담는 경우는 추가 alias 보강이 필요할 수 있다.
- landing snapshot corrective migration은 live DB apply 전까지는 효력이 없다. 프런트 fallback이 느림을 막아도 DB snapshot 자체는 migration 적용 후 한 번 성공 실행돼야 채워진다.

## 테스트 / 검증
- `frontend`: `npm test -- lib/program-filters.test.ts lib/program-display.test.ts lib/server/program-card-summary.test.ts lib/server/public-programs-fallback.test.ts 'app/(landing)/landing-c/_program-utils.test.ts'`
- `frontend`: `npx tsc --noEmit --pretty false`

## 추가 리팩토링 후보
- 랜딩 칩 버튼을 client-side prefetch 또는 shallow navigation 성격으로 더 가볍게 바꿀지 검토
- `Live Board`도 별도 daily snapshot으로 굳혀 자정 refresh와 완전히 같은 모델로 묶을지 판단
- landing snapshot SQL과 프런트 칩 정의를 더 강하게 공유하는 단일 source-of-truth 정리
- fallback chip cache를 process memory만이 아니라 DB snapshot 재생성 큐나 edge cache까지 확장할지 검토
