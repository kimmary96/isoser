# Documents Resume Portfolio UI Fit Result

## Changed files
- `frontend/app/dashboard/documents/page.tsx`
- `frontend/app/dashboard/resume/export/page.tsx`
- `frontend/app/dashboard/resume/export/_components/resume-export-preview.tsx`
- `frontend/app/dashboard/portfolio/export/page.tsx`
- `frontend/app/dashboard/portfolio/export/_components/portfolio-export-preview.tsx`
- `frontend/app/preview/documents/resume/page.tsx`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made
- 이력서, 포트폴리오, 문서 저장소 화면의 톤과 글자 크기/카드 밀도를 대시보드와 이력서 빌더 기준에 맞출 필요가 있었다.
- 문서 저장소는 구조는 유지하되 카드 padding, 제목 크기, hover tone을 낮춰 덜 떠 보이게 했다.
- 이력서 export/preview 쪽에는 아직 예전 gray 계열 UI가 남아 있어 같은 slate/blue/orange tone으로 맞췄다.

## Preserved behaviors
- 저장 문서 조회, 필터, 선택 문서 자동 하이라이트, iframe 미리보기 URL 생성은 변경하지 않았다.
- PDF 출력 데모 결제 모달과 `downloadResumePdf`, `downloadPortfolioPdf` helper 호출 계약은 유지했다.
- 이력서/포트폴리오 export API, PDF renderer, DB schema는 변경하지 않았다.

## Risks / possible regressions
- 시각 밀도 조정이라 기능 리스크는 낮지만, 긴 문서 제목은 더 작은 header/card 안에서 truncate 기준이 더 빨리 적용될 수 있다.
- dashboard 인증이 필요한 화면은 로그인 세션이 없으면 브라우저 visual QA가 제한된다.

## Follow-up refactoring candidates
- `/dashboard/documents/page.tsx`의 left list, preview header, design selector, payment modal을 로컬 컴포넌트로 분리한다.
- 문서 디자인 옵션과 PDF renderer variant를 공유 registry로 묶어 UI 선택과 실제 출력 차이를 줄인다.

## Verification
- `npm run lint -- --file app/dashboard/documents/page.tsx --file app/dashboard/resume/export/page.tsx --file app/dashboard/resume/export/_components/resume-export-preview.tsx --file app/dashboard/portfolio/export/page.tsx --file app/dashboard/portfolio/export/_components/portfolio-export-preview.tsx --file app/preview/documents/resume/page.tsx --file app/preview/documents/portfolio/page.tsx`
- `npx tsc --noEmit`
- `git diff --check`
- `Invoke-WebRequest http://localhost:3000/dashboard/documents -MaximumRedirection 0` -> `307 /login?redirectedFrom=%2Fdashboard%2Fdocuments`
- `Invoke-WebRequest http://localhost:3000/preview/documents/resume -MaximumRedirection 0` -> `200`
- `Invoke-WebRequest http://localhost:3000/preview/documents/portfolio -MaximumRedirection 0` -> `200`
