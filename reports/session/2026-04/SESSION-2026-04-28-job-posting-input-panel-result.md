# SESSION-2026-04-28 Job Posting Input Panel Result

## Changed Files
- `frontend/app/dashboard/_components/job-posting-input-panel.tsx`
- `frontend/app/dashboard/match/_components/match-analysis-input-modal.tsx`
- `frontend/app/dashboard/resume/_components/resume-assistant-sidebar.tsx`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why Changes Were Made
- `/dashboard/match`와 `/dashboard/resume`에 공고 본문, 이미지/PDF 업로드, 추출 버튼 UI가 중복되어 있었다.
- 후속 UI 조정 시 두 화면이 다시 어긋날 가능성이 있어, 기능 흐름은 유지하면서 공고 입력 surface만 공통화했다.

## What Changed
- 신규 `JobPostingInputPanel`을 추가해 공고 본문 textarea, optional URL 입력/추출, 이미지/PDF 업로드 카드, 파일 목록, 파일 제거/비우기, 추출 버튼을 한 컴포넌트에서 렌더한다.
- `variant="modal" | "sidebar"`로 매칭 모달과 이력서 우측 패널의 밀도 차이를 유지한다.
- `textPlacement="top" | "bottom"`으로 이력서에서는 본문을 먼저, 매칭 모달에서는 업로드 카드 아래에 본문을 배치한다.
- 매칭 입력 모달은 분석 방식 선택, 이력서 선택, 회사명/직무명 입력만 자체 렌더하고 공고 입력 부분은 공통 패널에 위임한다.
- 이력서 assistant sidebar는 문장 후보 생성 버튼과 rewrite 결과 렌더링은 유지하고 공고 입력 부분만 공통 패널에 위임한다.

## Preserved Behaviors
- 매칭 분석 생성, 이력서 선택, 활동 기반 분석 선택, 이미지/PDF 공고 추출, 공고 본문 state 연결은 유지했다.
- 이력서 공고 URL 추출, 이미지/PDF 추출, 문장 후보 생성, 미리보기 적용/해제, 채팅 UI는 유지했다.
- backend API, Next BFF, DB schema, 저장 payload는 변경하지 않았다.

## Risks / Possible Regressions
- 이력서 우측 패널의 업로드 영역이 기존 단순 세로 form에서 compact card 구조로 바뀌어 세로 높이가 조금 늘어날 수 있다.
- 파일 input은 브라우저 native UI라 Windows/Chrome 외 환경에서 줄바꿈이 약간 다를 수 있다.
- 공통 패널 prop이 늘어났으므로 이후 URL 추출이 없는 화면과 있는 화면을 추가할 때 disabled 조건을 확인해야 한다.

## Follow-up Refactoring Candidates
- `JobPostingInputPanel`의 class constants를 dashboard 공통 UI token/helper로 옮긴다.
- URL 추출이 매칭 화면에도 필요해지면 같은 패널 prop만 켜서 붙인다.
- 이미지/PDF 추출 완료 후 선택 파일을 자동 비울지 여부를 UX 정책으로 정한다.

## Verification
- `npm --prefix frontend run lint -- --file app/dashboard/_components/job-posting-input-panel.tsx --file app/dashboard/match/_components/match-analysis-input-modal.tsx --file app/dashboard/resume/_components/resume-assistant-sidebar.tsx`
- `npx --prefix frontend tsc -p frontend\tsconfig.codex-check.json --noEmit --pretty false`
