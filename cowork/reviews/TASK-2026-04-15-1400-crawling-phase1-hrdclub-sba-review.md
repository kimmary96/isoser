## Overall assessment

Not ready for promotion.

The frontmatter is complete and `planned_against_commit` matches current `HEAD` (`78e4bf6f260ed0ada3481d4d921e6ee5f4c643f3`), so there is no commit-level drift. The packet is still not execution-ready because several core assumptions do not match the current repository, including collector existence, scheduler API shape, admin route naming, and allowed `source_type` values in the current schema.

## Findings

- Frontmatter completeness: OK. Required fields `id`, `status`, `type`, `title`, `planned_at`, `planned_against_commit` are present.
- Commit drift: OK. Packet commit matches current `HEAD`.
- Repository path accuracy: partial mismatch.
  - `backend/rag/collector/normalizer.py` and `backend/rag/collector/scheduler.py` exist.
  - `backend/rag/collector/sba_collector.py` does not exist, which matches the packet.
  - `backend/rag/collector/hrdclub_collector.py` also does not exist. The packet frames HRD클럽 work as scheduler registration plus a possible raw-item check, but the current repo has no `HrdClubCollector` implementation to register or inspect.
- Scheduler drift: blocker.
  - Current `backend/rag/collector/scheduler.py` defines `run_all_collectors()`, not `run_all_collectors(upsert=True|False)`.
  - It always creates a Supabase client and always upserts. The packet’s user flow, acceptance criteria, and dry-run examples depend on an `upsert` parameter that does not exist.
- Admin route reference: mismatch.
  - The packet cites `POST /admin/programs/sync`.
  - Current route in [admin.py](/abs/path/D:/02_2025_AI_Lab/isoser/backend/routers/admin.py:155) is `POST /sync/programs`.
- Schema drift: blocker.
  - Current migration [20260415_create_programs.sql](/abs/path/D:/02_2025_AI_Lab/isoser/supabase/migrations/20260415_create_programs.sql:1) restricts `source_type` to `national_api`, `seoul_city`, `quasi_public`, `local_gu`.
  - The packet requires SBA rows to normalize to `source_type='regional_crawl'`, which would violate the current DB check constraint.
- Missing reference: blocker.
  - The packet says environment keys follow `.env.example`, but `.env.example` is not present at repo root.
- Acceptance clarity: partially weak.
  - “SbaCollector가 SBA 메인 페이지에서 1건 이상 사업공고를 추출한다” depends on a live external site and may fail for transient reasons unrelated to code quality.
  - “HRD클럽 또는 SBA 수집 실패가 전체 scheduler 실행을 중단시키지 않는다” is reasonable, but the packet should state how that is verified given the current scheduler has no dry-run mode.
- Reference hygiene: partial.
  - The cited reference document `cowork/reviews/isoser-crawling-plan-reviewed.md` exists.
  - Its content is useful context, but some of its proposed `source_type` values already conflict with the current migration, so it should not be treated as authoritative without reconciliation.

## Recommendation

Do not promote yet.

The packet becomes promotable after these exact changes:

- Update the HRD클럽 scope to match the repo: either add `backend/rag/collector/hrdclub_collector.py` as an explicit missing dependency in this packet, or remove HRD클럽 registration from this packet until that collector exists.
- Reconcile the scheduler contract with the repo. Either change the packet to the current `run_all_collectors()` API, or explicitly include adding an `upsert`/dry-run mode as part of the task.
- Fix the admin endpoint reference from `POST /admin/programs/sync` to the actual route, or state that the route must also be changed in scope.
- Resolve the `source_type` mismatch before promotion. Either use one of the currently allowed DB values, or explicitly add a migration/update for the `programs_source_type_check` constraint.
- Replace the `.env.example` reference with an existing local reference, or remove it if no new env is required.
- Tighten acceptance for live SBA verification so transient site/network failures do not make the task impossible to judge.

After those changes, the packet should be promotable, but in its current form it is not ready.

## Review Run Metadata

- generated_at: `2026-04-15T14:08:12`
- watcher_exit_code: `0`
- codex_tokens_used: `61,387`
