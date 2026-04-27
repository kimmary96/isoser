# SESSION-2026-04-28 Resume Overrides Export PDF Result

## Changed files
- `supabase/migrations/20260428110000_add_resume_activity_line_overrides.sql`
- `frontend/app/api/dashboard/resume/route.ts`
- `frontend/app/api/dashboard/resume-export/route.ts`
- `frontend/app/dashboard/documents/page.tsx`
- `frontend/app/dashboard/resume/_hooks/use-resume-builder.ts`
- `frontend/app/dashboard/resume/export/page.tsx`
- `frontend/app/dashboard/resume/export/_components/resume-pdf-download.tsx`
- `frontend/lib/resume-line-overrides.ts`
- `frontend/lib/resume-line-overrides.test.ts`
- `frontend/lib/resume-display.ts`
- `frontend/lib/api/app.ts`
- `frontend/lib/types/index.ts`
- `frontend/public/fonts/Pretendard-Regular.woff`
- `frontend/public/fonts/Pretendard-Bold.woff`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made
- 공고 핏 후보를 미리보기에 적용한 뒤 문서를 생성하면, 해당 문장이 문서 저장소와 PDF 출력까지 이어져야 했다.
- PDF 다운로드가 링크 생성 전에는 눌리지 않는 것처럼 보일 수 있어, 사용자가 클릭하면 생성/오류 상태가 명확히 보이는 버튼 흐름으로 바꿨다.
- 기존 react-pdf 원격 `NotoSansKR` 폰트 URL 2개가 404로 확인되어, PDF 생성이 끝나지 않거나 실패할 수 있었다.

## Preserved behaviors
- 성과 선택, 이력서 생성, 문서 저장소 목록, 기존 PDF export route는 기존 URL과 기본 계약을 유지한다.
- 적용 문장이 없는 이력서는 계속 성과저장소 기본 `getActivityResumeLines()` 결과를 사용한다.
- DB에 새 컬럼이 아직 반영되지 않은 환경에서는 override 저장을 포기하고 기존 문서 생성 계약으로 fallback한다.

## Result
- `resumes.activity_line_overrides` JSONB 컬럼을 추가하는 idempotent migration을 추가했다.
- 이력서 생성 API는 적용된 activity별 bullet override를 저장하고, export API는 저장 payload를 정규화해 내려준다.
- export 미리보기와 react-pdf 문서는 override가 있는 활동만 해당 bullet을 사용한다.
- PDF 다운로드 UI는 `PDFDownloadLink`에서 명시적 button + `pdf(...).toBlob()` 방식으로 변경해 클릭 가능 상태와 오류 표시를 분리했다.
- PDF용 Pretendard WOFF regular/bold를 앱 정적 자산으로 추가하고, react-pdf가 `/fonts/...` 경로에서 로드하도록 바꿨다.
- override 저장 fallback이 발생하면 문서 저장소에 AI 적용 문장이 저장되지 않았다는 안내를 표시한다.

## Risks / possible regressions
- 새 컬럼 migration이 운영 DB에 적용되기 전에는 적용 문장이 저장되지 않고 기존 성과 문장으로 export된다.
- PDF 생성은 여전히 브라우저에서 이미지 리소스를 가져오므로, 외부 프로필 이미지 CORS 문제는 오류로 표시될 수 있다.
- 현재 override는 활동별 최대 6줄까지 지원하지만, 빌더 UI는 한 후보 문장 적용을 중심으로 동작한다.

## Follow-up refactoring candidates
- 문서 생성 fallback이 발생했을 때 사용자에게 "AI 적용 문장은 저장되지 않았다"는 안내를 노출한다.
- PDF 폰트를 remote URL 대신 앱 자산으로 고정해 네트워크 실패 가능성을 줄인다.
- export 미리보기와 builder 미리보기 레이아웃을 공통 resume renderer로 더 줄인다.

## Verification
- `npm --prefix frontend test -- lib/resume-line-overrides.test.ts app/dashboard/resume/_lib/resume-rewrite.test.ts`
- `npx --prefix frontend tsc -p frontend\tsconfig.codex-check.json --noEmit --pretty false`
- `npm --prefix frontend run lint -- --file app/dashboard/resume/page.tsx --file app/dashboard/resume/_hooks/use-resume-builder.ts --file app/dashboard/resume/_components/resume-preview-pane.tsx --file app/dashboard/resume/export/page.tsx --file app/dashboard/resume/export/_components/resume-pdf-download.tsx --file app/api/dashboard/resume/route.ts --file app/api/dashboard/resume-export/route.ts --file lib/resume-line-overrides.ts --file lib/resume-line-overrides.test.ts --file lib/resume-display.ts --file lib/api/app.ts --file lib/types/index.ts`
- `npm --prefix frontend run lint -- --file app/dashboard/documents/page.tsx --file app/dashboard/resume/_hooks/use-resume-builder.ts --file app/dashboard/resume/export/_components/resume-pdf-download.tsx --file lib/resume-line-overrides.ts --file lib/resume-line-overrides.test.ts`
- `Invoke-WebRequest -UseBasicParsing http://localhost:3000/fonts/Pretendard-Regular.woff -Method Head -TimeoutSec 10` returned `200`
- `Invoke-WebRequest -UseBasicParsing http://localhost:3000/fonts/Pretendard-Bold.woff -Method Head -TimeoutSec 10` returned `200`
- Node react-pdf smoke with `Pretendard-Regular.woff` reached PDF buffer stream generation without font load error
- `npx tsc --noEmit` from `frontend/`
- `Invoke-WebRequest -UseBasicParsing http://localhost:3000/dashboard/resume -TimeoutSec 10` returned `200`
- `Invoke-WebRequest -UseBasicParsing http://localhost:3000/dashboard/resume/export -TimeoutSec 10` returned `200`
