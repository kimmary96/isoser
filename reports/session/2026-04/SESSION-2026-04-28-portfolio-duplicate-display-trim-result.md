# SESSION-2026-04-28 Portfolio Duplicate Display Trim Result

## Changed files
- `frontend/lib/portfolio-document.ts`
- `frontend/lib/portfolio-document.test.ts`
- `frontend/app/dashboard/portfolio/page.tsx`
- `frontend/app/dashboard/portfolio/export/page.tsx`
- `frontend/app/dashboard/portfolio/export/_components/portfolio-pdf-download.tsx`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made
- 실제 화면/PDF 확인 중 포트폴리오 프로젝트 내용이 반복되어 보였다.
- 원인은 변환 결과의 개요 요약, 구현 본문, 구현 하이라이트가 같은 활동 설명/기여/STAR Action에서 출발하는데, 렌더가 중복 여부를 보지 않고 모두 출력한 것이다.

## Preserved behaviors
- 포트폴리오 저장 payload와 기존 `PortfolioDocumentPayload`/legacy normalize 계약은 유지했다.
- 여러 성과를 여러 프로젝트로 조합하는 흐름, 프로젝트 순서 변경, 이미지 배치, PDF 다운로드는 유지했다.
- 중복 제거는 렌더 표시 모델에서만 수행해 원본 활동/저장 문서는 수정하지 않는다.

## Result
- `getPortfolioProjectDisplaySections()`를 추가해 이미 개요 요약으로 표시된 동일 문장과 중복 구현 불릿을 숨긴다.
- builder preview, export preview, React PDF 문서가 같은 표시 helper를 사용하도록 맞췄다.
- `getOrderedPortfolioProjects()`가 중복된 `projectOrder` id를 한 번만 렌더하도록 보강했다.

## Risks / possible regressions
- 현재 중복 판정은 완전히 같은 문장 중심이라, 의미는 같지만 표현만 조금 다른 반복은 그대로 남을 수 있다.
- 반대로 사용자가 의도적으로 같은 문장을 여러 섹션에 넣은 경우에는 표시가 한 번으로 줄어든다.
- 제공된 PDF 파일은 로컬에 있었지만 현재 환경에 PDF 텍스트 추출 라이브러리가 없어 코드 경로와 라우트 smoke 중심으로 검증했다.

## Follow-up refactoring candidates
- 포트폴리오 변환 단계 자체에서 개요/문제/구현/성과 문장을 더 분리해 생성하도록 backend `activity_to_portfolio()`를 보강한다.
- 포트폴리오 섹션별 사용자 편집 UX를 추가해 자동 변환 문장을 최종 산출물 기준으로 다듬게 한다.
- 실제 인증 브라우저 세션에서 저장된 포트폴리오 PDF를 열어 시각 회귀를 확인한다.

## Verification
- `npm --prefix frontend test -- lib/portfolio-document.test.ts`
- `npx --prefix frontend tsc -p frontend\tsconfig.codex-check.json --noEmit --pretty false`
- `npm --prefix frontend run lint -- --file app/dashboard/portfolio/page.tsx --file app/dashboard/portfolio/export/page.tsx --file app/dashboard/portfolio/export/_components/portfolio-pdf-download.tsx --file lib/portfolio-document.ts --file lib/portfolio-document.test.ts`
- `npx tsc --noEmit` from `frontend/`
- `Invoke-WebRequest -UseBasicParsing http://localhost:3000/dashboard/portfolio -TimeoutSec 10` returned `200`
- `Invoke-WebRequest -UseBasicParsing http://localhost:3000/dashboard/portfolio/export -TimeoutSec 10` returned `200`
