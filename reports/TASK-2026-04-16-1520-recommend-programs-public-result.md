# TASK-2026-04-16-1520-recommend-programs-public Result

- changed files
  - `frontend/app/(landing)/programs/page.tsx`
  - `frontend/app/(landing)/programs/recommended-programs-section.tsx`
  - `docs/refactoring-log.md`
- why changes were made
  - 공개 `/programs` 페이지 상단에 로그인 사용자용 맞춤 추천 섹션을 추가하기 위해 서버에서 로그인 상태를 확인하고, 클라이언트에서 기존 `getRecommendedPrograms` 헬퍼를 재사용해 추천 데이터를 불러오도록 구성했다.
  - 비로그인 사용자는 추천 대신 로그인 유도 배너를 보도록 분리했고, 추천 결과가 없을 때는 프로필 편집 유도 상태를 노출했다.
  - 추천 API 호출이 실패하면 추천 섹션만 숨기고 기존 프로그램 목록은 그대로 동작하도록 graceful degradation을 넣었다.
- preserved behaviors
  - 기존 `/programs` 목록의 검색, 필터, 정렬, 페이지네이션 로직은 변경하지 않았다.
  - 기존 프로그램 카드의 `상세 보기`, `비교에 추가`, 외부 지원 링크 CTA는 그대로 유지했다.
  - 기존 대시보드 추천 API/BFF 경로와 클라이언트 헬퍼는 재사용만 했고 동작은 변경하지 않았다.
- risks / possible regressions
  - 추천 섹션은 클라이언트 hydration 이후 로드되므로 네트워크 상태에 따라 상단 영역이 잠깐 skeleton으로 보일 수 있다.
  - 현재 프론트엔드의 TypeScript 전체 체크는 기존 `.next/types/app/programs/[id]/page.ts` 모듈 해석 오류 때문에 통과하지 못했다. 이번 변경 파일에서 새 타입 오류가 확인된 것은 아니지만, 전체 타입체크 신뢰도는 제한된다.
  - ESLint 9 CLI는 저장소에 `eslint.config.*`가 없어 실행하지 못했다.
- follow-up refactoring candidates
  - 추천 카드와 대시보드 추천 카드 사이에 점수/사유 포맷팅 로직이 중복되므로 공용 formatter 또는 프레젠테이션 컴포넌트로 묶을 수 있다.
  - 공개 페이지의 추천 섹션을 서버 prefetch로 전환하면 로그인 사용자 초기 로딩 skeleton을 줄일 수 있다.
- checks
  - `npx eslint 'app/(landing)/programs/page.tsx' 'app/(landing)/programs/recommended-programs-section.tsx'` -> 실패: ESLint 9 flat config(`eslint.config.*`) 부재
  - `npx tsc --noEmit` -> 실패: 기존 `.next/types/app/programs/[id]/page.ts`의 모듈 해석 오류

## Run Metadata

- generated_at: `2026-04-16T16:59:15`
- watcher_exit_code: `0`
- codex_tokens_used: `71,485`

## Git Automation

- status: `main-promotion-skipped`
- branch: `develop`
- commit: `2aa310d1960e554268cd8b42b63d382f4f73415b`
- note: origin/main is not an ancestor of the task commit, so watcher skipped automatic main promotion.
