# SESSION-2026-04-28 Portfolio Builder Fit Export Result

## Summary
- Built the portfolio builder flow around the existing evidence repository and profile data.
- Added job-fit analysis, top-3 project recommendation, lightweight project ordering/paraphrase-ready assembly, image placement metadata, save, and PDF export.
- Preserved the existing single-activity portfolio conversion path by normalizing legacy payloads into the new document payload.

## Changed Files
- `docs/specs/portfolio-builder-fit-framework-v1.md`
- `docs/specs/README.md`
- `docs/current-state.md`
- `docs/refactoring-log.md`
- `frontend/lib/types/index.ts`
- `frontend/lib/portfolio-fit.ts`
- `frontend/lib/portfolio-fit.test.ts`
- `frontend/lib/portfolio-document.ts`
- `frontend/lib/portfolio-document.test.ts`
- `frontend/lib/api/app.ts`
- `frontend/app/api/dashboard/portfolio/fit/route.ts`
- `frontend/app/api/dashboard/portfolio-export/route.ts`
- `frontend/app/api/dashboard/portfolios/route.ts`
- `frontend/app/api/dashboard/documents/route.ts`
- `frontend/app/dashboard/documents/page.tsx`
- `frontend/app/dashboard/page.tsx`
- `frontend/app/dashboard/portfolio/page.tsx`
- `frontend/app/dashboard/portfolio/export/page.tsx`
- `frontend/app/dashboard/portfolio/export/_hooks/use-portfolio-export.ts`
- `frontend/app/dashboard/portfolio/export/_components/portfolio-pdf-download.tsx`

## Why
- The intended workflow is source-first: users should write rich STAR evidence in the activity repository and only assemble, order, lightly fit, and package that evidence in the portfolio builder.
- Portfolio output needed the same practical model as resume output: keep facts grounded, reuse saved evidence and profile data, and support quick PDF generation.
- When users have many projects, the builder needs a low-friction way to recommend the most relevant three projects for a target posting.

## Preserved Behaviors
- Existing `portfolios` table usage is preserved.
- Existing single activity conversion via `/api/dashboard/activities/convert` is still used for portfolio draft generation.
- Existing legacy `PortfolioConversionResponse` payloads are normalized instead of being discarded.
- Browser print-based behavior can still be reached through saved portfolio preview, while the new export path adds explicit PDF generation.

## Result
- Added `PortfolioDocumentPayload` v2 to combine selected activity snapshots, generated section drafts, review tags, fit analysis, and image placement data.
- Added deterministic fit scoring that uses job text, target role, activity STAR completeness, metrics, skills, keywords, role signals, and image evidence.
- Added BFF endpoints for portfolio fit analysis and export hydration.
- Reworked `/dashboard/portfolio` into a builder with target input, project selection, top-3 recommendation, project ordering, image section placement, save, and export links.
- Added `/dashboard/portfolio/export` with React PDF generation using the same font approach as resume export.
- Follow-up fix: portfolio save now moves to `/dashboard/documents?portfolioId=...`, and the document repository lists both resumes and portfolios.
- Follow-up fix: portfolio save/load/export API paths tolerate missing `selected_activity_ids` or `source_activity_id` schema cache entries as long as `portfolio_payload` exists.

## Risks / Possible Regressions
- Fit scoring is deterministic and explainable but still heuristic; later AI coach output should use it as grounding, not as the only ranking signal.
- Image placement currently uses metadata and existing activity image URLs; broken or inaccessible external image URLs may not render in generated PDF.
- Very long project narratives can still need layout tuning after real content sampling, although PDF project blocks now allow page wrapping.
- The current `portfolio/page.tsx` is feature-complete but large; it should be split after behavior stabilizes.

## Verification
- `npm --prefix frontend test -- lib/portfolio-fit.test.ts lib/portfolio-document.test.ts`
- `npx --prefix frontend tsc -p frontend/tsconfig.codex-check.json --noEmit --pretty false`
- `npm --prefix frontend run lint -- --file app/dashboard/portfolio/page.tsx --file app/dashboard/portfolio/export/page.tsx --file app/dashboard/portfolio/export/_components/portfolio-pdf-download.tsx --file app/dashboard/portfolio/export/_hooks/use-portfolio-export.ts --file app/api/dashboard/portfolios/route.ts --file app/api/dashboard/portfolio/fit/route.ts --file app/api/dashboard/portfolio-export/route.ts --file lib/portfolio-document.ts --file lib/portfolio-fit.ts --file lib/types/index.ts --file lib/api/app.ts`
- `npm --prefix frontend run lint -- --file app/dashboard/documents/page.tsx --file app/api/dashboard/documents/route.ts --file app/dashboard/portfolio/page.tsx --file app/api/dashboard/portfolios/route.ts --file app/api/dashboard/portfolio-export/route.ts --file app/dashboard/page.tsx --file lib/api/app.ts --file lib/types/index.ts`
- `git diff --check -- <touched portfolio files>`
- `Invoke-WebRequest http://localhost:3000/dashboard/portfolio`
- `Invoke-WebRequest http://localhost:3000/dashboard/portfolio/export`
- `Invoke-WebRequest http://localhost:3000/dashboard/documents`

## Follow-Up Refactoring Candidates
- Split `frontend/app/dashboard/portfolio/page.tsx` into builder hooks, recommendation panel, preview pane, activity picker, and image placement panel.
- Add AI coach endpoints that consume `PortfolioFitAnalysis` and `PortfolioDocumentPayload` without inventing facts.
- Add persisted user overrides for section-level paraphrases after the no-invention guardrail is implemented.
- Add visual/browser verification for PDF export with seeded image data.
