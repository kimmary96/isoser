# TASK-2026-04-16-1130-relevance-score-accuracy result

## Changed files
- `backend/rag/programs_rag.py`
- `backend/routers/programs.py`
- `frontend/lib/types/index.ts`
- `frontend/app/api/dashboard/recommended-programs/route.ts`
- `frontend/app/dashboard/page.tsx`
- `frontend/lib/api/app.ts`
- `frontend/app/api/programs/compare-relevance/route.ts`
- `frontend/app/(landing)/compare/programs-compare-client.tsx`
- `supabase/migrations/20260416113000_add_relevance_score_to_recommendations.sql`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made
- 추천 카드의 "관련도"가 마감 임박도에 의해 부풀려지지 않도록 `relevance_score`를 별도 필드로 분리했다.
- 프로필 임베딩 쿼리에서 `name`, `portfolio_url`을 제거하고 `self_intro`, `bio`, `skills`, 활동 데이터를 재가중해 실제 직무 적합도 중심으로 검색 품질을 높였다.
- 비교 페이지의 "나와의 관련도"를 준비 중 상태에서 실제 계산 결과로 바꾸기 위해 로그인 사용자 기준 `/programs/compare-relevance` 경로와 프론트 표시를 추가했다.
- 기존 추천 캐시를 유지하면서 신규 추천부터 `relevance_score`를 저장할 수 있도록 `recommendations` 테이블 마이그레이션을 추가했다.

## Preserved behaviors
- 추천 정렬용 `final_score`와 기존 캐시 TTL 24시간은 유지했다.
- 추천 이유 생성, 추천 개수, 기존 `/programs/recommend` 응답 구조의 핵심 필드(`score`, `reason`, `fit_keywords`, `program`)는 유지했다.
- 비로그인 사용자는 기존처럼 공개 프로그램 비교 페이지를 볼 수 있고, 관련도 영역만 로그인 안내 상태로 남긴다.

## Risks / possible regressions
- `backend/routers/programs.py`에는 이 태스크 이전의 다른 수정도 함께 존재하므로, 후속 커밋 시 범위를 다시 점검해야 한다.
- 비교 페이지 관련도는 현재 키워드/스킬 교집합 기반 계산이라 프로필 데이터가 빈 사용자에게는 낮거나 보수적인 점수가 반환될 수 있다.
- 기존 캐시 행은 `relevance_score`가 없어서 UI에서 `final_score` fallback을 사용한다. 캐시 만료 전까지는 완전히 순수한 관련도 수치가 아닐 수 있다.

## Follow-up refactoring candidates
- `backend/rag/programs_rag.py`의 추천/비교 공통 매칭 로직을 별도 scorer 유틸로 분리하면 가중치 조정과 테스트 추가가 쉬워진다.
- 비교 페이지의 승자 배지와 허들 자동 판단 로직을 완전히 분리해, 관련도와 지원 허들 판단을 독립 섹션으로 정리할 수 있다.
- 추천 캐시 조회 정렬을 `relevance_score desc, urgency_score desc`로 전환할지 운영 데이터 기준으로 재검토할 수 있다.

## Verification
- `python` AST 파싱으로 `backend/rag/programs_rag.py`, `backend/routers/programs.py` 문법을 확인했다.
- `npx tsc --noEmit`는 `frontend/.next/types/app/programs/[id]/page.ts`가 실제로 없는 `app/programs/[id]/page.js`를 참조하는 기존 stale 타입 산출물 때문에 실패했다.
- `python -m mypy routers/programs.py --ignore-missing-imports`는 현재 환경에 `mypy`가 설치되어 있지 않아 실행하지 못했다.

## Run Metadata

- generated_at: `2026-04-16T13:47:03`
- watcher_exit_code: `0`
- codex_tokens_used: `163,020`

## Git Automation

- status: `merged-main`
- branch: `develop`
- commit: `9c25b1edf6392821c77aac60968a5bef6cb46ad5`
- note: [codex] TASK-2026-04-16-1130-relevance-score-accuracy 구현 완료. Auto-promoted to origin/main.

## Run Metadata

- generated_at: `2026-04-16T13:48:29`
- watcher_exit_code: `0`
- codex_tokens_used: `66,457`
