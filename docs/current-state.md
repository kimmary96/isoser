# Current State

현재 운영 구조의 짧은 요약입니다. 세부 운영 문서는 `docs/automation/` 아래로 분리했습니다.

에이전트가 이 저장소에 처음 들어오면 먼저 [agent-playbook.md](./agent-playbook.md)와 `AGENTS.md`를 읽고, 그 다음 이 문서를 현재 동작 기준으로 사용합니다.

## Summary
- 로컬 구현 자동화는 `watcher.py`가 담당한다.
- cowork scratch review와 promotion은 `cowork_watcher.py`가 담당한다.
- `cowork/packets`는 execution queue가 아니라 review 대상 원본 packet 저장소다.
- `cowork/reviews`는 packet review 산출물 저장소다.
- `tasks/inbox`에는 review 문서가 아니라 승인된 최신 packet 사본이 들어간다.
- watcher 공통 파일 처리, lock, frontmatter 파싱, CLI 해석은 `scripts/watcher_shared.py`로 분리되어 있다.
- local terminal outcome은 `dispatch/alerts/`에 기록된다.
- 성공 task는 watcher가 task-scoped git automation을 시도한다.
- watcher는 `TASK-YYYY-MM-DD-####-...` 번호를 파싱해 inbox / blocked / drifted 큐를 낮은 번호부터 순차 처리한다.
- `tasks/done`으로 완료된 task는 watcher가 task-scoped commit/push를 수행하고, fast-forward 가능하면 같은 commit을 `origin/main`에도 자동 반영한다.
- `origin/main` 자동 반영까지 성공한 완료 task는 watcher completed Slack 알림 요약에 main push 결과가 함께 기록된다.
- watcher는 `tasks/drifted/`와 `tasks/blocked/`를 다시 검사해 자동 복구 가능한 packet은 `tasks/inbox/`로 재투입한다.
- watcher는 Codex 실행 중 `tasks/running/<task>.md` heartbeat를 주기적으로 갱신해, stdout이 잠잠한 장기 실행에서도 stale timeout으로 오판되는 일을 줄인다.
- local `watcher.py`의 execution path는 supervisor 단계로 한 번 더 나뉘어, inspector handoff(`reports/<task-id>-supervisor-inspection.md`) 이후 implementer가 코드 수정과 result report를 만들고 verifier가 최종 검증(`reports/<task-id>-supervisor-verification.md`)을 수행한다. verifier가 `review-required` verdict를 내리면 일반 blocked 알림 대신 `tasks/review-required/`와 `needs-review` 공식 경로로 분기한다.
- task packet은 선택적으로 `planned_files`와 `planned_worktree_fingerprint`를 담아, 같은 `HEAD` 안에서도 계획 당시 worktree 상태가 달라졌는지 더 엄격하게 검증할 수 있다.
- `scripts/compute_task_fingerprint.py`는 planner가 `planned_files` 기준 fingerprint frontmatter 줄을 바로 생성할 수 있게 돕는다.
- `scripts/summarize_run_ledgers.py`는 local/cowork watcher ledger를 읽어 최근 상태와 stage 집계를 빠르게 확인하게 해준다.
- `scripts/summarize_actionable_ledgers.py`는 `blocked`, `drift`, `needs-review`, `replan-required` 같은 즉시 대응이 필요한 상태만 따로 좁혀 보여준다.
- `scripts/prune_run_ledgers.py`는 active JSONL ledger에서 오래된 이벤트를 archive로 옮겨 장기 운영 시 파일이 과도하게 커지는 문제를 완화한다.
- `scripts/create_task_packet.py`는 current HEAD와 optional fingerprint field까지 채운 packet 초안을 바로 생성해 planner 쪽 기본값을 강화한다.
- `watcher.py`와 `cowork_watcher.py`의 `PROJECT_PATH`는 더 이상 특정 Windows 절대경로에 하드코딩되지 않고, 기본값으로 각 스크립트 파일 위치의 저장소 루트를 기준으로 계산된다. 필요하면 `ISOSER_PROJECT_PATH` 환경변수로 override할 수 있다.
- local `watcher.py`는 알려진 반복 알림에 대해 fingerprint별 self-healing runbook을 먼저 적용한다. 현재는 `origin/main` 자동 반영 스킵을 비차단 `self-healed`로 다운그레이드하고, 이미 `tasks/done/`에 완료본이 있는 중복 packet 런타임 오류를 자동 archive로 정리한다.
- runbook으로 처리되지 않는 `blocked` / `runtime-error` / `push-failed` 알림은 summary+next_action 기반 fingerprint를 남기고, 같은 root cause가 3회 이상 반복되면 `tasks/inbox/`에 자동 remediation packet을 생성해 루트 원인 수정 작업을 다시 supervisor 플로우로 투입한다.
- watcher와 cowork watcher는 개별 packet 처리 중 예외가 나도 전체 프로세스를 종료하지 않고 `runtime-error` 기록을 남긴 뒤 다음 루프를 계속 돈다.
- `scripts/watcher_shared.py`의 lock PID 확인은 Windows에서 `os.kill(pid, 0)` 대신 `tasklist` 기반으로 동작해, stale `.watcher.lock` / `.cowork_watcher.lock` 때문에 supervisor가 재시작 루프에 빠지는 문제를 줄였다.
- `cowork_watcher.py`는 Codex review subprocess가 예외로 끝나거나 review 파일을 만들지 못해도 전체 워처를 죽이지 않고 해당 packet만 `review-failed` dispatch로 격리한다.
- 자동 복구가 막힌 task는 `cowork/packets/`으로 에스컬레이션되어 Slack approval/feedback 흐름으로 넘겨진다.
- 같은 task가 drift/blocked 복구에서 반복 중단되면 watcher는 일반 `needs-review` 대신 `replan-required` 알림으로 승격하고, Slack에 재설계 필요 사유와 다음 조치를 함께 공유한다.
- remote fallback은 `tasks/remote/` + GitHub Action 경로를 사용한다.
- cowork review-ready는 Slack 버튼과 slash command 양쪽으로 approval을 받을 수 있다.
- Slack 버튼 승인/거절의 최종 결과 메시지는 채널 공용(`in_channel`)으로 반환되고, 초기 처리중 ack만 클릭 사용자에게 보인다.
- cowork packet이 같은 `task_id`로 다시 review-ready가 되면 예전 approval marker와 promoted dispatch를 정리한 뒤 재승인 흐름을 연다.
- cowork Slack review-ready 알림은 같은 `task_id` 재발행 시 이전 알림을 대체한다는 표식을 포함하고, review snapshot 문구는 한국어 중심의 번호형 `판정`/`핵심 확인사항` 포맷으로 정규화한다.
- Slack에서 cowork 승인/거절 버튼을 누르면 기존 review-ready 메시지를 새 top-level 메시지로 늘리지 않고 갱신하며, 이후 `승격 완료`/`승격 보류` 후속 알림은 같은 작업 스레드로 이어진다.
- local `watcher.py`도 task별 Slack approval marker에 저장된 `slack_message_ts`를 재사용해, 같은 task의 `completed`/`drift`/`blocked`/`push-failed`/`runtime-error` 알림을 가능한 한 기존 Slack 스레드에 이어서 기록한다.
- `tasks/inbox`에 이미 `running`/`blocked`/`drifted`/`done` 상태가 존재하는 같은 파일명이 다시 들어오면 watcher는 재실행 대신 `tasks/archive/`로 보관하고 중복 inbox packet을 건너뛴다.
- 실행 중이던 packet이 완료 단계에서 이미 같은 이름의 `tasks/done` 파일과 충돌하면 watcher는 런타임 예외로 죽지 않고 중복 packet만 `tasks/archive/`로 치워 후속 Git/Slack 처리만 계속한다.
- `cowork_watcher.py`는 이미 `tasks/inbox/` 또는 `tasks/remote/`에 존재하는 packet을 다시 승인받아도 `FileExistsError`로 죽지 않고, 기존 승격본을 재사용한 것으로 기록만 남긴다.
- `cowork_watcher.py`의 승격 stamp는 packet 전체의 `TODO_CURRENT_HEAD` 문자열을 일괄 치환하지 않고, frontmatter `planned_against_commit` 줄만 현재 `HEAD`로 교체한다.
- review-ready Slack 메시지는 패킷/리뷰 경로와 승인 방법 안내를 숨기고, `판정`과 번호형 `핵심 확인사항` 중심으로 압축해서 보여준다.
- Slack approval은 로컬 파일 marker 대신 Supabase `cowork_approvals` 공유 큐에 기록되고, 로컬 `cowork_watcher.py`가 이를 poll해서 `tasks/inbox|remote` 승격과 consumed 처리를 수행한다.
- shared approval queue row는 가능하면 `id` 기준으로 claim 후 consumed/failed/ignored 상태를 갱신해 중복 poll 상황에서도 같은 승인 요청을 다시 소비하지 않도록 보강됐다.
- `watcher.py`와 `cowork_watcher.py`는 각각 JSONL run ledger를 남겨 주요 상태 전이를 파일 기반 alert/dispatch 외에도 추적할 수 있다.
- `scripts/supervise_watcher.ps1`와 `scripts/start_watchers.ps1`는 local watcher와 cowork watcher를 별도 supervisor 프로세스로 감싸 실행하며, 프로세스 종료 시 combined log를 남기고 자동 재시작한다.
- supervisor는 이미 live lock PID가 있는 동안 run script를 다시 launch하지 않고, 해당 PID가 사라질 때까지 상태만 재확인한다.
- watcher supervisor 로그는 `dispatch/logs/watcher-supervisor.log`, cowork watcher supervisor 로그는 `cowork/dispatch/logs/cowork-watcher-supervisor.log`에 쌓인다.
- supervisor combined log는 PowerShell UTF-8 출력 설정과 `Out-File -Encoding utf8` 경로를 사용해 한글 로그가 깨지지 않도록 맞춘다.
- `.vscode/tasks.json`은 워크스페이스 폴더가 열릴 때 `scripts/start_watchers.ps1`를 자동 실행해, 이미 살아 있는 watcher는 재사용하고 죽어 있으면 supervisor를 다시 띄운다.
- `scripts/install_start_watchers_task.ps1`는 Windows 작업 스케줄러에 `Isoser Start Watchers` on-logon task를 등록해, VS Code를 열지 않아도 로그인 시 watcher supervisor가 자동으로 시작되게 한다.
- `scripts/show_start_watchers_task.ps1`, `scripts/remove_start_watchers_task.ps1`로 등록 상태 조회와 제거를 같은 규칙으로 처리한다.
- Slack alert/dispatch는 영어 운영 문구를 그대로 노출하지 않고, 주요 `summary`, `next_action`, `note`, `freshness` 문장을 한국어 중심으로 정규화해 보낸다.
- `frontend/app/slack/interactivity/cowork-review/route.ts`는 Vercel 프론트 도메인으로 들어온 Slack 버튼 요청을 FastAPI backend의 `/slack/interactivity/cowork-review`로 프록시한다.
- `frontend/app/(landing)/programs/page.tsx`는 URL query 기반 검색, 카테고리/지역 필터, 모집중 토글, 정렬, 페이지네이션을 지원한다.
- `frontend/app/(landing)/programs/page.tsx`는 기본값으로 `오늘 기준 모집중` 프로그램만 마감 임박순으로 노출하고, `마감된 활동 보기`를 켰을 때만 최근 3개월 내 마감 프로그램까지 함께 보여준다.
- `frontend/app/(landing)/compare/page.tsx`는 공개 비교 페이지로 동작하며 `?ids=` URL state, 최대 3개 슬롯, 추천 프로그램 추가/제거를 지원한다.
- `frontend/app/page.tsx`는 루트 접근을 `/landing-a`로 리다이렉트해서 landing-a를 메인 랜딩 허브로 고정한다.
- `frontend/middleware.ts`는 루트 `/?code=...` OAuth 유입을 `/auth/callback?next=/landing-a`로 정규화해서 로그인 후 landing-a 주소를 깨끗하게 유지한다.
- `frontend/middleware.ts`는 레거시 `/programs/compare` 접근을 `/compare`로 리다이렉트해서 새 랜딩 축 라우트 구조로 정리한다.
- `frontend/app/auth/callback/route.ts`는 기존 사용자 로그인 완료 후 기본 진입점을 `/landing-a`로 돌리고, 신규 사용자는 계속 `/onboarding`으로 보낸다.
- `frontend/app/(landing)/landing-a/_components.tsx`의 상단 헤더는 `Programs`, `Compare`, `내 프로필` 링크와 로그인 사용자 표시를 공통 네비게이션으로 사용한다.
- `frontend/app/(landing)` 아래에는 `landing-a`, `landing-b`, `programs`, `compare`가 함께 정리되어 랜딩 축 라우트를 한 그룹으로 관리한다.
- `frontend/app/dashboard/layout.tsx`는 landing-a 헤더를 유지한 채 대시보드 사이드바와 본문을 렌더링한다.
- `backend/routers/programs.py`는 `/programs/count`와 확장된 목록 query(`q`, `regions`, `recruiting_only`, `include_closed_recent`, `sort`)를 지원하고, 목록/카운트 모두 Supabase의 `is_active` 값만 신뢰하지 않고 실제 `deadline` 기준으로 오늘 이후 모집중 공고만 기본 노출한다.
- `backend/routers/programs.py`의 `include_closed_recent=true` 경로는 최근 90일 이내 마감 공고만 추가로 포함하며, `deadline` 정렬에서는 모집중 공고를 먼저 오름차순으로, 최근 마감 공고를 그다음 최근순으로 재정렬한다.
- `backend/routers/admin.py`의 `POST /admin/sync/programs`는 운영 Supabase `programs` 스키마가 일부 뒤처진 경우에도 누락 컬럼을 제외하고, hybrid unique constraint 충돌 시 row-by-row fallback으로 upsert를 이어가도록 보강됐다.
- `backend/rag/chroma_client.py`는 Gemini embedding quota 초과(429) 시 재시도 후 local deterministic embedding fallback으로 전환해, Chroma sync/search가 완전히 멈추지 않도록 보강됐다.
- `programs.compare_meta` JSONB 컬럼이 migration으로 추가되어 비교 화면의 대상/허들/커리큘럼 메타데이터를 저장할 수 있다.
- `backend/rag/collector/scheduler.py`는 source별 `status`/`message`를 함께 반환해 `0건 수집(empty)`과 `설정/요청/저장 실패`를 구분해 기록한다.
- Tier 1 collector 중 `고용24`는 현재 유효한 국민내일배움카드 훈련과정 OpenAPI(`callOpenApiSvcInfo310L01.do`)를 사용하고, `K-Startup`은 현재 운영 중인 `nidapi.k-startup.go.kr` 조회서비스로 수집한다.
- scheduler의 Supabase upsert는 `(title, source)` 기준으로 source별 중복을 먼저 제거하고 100건 배치로 나눠 저장해, 대량 payload에서 PostgREST conflict 오류가 전체 source를 실패시키는 문제를 줄였다.
- `HRDCollector`는 optional source로 전환되어 기본값 `ENABLE_HRD_COLLECTOR=false` 상태에서는 scheduler가 `skipped_disabled`로 기록하고 실행하지 않는다.
- `ENABLE_HRD_COLLECTOR=true`여도 `HRD_API_KEY` 또는 `HRDNET_API_KEY`가 없으면 scheduler는 실패 대신 `skipped_missing_config`로 기록한다.
- 현재 full scheduler smoke 기준 `고용24`와 `K-Startup`은 서울 대상 데이터가 정상 저장되고, HRD는 기본 비활성 상태다.
- Tier 2 HTML collector는 `SeSAC` 제목에서 상태 chip/D-day/모집 메타를 제거하고, `서울시 50플러스`는 `일자리 참여 신청` 같은 메뉴성 항목을 제외하도록 정제 규칙을 강화했다.
- `backend/rag/collector/tier4_collectors.py`는 서울 자치구 Tier 4 수집기 6종(도봉창업센터, 구로 청년이룸, 서울청년센터 성동, 노원 청년내일, 도봉구청 일자리경제과, 마포구고용복지지원센터)을 모아 두고, `scheduler.py`는 이를 Tier 4로 등록해 `run_all_collectors(upsert=False)` dry-run 경로에서도 함께 실행한다.
- `backend/tests/test_tier4_collectors.py`와 `backend/tests/test_scheduler_collectors.py`는 Tier 4 collector별 파서 계약과 scheduler dry-run 포함 여부를 fixture 기반으로 고정한다. 노원 수집기는 애매한 제목을 기본값 `취업`으로 몰지 않고 `기타`로 남겨 오분류를 줄인다.

