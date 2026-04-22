# TASK-2026-04-22-program-backfill-detail-model Result

## Backfill Target
- 대상: `programs.source`가 고용24/work24 또는 K-Startup/kstartup 계열이고, `deadline >= 2026-04-22`인 운영 DB row.
- 기본 정책: 기존 값은 보존하고 비어 있는 필드만 채우는 `fill-null-only`.
- 적용 범위: dry-run으로 diff를 먼저 확인한 뒤 `--apply` 실행.
- 보강 필드: `provider`, `location`, `description`, `start_date`, `end_date`, `source_url`, `cost`, `subsidy_amount`, `compare_meta`.

## Source Unique Key
- K-Startup: `compare_meta.announcement_id` 우선, 없으면 URL의 `pbancSn`.
- 고용24: `hrd_id` 우선, 없으면 원본 URL의 `tracseId + tracseTme + trainstCstmrId`.
- title/source 기준 upsert는 사용하지 않았다. 제목이 같아도 회차가 다른 교육이 있을 수 있어 source 고유 식별자를 우선했다.

## Changed Files
- `scripts/program_backfill.py`: dry-run/apply 가능한 운영 DB 백필 CLI 추가.
- `backend/tests/test_program_backfill.py`: source key 추출과 fill-null-only/overwrite patch 정책 테스트 추가.
- `backend/routers/programs.py`: 상세페이지 전용 `ProgramDetailResponse`와 `GET /programs/{program_id}/detail` 추가.
- `frontend/lib/types/index.ts`: `ProgramDetail` 타입 추가.
- `frontend/lib/api/backend.ts`: `getProgramDetail()` helper 추가.
- `frontend/app/(landing)/programs/[id]/page.tsx`: 상세 전용 API 사용, 빈 섹션 숨김 렌더링 적용.
- `docs/current-state.md`, `docs/refactoring-log.md`: 현재 동작과 작업 기록 갱신.

## Applied Fields
- K-Startup 샘플 row는 기관, 지역, 설명, 신청 시작/종료일, 원본 링크, 신청 링크/대상/담당부서 등 `compare_meta`가 보강됐다.
- 고용24 샘플 4건은 기관, 지역, 설명, 운영 시작/종료일, 원본 링크, 지원금, 정원/전화/만족도 등 `compare_meta`가 보강됐다.

## Sample Diff
| 프로그램 | source key | 백필 전 DB | 백필 후 DB | API/detail 표시 |
|---|---|---|---|---|
| 2026년 서울여성 창업아이디어 공모전 | `kstartup:announcement:176678` | `provider/location/description/start_date/end_date/source_url/compare_meta` 비어 있음 | `provider=서울시여성능력개발원 서울광역여성새로일하기센터`, `location=서울`, `start_date=2026-03-30`, `end_date=2026-04-23`, `source_url` 저장 | 신청 일정 `2026-03-30 ~ 2026-04-23`, 기관/지역/설명/신청 페이지 표시 |
| [서울관광재단] 2026 서울 관광스타트업 창업 아카데미 교육생 모집 | `kstartup:announcement:177074` | `provider/location/description/start_date/end_date/source_url/compare_meta` 비어 있음 | `provider=서울관광재단`, `location=서울`, `start_date=2026-04-06`, `end_date=2026-04-23`, `source_url` 저장 | 신청 일정, 기관/지역/설명/신청 페이지 표시 |
| 『파이썬』Python 자료구조&알고리즘 프로그래밍 | `work24:url:AIG20230000419940:5:500020062235` | 상세 필드 일부 비어 있음 | `provider=그린컴퓨터아트학원`, `location=서울 종로구`, `start_date=2026-04-23`, `end_date=2026-05-12`, `subsidy_amount=238320`, `source_url` 저장 | 운영 일정, 기관/지역/지원금/원본 링크 표시 |

