# SESSION-2026-04-28 Resume Rewrite Preview Apply Result

## Changed files
- `frontend/app/dashboard/resume/page.tsx`
- `frontend/app/dashboard/resume/_hooks/use-resume-builder.ts`
- `frontend/app/dashboard/resume/_components/resume-assistant-sidebar.tsx`
- `frontend/app/dashboard/resume/_components/resume-preview-pane.tsx`
- `frontend/app/dashboard/resume/_lib/resume-rewrite.ts`
- `frontend/app/dashboard/resume/_lib/resume-rewrite.test.ts`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made
- 공고 기준 문장 후보를 생성한 뒤 실제 이력서 초안에서 어떻게 보이는지 확인할 수 있어야 했다.
- 저장 스키마와 PDF export 계약을 바로 바꾸기 전, 사용자 선택으로 미리보기에만 적용하는 작은 단계를 먼저 추가했다.

## Preserved behaviors
- 기존 성과 선택, 이력서 생성 API, `resumes.selected_activity_ids`, PDF export 경로는 변경하지 않았다.
- 후보 문장은 사용자가 직접 `미리보기에 적용`을 누르기 전까지 미리보기 본문을 바꾸지 않는다.
- 적용 문장은 브라우저 state에만 있으며, 성과 선택을 해제하거나 `적용 해제`를 누르면 기존 성과저장소 문장으로 되돌아간다.

## Result
- `AppliedResumeRewriteLines` helper와 상태를 추가해 활동별 적용 후보 문장을 관리한다.
- 우측 후보 카드에 `미리보기에 적용` 버튼과 활동 단위 `적용 해제` 버튼을 추가했다.
- 중앙 이력서 미리보기는 적용된 활동만 기본 `getActivityResumeLines()` 본문 대신 선택 후보 문장을 bullet로 보여준다.
- 미리보기에서 적용된 활동에는 작은 `AI 적용` 표시를 붙여 현재 초안 상태를 구분한다.

## Risks / possible regressions
- 적용 문장은 아직 저장되지 않으므로 새로고침, 문서 생성 이후 export에는 반영되지 않는다.
- 한 활동에 한 개 후보 문장만 적용하는 단순 모델이므로 여러 bullet 조합 편집은 후속 설계가 필요하다.
- 저장까지 확장하려면 `resumes` 스키마 또는 별도 draft payload를 설계하고 기존 export/read 경로를 같이 보강해야 한다.

## Follow-up refactoring candidates
- 적용 문장 저장을 위해 `resumes`에 activity line override payload를 둘지, 별도 resume draft 테이블을 둘지 결정한다.
- `/dashboard/match`와 `/dashboard/resume`의 공고 입력 UI를 공통 컴포넌트로 분리한다.
- 후보 적용 후 사용자가 직접 문장을 다듬을 수 있는 inline editor를 추가한다.

## Verification
- `npm --prefix frontend test -- app/dashboard/resume/_lib/resume-rewrite.test.ts`
- `npx --prefix frontend tsc -p frontend\tsconfig.codex-check.json --noEmit --pretty false`
- `npm --prefix frontend run lint -- --file app/dashboard/resume/page.tsx --file app/dashboard/resume/_hooks/use-resume-builder.ts --file app/dashboard/resume/_components/resume-assistant-sidebar.tsx --file app/dashboard/resume/_components/resume-preview-pane.tsx --file app/dashboard/resume/_lib/resume-rewrite.ts --file app/dashboard/resume/_lib/resume-rewrite.test.ts`
