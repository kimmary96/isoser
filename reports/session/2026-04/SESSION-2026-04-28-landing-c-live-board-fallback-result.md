# Landing C Live Board fallback result

## Changed files
- `frontend/app/(landing)/landing-c/page.tsx`
- `frontend/app/(landing)/landing-c/_program-utils.ts`
- `frontend/app/(landing)/landing-c/_program-utils.test.ts`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made
- `/landing-c`는 Opportunity feed용 snapshot 프로그램과 hero Live Board용 프로그램을 별도로 읽는다.
- snapshot 프로그램이 정상이어도 Live Board 조회가 빈 배열로 실패/캐시되면 hero `추천 공고` 영역만 0건으로 보일 수 있는 분기가 있었다.
- Live Board가 비어 있을 때 이미 확보한 공개 프로그램 목록에서 같은 `getLiveBoardPrograms()` 규칙으로 대체 후보를 고르도록 했다.

## Preserved behaviors
- Live Board 조회 결과에 후보가 있으면 기존처럼 해당 후보를 우선 사용한다.
- 추천공고 정렬 규칙은 기존 최근 7일 상세 조회수, 누적 상세 조회수, 만족도/리뷰/추천 proxy fallback 순서를 유지한다.
- Opportunity feed의 chip, keyword, snapshot/backend fallback 조회 흐름은 변경하지 않았다.

## Risks / possible regressions
- Live Board source가 비어 있는 장애 상황에서는 hero 추천공고와 Opportunity feed가 같은 원천 프로그램 목록에서 뽑힐 수 있다.
- 대체 후보도 없으면 기존처럼 hero 빈 상태 문구가 표시된다.

## Follow-up refactoring candidates
- Live Board 조회 실패/빈 결과를 서버 로그나 lightweight metric으로 남겨 snapshot cache 문제와 read-model 문제를 구분한다.
- `landing-c/page.tsx`의 데이터 로딩 분기를 `loadLandingCPrograms()` 같은 서버 helper로 분리해 fallback 조합을 테스트하기 쉽게 만든다.

## Verification
- `npm --prefix frontend test -- --run "app/(landing)/landing-c/_program-utils.test.ts"`: passed, 8 tests.
- `npm --prefix frontend run lint -- --file 'app/(landing)/landing-c/page.tsx' --file 'app/(landing)/landing-c/_program-utils.ts' --file 'app/(landing)/landing-c/_program-utils.test.ts'`: passed.
- `npx --prefix frontend tsc -p frontend\tsconfig.codex-check.json --noEmit --pretty false`: passed.
- `Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3000/landing-c -TimeoutSec 20`: HTTP 200, `Live Board` present, `추천 공고` present, hero empty message absent, `과정 보기` 12 matches.
- `Invoke-WebRequest` smoke for `http://127.0.0.1:3000/` and `http://127.0.0.1:3000/landing-c`: both HTTP 200, `Live Board`/`추천 공고` present, hero empty message absent, `과정 보기` 12 matches.
