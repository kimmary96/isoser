---
id: TASK-2026-04-15-1100-programs-compare
status: queued
type: feature
title: 부트캠프 비교 페이지 — /programs/compare
priority: high
planned_by: claude
planned_at: 2026-04-15T11:00:00+09:00
planned_against_commit: d2dc9fe36272d06812f26781c8659aad98dd6054
---

# Goal

최대 3개 프로그램을 나란히 놓고 기본 정보·모집 대상·지원 허들·커리큘럼을 한눈에 비교하는 `/programs/compare` 페이지를 추가한다.

비교 대상은 URL 쿼리 파라미터(`?ids=uuid1,uuid2,uuid3`)로 관리한다. 페이지 자체는 비로그인 공개 접근이 가능하다.

UI 초안 참조 파일은 `cowork/drafts/isoser-compare-v3.html`이다. 실행 기준 문서는 본 packet이며, 구현 시 draft의 레이아웃·컬러·컴포넌트 구조를 저장소 실제 경로와 Next.js 구조에 맞게 변환한다.

**Drift 주의 — 현재 repo 상태 확인 필수:**

- `/programs/page.tsx`, `/programs/[id]/page.tsx`는 이미 구현돼 있다. 이 파일들을 건드리지 않는다
- `programs` 테이블은 이미 존재하며 `id`, `title`, `deadline`, `days_left`, `skills`, `tags`, `provider`, `location`, `source` 등 기본 컬럼을 갖고 있다. 단, 허들 관련 컬럼(연령 제한, 코딩 실력 요건 등)은 없다
- 이 Task에서 허들 데이터를 위해 `compare_meta JSONB` 컬럼 하나를 migration으로 추가한다
- `Program` 타입은 `frontend/lib/types/index.ts`에 정의되어 있다. 새 컬럼 추가 시 이 타입도 함께 업데이트한다

# User Flow

- 비로그인 사용자가 nav "부트캠프 비교" 탭 또는 `/programs/compare`에 직접 접근한다
- URL에 `?ids=`가 없으면 3개 빈 슬롯이 표시된다. 페이지 하단 "추천 프로그램" 섹션에서 "+ 비교에 추가" 버튼으로 슬롯을 채운다
- 슬롯에 프로그램이 추가되면 URL이 `?ids=uuid1` → `?ids=uuid1,uuid2` 순으로 업데이트된다 (router.replace)
- 슬롯의 × 버튼을 누르면 해당 UUID가 URL에서 제거되고 슬롯이 빈 상태로 돌아간다
- 비교 테이블에서 기본 정보 / 모집 대상 / 지원 허들 / 커리큘럼 섹션을 확인한다
- 허들 항목에 빨간 배지가 있으면 사전 해결 필요 사항을 인지한다
- "AI 관련도" 섹션은 모든 사용자에게 "준비 중" 플레이스홀더를 표시한다 (로그인 여부 무관)
- CTA 행에서 "지금 지원하기" (외부 `application_url` 새탭), "이력서 즉시 만들기" (`/dashboard/resume` 로그인 시, `/login` 비로그인 시)를 클릭한다

# UI Requirements

**컬러 시스템** (`cowork/drafts/isoser-compare-v3.html` 기준, Pretendard 폰트 유지)

| 변수 | 값 |
|---|---|
| `--ink` | `#0A0F1E` |
| `--blue` | `#2563EB` |
| `--fire` | `#F97316` |
| `--red` | `#EF4444` |
| `--amber` | `#F59E0B` |
| `--green` | `#22C55E` |
| `--surface` | `#F1F5F9` |
| `--border` | `#E2E8F0` |

**페이지 헤더**

