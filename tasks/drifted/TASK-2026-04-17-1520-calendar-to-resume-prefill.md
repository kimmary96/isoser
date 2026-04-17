---
id: TASK-2026-04-17-1520-calendar-to-resume-prefill
status: queued
type: feature
title: "캘린더 → 이력서 프리필 — 프로그램 선택 시 관련 활동 자동 선택 + 이력서 초안 구성"
planned_at: 2026-04-17T15:20:00+09:00
planned_against_commit: 5206453
priority: P0
planned_by: claude-pm
depends_on:
  - TASK-2026-04-17-1500-recommend-hybrid-rerank-calendar
  - TASK-2026-04-17-1510-dashboard-ai-calendar-view
---

# Goal

사업계획서 7-6항에서 정의한 **지원 서류 즉시 생성 연결**을 구현한다.

현재 `/dashboard/resume`는 빈 상태 또는 과거에 저장된 이력서 버전만 보여준다. 사업계획서가 정의한 순환 플로우("캘린더 → 프로그램 선택 → 요건 분석 → 관련 활동 자동 선택 → 이력서 초안 프리필 → PDF 생성 → 지원 → 다음 마감 캘린더") 중 **출구 단계**인 프리필이 빠져 있어, 사용자가 캘린더에서 관심 프로그램을 발견해도 다시 이력서를 처음부터 구성해야 한다.

이 Task는 다음 흐름을 연결한다:
1. 캘린더 카드(또는 추천 카드, 프로그램 상세)에서 "이력서 바로 만들기" CTA 클릭
2. `/dashboard/resume?prefill_program_id=<id>`로 이동
3. 페이지 로드 시 프로그램 요건(직무/스킬/키워드)을 분석하고, 사용자 활동 중 관련도가 높은 활동을 자동 선택
4. `target_job`, `selected_activity_ids`, `summary` 초안을 프리필한 상태로 편집 UI 진입
5. 프리필 상태임을 알리는 배너 + "프리필 되돌리기" 버튼 제공 (저장 전까지 사용자는 자유롭게 조정)

# User Flow

1. 사용자가 대시보드 캘린더 카드에서 "이력서 바로 만들기" 클릭
2. `/dashboard/resume?prefill_program_id=<program-id>`로 이동
3. 상단에 "<프로그램명> 지원용 이력서 초안을 준비했습니다" 안내 배너 노출
4. 폼에는 다음이 프리필됨
   - `target_job`: 프로그램의 직무 카테고리 또는 대표 키워드
   - `selected_activity_ids`: 프로그램 요건과 매칭된 활동 상위 N개 (N=3~5, 현재 활동 수에 따라)
   - `summary` 초안(선택): 프로그램 요건을 참고한 간단한 한 줄 요약 (없으면 빈 값)
5. 사용자가 활동 토글/추가/제거를 자유롭게 조정
6. "저장"을 누르면 일반 이력서 버전으로 저장. 이때 `source_program_id`를 함께 기록 (후속 분석용)
7. 저장 후 기존 PDF 내보내기 플로우로 자연스럽게 이어진다
8. 프리필 기능을 원치 않으면 "프리필 되돌리기" 버튼으로 빈 상태로 리셋

# UI Requirements

- 페이지 상단 배너: 프로그램명, 요건 요약(최대 2줄), "프리필 되돌리기" 링크
- 프리필 적용된 활동 카드에는 small badge "자동 선택" 표시
- 자동 선택 활동이 0건일 때는 "관련 활동이 아직 없어요. 활동을 먼저 추가해보세요" 안내 + `/dashboard/activities/new` 링크
- 쿼리 파라미터가 없을 때는 기존 이력서 편집 UI 그대로
- 잘못된 `prefill_program_id`(존재하지 않음)일 때는 배너에 "프로그램 정보를 찾지 못했어요. 수동으로 작성해주세요" + 일반 편집 모드 유지

# Acceptance Criteria

