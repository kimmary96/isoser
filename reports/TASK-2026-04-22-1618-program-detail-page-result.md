# TASK-2026-04-22-1618-program-detail-page 결과 보고서

## 1. 현재 상세페이지 진입 구조

- `/programs` 목록의 `상세 보기`는 기존처럼 `/programs/${program.id}`로 이동한다.
- 상세 페이지 위치는 `frontend/app/(landing)/programs/[id]/page.tsx`다.
- 상세 페이지는 기존 `getProgramDetail(id)` helper를 통해 `GET /programs/{program_id}/detail`을 사용한다.
- 404 응답은 기존 `notFound()` 흐름을 유지한다.

## 2. 수정 대상 파일 목록

### Changed files

- `frontend/app/(landing)/programs/[id]/page.tsx`
- `frontend/app/(landing)/programs/[id]/program-detail-client.tsx`
- `docs/current-state.md`
- `docs/refactoring-log.md`
- `reports/TASK-2026-04-22-1618-program-detail-page-result.md`

## 3. 섹션별 데이터 매핑표

| 섹션 | 연결 필드 | 렌더링 정책 |
| --- | --- | --- |
| Hero | `title`, `provider`, `organizer`, `location`, `application_end_date`, `program_end_date`, `program_start_date`, `teaching_method`, `fee`, `capacity_remaining`, `support_type` | 제목은 최소 fallback, 나머지는 값이 있을 때만 badge/fact로 표시 |
| 프로그램 요약 | `description`, `location`, `teaching_method`, `support_type`, `rating_display`, `rating`, `review_count`, `capacity_total`, `tags`, `tech_stack` | 설명 또는 요약 fact/tag가 있을 때만 표시 |
| 교육기관 정보 | `provider`, `organizer`, `location`, `manager_name`, `phone`, `email` | 값이 있는 항목만 grid로 표시 |
| 일정 & 수업 | `application_start_date`, `application_end_date`, `program_start_date`, `program_end_date`, `schedule_text`, `teaching_method`, `capacity_remaining` | 날짜 범위 또는 운영 정보가 있을 때만 표시 |
| 추천 대상 | `recommended_for` | 실제 배열이 있을 때만 표시 |
| 학습 목표 | `learning_outcomes` | 실제 배열이 있을 때만 표시 |
| 수강료 & 지원금 | `fee`, `support_amount`, `support_type`, `certifications` | 금액/지원유형/인증 중 하나라도 있을 때만 표시 |
| 지원 자격 & 절차 | `eligibility`, `source_url` | 자격 또는 신청 링크가 있을 때만 표시 |
| 취업 지원 | `career_support`, `job_placement_rate` | 실제 데이터가 있을 때만 표시 |
| 추가 안내 | `ai_matching_summary`, `event_banner` | 실제 문구가 있을 때만 표시 |
| 커리큘럼 | `curriculum` | 실제 배열이 있을 때만 아코디언 표시 |
| 수강 후기 | `reviews` | 실제 배열이 있을 때만 카드 표시 |
| Q&A | `faq` | 실제 question/answer가 있을 때만 아코디언 표시 |
| 우측 사이드바 | `application_end_date`, `program_end_date`, `schedule_text`, `program_start_date`, `location`, `fee`, `support_amount`, `teaching_method`, `capacity_remaining`, `source_url` | 값이 있는 행만 표시, 신청 링크 없으면 CTA 숨김 |

## 4. 실제 구현한 섹션

- HTML 시안의 방향을 따라 Hero, 상단 탭, 본문/사이드바 2열, 빠른 목차, 신청 CTA, 북마크/공유 UI를 구현했다.
- 서버 컴포넌트는 데이터 fetch, metadata, JSON-LD, 404 처리를 유지하고 상세 UI는 `program-detail-client.tsx`로 분리했다.
- 탭과 빠른 목차 클릭은 기존 섹션으로 부드럽게 스크롤한다.
- 스크롤 위치에 따라 탭/목차 active 상태가 갱신된다.
- 북마크는 클라이언트 UI 상태만 토글하며 서버 저장은 포함하지 않았다.
- 커리큘럼과 FAQ는 실제 데이터가 있을 때만 아코디언으로 렌더링한다.

## 5. 숨김 처리한 섹션과 이유

- `curriculum`이 비어 있으면 커리큘럼 탭/섹션을 숨긴다.
- `reviews`가 비어 있으면 후기 탭/섹션을 숨긴다.
- `faq`가 비어 있으면 Q&A 탭/섹션을 숨긴다.
- 유사 프로그램은 현재 상세 API에 related data가 없어 렌더링하지 않았다.
- 추천 대상, 학습 목표, 취업 지원, 추가 안내도 해당 실제 필드가 없으면 숨긴다.
- 개별 필드마다 `정보 없음`을 반복하지 않는다.

## 6. API 응답과 연결한 필드 목록

