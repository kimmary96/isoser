# SESSION-2026-04-28 Portfolio PDF Output Cleanup Result

## Summary
- Cleaned the final portfolio PDF/preview output after QA found generated PDFs were slow and still showed editing placeholders.
- Kept the portfolio source payload and builder editing behavior unchanged.

## Changed Files
- `frontend/app/dashboard/documents/page.tsx`
- `frontend/app/dashboard/portfolio/export/_components/portfolio-pdf-download.tsx`
- `frontend/app/dashboard/portfolio/export/_components/portfolio-export-preview.tsx`
- `frontend/lib/portfolio-document.ts`
- `frontend/lib/portfolio-document.test.ts`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why
- The downloaded portfolio PDF included final-output-unfriendly text such as `활동이 시작된 배경이나 해결하려던 문제를 입력해주세요.` and duplicate review tags.
- The document store payment modal loaded the PDF renderer only after the final download click, increasing perceived wait time.

## Preserved Behaviors
- Original activities and saved portfolio payloads are not rewritten.
- Portfolio builder editing prompts and saved document schema remain unchanged.
- Existing export fallback route and document store payment modal flow remain the same.

## Result
- Preview-only portfolio document output and React PDF output hide known editing placeholder section text.
- Portfolio PDF metric labels that are still placeholders are omitted rather than printed as final labels.
- Portfolio review tags are normalized so bracketed and unbracketed duplicates collapse to one tag.
- The document store preloads the selected PDF download module when the payment modal opens and shortens the demo-only payment delay.
- Follow-up PDF QA confirmed internal tags such as `수치 보완 필요`, `검토 필요`, and `본인 경험으로 수정 필요` could still appear through review tags or metric values.
- Final preview/PDF output now suppresses those internal tags and placeholder role/metric values.
- If a project has no real quantified result, final output adds a qualitative result sentence based on the project title, role, and skills instead of inventing fake numbers.

## Risks / Possible Regressions
- Placeholder filtering is phrase-based. New backend placeholder phrases will need to be added to the helper.
- PDF generation still happens client-side with React PDF, so very long documents can remain slower than a server-side render/export pipeline.
- The qualitative fallback is deterministic and conservative, so it improves document completeness but does not replace a stronger AI rewrite pass with user-approved evidence.

## Follow-up Refactoring Candidates
- Move final-output text cleanup into a dedicated portfolio export view-model helper.
- Add a server-side PDF rendering path or cached generated PDF artifact for paid/download flows.
- Let users explicitly mark generated portfolio sections as omitted or complete in the builder.

## Verification
- `npm --prefix frontend test -- lib/portfolio-document.test.ts`
- `npm --prefix frontend run lint -- --file app/dashboard/documents/page.tsx --file app/dashboard/portfolio/export/_components/portfolio-pdf-download.tsx --file app/dashboard/portfolio/export/_components/portfolio-export-preview.tsx --file lib/portfolio-document.ts --file lib/portfolio-document.test.ts`
- `npx --prefix frontend tsc -p frontend/tsconfig.codex-check.json --noEmit --pretty false`
- `git diff --check`
- `npm --prefix frontend run build`
- Follow-up: `npm --prefix frontend test -- lib/portfolio-document.test.ts`
- Follow-up: `npm --prefix frontend run lint -- --file app/dashboard/portfolio/export/_components/portfolio-pdf-download.tsx --file app/dashboard/portfolio/export/_components/portfolio-export-preview.tsx --file lib/portfolio-document.ts --file lib/portfolio-document.test.ts`
- Follow-up: `npx --prefix frontend tsc -p frontend/tsconfig.codex-check.json --noEmit --pretty false`
