## Overall assessment

Not ready for promotion.

Frontmatter is complete, the packet points at the correct collector area, and `planned_against_commit` matches current `HEAD` (`750fba4f766f86739e94368afa8474e2edbdc6b4`), so commit-level drift is low. The blockers are packet-to-repository mismatches in schema assumptions, dedupe rules, source/category semantics, and missing reference material.

## Findings

- Frontmatter completeness: pass. All required fields from `AGENTS.md` are present.
- Repository path accuracy: pass. `backend/rag/collector/base_collector.py`, `normalizer.py`, and `scheduler.py` exist, and the packet targets the right subsystem.
- Drift risk: low at commit level, medium in assumptions. The packet was planned against the current commit, but several execution assumptions do not match the current collector stack and `programs` schema.
- Scheduler behavior: partial pass. Current `scheduler.py` already sorts by `(tier, source_name)` and continues after collector exceptions, so Tier 1 before Tier 2 and per-collector failure isolation are compatible with current behavior.
- Acceptance mismatch: blocker. The packet says `0건 수집 시 성공으로 처리하지 않는다`, but current `scheduler.py` treats an empty collector result as `saved=0, failed=0` and keeps going. That failure rule is not currently encoded.
- Source identity mismatch: blocker. The packet defines `source` as a stable identifier like `sesac` or `sba_posting`, but current `normalizer.py` persists `meta["source_name"]`, and existing collectors use human-readable source names such as `HRD넷` and `고용24`.
- `source_type` mismatch: blocker. The packet requires `source_type='regional_crawl'`, but `supabase/migrations/20260415_create_programs.sql` only allows `national_api`, `seoul_city`, `quasi_public`, and `local_gu`.
- Category mismatch: blocker. The packet’s category rules rely on values such as `취업`, `교육`, and `네트워킹`, but the active `programs` check constraint only allows `AI`, `IT`, `디자인`, `경영`, `창업`, `기타`. Current `normalizer.py` would write `category_hint` directly into `category`, which would violate the constraint for most Tier 2 categories in this packet.
- Payload field mismatch: blocker. The packet requires `raw` and says `start_date` and `end_date` should be included when possible. Current `normalizer.py` does not persist `raw`, `start_date`, or `end_date`. The current schema has `raw_data` from `supabase/migrations/20260415170000_add_programs_hub_fields.sql`, not `raw`.
- Dedupe mismatch: blocker. The packet specifies `source + title + deadline`, then `source + link`, then `source + title`, but current scheduler upsert is fixed to `on_conflict=title,source`, matching the current unique constraint on `(title, source)`.
- Implementation pattern ambiguity: medium risk. The packet mandates `urllib + BeautifulSoup`, while the existing collector stack is `requests`-based. That is workable, but it is a deliberate divergence from current local patterns and should be justified explicitly if intended.
- Missing references: blocker. The packet cites `isoser-tier2-seoul-crawling-validated.md` and `isoser-tier2-seoul-crawling-detailed.md`, but those files are not present in the repository, including under `cowork/`.
- Acceptance clarity: blocker. “각각 1건 이상의 데이터를 Supabase programs 테이블에 적재한다” makes live external site availability part of success, but the packet provides no local fixture, captured HTML, or fallback verification path for a network-dependent feature.
- Open questions remain on core prerequisites. The packet still leaves schema compatibility, normalizer field support, and scheduler expectations unresolved. Those are execution prerequisites, not minor follow-ups.

## Recommendation

Do not promote yet.

The packet must change in these exact ways before promotion:

- Reconcile `source` semantics with the current collector contract. Either define `source` as the persisted display name, or explicitly scope a collector/meta/normalizer change to support stable source IDs.
- Reconcile packet-required `source_type`, category values, and payload fields with the active `programs` schema. Either change the packet to current allowed values and current column names, or explicitly add the required schema work to scope.
- Reconcile dedupe rules with the actual upsert key. Either align acceptance to `(title, source)`, or explicitly scope the DB and scheduler changes needed for deadline/link-aware dedupe.
- Decide whether `0건 수집` is only a review expectation or a required code change. If required, say so explicitly in scope and acceptance.
- Add the missing referenced validation documents to repository-local paths, or replace them with existing repository-local evidence.
- Tighten the acceptance section so success is not defined only by live external availability. Add a repo-local verification method, captured sample HTML, or a narrower readiness gate.
- Resolve the current open questions inside the packet instead of leaving them open.

After those packet changes, this does not look far from executable, but it is not promotable as-is.

## Review Run Metadata

- generated_at: `2026-04-15T16:09:10`
- watcher_exit_code: `0`
- codex_tokens_used: `67,779`
