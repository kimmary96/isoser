# Current State

현재 운영 구조의 짧은 요약입니다. 세부 운영 문서는 `docs/automation/` 아래로 분리했습니다.

에이전트가 이 저장소에 처음 들어오면 먼저 [agent-playbook.md](./agent-playbook.md)와 `AGENTS.md`를 읽고, 그 다음 이 문서를 현재 동작 기준으로 사용합니다.

## Summary
- 로컬 구현 자동화는 `watcher.py`가 담당한다.
- 저장소 루트에는 `main.py` ASGI shim이 있어 `uvicorn main:app --reload --port 8000`를 루트에서도 직접 실행할 수 있다.
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
- 다만 `type: docs|doc|documentation` task는 저위험 fast-path를 써서 inspector + implementer까지만 Codex를 실행하고, 마지막 verification artifact는 watcher가 경량 리포트로 직접 기록한다.
- `tasks/review-required/`는 살아 있는 수동 검토 대기열로만 사용한다. 사람이 검토를 마쳐 재실행이 아니라 종결/보류/대체로 처리하기로 결정한 packet은 `tasks/archive/`로 이동하고 `reports/*` 판단 근거는 그대로 유지한다.
- task packet은 선택적으로 `planned_files`와 `planned_worktree_fingerprint`를 담아, 같은 `HEAD` 안에서도 계획 당시 worktree 상태가 달라졌는지 더 엄격하게 검증할 수 있다.
- task packet frontmatter에 `spec_version`이 있으면 watcher와 cowork watcher는 Supervisor 표준 spec으로 간주하고 `request_id`, `execution_path`, `allowed_paths`, `fallback_plan`, `rollback_plan`, `dedupe_key` 같은 추가 필드를 함께 검증한다. 이때 `allowed_paths`와 `blocked_paths`가 겹치면 실행 전에 차단한다.
- `scripts/compute_task_fingerprint.py`는 planner가 `planned_files` 기준 fingerprint frontmatter 줄을 바로 생성할 수 있게 돕는다.
- `scripts/summarize_run_ledgers.py`는 local/cowork watcher ledger를 읽어 최근 상태와 stage 집계를 빠르게 확인하게 해준다.
- `scripts/summarize_actionable_ledgers.py`는 `blocked`, `drift`, `needs-review`, `replan-required` 같은 즉시 대응이 필요한 상태만 따로 좁혀 보여준다.
- `scripts/prune_run_ledgers.py`는 active JSONL ledger에서 오래된 이벤트를 archive로 옮겨 장기 운영 시 파일이 과도하게 커지는 문제를 완화한다.
- `scripts/create_task_packet.py`는 current HEAD와 optional fingerprint field까지 채운 packet 초안을 바로 생성해 planner 쪽 기본값을 강화한다. `--supervisor-spec` 옵션을 주면 Supervisor 표준 frontmatter도 함께 채운다.
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
- `frontend/.eslintrc.json`이 추가되어 `frontend`의 `npm run lint`가 더 이상 초기 대화형 ESLint 설정 프롬프트에 막히지 않고 비대화형 검증으로 동작한다.
- `frontend/tsconfig.codex-check.json`은 `.next/types`를 직접 포함하지 않아 stale Next.js 생성 파일 때문에 standalone 타입체크가 거짓 실패하지 않는다.
- `frontend/lib/server/upload-validation.ts`는 활동 이미지/프로필 이미지 업로드 전에 허용 형식(JPG/PNG/WEBP/GIF), 파일 크기 제한, storage path segment 정규화를 공통으로 적용한다.
- `frontend/lib/server/upload-validation.ts`는 확장자/MIME뿐 아니라 파일 헤더(signature, magic number)도 함께 검사해 이름만 바꾼 위장 파일 업로드를 1차로 차단한다.
- `frontend/lib/server/upload-validation.ts`는 PNG/GIF/WEBP/JPEG의 실제 크기 정보(width/height)도 읽어 정상 이미지 여부를 한 번 더 확인하고, 8000px 초과 비정상 고해상도 이미지는 업로드를 거부한다.
- `frontend/lib/server/rate-limit.ts`는 프론트 BFF route에서 사용하는 요청 제한 유틸을 제공한다. `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`이 있으면 Upstash Redis REST 기반 전역 제한을 사용하고, 없거나 실패하면 기존 프로세스 로컬 메모리 제한으로 자동 fallback한다.
- `frontend/lib/server/rate-limit.ts`의 내부 저장 key는 원본 식별자(user id, access token, ip)를 그대로 쓰지 않고 SHA-256 해시 형태로 저장해 Redis key나 메모리 key에 민감값이 직접 남지 않도록 한다.
- `frontend/app/api/auth/google/route.ts`는 OAuth 시작 요청에 분당 8회 기준의 최소 요청 제한을 적용해 짧은 시간에 로그인 시작 요청이 과도하게 반복되는 경우 429를 반환한다.
- `frontend/app/api/dashboard/activities/images/route.ts`는 인증 사용자 기준 분당 12회 업로드 요청 제한을 적용해 이미지 업로드 남용을 1차로 완화한다.
- `frontend/app/api/dashboard/profile/route.ts`의 `PATCH`/`PUT`는 인증 사용자 기준 분당 20회 프로필 수정 제한을 적용해 반복 저장 남용을 줄인다.
- `frontend/app/api/summary/route.ts`는 호출자 IP 기준 분당 10회 요청 제한과 20초 timeout을 함께 적용해 AI summary 상류 호출의 남용과 장시간 대기를 동시에 완화한다.
- `frontend/app/api/dashboard/match/route.ts`의 `POST`는 인증 사용자 기준 분당 6회 제한과 30초 timeout을 적용해 고비용 합격률 분석 요청의 남용과 장시간 대기를 완화한다.
- `frontend/app/api/dashboard/cover-letters/coach/route.ts`의 `POST`는 인증 사용자 기준 분당 8회 제한과 30초 timeout을 적용해 AI 코칭 요청의 남용과 무한 대기 가능성을 줄인다.
- `frontend/app/api/programs/compare-relevance/route.ts`의 `POST`는 로그인 세션 기준 분당 12회 제한과 20초 timeout을 적용해 비교 관련도 계산 요청의 남용과 지연을 완화한다.
- `frontend/lib/server/route-logging.ts`는 프론트 BFF route 실패를 JSON 구조 로그로 남기며, route/method/category/status/code 중심으로 기록하고 토큰·본문 전문 같은 민감정보는 남기지 않는다.
- `frontend/next.config.ts`는 `NEXT_PUBLIC_SUPABASE_URL` 기반 Supabase storage public URL을 `next/image` remotePatterns로 허용해, storage 이미지 구간을 점진적으로 `Image` 컴포넌트로 전환할 수 있게 한다.
- 프로필 편집 모달의 avatar preview는 blob URL과 storage URL을 모두 받을 수 있어 `next/image`의 `unoptimized` 모드로 렌더링한다.
- `frontend/get_token.mjs`는 기본 실행 시 access token을 바로 출력하지 않고, `--print` 인자를 준 경우에만 토큰을 출력한다.
- `docs/launch-smoke-test.md`는 공개 진입, 로그인, 프로필, 활동 저장소, AI 기능, 추천/비교, 운영 로그까지 포함한 런칭 전 smoke test 체크리스트를 제공한다.
- `docs/launch-checklist-nontechnical.md`는 비개발자도 10분 안에 따라 할 수 있는 배포 직전 체크리스트를 제공한다.
- `docs/launch-checklist-notion.md`는 운영자가 Notion에 그대로 붙여 넣어 체크박스로 사용할 수 있는 배포 체크리스트를 제공한다.
- `docs/launch-checklist-slack.md`는 운영 채널에 바로 붙여 넣을 수 있는 Slack용 배포 점검/승인/보류/완료 템플릿을 제공한다.
- `frontend/app/api/health/config/route.ts`는 비밀값 원문을 노출하지 않고 Supabase/Gemini/Upstash/백엔드 연결 상태를 한 번에 확인하는 설정 진단 endpoint를 제공한다.
- `frontend/app/api/summary/route.ts`는 Gemini summary 호출에 20초 timeout을 적용해 상류 AI 응답이 장시간 멈출 때 504 형태의 upstream 오류로 빠르게 실패한다.
- `backend/tests/test_know_survey.py`는 저장소에 포함되지 않은 KNOW 원본 코드북/원자료가 없을 때 관련 테스트만 skip하고, 전체 pytest 수집을 중단시키지 않는다.
- `backend/chains/job_posting_rewrite_chain.py`의 Gemini rewrite 호출은 timeout 시 task cancel/cleanup까지 정리해 fallback 테스트에서 `coroutine was never awaited` 경고를 다시 만들지 않는다.
- `frontend/app/page.tsx`는 루트 접근을 `/landing-a`로 리다이렉트해서 landing-a를 메인 랜딩 허브로 고정한다.
- `frontend/middleware.ts`는 루트 `/?code=...` OAuth 유입을 `/auth/callback?next=/landing-a`로 정규화해서 로그인 후 landing-a 주소를 깨끗하게 유지한다.
- `frontend/middleware.ts`는 레거시 `/programs/compare` 접근을 `/compare`로 리다이렉트해서 새 랜딩 축 라우트 구조로 정리한다.
- `frontend/app/auth/callback/route.ts`의 `GET()`는 기존 사용자 로그인 완료 후 기본 진입점을 `/landing-a`로 돌리고, 신규 사용자는 계속 `/onboarding`으로 보낸다.
- `frontend/app/(landing)/landing-a`는 상단에 랜딩 A 전용 헤더를 렌더링하며, 헤더는 `프로그램 상세`(`/programs`), `비교`(`/compare`), `대시보드`(`/dashboard#recommend-calendar`), 로그인/프로필 버튼을 제공한다. 로그인 확인 후 헤더 인증 버튼은 `/dashboard/profile`로 이동하고, 히어로 주 CTA는 `/dashboard#recommend-calendar`로 이동한다.
- `frontend/app/(landing)/landing-a`는 상단 티커 없이 온보딩 톤의 네이비 히어로와 컴팩트 live board를 먼저 렌더링하며, 비로그인 히어로 주 CTA는 `/login`으로 이동한다.
- `frontend/app/(landing)/landing-a`는 검색/칩 필터, 프로그램 카드, 6단계 지원 준비 흐름, 기능 미리보기 카드, CTA/푸터 순서의 공개 랜딩 A 구조를 렌더링한다. D-Day 요약, 문제/해결 비교, 추천 정확도 설명, KPI 뼈대 섹션은 현재 랜딩 A 렌더링에서 제외되어 있다.
- `frontend/app/(landing)/landing-a/page.tsx`의 칩 라벨은 사용자에게 `AI·데이터`, `IT·개발`처럼 표시하지만, 백엔드 `programs.category` 저장값은 `AI`, `IT`, `경영`이므로 API 요청 시 해당 저장 카테고리로 매핑한다.
- `frontend/app/(landing)/landing-a/_components.tsx`는 기존 import 호환을 위한 export 허브이며, 실제 섹션 구현은 `_navigation.tsx`, `_hero.tsx`, `_program-feed.tsx`, `_support-sections.tsx`, `_style-tag.tsx`, 공통 유틸/인증 hook은 `_shared.ts`, `_auth.ts`로 분리되어 있다. `_program-feed.tsx`는 칩 버튼 class 계산과 프로그램 카드 렌더를 각각 `getChipButtonClass`, `ProgramCard`로 분리하고, `_hero.tsx`는 live board 카드와 hero stats 렌더를 `HeroProgramSignalCard`와 배열 map으로 관리한다. `_navigation.tsx`는 브랜드/프로필 액션/랜딩 A 헤더 링크 패턴을 공유 컴포넌트와 링크 배열로 관리한다.
- `frontend/app/(landing)/landing-c`는 제공된 standalone HTML reference를 Next.js 페이지로 이식한 공개 랜딩 C 경로이며, 스플릿 히어로, 프로그램 검색/칩 필터, 프로그램 카드, 기능 미리보기, 로그인 이후 여정, 최종 CTA를 렌더링한다. CTA와 카드 액션은 `/programs`, `/compare`, `/login`, `/dashboard#recommend-calendar`, `/programs/[id]` 실제 라우트로 연결되어 있다.
- `frontend/app/(landing)` 아래 공개 랜딩 축 라우트는 `landing-a`, `landing-b`, `landing-c`, `programs`, `compare`로 정리되어 있다. 이 중 `landing-b`와 `landing-c`는 현재 기본 진입이나 공통 네비게이션에는 연결하지 않는 A/B 테스트 보존 경로다.
- `frontend/app/dashboard/layout.tsx`는 landing-a 헤더를 유지한 채 대시보드 사이드바와 본문을 렌더링한다.
- Supabase 인증 설정 문서는 `docs/auth/supabase-auth-local.md`, `docs/auth/supabase-auth-production.md`로 로컬/운영을 분리해 관리한다.
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
7. local watcher supervisor는 inspector handoff를 먼저 만들고, 이어서 implementer가 구현과 result report를 만든다. 일반 코드 task는 verifier가 최종 검증 artifact를 남기고, docs task는 watcher가 경량 verification artifact를 대신 남긴다.
8. watcher는 실행 결과에 따라 packet을 `tasks/done/`, `tasks/drifted/`, `tasks/blocked/`, `tasks/review-required/`로 이동한다.
9. `tasks/drifted/`와 `tasks/blocked/`는 자동 복구가 가능하면 `tasks/inbox/`로 재큐잉되고, 아니면 다시 `cowork/packets/` review 흐름으로 에스컬레이션된다. `tasks/review-required/`는 verifier가 수동 검토를 요청한 전용 큐이며, 검토가 끝난 packet은 그 큐에 남기지 않고 `tasks/archive/` 또는 후속 execution queue로 정리한다.

