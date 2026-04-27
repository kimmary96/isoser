# SESSION-2026-04-28 Documents Design Hub Result

## Summary
- Moved visible design selection out of the resume builder flow.
- Reworked `/dashboard/documents` into the final document selection, design selection, preview, and PDF output hub.
- Added embedded preview mode to resume and portfolio export pages so the document store can show a clean preview.

## Changed Files
- `frontend/app/dashboard/resume/page.tsx`
- `frontend/app/dashboard/resume/_components/resume-assistant-sidebar.tsx`
- `frontend/app/dashboard/resume/_hooks/use-resume-builder.ts`
- `frontend/app/dashboard/documents/page.tsx`
- `frontend/app/dashboard/resume/export/page.tsx`
- `frontend/app/dashboard/portfolio/export/page.tsx`
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
  - Center: embedded export preview for the selected document and selected design.
  - Right: design selector with `기본형` active and future design candidates disabled.
- Resume and portfolio export pages accept `embedded=true` and hide outer output controls in embedded preview mode.
- Normal export pages show `디자인 기본형` instead of template wording.

## Risks / Possible Regressions
- The design selector currently has one real active option; additional designs still need actual PDF rendering variants before they should be enabled.
- The document store preview uses same-origin iframe embedding of existing export pages. If route-level frame protections are added later, preview embedding must be revisited.
- Visual QA should check iframe sizing with real saved documents containing long resume/portfolio content.

## Follow-up Refactoring Candidates
- Introduce a shared document design registry used by documents, resume PDF, and portfolio PDF renderers.
- Split `/dashboard/documents/page.tsx` into smaller local components once the design selection flow grows beyond one active design.
- Add integration tests or component tests for highlighted document auto-selection and export href parameter construction.

## Verification
- `npx --prefix frontend tsc -p frontend/tsconfig.codex-check.json --noEmit --pretty false`
- `npm --prefix frontend run lint -- --file app/dashboard/documents/page.tsx --file app/dashboard/resume/page.tsx --file app/dashboard/resume/_components/resume-assistant-sidebar.tsx --file app/dashboard/resume/_hooks/use-resume-builder.ts --file app/dashboard/resume/export/page.tsx --file app/dashboard/portfolio/export/page.tsx`
- `Invoke-WebRequest http://localhost:3000/dashboard/documents`
- `Invoke-WebRequest http://localhost:3000/dashboard/resume/export?embedded=true`
- `Invoke-WebRequest http://localhost:3000/dashboard/portfolio/export?embedded=true`
