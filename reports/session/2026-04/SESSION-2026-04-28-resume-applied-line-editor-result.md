# SESSION-2026-04-28 Resume Applied Line Editor Result

## Changed files
- `frontend/app/dashboard/resume/page.tsx`
- `frontend/app/dashboard/resume/_hooks/use-resume-builder.ts`
- `frontend/app/dashboard/resume/_components/resume-preview-pane.tsx`
- `frontend/app/dashboard/resume/_lib/resume-rewrite.ts`
- `frontend/app/dashboard/resume/_lib/resume-rewrite.test.ts`
- `frontend/lib/resume-line-overrides.ts`
- `frontend/lib/resume-line-overrides.test.ts`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made
- 공고 핏 후보를 적용한 뒤 실제 이력서 문장으로 한 번 더 다듬는 단계가 필요했다.
- 이미 문서 생성/PDF export에 연결된 `activity_line_overrides`를 재사용하면 신규 저장 구조 없이 작은 UX 개선으로 끝낼 수 있었다.

## Preserved behaviors
- AI 후보 생성, 후보 카드의 `미리보기에 적용`/`적용 해제`, 성과 선택 해제 시 원문 복귀 동작을 유지했다.
- 적용 문장이 없는 활동은 계속 성과저장소 기본 이력서 문장을 렌더한다.
- 문서 생성, 문서 저장소, resume export API, PDF 출력 계약은 기존 `activity_line_overrides` 흐름을 그대로 사용한다.

## Result
- 이력서 중앙 미리보기에서 AI 적용된 활동 bullet을 textarea로 직접 편집할 수 있게 했다.
- 활동별 적용 문장은 최대 6개까지 추가할 수 있고, 개별 문장 삭제와 `원문 복귀`를 지원한다.
- preview의 경력/프로젝트 activity 렌더링을 작은 공용 컴포넌트로 묶어 적용 문장 편집 UI 중복을 줄였다.
- 편집 중 빈 줄만 남은 override draft가 저장 후보로 오판되지 않도록 `hasResumeActivityLineOverrides()`를 실제 문장 존재 기준으로 보강했다.

## Risks / possible regressions
- 실제 인증 세션에서 URL 추출부터 PDF 다운로드까지의 완전한 브라우저 E2E는 이번 CLI 검증 범위 밖이다.
- textarea 편집은 로컬 draft이며, 문서 생성 전 페이지를 벗어나면 저장되지 않는다.
- 여러 줄을 하나의 textarea에 붙여넣으면 저장 시 공백 정규화로 한 bullet처럼 처리된다. 여러 bullet은 `문장 추가`로 나눠 입력하는 흐름이다.

## Follow-up refactoring candidates
- 이력서 builder preview와 export preview/PDF의 공통 resume renderer를 더 통합한다.
- 적용 문장 편집 draft를 문서 생성 전 임시 저장하거나 페이지 이탈 경고를 제공할지 검토한다.
- 공고 URL 추출, 후보 생성, 적용 문장 편집, 문서 생성, PDF 다운로드를 실제 인증 브라우저 세션으로 E2E 체크한다.

## Verification
- `npm --prefix frontend test -- app/dashboard/resume/_lib/resume-rewrite.test.ts lib/resume-line-overrides.test.ts`
- `npx --prefix frontend tsc -p frontend\tsconfig.codex-check.json --noEmit --pretty false`
- `npm --prefix frontend run lint -- --file app/dashboard/resume/page.tsx --file app/dashboard/resume/_hooks/use-resume-builder.ts --file app/dashboard/resume/_components/resume-preview-pane.tsx --file app/dashboard/resume/_lib/resume-rewrite.ts --file app/dashboard/resume/_lib/resume-rewrite.test.ts --file lib/resume-line-overrides.ts --file lib/resume-line-overrides.test.ts`
- `npx tsc --noEmit` from `frontend/`
- `Invoke-WebRequest -UseBasicParsing http://localhost:3000/dashboard/resume -TimeoutSec 10` returned `200`
