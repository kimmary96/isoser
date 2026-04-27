# Resume A4 Print Preview Result

## Changed files
- `frontend/app/dashboard/resume/_components/resume-preview-pane.tsx`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made
- 이력서 중앙 미리보기가 하나의 긴 카드로 계속 늘어나 A4 기준에서 어디서 다음 장으로 넘어가는지, 전체가 몇 장 정도인지 확인하기 어려웠다.
- 저장/PDF/API 계약은 그대로 두고 화면 미리보기만 인쇄 미리보기처럼 A4 page 단위로 보이게 했다.

## Preserved behaviors
- 성과/기술/질문 선택, bio 수정 저장, AI 적용 문장 직접 수정, 문장 추가/삭제, 원문 복귀 callback은 유지했다.
- 이력서 생성 API, 저장 payload, export/PDF 경로, DB schema는 변경하지 않았다.
- Dashboard sidebar와 좌우 패널 구조는 변경하지 않았다.

## Risks / possible regressions
- 페이지 분할은 브라우저 실제 인쇄 엔진이 아니라 화면 미리보기용 추정 단위 기반이다. 아주 긴 단일 문장이나 예외적인 content height에서는 실제 PDF page break와 약간 다를 수 있다.
- `/dashboard/resume`은 인증 middleware가 있어 로그인 세션 없는 자동 visual smoke는 `/login?redirectedFrom=%2Fdashboard%2Fresume` redirect까지만 확인했다.

## Follow-up refactoring candidates
- 이력서 builder preview와 `/dashboard/resume/export`의 PDF renderer를 더 가까운 공통 document model로 묶으면 page break 추정과 실제 출력 차이를 줄일 수 있다.
- 활동 entry를 header/bullet 단위로 더 세분화하면 매우 긴 활동 하나도 다음 page로 자연스럽게 이어 보이게 할 수 있다.

## Verification
- `npm run lint -- --file app/dashboard/resume/_components/resume-preview-pane.tsx`
- `npx tsc --noEmit`
- `Invoke-WebRequest -UseBasicParsing http://localhost:3000/dashboard/resume -MaximumRedirection 0` -> `307 /login?redirectedFrom=%2Fdashboard%2Fresume`
