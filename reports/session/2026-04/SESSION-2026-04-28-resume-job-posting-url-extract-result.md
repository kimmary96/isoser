# SESSION-2026-04-28 Resume Job Posting URL Extract Result

## Changed files
- `frontend/app/api/dashboard/resume/extract-job-url/route.ts`
- `frontend/lib/server/job-posting-url-extract.ts`
- `frontend/lib/server/job-posting-url-extract.test.ts`
- `frontend/app/dashboard/resume/page.tsx`
- `frontend/app/dashboard/resume/_hooks/use-resume-builder.ts`
- `frontend/app/dashboard/resume/_components/resume-assistant-sidebar.tsx`
- `frontend/lib/api/app.ts`
- `frontend/lib/types/index.ts`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made
- 공고 텍스트/캡처/PDF에 이어 채용 공고 URL만 가진 사용자가 이력서 문장 후보 생성을 시작할 수 있어야 했다.
- 서버가 임의 URL을 가져오는 기능은 SSRF 위험이 있으므로 이미지/PDF보다 별도 작은 단계로 분리해 방어 로직을 먼저 넣었다.

## Preserved behaviors
- 기존 텍스트 붙여넣기, 이미지 추출, PDF 추출, 문장 후보 생성 흐름은 유지했다.
- URL 추출 결과는 `jobPostingText` draft에만 합치며, 이력서 저장값과 PDF export에는 자동 반영하지 않는다.
- `/match/rewrite`와 backend 이미지/PDF 추출 API 계약은 변경하지 않았다.

## Result
- `/dashboard/resume` 우측 AI 패널에 공고 URL 입력과 `URL에서 공고 추출` 버튼을 추가했다.
- 신규 `POST /api/dashboard/resume/extract-job-url` BFF는 로그인 사용자 확인과 분당 rate limit을 적용한다.
- `frontend/lib/server/job-posting-url-extract.ts`는 URL 파싱, DNS 조회, localhost/사설 IP/link-local/메타데이터 IP/비표준 포트 차단, 수동 redirect 검증, 본문 크기 제한, 텍스트/HTML content-type 제한을 처리한다.
- HTML 공고는 script/style/noscript/svg를 제거하고 block 요소를 줄바꿈으로 바꾼 뒤 텍스트를 정규화해 최대 12000자까지만 반환한다.
- 사람인 relay URL 실측 결과, relay HTML은 공통 UI가 대부분이고 canonical `/zf_user/jobs/view?rec_idx=...`에 실제 공고 본문이 있었다. 같은 host canonical URL을 한 번 더 조회하고, `.wrap_jv_cont`, `.jv_cont`, `job/recruit/detail` 계열 본문 컨테이너가 있으면 전체 페이지보다 해당 후보를 우선 점수화하도록 보강했다.
- 확인 URL `https://www.saramin.co.kr/zf_user/jobs/relay/view?...rec_idx=53358108...`는 최종 URL `https://www.saramin.co.kr/zf_user/jobs/view?rec_idx=53358108`로 canonical fallback되며, 추출 앞부분이 `홍익대학교 세종캠퍼스`, `홍익대 세종캠퍼스 계약직 직원 모집(게임학부)`, `주요업무`, `자격요건`, `근무조건`, `채용절차` 중심으로 바뀌었다.

## Risks / possible regressions
- 일부 채용 사이트는 로그인, 봇 차단, JS 렌더링 의존 때문에 URL 추출이 실패할 수 있다.
- 클라이언트 렌더링으로만 공고 본문을 만드는 사이트는 서버 HTML에서 충분한 텍스트가 나오지 않을 수 있다.
- PDF URL은 이번 route에서 직접 파싱하지 않고 파일 업로드 사용을 안내한다.
- DNS 검증과 fetch 사이 TOCTOU 가능성은 남아 있으므로, 더 강한 네트워크 계층 통제가 필요하면 별도 egress proxy나 allowlist가 필요하다.

## Follow-up refactoring candidates
- `/dashboard/match`와 `/dashboard/resume`의 공고 입력 UI를 공통 컴포넌트로 분리한다.
- 채용 사이트별 구조화 selector 또는 readability parser를 도입해 URL 추출 품질을 높인다.
- URL 추출 실패 시 사용자가 본문 붙여넣기로 바로 전환할 수 있는 안내 상태를 더 명확히 한다.

## Verification
- `npm --prefix frontend test -- lib/server/job-posting-url-extract.test.ts app/dashboard/resume/_lib/resume-rewrite.test.ts`
- `npx --prefix frontend tsc -p frontend\tsconfig.codex-check.json --noEmit --pretty false`
- `npm --prefix frontend run lint -- --file app/dashboard/resume/page.tsx --file app/dashboard/resume/_hooks/use-resume-builder.ts --file app/dashboard/resume/_components/resume-assistant-sidebar.tsx --file app/api/dashboard/resume/extract-job-url/route.ts --file lib/server/job-posting-url-extract.ts --file lib/server/job-posting-url-extract.test.ts --file lib/api/app.ts --file lib/types/index.ts`
- `npx tsc --noEmit` from `frontend/`
- `Invoke-WebRequest -UseBasicParsing http://localhost:3000/dashboard/resume -TimeoutSec 10` returned `200`
- `npm --prefix frontend test -- lib/server/job-posting-url-extract.test.ts`
- `npm --prefix frontend run lint -- --file lib/server/job-posting-url-extract.ts --file lib/server/job-posting-url-extract.test.ts --file app/api/dashboard/resume/extract-job-url/route.ts`
- Node `--experimental-strip-types` smoke for the provided Saramin URL confirmed canonical fallback and job-content-first extraction.
