# Documents A4 Preview Result

## Changed files
- `frontend/app/dashboard/resume/export/_components/resume-export-preview.tsx`
- `frontend/app/dashboard/portfolio/export/_components/portfolio-export-preview.tsx`
- `frontend/app/dashboard/portfolio/export/page.tsx`
- `frontend/app/preview/documents/resume/page.tsx`
- `frontend/app/preview/documents/portfolio/page.tsx`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made
- 문서 저장소 중앙 iframe 미리보기가 일반 카드처럼 보여 A4 문서 기준의 종이 크기와 페이지 흐름을 확인하기 어려웠다.
- 이력서 작성 화면에 적용한 A4 미리보기 경험을 저장된 이력서/포트폴리오 문서 확인 단계에도 맞출 필요가 있었다.

## Preserved behaviors
- 저장 문서 조회, 문서 선택, 디자인 선택, preview iframe URL 생성, 데모 결제 모달은 변경하지 않았다.
- 기존 PDF 다운로드 helper와 export API, DB schema는 변경하지 않았다.
- 일반 `/dashboard/resume/export`, `/dashboard/portfolio/export` fallback 화면은 기존 출력 설정/다운로드 흐름을 유지한다.

## Risks / possible regressions
- A4 page break는 브라우저 실제 PDF 엔진이 아니라 화면 미리보기용 추정 pagination이다.
- 아주 긴 단일 활동 또는 프로젝트 블록은 한 A4 page 안에서 overflow가 잘릴 수 있어, 후속으로 bullet/section 단위 세분화 pagination이 필요할 수 있다.
- `/dashboard/documents`는 인증이 필요한 화면이라 로그인 세션 없이는 visual QA가 제한된다.

## Follow-up refactoring candidates
- resume builder preview, document store preview, export PDF renderer의 pagination 기준을 공유 model로 통합한다.
- 포트폴리오 project 내부 section을 A4 item으로 더 잘게 쪼개 긴 프로젝트가 다음 page로 자연스럽게 이어지도록 한다.

## Verification
- `npm run lint -- --file app/dashboard/resume/export/_components/resume-export-preview.tsx --file app/dashboard/portfolio/export/_components/portfolio-export-preview.tsx --file app/dashboard/portfolio/export/page.tsx --file app/preview/documents/resume/page.tsx --file app/preview/documents/portfolio/page.tsx`
- `npx tsc --noEmit`
- `git diff --check`
- `Invoke-WebRequest http://localhost:3000/dashboard/documents -MaximumRedirection 0` -> `307 /login?redirectedFrom=%2Fdashboard%2Fdocuments`
- `Invoke-WebRequest http://localhost:3000/preview/documents/resume -MaximumRedirection 0` -> `200`
- `Invoke-WebRequest http://localhost:3000/preview/documents/portfolio -MaximumRedirection 0` -> `200`