## End-to-end packet flow
1. planner가 `cowork/packets/<task-id>.md`에 task packet 원본을 만든다.
2. `cowork_watcher.py`가 현재 저장소와 packet frontmatter를 검사해 `cowork/reviews/<task-id>-review.md`를 만든다.
3. reviewer는 review 문서를 보고 `cowork/packets/<task-id>.md` 원본을 수정하거나 보강한다.
4. packet이 바뀌면 cowork watcher는 최신 packet 기준으로 review를 다시 생성하거나 stale review를 막는다.
5. 승인되면 cowork watcher는 `cowork/packets/<task-id>.md` 최신본을 `tasks/inbox/` 또는 `tasks/remote/`로 복사한다.
6. local path라면 `watcher.py`가 `tasks/inbox/`에서 packet을 집어 `tasks/running/`으로 옮기고 Codex를 실행한다.
7. local watcher supervisor는 inspector handoff를 먼저 만들고, 이어서 implementer가 구현과 result report를 만들며 verifier가 최종 검증 artifact를 남긴다.
8. watcher는 실행 결과에 따라 packet을 `tasks/done/`, `tasks/drifted/`, `tasks/blocked/`, `tasks/review-required/`로 이동한다.
9. `tasks/drifted/`와 `tasks/blocked/`는 자동 복구가 가능하면 `tasks/inbox/`로 재큐잉되고, 아니면 다시 `cowork/packets/` review 흐름으로 에스컬레이션된다. `tasks/review-required/`는 verifier가 수동 검토를 요청한 전용 큐다.

