# Profile Page Completion And Editors Result

## Changed files
- `frontend/app/dashboard/profile/page.tsx`
- `frontend/app/dashboard/profile/_components/profile-completion-card.tsx`
- `frontend/app/dashboard/profile/_components/profile-hero-section.tsx`
- `frontend/app/dashboard/profile/_components/profile-activity-strip.tsx`
- `frontend/app/dashboard/profile/_components/profile-detail-cards.tsx`
- `frontend/app/dashboard/profile/_components/profile-section-editors.tsx`
- `frontend/app/dashboard/profile/_lib/profile-page.ts`
- `frontend/app/(landing)/landing-c/_program-feed.tsx`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made
- 프로필 완성도 100% 전에는 어떤 입력이 부족한지 화면에서 바로 알 수 있게 하기 위해 완성도 계산 결과에 부족 항목 표시를 추가했다.
- 100% 도달 시 완료 피드백과 팡파레 애니메이션 후 완성도 섹션이 사라지도록 해, 완료 후 같은 안내가 계속 남지 않게 했다.
- 학력 입력을 단일 문자열에서 구조화된 입력 UI로 바꾸되, 기존 API/DB 저장 계약은 유지했다.
- 스킬 텍스트 overflow, 경력 하위 프로젝트 상세 설명 과다 표시, 프로필 화면 간격 문제를 함께 줄였다.
- Skills 편집에서 키워드별 숙련도를 `하/중/상` 3단계 슬라이더로 조정할 수 있게 하고, 카드에는 단계 배지와 단계별 막대를 표시하게 했다.
- Skills 카드 표시를 키워드 좌측 정렬 영역과 단계/막대 우측 고정 영역으로 나눠 정렬했다.
- 자기소개 본문이 카드 안에서 잘리지 않도록 줄수 제한을 제거하고 내부 세로 스크롤로 끝까지 볼 수 있게 했다.
- 자기소개 수정 모달은 넓은 모달 안에서 큰 textarea로 편집하도록 전용 모달로 분리했다.
- 성과 카테고리 기본 화면의 빈 영역을 줄이기 위해 `전체` 탭을 기본값으로 추가하고 최신순 성과 목록을 보여주도록 했다.
- 개별 성과 카테고리에서 첫 행이 다 차지 않을 때 바로 새 성과 작성으로 이동할 수 있는 플러스 카드를 마지막 카드 오른쪽에 배치했다.
- production build 검증 중 기존 landing-c JSX apostrophe lint 오류가 빌드를 막아, 표시 문구를 유지하는 escape만 적용했다.

## Preserved behaviors
- 프로필 저장 API와 `education_history: string[]` 저장 형태는 유지했다.
- 기존 단일 문자열 학력은 학력 모달에서 학교명 필드로 열리며 삭제/저장이 가능하다.
- 기존 완성도 점수 배점은 유지했고, 부족 항목 표시만 같은 기준으로 추가했다.
- 경력과 활동 연결 로직은 유지하되, 경력 카드 안에서는 하위 활동 제목만 표시한다.
- 기존 단일 문자열 스킬은 `중` 단계로 해석해 계속 표시한다.
- 자기소개 저장 API와 `self_intro` 필드 계약은 유지했다.
- 기존 성과 카드 클릭은 상세 이동을 유지하고, 새 플러스 카드는 기존 `/dashboard/activities/new` 작성 경로를 재사용한다.
- landing-c 문구의 화면 표시 결과는 유지했다.

## Risks / possible regressions
- 완성도 100% 상태에서는 진입 직후 약 1.9초 후 완성도 카드가 숨겨지므로, 사용자가 완료 상태를 다시 보고 싶어도 같은 화면 안에서는 재노출되지 않는다.
- 학력 구조화 문자열은 `|` 구분자를 사용하므로, 사용자가 학점 필드 안에 `|` 문자를 직접 입력하면 표시 문자열에 포함될 수 있다.
- 스킬 구조화 문자열도 `|` 구분자를 사용하므로, 사용자가 스킬명에 `| 상`, `| 중`, `| 하` 같은 접미어를 직접 입력하면 숙련도 구분자로 해석될 수 있다.
- 스킬 카드 긴 텍스트는 카드 밖으로 넘치지 않도록 줄바꿈되지만, 매우 긴 항목이 많으면 카드 내부 스크롤이 늘어난다.
- 자기소개가 길면 카드 전체 높이는 유지되고 자기소개 본문 영역만 스크롤된다.
- 개별 성과 카테고리에서 카드가 정확히 5장 이상이면 플러스 카드가 숨겨지므로, 추가 진입은 기존 활동 관리/다른 작성 진입점을 사용해야 한다.

## Follow-up refactoring candidates
- 프로필 완성도 계산을 page 컴포넌트에서 별도 helper와 단위 테스트로 분리한다.
- 학력/경력 구조화 입력을 DB 스키마의 typed JSON 형태로 승격할지 검토한다.
- 프로필 화면 전체 카드 컴포넌트의 spacing/radius/token을 대시보드 공통 UI 토큰으로 묶는다.

## Verification
- `npm --prefix frontend exec tsc -- --noEmit --project frontend/tsconfig.json`: passed.
- `npm --prefix frontend test -- --run`: passed, 18 files / 91 tests.
- `npm --prefix frontend run build`: passed after landing-c apostrophe escape. Remaining output includes the existing `program-provider-brand.tsx` `<img>` LCP warning only.
