# SESSION-2026-04-28 Match UI Tone Fit Result

## Changed Files
- `frontend/app/dashboard/_components/modal-shell.tsx`
- `frontend/app/dashboard/match/page.tsx`
- `frontend/app/dashboard/match/_components/match-analysis-input-modal.tsx`
- `frontend/app/dashboard/match/_components/match-analysis-detail-modal.tsx`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why Changes Were Made
- 공고 매칭 분석 화면이 최근 정리한 대시보드/문서 계열 화면보다 더 기본 gray/blue UI에 가까워 전체 제품 톤과 맞지 않았다.
- 백엔드와 DB, `useMatchPage` 상태/API 로직은 유지하면서 화면 surface, 카드, 버튼, 입력창, 모달의 시각 밀도만 맞추는 것이 목표였다.

## What Changed
- `/dashboard/match` 본문 배경을 `#f3f6fb`로 맞추고, 헤더를 white card + compact title/CTA 구조로 정리했다.
- 저장 분석 카드는 white surface, pale blue score block, score progress, soft orange grade chip, summary/date footer, pill형 `상세 보기` affordance로 바꿨다.
- 빈 상태에는 첫 분석 CTA를 추가해 사용자가 상단 버튼을 다시 찾지 않아도 시작할 수 있게 했다.
- 입력 모달은 section/input/file/secondary button class를 로컬 helper로 묶어 분석 방식, 회사/직무, 공고 업로드 영역을 같은 톤으로 맞췄다.
- 입력 모달의 회사명/직무명/공고 본문 label을 추가하고, 이미지/PDF 업로드를 compact card 2개로 나눠 파일 선택 상태를 더 명확히 표시했다.
- `ModalShell`은 optional `scrollBody`, title/subtitle class prop을 지원하게 했고, 매칭 입력/상세 모달만 body scroll + footer 고정 구조를 사용한다.
- 상세 모달은 dark navy 점수 hero, white summary card, pale panel 상세 점수 row, blue progress, orange grade chip, 긴 제목 2줄 clamp로 정리했다.
- 상세 점수 progress width는 `max_score <= 0`일 때 0으로 처리해 비정상 payload에서도 `Infinity%` style이 생기지 않게 했다.

## Preserved Behaviors
- 분석 생성, 저장 목록 조회, 삭제 confirm, 상세 모달 열기/닫기 로직은 변경하지 않았다.
- 이력서 기반/활동 기반 분석 선택, 저장 이력서 조회, 이미지/PDF 공고 추출, 공고 텍스트 입력 계약은 유지했다.
- Next BFF, backend API, DB schema, dashboard sidebar/layout은 변경하지 않았다.
- `ModalShell`의 기본 `scrollBody=false` 동작은 유지해 기존 프로그램/활동 모달의 스크롤 구조를 바꾸지 않았다.

## Risks / Possible Regressions
- 파일 input의 native 스타일은 브라우저별 차이가 있어 일부 Windows/Chrome 환경에서 버튼 폭이나 줄바꿈이 다르게 보일 수 있다.
- 저장 분석 카드가 4열에서 3열로 바뀌어 한 화면에 보이는 카드 수는 줄었지만, 제목/요약 가독성은 좋아졌다.
- `ModalShell` optional prop 추가는 기본값 보존 방식이지만, 이후 다른 모달에 `scrollBody`를 적용할 때는 header/body/footer 높이 검증이 필요하다.
- 인증이 필요한 화면이라 비로그인 smoke는 redirect까지만 확인했다.

## Follow-up Refactoring Candidates
- `/dashboard/match`와 `/dashboard/resume`의 공고 입력 UI를 공통 `JobPostingInputPanel`로 분리한다.
- dashboard 계열에서 반복되는 `sectionClassName`, `fieldClassName`, primary/secondary button class를 공통 UI helper로 끌어올린다.
- 저장 분석 카드가 많아질 경우 검색/정렬 또는 최근 분석 pinning을 추가한다.

## Verification
- `npm --prefix frontend run lint -- --file app/dashboard/_components/modal-shell.tsx --file app/dashboard/match/page.tsx --file app/dashboard/match/_components/match-analysis-input-modal.tsx --file app/dashboard/match/_components/match-analysis-detail-modal.tsx`
- `npx --prefix frontend tsc -p frontend\tsconfig.codex-check.json --noEmit --pretty false`
- `Invoke-WebRequest -UseBasicParsing -Uri http://localhost:3000/dashboard/match -MaximumRedirection 0 -TimeoutSec 20`: HTTP 307 auth redirect 확인
