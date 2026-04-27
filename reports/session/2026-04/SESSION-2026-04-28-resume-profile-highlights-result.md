# SESSION-2026-04-28 Resume Profile Highlights Result

## Changed files
- `frontend/lib/resume-profile.ts`
- `frontend/lib/resume-profile.test.ts`
- `frontend/lib/types/index.ts`
- `frontend/app/api/dashboard/resume/route.ts`
- `frontend/app/api/dashboard/resume-export/route.ts`
- `frontend/app/dashboard/resume/_hooks/use-resume-builder.ts`
- `frontend/app/dashboard/resume/_components/resume-preview-pane.tsx`
- `frontend/app/dashboard/resume/export/page.tsx`
- `frontend/app/dashboard/resume/export/_components/resume-pdf-download.tsx`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made
- 이력서에서 프로필의 수상경력, 자격증, 어학 성적이 빠져 보였다.
- 기존 resume BFF가 `profiles`에서 `name/bio/avatar/email/phone/self_intro/skills`만 읽고 있어 profile 저장소의 `awards`, `certifications`, `languages`가 이력서 화면과 PDF로 전달되지 않았다.
- 수상/자격/어학은 경력 아래에 먼저 보여야 하며, A4 첫 페이지가 내용 overflow로 깨지지 않아야 했다.

## Preserved behaviors
- 이력서 성과 선택, AI 문장 적용/편집, 문서 생성, 저장된 override export 계약은 유지했다.
- `awards/certifications/languages` 컬럼이 없는 DB 환경에서는 기존 기본 profile 컬럼만 읽는 fallback으로 이력서 로딩을 유지한다.
- 선택한 기술스택과 성과 기반 경력/프로젝트 구성은 기존 순서를 유지한다.

## Result
- resume builder/export profile 타입과 API 조회에 `awards`, `certifications`, `languages`를 추가했다.
- 프로필 배열 필드를 정규화하고 highlight section을 만드는 `frontend/lib/resume-profile.ts` helper를 추가했다.
- builder A4 preview는 `WORK EXPERIENCE` 바로 아래에 `AWARDS · CERTIFICATIONS · LANGUAGE` compact 섹션을 표시한다.
- export preview와 React PDF도 `PROFESSIONAL PROFILE -> WORK EXPERIENCE -> AWARDS/CERTIFICATIONS/LANGUAGE -> KEY EXPERIENCE` 순서로 렌더한다.
- A4 preview pagination 추정에 profile highlight block 높이를 반영해 첫 페이지 overflow 대신 page split이 일어나도록 했다.

## Risks / possible regressions
- 항목이 매우 길거나 많으면 첫 페이지에 고정하지 않고 다음 A4 페이지로 넘어간다.
- 오래된 DB에서 optional profile 컬럼이 없으면 fallback으로 기본 profile만 표시되고 수상/자격/어학은 비어 있다.
- 실제 인증 브라우저의 저장된 사용자 데이터로 시각 확인은 별도 수동 확인이 필요하다.

## Follow-up refactoring candidates
- resume builder preview와 export preview/PDF의 섹션 렌더러를 공통화한다.
- 이력서 저장 시 선택한 profile skills snapshot까지 저장할지 검토한다.
- profile 수상/자격/어학 항목이 많을 때 우선순위/접힘/페이지별 분산 UX를 추가한다.

## Verification
- `npm --prefix frontend test -- lib/resume-profile.test.ts lib/resume-line-overrides.test.ts app/dashboard/resume/_lib/resume-rewrite.test.ts`
- `npx --prefix frontend tsc -p frontend\tsconfig.codex-check.json --noEmit --pretty false`
- `npm --prefix frontend run lint -- --file app/api/dashboard/resume/route.ts --file app/api/dashboard/resume-export/route.ts --file app/dashboard/resume/_hooks/use-resume-builder.ts --file app/dashboard/resume/_components/resume-preview-pane.tsx --file app/dashboard/resume/export/page.tsx --file app/dashboard/resume/export/_components/resume-pdf-download.tsx --file lib/resume-profile.ts --file lib/resume-profile.test.ts --file lib/types/index.ts`
- `npx tsc --noEmit` from `frontend/`
- `Invoke-WebRequest -UseBasicParsing http://localhost:3000/dashboard/resume -TimeoutSec 10` returned `200`
- `Invoke-WebRequest -UseBasicParsing http://localhost:3000/dashboard/resume/export -TimeoutSec 10` returned `200`
