# TASK-2026-04-14-RESUME-BIO-SAVE-GUARD result

- changed files
  - `frontend/app/dashboard/resume/_hooks/use-resume-builder.ts`
  - `docs/refactoring-log.md`
- why changes were made
  - resume preview의 `bio` 입력은 `Enter`와 `blur`가 같은 trimmed 값에 대해 연속으로 저장을 호출할 수 있었다.
  - 마지막으로 성공 저장된 trimmed `bio`와 현재 저장 진행 여부를 로컬 훅에서 추적해, 의미 있는 변경이 있을 때만 저장하도록 조정했다.
- preserved behaviors
  - 기존 resume preview 레이아웃과 입력 위치는 유지했다.
  - 기존 `bio 저장 중...` 피드백과 저장 실패 시 에러 설정 흐름은 유지했다.
  - `bio` 변경 후 실제 값이 달라지면 기존처럼 저장 요청이 발생한다.
- checks
  - `frontend`: `npx tsc --noEmit` 통과
  - `frontend`: `npx eslint app/dashboard/resume/_hooks/use-resume-builder.ts` 시도했지만 `eslint.config.*` 부재로 실행 불가
- risks / possible regressions
  - 저장 중 새 값을 입력한 뒤 즉시 또 저장 트리거를 발생시키면, 진행 중 요청은 무시되고 이후 다시 트리거되어야 새 값이 저장된다.
  - 현재 가드는 resume builder 내부 `bio` 저장 흐름에만 적용되어 profile 페이지의 다른 저장 UX와는 동기화되지 않는다.
- follow-up refactoring candidates
  - profile/resume에서 공통으로 쓰는 문자열 필드 autosave 가드가 늘어나면 작은 shared helper로 추출할 수 있다.
