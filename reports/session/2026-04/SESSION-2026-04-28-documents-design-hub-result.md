# SESSION-2026-04-28 Documents Design Hub Result

## Summary
- Moved visible design selection out of the resume builder flow.
- Reworked `/dashboard/documents` into the final document selection, design selection, preview, and PDF output hub.
- Added preview-only resume and portfolio routes outside the dashboard layout so the document store can show document content without the dashboard header/sidebar.
- Replaced the primary export-page hop with an in-place demo payment modal that downloads the selected PDF after simulated payment.
- Stabilized portfolio PDF generation by avoiding direct external image rendering and splitting projects across pages.

## Changed Files
- `frontend/app/dashboard/resume/page.tsx`
- `frontend/app/dashboard/resume/_components/resume-assistant-sidebar.tsx`
- `frontend/app/dashboard/resume/_hooks/use-resume-builder.ts`
- `frontend/app/dashboard/documents/page.tsx`
- `frontend/app/dashboard/resume/export/page.tsx`
- `frontend/app/dashboard/resume/export/_components/resume-export-preview.tsx`
- `frontend/app/dashboard/resume/export/_components/resume-pdf-download.tsx`
- `frontend/app/dashboard/portfolio/export/page.tsx`
- `frontend/app/dashboard/portfolio/export/_components/portfolio-export-preview.tsx`
- `frontend/app/dashboard/portfolio/export/_components/portfolio-pdf-download.tsx`
- `frontend/app/preview/documents/resume/page.tsx`
- `frontend/app/preview/documents/portfolio/page.tsx`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why
- The design/template side is not ready enough to keep inside the resume and portfolio authoring screens.
- Resume and portfolio builders should prioritize content, evidence selection, job-fit rewriting, and direct text editing.
- Final design selection and PDF verification belongs in the document repository, where saved documents can be reviewed before export.

## Preserved Behaviors
- Resume creation still sends `template_id: "simple"` to preserve the existing API and database contract.
- Existing resume and portfolio export routes remain the PDF download entrypoints.
- Existing saved document list API and export href contract remain unchanged.
- Portfolio builder save/open and resume rewrite override flows are not changed.

## Result
- Resume assistant sidebar no longer renders template cards.
- Documents page now uses a fixed 3-panel layout:
  - Left: saved resume/portfolio document selection.
  - Center: preview-only iframe for the selected document and selected design.
  - Right: design selector with `기본형` active and future design candidates disabled.
- The left document panel includes `전체`, `이력서`, and `포트폴리오` filter buttons.
- Resume and portfolio preview bodies were split into reusable components and mounted from `/preview/documents/resume` and `/preview/documents/portfolio`.
- `PDF 출력` now opens a demo payment modal in `/dashboard/documents` instead of navigating to an export page.
- The modal shows the selected document, design, demo price, and saved payment method. `결제하고 다운로드` simulates payment completion and then invokes the same React PDF download helper used by the export pages.
- `downloadResumePdf()` and `downloadPortfolioPdf()` are exported from the existing download components so the document store and fallback export pages reuse the same generation logic.
- Portfolio PDF output uses image caption placeholders instead of fetching external image URLs directly, and renders projects on separate pages to avoid browser hangs during demo download.
- Resume and portfolio export pages accept `embedded=true` and hide outer output controls in embedded preview mode.
- Normal export pages show `디자인 기본형` instead of template wording.

## Risks / Possible Regressions
- The design selector currently has one real active option; additional designs still need actual PDF rendering variants before they should be enabled.
- The document store preview uses same-origin iframe embedding of preview-only routes. If route-level frame protections are added later, preview embedding must be revisited.
- The payment modal is explicitly a demo UI. Real payment will need PG integration, payment authorization records, receipt handling, and download entitlement checks.
- Portfolio PDF images are not embedded in this stable demo path; only their captions/placeholders are included until image fetching is moved to a safer server/proxy pipeline.
- Visual QA should check iframe sizing with real saved documents containing long resume/portfolio content.

## Follow-up Refactoring Candidates
- Introduce a shared document design registry used by documents, resume PDF, and portfolio PDF renderers.
- Split `/dashboard/documents/page.tsx` into smaller local components once the design selection flow grows beyond one active design.
- Add integration tests or component tests for highlighted document auto-selection and export href parameter construction.

## Verification
- `npx --prefix frontend tsc -p frontend/tsconfig.codex-check.json --noEmit --pretty false`
- `npx tsc --noEmit` from `frontend/`
- `npm --prefix frontend test`
- `npm --prefix frontend run build`
- `npm --prefix frontend run lint -- --file app/dashboard/documents/page.tsx --file app/dashboard/resume/page.tsx --file app/dashboard/resume/_components/resume-assistant-sidebar.tsx --file app/dashboard/resume/_hooks/use-resume-builder.ts --file app/dashboard/resume/export/page.tsx --file app/dashboard/portfolio/export/page.tsx`
- `npm --prefix frontend run lint -- --file app/dashboard/documents/page.tsx --file app/dashboard/resume/export/page.tsx --file app/dashboard/resume/export/_components/resume-export-preview.tsx --file app/dashboard/portfolio/export/page.tsx --file app/dashboard/portfolio/export/_components/portfolio-export-preview.tsx --file app/preview/documents/resume/page.tsx --file app/preview/documents/portfolio/page.tsx`
- `npm --prefix frontend run lint -- --file app/dashboard/documents/page.tsx --file app/dashboard/resume/export/_components/resume-pdf-download.tsx --file app/dashboard/portfolio/export/_components/portfolio-pdf-download.tsx --file app/dashboard/resume/export/page.tsx --file app/dashboard/portfolio/export/page.tsx --file app/dashboard/resume/export/_components/resume-export-preview.tsx --file app/dashboard/portfolio/export/_components/portfolio-export-preview.tsx --file app/preview/documents/resume/page.tsx --file app/preview/documents/portfolio/page.tsx`
- `npm --prefix frontend run lint -- --file app/dashboard/documents/page.tsx --file app/dashboard/resume/export/page.tsx --file app/dashboard/resume/export/_components/resume-pdf-download.tsx --file app/dashboard/resume/export/_components/resume-export-preview.tsx --file app/dashboard/portfolio/export/page.tsx --file app/dashboard/portfolio/export/_components/portfolio-pdf-download.tsx --file app/dashboard/portfolio/export/_components/portfolio-export-preview.tsx --file app/preview/documents/resume/page.tsx --file app/preview/documents/portfolio/page.tsx --file app/dashboard/match/page.tsx --file app/dashboard/match/_components/match-analysis-detail-modal.tsx --file app/dashboard/match/_components/match-analysis-input-modal.tsx`
- `npm --prefix frontend run lint -- --file app/dashboard/portfolio/export/_components/portfolio-pdf-download.tsx --file app/dashboard/documents/page.tsx`
- `git diff --check`
- `Invoke-WebRequest http://localhost:3000/dashboard/documents`
- `Invoke-WebRequest http://localhost:3000/dashboard/match`
- `Invoke-WebRequest http://localhost:3000/dashboard/resume/export?embedded=true`
- `Invoke-WebRequest http://localhost:3000/dashboard/portfolio/export?embedded=true`
- `Invoke-WebRequest http://localhost:3000/preview/documents/resume`
- `Invoke-WebRequest http://localhost:3000/preview/documents/portfolio`