- 직접 연결: `title`, `provider`, `organizer`, `location`, `description`, `source_url`, `application_start_date`, `application_end_date`, `program_start_date`, `program_end_date`, `support_type`, `teaching_method`, `fee`, `support_amount`, `tags`, `schedule_text`, `eligibility`.
- 선택 연결: `rating`, `rating_display`, `review_count`, `job_placement_rate`, `capacity_total`, `capacity_remaining`, `manager_name`, `phone`, `email`, `certifications`, `tech_stack`, `curriculum`, `recommended_for`, `learning_outcomes`, `career_support`, `event_banner`, `ai_matching_summary`, `faq`, `reviews`.
- 데이터가 없는 optional 배열은 클라이언트에서 빈 배열처럼 처리해 기존 응답과의 호환성을 유지했다.

## 7. 반응형/인터랙션 구현 여부

- 모바일/태블릿에서는 본문과 사이드바가 단일 컬럼으로 쌓인다.
- 데스크톱에서는 본문과 우측 신청/목차 사이드바가 2열로 배치된다.
- 상단 탭은 가로 overflow를 허용해 좁은 폭에서 가로 스크롤로 접근한다.
- 빠른 목차 active 상태, 탭 스크롤, 목차 스크롤, 북마크 토글, 공유 링크 복사를 구현했다.

## 8. 테스트/검증 결과

- `npm --prefix frontend run lint -- --file "app/(landing)/programs/[id]/page.tsx" --file "app/(landing)/programs/[id]/program-detail-client.tsx"`: 통과.
- `npx --prefix frontend tsc -p frontend/tsconfig.codex-check.json --noEmit`: 통과.
- 백엔드 상세 API 계약은 변경하지 않아 `backend/tests/test_programs_router.py`는 이번 구현 단계에서 실행하지 않았다.
- 이 단계는 최종 검증 게이트가 아니므로 로컬 브라우저 수동 확인은 후속 supervisor verification 대상으로 남긴다.

## 9. 남은 데이터 공백과 후속 작업 제안

- `ProgramDetail` 타입에는 커리큘럼, FAQ, 후기, 추천 대상 등 선택 필드가 있지만 현재 백엔드 상세 응답은 대부분 빈 값 또는 미제공 상태일 수 있다.
- 유사 프로그램 섹션은 related API 또는 상세 응답 계약이 생긴 뒤 추가하는 것이 안전하다.
- `reviews`의 구조가 현재 `Record<string, unknown>`라 UI에서 표시 가능한 key를 추정해 읽는다. 실제 후기 계약이 생기면 명시 타입으로 분리하는 것이 좋다.
- 상세 페이지가 커질 경우 Hero, Sidebar, SectionCard, Accordion을 `frontend/app/(landing)/programs/[id]/_components/`로 추가 분리할 수 있다.

## 변경 이유

- 기존 상세 페이지는 상세 API를 사용하지만 시안의 Hero, 탭, 사이드바, 목차, 인터랙션 구조가 부족했다.
- 실제 데이터가 없는 섹션에 가짜 콘텐츠를 넣지 않는 조건을 지키면서, 값이 있는 상세 필드를 더 풍부하게 보여주기 위해 렌더링 모델을 보강했다.

## 영향 범위

- 영향 범위는 `/programs/[id]` 상세 페이지 UI와 관련 문서 기록으로 제한된다.
- `/programs` 목록 route, 상세 API helper, 백엔드 상세 API, 비교/추천 API는 변경하지 않았다.

## 리스크

- 실제 운영 데이터에서 optional 배열이 계속 비어 있으면 커리큘럼/후기/Q&A 탭은 노출되지 않는다.
- 공유 버튼은 Clipboard API가 없는 브라우저에서는 동작하지 않을 수 있으나 페이지 렌더링에는 영향을 주지 않는다.
- 현재 worktree에 다른 watcher/작업 변경이 많아 최종 검증 단계에서 전체 diff scope를 다시 확인해야 한다.

## 테스트 포인트

- `/programs`에서 상세 보기 클릭 후 `/programs/[id]`로 이동하는지 확인한다.
- 상세 API가 sparse data를 반환해도 Hero와 사이드바가 깨지지 않고 `정보 없음` 반복이 없는지 확인한다.
- 커리큘럼/FAQ/후기 데이터가 없을 때 탭과 섹션이 숨겨지는지 확인한다.
- 탭/목차 클릭, active 상태, 북마크 토글, 모바일 단일 컬럼을 브라우저에서 확인한다.

## 추가 리팩토링 후보

- `ProgramDetail` optional 배열 필드를 백엔드 response model과 프론트 타입에서 명시적으로 동기화한다.
- 후기 record를 명시 타입으로 정의한다.
- 상세 UI 하위 컴포넌트를 폴더 단위로 분리해 파일 크기를 줄인다.

## Run Metadata

- generated_at: `2026-04-22T16:43:42`
- watcher_exit_code: `0`
- codex_tokens_used: `411,322`
