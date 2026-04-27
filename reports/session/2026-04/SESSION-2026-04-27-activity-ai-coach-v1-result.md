# Session Result: Activity AI Coach v1

## Changed files

- `docs/specs/career-evidence-engine-v1.md`
- `docs/specs/README.md`
- `docs/current-state.md`
- `docs/refactoring-log.md`
- `frontend/app/dashboard/activities/[id]/page.tsx`
- `frontend/app/dashboard/activities/_hooks/use-activity-detail.ts`
- `frontend/app/dashboard/activities/_components/activity-coach-panel.tsx`
- `frontend/app/dashboard/activities/_components/activity-coach-insight-panel.tsx`
- `frontend/app/dashboard/activities/_components/activity-coach-insight-panel.test.tsx`
- `frontend/app/dashboard/activities/_lib/activity-coach-context.ts`
- `frontend/app/dashboard/activities/_lib/activity-coach-context.test.ts`
- `frontend/app/dashboard/activities/_lib/activity-coach-insight.ts`
- `frontend/app/dashboard/activities/_lib/activity-coach-insight.test.ts`

## Why changes were made

The activity AI coach needed to become a reusable career evidence workflow rather than a plain chat panel. The first implementation keeps the existing backend contract and adds a structured frontend layer that turns coach responses into diagnosis, questions, rewrite candidates, risk flags, role keywords, and reusable draft apply actions.

## Preserved behaviors

- Existing activity detail loading remains unchanged.
- Existing coach request route and backend `CoachFeedbackResponse` contract remain unchanged.
- Existing chat messages still render.
- Existing activity save, STAR save, delete, image upload, intro generation, STAR conversion, and portfolio conversion flows remain the save points.
- AI candidate apply actions only update client draft state and do not auto-save to the server.

## Implemented behavior

- Coach requests now send a structured activity evidence packet including target role, title, type, organization, period, team info, role, skills, contributions, description, and STAR fields.
- Latest successful coach response is mapped into an `ActivityCoachInsight`.
- The coach panel displays diagnosis cards, role/skill-based strength points, deterministic follow-up questions, rewrite candidates, and review risks.
- Rewrite candidates can be applied to:
  - activity description draft
  - mapped STAR draft field
  - contribution draft items
- STAR apply appends without overwriting existing draft text.
- Contribution apply fills an empty row first, then appends up to six items, avoiding duplicates.

## Verification

- `npm run test -- app/dashboard/activities/_lib/activity-coach-context.test.ts app/dashboard/activities/_lib/activity-coach-insight.test.ts app/dashboard/activities/_components/activity-coach-insight-panel.test.tsx`
- `npx tsc --noEmit --pretty false`
- `npm run lint -- --file app/dashboard/activities/_lib/activity-coach-context.ts --file app/dashboard/activities/_lib/activity-coach-context.test.ts --file app/dashboard/activities/_lib/activity-coach-insight.ts --file app/dashboard/activities/_lib/activity-coach-insight.test.ts --file app/dashboard/activities/_components/activity-coach-insight-panel.tsx --file app/dashboard/activities/_components/activity-coach-insight-panel.test.tsx --file app/dashboard/activities/_components/activity-coach-panel.tsx --file app/dashboard/activities/_hooks/use-activity-detail.ts --file app/dashboard/activities/[id]/page.tsx`
- Local dev server root returned `200`.

## Risks / possible regressions

- STAR target mapping is deterministic and conservative, but LLM `section` labels may vary. The fallback currently maps by Korean/English section keywords and `focus`.
- Apply actions are draft-only, so users still need to save explicitly. This is intentional but should be clear in QA.
- The insight panel can become dense if the backend returns many rewrite candidates.
- `useActivityDetail` is carrying more responsibilities and should be split if the activity page continues to grow.

## Follow-up refactoring candidates

- Extract apply-action helpers from `useActivityDetail` into a small tested utility if more apply targets are added.
- Split `ActivityCoachInsightPanel` into `DiagnosisGrid`, `StrengthPointList`, `QuestionList`, `RewriteCandidateList`, and `RiskFlagList` once UI iteration stabilizes.
- Promote the frontend-only `ActivityCoachInsight` shape into a backend `CareerCoachingResult` only after resume/portfolio reuse proves the contract.
- Add browser-level QA for a logged-in activity flow when an authenticated test account is available.