- 다크(#0A0F1E) 배경, 타이틀 "부트캠프 비교 분석", 서브텍스트
- 헤더 하단 pill: "개발자 대상 포함", "비개발자 대상 포함", "로그인 시 AI 자동 판단 (준비 중)"

**범례 바**

- "허들 표시" 레이블 + 초록(조건 충족 가능) / 노랑(확인 필요) / 빨강(지원 불가) 3종 설명
- 오른쪽 끝: "로그인 시 내 프로필 기준 자동 판단 (준비 중)"

**비교 카드 — CSS Grid 구조**

- `grid-template-columns: 170px repeat(3, 1fr)`
- 4열 고정. 첫 번째 열: 항목 레이블(회색 배경). 2~4열: 프로그램 데이터
- `.row { display: contents }` 패턴으로 논리적 묶음만 하고 레이아웃에서 투명

**슬롯 헤더 행 (직계 자식 4개)**

- 1열 (slot-corner): 현재 비교 중 건수 표시 (예: "2 / 3개")
- 2~4열 (slot-cell): 프로그램이 있으면 프로그램 정보, 없으면 빈 슬롯
- Winner 슬롯 조건: `days_left`가 가장 작은 프로그램. 동점이면 먼저 추가된 프로그램. AI 점수 기반 판단은 이번 범위 밖
- Winner 슬롯: `border-top: 3px solid var(--fire)`, "나에게 가장 적합" 배지, 연한 오렌지 배경
- 슬롯 안 표시 요소: 출처(`source`), 프로그램명(`title`), 마감 D-day 태그 (`days_left` 기준), 대상 태그 (`compare_meta.target_group`), 지원율 태그 (`compare_meta.subsidy_rate`), × 삭제 버튼
- 빈 슬롯: "＋ 프로그램 추가 / 아래 목록에서 선택" 안내, 클릭 시 포커스 없음 (추천 프로그램 섹션에서 추가)

**비교 테이블 섹션 — 각 섹션은 전체 열 스팬 섹션 헤더 + 데이터 행으로 구성**

섹션 헤더 배경색:
- 기본 정보: `#F8FAFC`
- 모집 대상: `#F5F3FF`
- 지원 허들: `#FEF9EC`, 빨간 경고 문구 포함
- 커리큘럼: `#EFF6FF`
- AI 관련도: `#0A0F1E` (다크, "준비 중" 표시)

**기본 정보 섹션 행 (5행)**

| 항목 | 데이터 출처 |
|---|---|
| 마감일 | `deadline` + `days_left`. D-3 이하 빨강, D-4~7 주황, D-8~14 노랑 강조 |
| 과정 기간 | `start_date` ~ `end_date`. 없으면 "정보 없음" |
| 국비 지원율 | `compare_meta.subsidy_rate`. null이면 "정보 없음" |
| 수업 방식 | `compare_meta.teaching_method`. null이면 "정보 없음" |
| 취업 연계 | `compare_meta.employment_connection`. null이면 "정보 없음" |

**모집 대상 섹션 행 (5행)**

| 항목 | 데이터 출처 |
|---|---|
| 주요 대상 | `compare_meta.target_group`. null이면 "정보 없음" |
| 연령 제한 | `compare_meta.age_restriction`. null이면 "정보 없음" |
| 학력 요건 | `compare_meta.education_requirement`. null이면 "정보 없음" |
| 재직자 지원 | `compare_meta.employment_restriction`. null이면 "정보 없음" |
| 경력 조건 | `compare_meta.experience_requirement`. null이면 "정보 없음" |

**지원 허들 섹션 행 (5행)**

각 행은 허들 배지 3종 중 하나를 표시. `compare_meta`가 null이면 "정보 없음"으로 표시.

허들 배지 규칙:
- `pass` (초록): 조건 충족 가능 또는 제한 없음
- `warn` (노랑): 확인 필요 또는 부분 제한
- `block` (빨강): 지원 전 반드시 해결 필요

| 항목 | 데이터 출처 |
|---|---|
| 사전 코딩 실력 | `compare_meta.coding_skill_required`. null → "정보 없음" |
| 국민내일배움카드 | `compare_meta.naeilbaeumcard_required`. null → "정보 없음" |
| 고용보험 이력 | `compare_meta.employment_insurance`. null → "정보 없음" |
| 포트폴리오 제출 | `compare_meta.portfolio_required`. null → "정보 없음". 필요한 경우 "이소서에서 바로 만들 수 있습니다" 링크 노트 표시 |
| 면접 / 코딩테스트 | `compare_meta.interview_required`. null → "정보 없음" |

**커리큘럼 섹션 행 (2행)**

| 항목 | 데이터 출처 |
|---|---|
| 주요 기술 스택 | `skills` (기존 컬럼). 없으면 "정보 없음" |
| 수료 후 목표 직무 | `compare_meta.target_job`. null → "정보 없음" |

**AI 관련도 섹션**

- 섹션 헤더: 다크 배경, "★ 나와의 관련도 — AI 분석 (준비 중)"
- 종합 관련도 행: 모든 슬롯에 "준비 중" 텍스트 표시. 진행 바 없음
- 기술 스택 일치도 행: 동일

**CTA 행 (직계 자식 4개)**

- 프로그램 있는 슬롯: "지금 지원하기 →" (fire 버튼, `application_url` 새탭 오픈. `application_url`이 null이면 버튼 비활성화 또는 미표시) + "이력서 즉시 만들기" (res 버튼, 로그인 시 `/dashboard/resume`, 비로그인 시 `/login`)
- 빈 슬롯: "+ 프로그램 추가" ghost 버튼 (클릭 무반응, 안내 텍스트 역할)

**AI 배너**

- 다크 배경 배너, "로그인하면 나의 허들 항목을 AI가 자동 판단해드립니다" 카피 (이번 Task에서 기능 미구현, 배너 UI만)
- "Google로 무료 시작" 버튼 → `/login`

**추천 프로그램 섹션**

- 섹션 타이틀: "비교에 추가해볼 만한 프로그램"
- 4열 카드 그리드
- 데이터: 기존 `listPrograms` 백엔드 API 호출 (limit=8). 현재 비교 중인 ids를 제외한 프로그램 중 앞 4개 표시
- 카드 구성: 출처(`source`), D-day (`days_left`), 프로그램명(`title`), 태그(`tags`), "+ 비교에 추가" 버튼
- "+ 비교에 추가" 버튼: 클릭 시 URL의 ids에 해당 UUID 추가 (이미 3개면 버튼 비활성화)

# Acceptance Criteria

1. `/programs/compare`에 비로그인 상태로 접근 가능하다 (middleware 수정 불필요 — 실행 전 middleware 변경 여부 확인)
2. URL `?ids=uuid1,uuid2` 형태로 접근 시 해당 프로그램 데이터가 슬롯에 로드된다
3. 추천 프로그램 카드의 "+ 비교에 추가" 클릭 시 URL ids에 추가되고 슬롯에 반영된다
4. 슬롯의 × 클릭 시 해당 UUID가 URL에서 제거되고 슬롯이 빈 상태로 바뀐다
5. ids가 3개일 때 "+ 비교에 추가" 버튼이 비활성화된다
6. `compare_meta`가 null인 프로그램은 허들·모집 대상·커리큘럼의 모든 셀에 "정보 없음" 텍스트를 표시한다. 에러 없이 렌더링된다
7. `compare_meta`에 값이 있는 항목은 허들 배지(pass/warn/block)로 정확히 표시된다
8. 비교 카드 그리드가 4열(레이블 1열 + 슬롯 3열)로 정확히 렌더링된다. `.row { display: contents }` 패턴을 사용한다
9. winner 슬롯 (days_left 최솟값 기준)에 fire border-top + "나에게 가장 적합" 배지가 표시된다
10. "지금 지원하기" 버튼이 `application_url`이 있는 경우 새탭으로 열린다. null인 경우 버튼이 비활성화 또는 미표시된다
11. AI 관련도 섹션이 "준비 중" 상태로 렌더링된다. 에러가 없어야 한다
12. 추천 프로그램 섹션이 현재 비교 중인 ids를 제외한 프로그램 중 최대 4개를 표시한다
13. `supabase/migrations/`에 `compare_meta JSONB` 컬럼 추가 migration이 포함된다
14. `frontend/lib/types/index.ts`의 `Program` 타입에 `compare_meta?: CompareMetaType | null`이 추가된다

# Constraints

- `/programs/page.tsx`, `/programs/[id]/page.tsx` 수정 금지 (기존 파일 건드리지 않음)
- 기존 migration 파일 수정 금지. `compare_meta` 컬럼 추가는 새 migration 파일로만
- 브라우저에서 Supabase 직접 호출 금지. 데이터는 기존 `getProgram` 및 `listPrograms` API 경유
- URL state 관리는 `router.replace` 기반으로 한다. `localStorage`나 `sessionStorage`는 사용하지 않는다
- 비교 중인 ids 파싱 시 유효하지 않은 UUID가 포함된 경우 해당 슬롯은 에러 없이 빈 슬롯으로 처리한다
- compare 페이지는 Client Component가 필요한 부분(슬롯 추가/제거 상호작용)과 Server Component(초기 데이터 페치)를 적절히 분리한다. 기존 hook + component 분리 패턴 참고
- AI 점수 기반 winner 판단 금지. winner는 `days_left` 최솟값 기준으로만 결정한다
- 폰트는 Pretendard 유지. draft의 Noto Sans KR 적용 금지

# Non-goals

- AI 관련도 실제 계산 (종합 관련도 %, 기술 스택 일치도 %)
- 로그인 사용자 프로필 기반 허들 자동 판단
- `/programs` 카드에 "비교에 추가" 버튼 추가 (별도 Task)
- `compare_meta` 데이터 실제 수집/입력 로직 (migration으로 컬럼만 추가)
- 모바일 전용 레이아웃 최적화
- 비교 결과 공유 기능

# Edge Cases

- URL ids가 0개: 3개 빈 슬롯 + 추천 프로그램 섹션 표시. 에러 없음
- URL에 존재하지 않는 UUID 포함: `getProgram` 호출 시 404 또는 null 반환 → 해당 슬롯을 빈 슬롯으로 처리
- URL에 중복 UUID 포함: 첫 번째 UUID만 사용하고 중복 제거 후 URL 정규화
- ids가 3개 초과인 URL 직접 입력: 처음 3개만 사용, 나머지 무시
- `days_left`가 동일한 프로그램이 여러 개인 경우: 슬롯에 먼저 추가된 프로그램을 winner로 판정
- `days_left`가 null인 프로그램: winner 판정에서 제외. D-day 배지 미표시
- `application_url`이 null인 경우: "지금 지원하기" 버튼 비활성화 처리 (`disabled` 속성 + 회색 스타일)
- 추천 프로그램 API 실패: 섹션 자체를 미표시 또는 "추천 프로그램을 불러올 수 없습니다" 안내. 비교 카드 렌더링은 영향받지 않음

# Open Questions

1. `compare_meta` JSONB의 필드 값 표준화 — 허들 배지 로직(pass/warn/block 분기)을 위해 값 형식을 정해야 한다. 권장 형식:
   - `coding_skill_required`: `"none"` (pass) / `"basic"` (warn) / `"required"` (block) / null (정보 없음)
   - `naeilbaeumcard_required`: `false` (pass) / `true` (warn) / null (정보 없음)
   - `portfolio_required`: `false` (pass) / `true` (warn) / null (정보 없음)
   - `employment_restriction`: `"all"` (pass) / `"employed_ok"` (pass) / `"unemployed_only"` (warn) / null (정보 없음)
   구현 러너는 이 형식을 기준으로 배지 분기 로직을 작성한다
2. winner 선정 기준 — 현재는 `days_left` 최솟값. 추후 AI 점수 기반으로 전환 예정. 코드에 주석으로 교체 지점 명시 권장

# Transport Notes

- Local execution target: `tasks/inbox/TASK-2026-04-15-1100-programs-compare.md`
- Remote fallback target: `tasks/remote/TASK-2026-04-15-1100-programs-compare.md`
- 실행 전 현재 HEAD가 `d2dc9fe36272d06812f26781c8659aad98dd6054`인지 확인한다. 다른 commit이라면 `/programs/page.tsx`, `/programs/[id]/page.tsx`, `Program` 타입, migration 목록을 실제 repo 기준으로 재검토한다