1. `/dashboard/resume?prefill_program_id=<id>` 접근 시 프리필 배너와 자동 선택 상태가 노출된다
2. `target_job`, `selected_activity_ids` 두 필드가 최소한 프리필되어 편집 UI에 반영된다
3. 프리필 소스 식별자(`source_program_id`)가 이력서 저장 payload에 포함된다
4. 관련 활동 매칭은 프로그램의 `skills` / `category` / `target` 필드와 사용자 활동의 `skills` / `description` / `title`에서 추출한 키워드 간 overlap으로 계산한다 (기존 `_program_match_context` 유사 로직 재사용 권장)
5. 자동 선택 활동 개수는 기본 3~5개, 활동 총수가 적으면 가능한 범위로 축소
6. 프리필 상태에서 사용자가 활동을 수동 토글하면 해당 활동의 "자동 선택" 배지는 제거되고, 이후 저장 시 수동 선택으로 기록
7. "프리필 되돌리기" 버튼 클릭 시 빈 상태로 초기화되고 URL의 `prefill_program_id` 파라미터가 제거된다
8. 잘못된 `prefill_program_id`에도 페이지가 500 없이 일반 편집 모드로 fallback
9. 새 BFF route는 `apiOk` / `apiError` 헬퍼 사용, 에러 형식 통일
10. 기존 이력서 저장/수정/삭제/PDF 내보내기 흐름에 회귀 없음

# Constraints

- 의존: TASK-2026-04-17-1500과 1510이 완료되어야 실제 동선이 작동한다 (본 task 자체는 1500만 강한 의존)
- 매칭 로직은 서버측에서 수행한다. Prefill 대상 활동 id는 서버가 계산해 프론트에 내려준다 (`GET /api/dashboard/resume/prefill?program_id=<id>` 형태 BFF)
- Supabase 저장 스키마 변경이 필요하면(`source_program_id` 컬럼 추가) `supabase/migrations/` 아래 새 SQL 파일 추가. 기존 마이그레이션 수정 금지
- 기존 `resumes` 테이블의 기존 row에는 영향 없음 (nullable 컬럼으로 추가)
- 브라우저 직접 Supabase 접근 금지
- 기준 문서(CLAUDE.md, AGENTS.md, docs/) 직접 수정 금지
- 실행 전 `planned_against_commit` 최신 HEAD로 교체

# Non-goals

- 자기소개서 프리필 (이력서 우선, 자소서는 별도 task)
- AI로 활동 문장을 자동 rewrite (기존 공고 기반 rewrite 재활용 아님)
- PDF 자동 생성 및 다운로드 자동화 — 사용자가 여전히 수동으로 "저장 → PDF 내보내기" 클릭
- 포트폴리오 프리필
- 저장된 프리필 이력서를 프로그램별로 자동 분류/검색 (단순 `source_program_id` 기록만)
- 로그인하지 않은 사용자 흐름 (대시보드 전제 유지)

# Edge Cases

- 사용자 활동이 0건: 프리필 불가 → 배너에서 "활동을 먼저 추가해주세요" + CTA
- 프로그램 데이터에 `skills`, `category`, `target` 전부 비어 있음: `target_job`만 프로그램 제목에서 추출하고 활동 자동 선택은 skip (배너에는 "요건 분석에 정보가 부족해요" 표시)
- 이미 저장된 이력서 편집 중에 `prefill_program_id`를 추가로 붙이는 경우: 현재 편집 중 내용 덮어쓰기 하지 않고 배너만 표시 후 "적용" 확인 버튼으로 2단계 확인
- 매칭 점수가 너무 낮은 활동(임계값 이하)만 있는 경우: 자동 선택은 하지 않고 "관련도가 낮아 자동 선택을 생략했습니다" 안내
- 동일 프로그램으로 여러 번 프리필: 매번 같은 결과를 보장할 필요 없음. 캐시 미적용
- 프로그램이 삭제/숨김 처리된 경우: 배너에서 안내 후 일반 편집 모드

# Open Questions

1. `source_program_id` 컬럼을 `resumes` 테이블에 추가할지, 별도 `resume_sources` 테이블을 만들지 — 단순성 우선으로 nullable 컬럼 권장
2. 자동 선택 활동 개수 기본값 3 vs 5 — 이력서 한 장 분량 기준으로 5 권장하되, 스코어 임계값을 두어 무리한 5개 채우기는 방지
3. 매칭 로직을 새 BFF route에서 수행할지 FastAPI로 넘길지 — 기존 `_program_match_context`가 백엔드에 있으므로 FastAPI 레이어에서 수행하고 BFF는 passthrough 권장
4. 배너 "프리필 되돌리기" 시 URL 파라미터 제거가 `router.replace`인지 `router.push`인지 — 뒤로가기에서 프리필이 복원되지 않도록 `replace` 권장

# Transport Notes

- 로컬 실행: `tasks/inbox/TASK-2026-04-17-1520-calendar-to-resume-prefill.md`
- 원격 실행: `tasks/remote/TASK-2026-04-17-1520-calendar-to-resume-prefill.md`
- 이 패킷은 `cowork/packets/` 초안이며, 1500/1510 머지 확인 후 실행 큐로 복사
