# Result Report: TASK-2026-04-20-1532-compare-current-columns

## Changed files

- `frontend/app/(landing)/compare/programs-compare-client.tsx`

## Why changes were made

- `/compare` 표가 기본적으로 `compare_meta`에 의존하고 있어 현재 운영 적재 데이터 기준에서는 `"정보 없음"`이 대량 노출되고 있었습니다.
- compare 표 본문을 현재 `Program` 실사용 컬럼 기준으로 재구성해 기본 정보, 운영 정보, 프로그램 개요만 비교하도록 바꿨습니다.
- source별 미수집 가능성이 큰 운영 메타에는 `"데이터 미수집"`을, 실제 현재 컬럼의 빈 값에는 `"정보 없음"`을 쓰도록 formatter를 분리했습니다.
- 상단 카드 chip과 CTA 링크도 현재 컬럼 기준으로 단순화하고, 지원 링크는 `application_url -> source_url -> link` fallback을 동일하게 사용하도록 맞췄습니다.

## Preserved behaviors

- `/compare` 라우트, 슬롯 수, URL `ids` 상태 관리, 슬롯 추가/제거 동작은 유지했습니다.
- 추천 프로그램 영역과 관련도 분석 섹션 및 API 호출 흐름은 유지했습니다.
- 빈 슬롯의 `"정보 없음"` 표기는 유지했습니다.
- `compare_meta` 타입과 컬럼 자체는 삭제하지 않았고, 이번 변경에서는 UI 기본 의존성에서만 제외했습니다.

## Risks / possible regressions

- `is_certified=false`와 `is_active=false`는 명시적 음수 데이터로 그대로 표기하므로, 일부 source에서 사실상 unknown을 `false`로 적재한다면 의미가 과하게 단정적으로 보일 수 있습니다.
- `summary`가 없을 때 `description`을 한줄 요약으로 재사용하므로, 일부 프로그램에서는 요약 행과 상세 설명 행 내용이 유사하게 보일 수 있습니다.
- CTA가 `source_url` 또는 `link`까지 fallback 하도록 바뀌었으므로, 일부 source에서는 신청 링크가 아니라 상세 페이지 링크로 이동할 수 있습니다.

## Follow-up refactoring candidates

- compare 표 row 정의를 별도 상수로 추출하면 formatter 정책과 표시 문구를 테스트 가능하게 정리할 수 있습니다.
- `getLinkHref`와 운영 메타 formatter 규칙을 compare 외 카드/상세 화면과 공통화하면 링크 정책과 fallback 문구를 일관되게 유지하기 쉽습니다.

## Verification run

- `git diff --check -- "frontend/app/(landing)/compare/programs-compare-client.tsx" "frontend/lib/types/index.ts"`
- `npm exec tsc -- --noEmit` (workdir: `frontend`)

## Run Metadata

- generated_at: `2026-04-20T15:55:41`
- watcher_exit_code: `0`
- codex_tokens_used: `391,048`

## Git Automation

- status: `push-failed`
- branch: `develop`
- commit: `38282b2caa582e3f1b255b3d7a334cb2404aebbc`
- note: To https://github.com/kimmary96/isoser.git
 ! [rejected]        develop -> develop (non-fast-forward)
error: failed to push some refs to 'https://github.com/kimmary96/isoser.git'
hint: Updates were rejected because the tip of your current branch is behind
hint: its remote counterpart. If you want to integrate the remote changes,
hint: use 'git pull' before pushing again.
hint: See the 'Note about fast-forwards' in 'git push --help' for details.
