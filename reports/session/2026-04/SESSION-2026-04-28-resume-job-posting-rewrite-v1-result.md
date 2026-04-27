# SESSION-2026-04-28 Resume Job Posting Rewrite V1 Result

## Changed files
- `frontend/app/dashboard/resume/page.tsx`
- `frontend/app/dashboard/resume/_hooks/use-resume-builder.ts`
- `frontend/app/dashboard/resume/_components/resume-assistant-sidebar.tsx`
- `frontend/app/dashboard/resume/_lib/resume-rewrite.ts`
- `frontend/app/dashboard/resume/_lib/resume-rewrite.test.ts`
- `frontend/app/api/dashboard/resume/rewrite/route.ts`
- `frontend/lib/api/app.ts`
- `frontend/lib/types/index.ts`
- `backend/chains/job_posting_rewrite_chain.py`
- `backend/tests/test_job_posting_rewrite_chain.py`
- `backend/tests/test_match_rewrite_api.py`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made
- 이력서 기능에서 성과저장소 활동을 공고/지원 직무 기준의 이력서 문장 후보로 재가공하는 1단계가 필요했다.
- 텍스트 붙여넣기만으로는 사용자가 캡처 이미지나 PDF 공고를 들고 있는 실제 입력 상황을 받기 어렵기 때문에, 기존 `/dashboard/match`의 공고 이미지/PDF 추출 흐름을 이력서 빌더에도 재사용했다.

## Preserved behaviors
- 기존 이력서 생성은 계속 `resumes.title`, `target_job`, `template_id`, `selected_activity_ids`만 저장한다.
- 이력서 미리보기와 PDF export는 기존 `getActivityResumeLines()` 기반 표시를 유지한다.
- 생성된 문장 후보는 화면 state에만 표시하며 자동 저장하거나 기존 이력서 본문을 바꾸지 않는다.
- 기존 `/match/rewrite`, `/match/extract-job-image`, `/match/extract-job-pdf` backend API 계약은 유지했다.

## Result
- `/dashboard/resume` 우측 AI 패널에 공고 텍스트 붙여넣기, 캡처 이미지 업로드 추출, PDF 업로드 추출, `선택 성과로 문장 후보 생성` 흐름을 추가했다.
- 신규 `POST /api/dashboard/resume/rewrite` BFF가 로그인 사용자 확인, 분당 rate limit, 30초 timeout을 적용하고 backend `/match/rewrite?user_id=...`를 호출한다.
- `frontend/app/dashboard/resume/_lib/resume-rewrite.ts`는 공고 텍스트 병합, 선택 성과 section type 판정, 후보 렌더링용 activity title map, 요청 가능 여부 판정을 맡는다.
- backend `job_posting_rewrite_chain.py`는 Supabase 활동 조회와 prompt 구성에 활동 유형, 조직, 기간, 팀 규모/구성, 내 역할, 기여내용, 소개글, STAR 4요소를 포함한다.

## Risks / possible regressions
- 이미지 공고 추출은 Gemini/API quota와 이미지 품질에 영향을 받는다.
- PDF 추출은 텍스트형 PDF에는 강하지만 스캔 이미지형 PDF는 별도 OCR 품질에 좌우된다.
- `/match/rewrite`는 현재 공고 텍스트 최소 50자와 지원 직무 입력을 요구한다.
- 우측 패널에 입력/후보 UI가 늘어나 화면 밀도가 높아졌다. 이후 별도 공고 입력 컴포넌트 분리가 필요할 수 있다.
- URL 공고 추출은 SSRF 방어와 채용 사이트 접근 제한 처리가 필요해 이번 단계에는 포함하지 않았다.

## Follow-up refactoring candidates
- `/dashboard/match`와 `/dashboard/resume`에서 공고 입력 UI를 공유하는 `JobPostingInputPanel`로 분리한다.
- URL 공고 추출은 allowlist/denylist, 사설 IP 차단, timeout, content-type/size 제한을 포함한 BFF로 별도 추가한다.
- 후보 적용은 다음 단계에서 이력서 draft line state를 도입한 뒤 자동 저장 없이 선택 적용으로 제한한다.
- `ActivityEvidenceSource` 계열 근거 패킷 builder를 성과저장소 화면 밖 공통 domain lib로 승격한다.

## Verification
- `backend\venv\Scripts\python.exe -m pytest backend\tests\test_job_posting_rewrite_chain.py backend\tests\test_match_rewrite_api.py -q`
- `npm --prefix frontend test -- app/dashboard/resume/_lib/resume-rewrite.test.ts`
- `npx --prefix frontend tsc -p frontend\tsconfig.codex-check.json --noEmit --pretty false`
- `npm --prefix frontend run lint -- --file app/dashboard/resume/page.tsx --file app/dashboard/resume/_hooks/use-resume-builder.ts --file app/dashboard/resume/_components/resume-assistant-sidebar.tsx --file app/dashboard/resume/_lib/resume-rewrite.ts --file app/api/dashboard/resume/rewrite/route.ts --file lib/api/app.ts --file lib/types/index.ts`
- `npx tsc --noEmit` from `frontend/`
- `backend\venv\Scripts\python.exe -m py_compile backend\chains\job_posting_rewrite_chain.py backend\routers\match.py`
- `Invoke-WebRequest -UseBasicParsing http://localhost:3000/dashboard/resume -TimeoutSec 10` returned `200`
