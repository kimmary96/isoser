# TASK-2026-04-17-1520-calendar-to-resume-prefill result report

## Status
- verdict: completed
- task_id: `TASK-2026-04-17-1520-calendar-to-resume-prefill`
- planned_against_commit: `ddc1083bf1a82c4ed21ccd313e32106227d663b8`
- current_head_at_start: `2b1d52c4401caf41e15d168069a8c623e0e4036c`

## Changed files
- `frontend/app/api/dashboard/resume/prefill/route.ts`
- `frontend/app/api/dashboard/resume/route.ts`
- `frontend/app/dashboard/resume/page.tsx`
- `frontend/app/dashboard/resume/_hooks/use-resume-builder.ts`
- `frontend/app/dashboard/resume/_components/resume-assistant-sidebar.tsx`
- `frontend/app/dashboard/resume/_components/resume-preview-pane.tsx`
- `frontend/lib/api/app.ts`
- `frontend/lib/types/index.ts`
- `supabase/migrations/20260417162000_add_source_program_id_to_resumes.sql`
- `reports/TASK-2026-04-17-1520-calendar-to-resume-prefill-result.md`
- `docs/refactoring-log.md`

## Why changes were made
- 캘린더 CTA가 이미 `/dashboard/resume?prefill_program_id=<id>`로 연결되어 있었지만, resume 쪽에서는 해당 파라미터를 읽지 않아 프리필이 전혀 적용되지 않고 있었다.
- 프로그램 요건 기반 활동 자동 선택은 서버측 BFF에서 계산하도록 packet이 요구했기 때문에, `GET /api/dashboard/resume/prefill` route를 추가해 프로그램/활동 overlap 계산, fallback 메시지, 자동 선택 ID 목록을 내려주도록 구현했다.
- 이력서 저장 후 프로그램 출처를 추적할 수 있도록 `source_program_id`를 payload와 DB schema에 연결했다.

## Preserved behaviors
- `prefill_program_id`가 없으면 resume builder는 기존 수동 편집 흐름을 그대로 유지한다.
- 잘못된 프로그램 ID, 활동 0건, 요건 정보 부족, 낮은 관련도 같은 경우에도 500 없이 일반 편집 모드로 fallback한다.
- 기존 이력서 저장 API는 아직 migration이 적용되지 않은 환경에서도 fallback insert로 동작을 유지한다.
- 기존 bio 저장, AI 채팅, 템플릿 선택, 문서 생성 진입 흐름은 그대로 유지했다.

## Validation
- `frontend`에서 임시 task-scoped tsconfig로 대상 파일만 포함해 `npx tsc --noEmit -p "$env:TEMP\\isoser-resume-task-tsconfig.json"` 실행
- 결과: 성공
- 추가 확인:
  - 기본 `tsconfig.codex-check.json` 경로는 기존 `.next/types/app/programs/[id]/page.ts` 생성물 누락 때문에 이 task와 무관한 실패가 있었다.
  - `next lint`는 저장소에 ESLint 초기 설정이 없어 interactive prompt로 진입해 비적합했다.

## Risks / possible regressions
- 프로그램 테이블 스키마가 환경마다 혼재돼 있을 가능성이 있어 prefill route는 `select("*")` + 다중 필드 fallback으로 작성했다. 운영 DB 필드명이 더 다르면 요건 요약 품질은 떨어질 수 있다.
- 새 요약 초안은 현재 client-local 편집 상태로만 유지되며, 별도 resume column으로 저장하지는 않는다.
- 자동 선택 badge는 사용자가 토글한 순간 제거되도록 구현했기 때문에, 다시 선택해도 자동 선택 표시가 복원되지는 않는다.

## Follow-up refactoring candidates
- 프로그램/활동 overlap 계산을 공용 서버 유틸로 분리해 calendar, compare, resume prefill 간 점수 규칙을 하나로 맞출 수 있다.
- resume builder의 prefill 상태와 일반 편집 상태를 reducer나 state machine으로 분리하면 적용/되돌리기/수동 덮어쓰기 흐름이 더 명확해질 수 있다.

## Run Metadata
- generated_at: `2026-04-17T16:00:00+09:00`

## Run Metadata

- generated_at: `2026-04-17T13:14:57`
- watcher_exit_code: `0`
- codex_tokens_used: `134,297`

## Git Automation

- status: `pushed`
- branch: `develop`
- commit: `784f46e198a6283f9914b90dd8fa1eafd2e3f08b`
- note: [codex] TASK-2026-04-17-1520-calendar-to-resume-prefill 구현 완료. Pushed to origin/develop. Automatic main promotion skipped because origin/main is not an ancestor of the task commit.