## Detail Field Contract
- 원본에서 직접 채움: `title`, `provider`, `organizer`, `location`, `description`, `application_start_date`, `application_end_date`, `program_start_date`, `program_end_date`, `teaching_method`, `support_type`, `source_url`, `fee`, `support_amount`, `eligibility`, `schedule_text`.
- 있으면 표시, 없으면 섹션 숨김: `rating`, `review_count`, `job_placement_rate`, `capacity_total`, `capacity_remaining`, `manager_name`, `phone`, `email`, `certifications`, `tech_stack`, `tags`.
- 원본에 없으면 기본 숨김 또는 후순위 생성: `curriculum`, `faq`, `reviews`, `recommended_for`, `learning_outcomes`, `career_support`, `event_banner`, `ai_matching_summary`.

## Verification
- `backend\venv\Scripts\python.exe -m pytest backend/tests/test_program_backfill.py backend/tests/test_work24_kstartup_field_mapping.py backend/tests/test_scheduler_collectors.py -q`: 15 passed.
- `backend\venv\Scripts\python.exe -m pytest backend/tests/test_programs_router.py backend/tests/test_program_backfill.py -q`: 22 passed.
- `backend\venv\Scripts\python.exe -m pytest backend/tests/test_program_backfill.py backend/tests/test_tier2_collectors.py -q`: 20 passed.
- `npm run lint -- --file "app/(landing)/programs/[id]/page.tsx" --file "lib/api/backend.ts" --file "lib/types/index.ts"`: passed.
- `npx tsc -p tsconfig.codex-check.json --noEmit`: passed.
- `scripts/program_backfill.py --limit 120 --max-pages 5 --deadline-from 2026-04-22 --format json`: post-check `patch_count=0`.
- FastAPI TestClient로 K-Startup 2건, 고용24 3건의 `/programs/{id}/detail` 200 응답과 핵심 필드 반환을 확인했다.
- 추가 회귀 테스트로 K-Startup은 신청 기간, 고용24는 운영 기간으로 상세 응답 날짜가 분리되는 계약을 고정했다.
- 확장 백필 `scripts/program_backfill.py --limit 300 --max-pages 20 --deadline-from 2026-04-22 --apply`로 고용24/K-Startup 기존 row 40건을 추가 보강했다.
- 고용24 상세 HTML fallback + SeSAC backfill 적용 `scripts/program_backfill.py --limit 300 --max-pages 3 --deadline-from 2026-04-22 --apply`로 273건을 추가 보강했다. 적용 결과는 `reports/TASK-2026-04-22-program-backfill-detail-sesac-apply.json`에 저장했다.
- 적용 후 `/programs/?limit=40&sort=deadline` 기준 첫 40개 row에서 `provider/location/start_date/end_date` 누락 row가 0건임을 확인했다.

## Blocked Cleanup
- `reports/TASK-2026-04-22-program-backfill-detail-model-blocked.md`는 이 작업으로 해소되어 삭제 대상이다.
- `reports/TASK-2026-04-15-1420-crawling-phase2-api-validation-blocked.md`는 당시 `HRD_API_KEY`/`WORK24_API_KEY` 부재가 원인이었으나, 현재 현행 `WORK24_TRAINING_AUTH_KEY`와 `KSTARTUP_API_KEY`가 있고 HRD collector는 기본 비활성 optional source로 바뀌어 현재 blocked 상태가 아니다.

## Risks
- 고용24의 일부 기존 row는 현재 공개 API 첫 5페이지에 없거나 과거 회차라 매칭되지 않을 수 있다. 이 경우 `--max-pages`를 늘리거나 source 상세 조회 API가 필요하다.
- K-Startup은 공고 상세 조회가 `announcement_id`로 가능해 상대적으로 안정적이지만, API 원본에서 종료된 공고가 제거되면 백필할 수 없다.
- 이번 적용은 활성 후보 중심이다. 과거 마감 row까지 채우려면 별도 `--deadline-from` 범위를 낮춘 운영 백필을 다시 dry-run 후 적용해야 한다.
