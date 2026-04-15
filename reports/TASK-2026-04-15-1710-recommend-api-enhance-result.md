# TASK-2026-04-15-1710-recommend-api-enhance result

- changed files
  - `backend/routers/programs.py`
  - `backend/rag/programs_rag.py`
  - `backend/rag/chroma_client.py`
- why changes were made
  - `POST /programs/recommend` 요청에 `category`, `region`, `job_title`, `force_refresh`를 추가하고, 기본 추천 결과를 `recommendations` 테이블에 24시간 캐시하도록 보강했다.
  - 추천용 프로그램 조회를 카테고리/지역 기준으로 제한하고, 캐시 히트 시 프로그램 상세를 다시 병합해 기존 응답 shape를 유지했다.
  - Chroma 검색에 metadata `where` 필터를 전달하고, 필터 조건이 실패하거나 결과가 없을 때 전체 검색으로 폴백하도록 조정했다.
- preserved behaviors
  - 인증이 없는 호출은 여전히 RAG 없이 프로그램 목록 기반 응답을 반환한다.
  - 카테고리/지역/직무명 필터가 없는 기본 추천의 점수 계산식은 기존 `semantic × 0.8 + urgency × 0.2`를 유지한다.
  - 추천 캐시 저장/삭제 실패는 경고 로그만 남기고 추천 응답 자체는 계속 반환한다.
- risks / possible regressions
  - `recommendations` 테이블 스키마가 예상 컬럼과 다르면 캐시 hit/save 경로가 로그 후 비활성화될 수 있다.
  - `category`/`region` 필터는 Supabase `ilike`와 Chroma metadata substring 매칭에 의존하므로 데이터 정규화가 불충분하면 기대보다 넓거나 좁게 매칭될 수 있다.
  - 캐시 hit 응답은 저장된 점수만 복원하므로 최초 생성 당시의 추천 이유/키워드는 재생성하지 않는다.
- follow-up refactoring candidates
  - 추천 캐시 load/save/delete 로직을 전용 모듈로 분리해 router 책임을 줄일 수 있다.
  - 추천 API 전용 backend 테스트를 추가해 cache hit, force refresh, filtered fallback 시나리오를 고정할 필요가 있다.
- relevant checks
  - `python -c "import ast, pathlib; files=['backend/routers/programs.py','backend/rag/programs_rag.py','backend/rag/chroma_client.py']; [ast.parse(pathlib.Path(f).read_text(encoding='utf-8'), filename=f) for f in files]; print('AST_OK')"`
  - `python -m compileall ...` 는 기존 `__pycache__` 파일 권한 문제(`WinError 5`)로 완료되지 않아 대체로 AST parse 검사를 사용했다.

## Run Metadata

- generated_at: `2026-04-15T20:14:36`
- watcher_exit_code: `0`
- codex_tokens_used: `219,035`

## Git Automation

- status: `watcher-sync-failed`
- note: CalledProcessError: Command '['git', 'add', '-A', '--', 'tasks/running/TASK-2026-04-15-1710-recommend-api-enhance.md', 'tasks/done/TASK-2026-04-15-1710-recommend-api-enhance.md', 'reports/TASK-2026-04-15-1710-recommend-api-enhance-result.md']' returned non-zero exit status 128.