## Folder semantics
- `cowork/packets/`: 사람이 계속 수정하는 원본 packet
- `cowork/reviews/`: 원본 packet에 대한 review 이력
- `tasks/inbox/`: 승인된 최신 packet 사본의 실행 대기열
- `tasks/running/`: 현재 실행 중인 packet
- `tasks/done/`: 성공적으로 끝난 execution packet
- `tasks/blocked/`: 메타데이터 누락, 실패, 외부 의존성 등으로 멈춘 execution packet
- `tasks/drifted/`: 계획 기준과 현재 코드가 어긋나 재검토가 필요한 execution packet
- `tasks/review-required/`: verifier가 사람 검토 후 재승인을 요구한 execution packet

## Key references
- automation index: [automation/README.md](./automation/README.md)
- automation overview: [automation/overview.md](./automation/overview.md)
- local flow: [automation/local-flow.md](./automation/local-flow.md)
- watcher LangGraph review: [automation/watcher-langgraph.md](./automation/watcher-langgraph.md)
- task packet contract: [automation/task-packets.md](./automation/task-packets.md)
- dispatch split: [automation/dispatch-channels.md](./automation/dispatch-channels.md)
- operations: [automation/operations.md](./automation/operations.md)
- Slack approval setup: [automation/slack-approval-setup.md](./automation/slack-approval-setup.md)

