# TASK-2026-04-16-1610-compare-add-program-modal 결과 보고

## changed files

- `frontend/app/(landing)/compare/page.tsx`
- `frontend/app/(landing)/compare/programs-compare-client.tsx`
- `frontend/app/(landing)/compare/program-select-modal.tsx`
- `frontend/app/api/dashboard/bookmarks/route.ts`
- `frontend/lib/api/app.ts`
- `docs/refactoring-log.md`

## why changes were made

- `/compare`의 빈 슬롯 셀과 CTA 행에서 프로그램 선택 모달을 열 수 있도록 compare 클라이언트를 확장했습니다.
- 로그인 사용자의 찜 목록을 브라우저에서 Supabase에 직접 접근하지 않고 불러오도록 `GET /api/dashboard/bookmarks` 프록시 route를 추가했습니다.
- 선택한 슬롯 인덱스를 URL 상태로 정확히 반영하려고 compare `ids` 정규화/직렬화 규칙을 조정해 내부 빈 슬롯을 보존할 수 있게 했습니다.
- 전체 검색 탭은 기존 backend `/programs`의 `q` 파라미터를 사용해 300ms debounce 검색과 빈 쿼리 최신 20건 로딩을 지원하도록 구현했습니다.

## preserved behaviors

- 하단 추천 카드의 `+ 비교에 추가`는 모달 없이 첫 번째 빈 슬롯에 직접 추가되는 흐름을 유지합니다.
- compare 상태의 단일 소스는 계속 URL `ids` 파라미터이며 `router.replace`로만 갱신합니다.
- 로그인 사용자의 관련도 비교 로딩과 기존 compare 표/CTA 구성은 유지했습니다.

## risks / possible regressions

- compare URL이 이제 내부 빈 슬롯을 표현할 수 있어 `ids=a,,b` 같은 형태를 허용합니다. 기존 compact URL만 가정한 외부 링크/테스트가 있으면 보정이 필요할 수 있습니다.
- `GET /api/dashboard/bookmarks`는 backend `/bookmarks` 응답 shape에 의존합니다. backend 계약이 바뀌면 프록시 정규화도 같이 수정해야 합니다.
- toast 인프라는 기존 공용 컴포넌트가 없어 compare 페이지 내부 임시 notice UI로 처리했습니다. 향후 전역 알림 체계가 생기면 치환하는 편이 낫습니다.

## follow-up refactoring candidates

- compare 모달 카드와 추천 카드의 프로그램 badge/render 로직을 공용 helper나 component로 합치기
- compare 모달을 공용 `ModalShell` 위에 재구성할지 검토하고, ESC/overlay/body lock 동작을 공통 modal 계층으로 끌어올리기
- compare 슬롯 순서 변경 요구가 생기면 현재 positional URL serializer를 공용 utility로 추출하기

## checks

- `git diff --check -- "frontend/app/(landing)/compare/page.tsx" "frontend/app/(landing)/compare/programs-compare-client.tsx" "frontend/app/(landing)/compare/program-select-modal.tsx" "frontend/app/api/dashboard/bookmarks/route.ts" "frontend/lib/api/app.ts"`: 통과
- `npx tsc -p tsconfig.json --noEmit --pretty false`: 실패
  - pre-existing `.next/types/app/programs/[id]/page.ts` generated import error로 중단됨
- `npm run lint -- --file ...`: 실패
  - 이 저장소는 아직 `next lint` 초기 ESLint 설정 프롬프트가 남아 있어 비대화형 실행이 불가함

## git

- commit/push는 수행하지 않았습니다.
- 이유: 작업 외 변경이 이미 많은 dirty worktree였고, 저장소의 lint/typecheck 자동 검증 경로가 현재 비대화형으로 안정적으로 통과하지 않았습니다.

## Run Metadata

- generated_at: `2026-04-16T14:46:33`
- watcher_exit_code: `0`
- codex_tokens_used: `285,260`

## Git Automation

- status: `main-promotion-skipped`
- branch: `develop`
- commit: `8bb94c8dbc86630d49879795016a4e9618c7dc22`
- note: origin/main is not an ancestor of the task commit, so watcher skipped automatic main promotion.
