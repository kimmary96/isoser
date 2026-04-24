# TASK-2026-04-23-1857-aws-pipeline-validation-adoption Blocked

## Summary

AWS Boottent course-registration automation article에서 차용 가능한 품질 검증 패턴을 isoser 수집 파이프라인에 단계적으로 적용하려는 요청은 구현 작업에 해당한다.

저장소 규칙상 구현 전 task packet frontmatter가 필요하지만, 이번 요청에는 실행 가능한 packet이 제공되지 않았다. 또한 현재 관련 영역에 기존 미커밋 변경이 있어 이 상태에서 새 구현을 바로 겹치면 변경 소유권과 검증 기준이 흐려질 수 있다.

## Blocker

- Required task packet frontmatter is missing:
  - `id`
  - `status`
  - `type`
  - `title`
  - `planned_at`
  - `planned_against_commit`
- Current HEAD at inspection time:
  - `b74549f268c5f2527653fd444338225455539927`
- Existing uncommitted changes are present in relevant or adjacent areas:
  - `backend/rag/collector/work24_detail_parser.py`
  - `backend/routers/programs.py`
  - `backend/tests/test_program_backfill.py`
  - `backend/tests/test_programs_router.py`
  - `frontend/lib/types/index.ts`
  - `scripts/program_backfill.py`
  - `scripts/refresh_program_list_index.py`
  - `supabase/migrations/20260423203000_conservative_program_participation_display.sql`
  - `reports\ops\work24\programs-work24-participation-backfill-current-dry-run.json`
  - `reports\ops\work24\programs-work24-participation-backfill-dry-run.json`
  - `reports\ops\work24\work24_partition_sync_with_chroma_20260423.json`

## Recommended First Packet Scope

Create a narrow `fix/update` or `improvement` packet for the first borrowable item only:

- Add report-only collector validation helpers for normalized program rows.
- Start with deterministic checks, not LLM/OCR:
  - missing required identity fields
  - deadline/start/end consistency risk
  - source_unique_key presence
  - provider/location/cost/source_url presence
  - compare_meta source evidence for high-risk fields
- Add unit tests around Work24/K-Startup fixture rows.
- Do not block ingestion yet; emit diagnostics only.

## Test Points To Confirm Before Implementation

- `backend/tests/test_work24_kstartup_field_mapping.py`
- `backend/tests/test_program_backfill.py`
- Any new tests for the report-only validator
- Dry-run scheduler path with `run_all_collectors(upsert=False)` if environment allows

## Why This Is The Safest First Step

- It reuses existing deterministic mapping and normalizer code.
- It does not change public `/programs` behavior.
- It creates measurable quality signals before adding Playwright, OCR, or LLM validation.
- It limits risk while the Work24 participation/backfill worktree changes are still open.

## Resume Conditions

Implementation can resume when one of these is true:

1. A task packet with required frontmatter is created and approved for this work.
2. The user explicitly asks to create a packet first instead of implementing directly.
3. The current related worktree changes are committed, archived, or explicitly accepted as the new baseline in the packet.