## Folder semantics
- `cowork/packets/`: 사람이 계속 수정하는 원본 packet
- `cowork/reviews/`: 원본 packet에 대한 review 이력
- `tasks/inbox/`: 승인된 최신 packet 사본의 실행 대기열
- `tasks/running/`: 현재 실행 중인 packet
- `tasks/done/`: 성공적으로 끝난 execution packet
- `tasks/blocked/`: 메타데이터 누락, 실패, 외부 의존성 등으로 멈춘 execution packet
- `tasks/drifted/`: 계획 기준과 현재 코드가 어긋나 재검토가 필요한 execution packet
- `tasks/review-required/`: verifier가 사람 검토 후 재승인을 요구한 살아 있는 execution packet만 두는 큐
- `tasks/archive/`: 중복 packet, review 처리 완료 packet, 재실행 대상이 아닌 stale packet을 보관하는 아카이브

## Key references
- automation index: [automation/README.md](./automation/README.md)
- automation overview: [automation/overview.md](./automation/overview.md)
- local flow: [automation/local-flow.md](./automation/local-flow.md)
- architecture graph: [automation/agentic-architecture-langgraph.md](./automation/agentic-architecture-langgraph.md)
- presentation summary: [automation/agentic-flow-presentation.md](./automation/agentic-flow-presentation.md)
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
- `reports/`의 `supervisor-verification`, `result`, `needs-review` 같은 문서는 packet이 `tasks/archive/`로 이동해도 audit trail로 계속 유지한다
- `docs/`: reference docs and operational docs
- `scripts/`: watcher 실행 스크립트와 watcher 공통 유틸
  - `docs/automation/`: watcher, dispatch, task packet, 운영 흐름
  - `docs/rules/`: 규칙 문서와 템플릿
  - `docs/specs/`: PRD, API 계약, 출력 스펙
  - `docs/data/`: CSV, SQL, http 샘플
  - `docs/research/`: 조사와 매핑 문서
  - `docs/worklogs/`: 날짜별 작업 기록