## Project structure highlights
- `frontend/`: Next.js application
- `backend/`: FastAPI application
- `tasks/`: local task queue state
- `dispatch/alerts/`: local watcher terminal alerts
- `reports/`: implementation, drift, blocked reports
- `docs/`: reference docs and operational docs
- `scripts/`: watcher 실행 스크립트와 watcher 공통 유틸
  - `docs/automation/`: watcher, dispatch, task packet, 운영 흐름
  - `docs/rules/`: 규칙 문서와 템플릿
  - `docs/specs/`: PRD, API 계약, 출력 스펙
  - `docs/data/`: CSV, SQL, http 샘플
  - `docs/research/`: 조사와 매핑 문서
  - `docs/worklogs/`: 날짜별 작업 기록

## Current behavior notes
- 추천 프로그램 API는 `relevance_score`와 `urgency_score`를 분리해서 반환하며, 카드 UI는 관련도 배지에 `relevance_score`를 사용하고 마감 7일 이내만 별도 마감 칩으로 표시한다.
- `backend/routers/programs.py`는 기존 `POST /programs/recommend`를 유지한 채 `GET /programs/recommend/calendar`를 추가해 `{ items: [...] }` 계약으로 캘린더 전용 추천을 제공하고, 이 경로에서만 만료 프로그램 제외 + `final_score desc`, `deadline asc` 정렬을 적용한다.
- recommendation cache read는 저장된 `final_score`를 그대로 신뢰하지 않고 `relevance_score * 0.6 + urgency_score * 0.4`로 재계산하며, component score가 하나라도 없으면 stale cache로 보고 fresh recommendation path로 우회한다.
- `frontend/app/api/dashboard/recommend-calendar/route.ts`와 `frontend/lib/api/app.ts`는 새 캘린더 추천 BFF/helper를 제공하며, 비로그인 사용자도 `relevance_score = 0`을 유지한 `{ items: CalendarRecommendItem[] }` 응답을 받을 수 있다.
- 비교 페이지는 로그인 사용자에 한해 `POST /programs/compare-relevance`로 종합 관련도, 기술 스택 일치도, 매칭 스킬 태그를 계산해 표시한다.
- compare relevance 응답은 기존 점수 필드 외에 `fit_label`, `fit_summary`, `readiness_label`, `gap_tags`를 함께 반환하고, compare UI는 이를 `★ AI 적합도` 섹션에서 적합도 판단, 지원 준비도, 한줄 요약, 보완 포인트로 해석해 보여준다.