## Current behavior notes
- PDF 이력서 파서는 Gemini 호출 실패/쿼터 초과 시 원문 기반 fallback 파싱을 수행하며, `경력` 섹션은 `프로젝트` 헤더에서 종료해 프로젝트가 프로필 경력으로 섞이지 않도록 처리한다.
- 활동 역할/팀 구성 파싱은 `백엔드 개발자 (5인: ...)`와 `백엔드 개발자 (5인 팀: ...)` 표기를 모두 지원하며, scorer가 소개형/성과형/무시 문장을 점수 기반으로 분류한다. PDF parser rule table과 scorer weight는 `backend/chains/pdf_parser_rules.py`에 모아 두고, 역할명 단독 줄은 기여내용에서 제외하고 구현/개발/성과 문장은 기여내용으로 분류한다. scorer classification은 `metric_signal`, `keyword_signal`, `role_only` 같은 세분화된 reason을 반환하며, `ISOSER_PDF_PARSE_DEBUG_SCORER=1`일 때 실제 파싱 중 debug log로 남긴다. PDF 원문 회귀 케이스는 `backend/tests/fixtures/pdf_texts/`, expected snapshot은 `backend/tests/fixtures/pdf_expected/`, 실제 PDF e2e fixture는 `backend/tests/fixtures/pdf_files/`로 관리한다.
- 추천 프로그램 API는 `relevance_score`와 `urgency_score`를 분리해서 반환하며, 카드 UI는 관련도 배지에 `relevance_score`를 사용하고 마감 7일 이내만 별도 마감 칩으로 표시한다.
- `backend/routers/programs.py`는 기존 `POST /programs/recommend`를 유지한 채 `GET /programs/recommend/calendar`를 추가해 `{ items: [...] }` 계약으로 캘린더 전용 추천을 제공하고, 이 경로에서만 만료 프로그램 제외 + `final_score desc`, `deadline asc` 정렬을 적용한다.
- recommendation cache read는 저장된 `final_score`를 그대로 신뢰하지 않고 `relevance_score * 0.6 + urgency_score * 0.4`로 재계산하며, component score가 하나라도 없으면 stale cache로 보고 fresh recommendation path로 우회한다.
- `frontend/app/api/dashboard/recommend-calendar/route.ts`와 `frontend/lib/api/app.ts`는 새 캘린더 추천 BFF/helper를 제공하며, 비로그인 사용자도 `relevance_score = 0`을 유지한 `{ items: CalendarRecommendItem[] }` 응답을 받을 수 있다. 백엔드 캘린더 추천이 빈 배열을 반환하거나 백엔드 fetch 자체가 실패하면 발표 퍼널 보호를 위해 모집 마감순 공개 프로그램을 Supabase에서 직접 fallback으로 노출한다.
- `frontend/app/dashboard/page.tsx`는 캘린더 전용 추천 BFF를 사용하고, 추천 카드의 `캘린더에 적용` 버튼으로 선택한 부트캠프 일정을 dashboard calendar에 반영한다. 적용된 일정은 `calendar_program_selections` 서버 테이블에 최대 3개까지 저장하고, 실패 시 기존 브라우저 `localStorage` 선택 상태로 fallback한다. `frontend/app/api/dashboard/calendar-selections/route.ts`는 쿠키 세션으로 사용자를 확인한 뒤 서버 쪽 service role client가 있으면 이를 사용해 저장/조회하여 RLS나 토큰 전파 흔들림으로 발표 저장이 실패하지 않게 한다. 적용된 프로그램은 `MiniCalendar`의 해당 마감 날짜 셀 안에 녹색 `적용` 라벨과 프로그램명으로 직접 표시된다. `MiniCalendar`는 현재 표시 월 중앙 라벨과 이전/다음 월 이동 버튼을 제공하며, 적용된 프로그램의 마감월로 자동 이동한다.
- `frontend/app/dashboard/portfolio/page.tsx`는 세션스토리지에 남은 포트폴리오 변환 결과가 있으면 기존 미리보기를 보여주고, 없으면 성과 저장소 활동 목록에서 활동을 선택해 `/activities/convert` 기반 포트폴리오 초안을 직접 생성할 수 있다. 생성 결과는 `portfolios.portfolio_payload`에 저장되어 재진입 시 저장된 초안을 다시 열 수 있으며, 미리보기 화면에서 브라우저 인쇄 기반 `PDF로 저장`을 제공한다.
- 비교 페이지는 현재 운영 적재 컬럼 기준으로 기본 정보, 운영 정보, 프로그램 개요만 비교하고, `compare_meta`는 더 이상 표 본문의 기본 의존성이 아니다. 운영 메타 성격의 빈 값은 `데이터 미수집`, 실사용 컬럼의 빈 값은 `정보 없음`으로 구분해 표시한다.
- 비교 페이지는 로그인 사용자에 한해 `POST /programs/compare-relevance`로 종합 관련도, 기술 스택 일치도, 매칭 스킬 태그를 계산해 표시한다.
- compare relevance 응답은 기존 점수 필드 외에 `fit_label`, `fit_summary`, `readiness_label`, `gap_tags`를 함께 반환하고, compare UI는 이를 `★ AI 적합도` 섹션에서 적합도 판단, 지원 준비도, 한줄 요약, 보완 포인트로 해석해 보여준다.
