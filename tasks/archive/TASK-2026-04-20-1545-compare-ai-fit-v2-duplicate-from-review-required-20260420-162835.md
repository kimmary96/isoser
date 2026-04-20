---
id: TASK-2026-04-20-1545-compare-ai-fit-v2
status: queued
type: "fix/update"
title: Compare 페이지 - 프로필 기준 AI 적합도 v2 도입
priority: high
planned_by: codex
planned_at: 2026-04-20T15:45:00+09:00
planned_against_commit: 3bb4aff8213e310c129d00cd81588642ed03b3c3
auto_recovery_attempts: 2
planned_files:
  - frontend/app/(landing)/compare/programs-compare-client.tsx
  - frontend/lib/api/app.ts
  - frontend/lib/types/index.ts
  - frontend/app/api/programs/compare-relevance/route.ts
  - backend/routers/programs.py
  - backend/tests/test_programs_router.py
  - docs/current-state.md
  - docs/refactoring-log.md
---

# Goal

현재 `/compare`에 이미 존재하는 `나와의 관련도` 섹션을, 사용자가 더 직접적으로 이해할 수 있는 **AI 적합도 v2**로 확장한다.

현재 기준 실제 상태:

- compare 페이지는 로그인 사용자에 한해 `POST /programs/compare-relevance`를 호출한다.
- 현재 응답은 `relevance_score`, `skill_match_score`, `matched_skills`만 포함한다.
- 계산 로직은 `profile + activities`에서 키워드를 추출해 프로그램 텍스트와 겹치는 정도를 점수화하는 규칙 기반 매칭이다.
- UI에는 이미 `★ 나와의 관련도`, `종합 관련도`, `기술 스택 일치도`, `매칭된 스킬` 섹션이 있다.
- 하단 안내 문구에도 `지원 허들 자동 판단은 후속 범위로 남겨둡니다`라고 명시돼 있다.
- 자동 복구 기준 현재 `planned_files` 범위에는 unresolved merge conflict나 conflict marker가 없고, compare relevance 관련 구현 흐름도 계속 같은 파일 경계 안에 있어 현재 `HEAD` 기준 재시도가 가능하다.

이 task는 새로운 추천 엔진을 만드는 것이 아니라, **기존 compare relevance 흐름을 재사용**하면서 사용자가 이해 가능한 적합도 설명과 지원 판단 힌트를 추가하는 작업이다.

# Why Now

- compare 기능에서 사용자가 실제로 기대하는 것은 단순 관련도보다 “나에게 얼마나 맞는지”에 대한 해석된 판단이다.
- 현재 관련도는 계산되지만, 사용자 입장에서는 숫자 2개와 태그만 보여서 행동 결정으로 이어지기 어렵다.
- compare 컬럼 정리 task 이후에는 화면 구조가 더 단순해지므로, 다음 단계로 AI 적합도 레이어를 얹기 좋은 시점이다.

# Scope

## In scope

1. 기존 `compare-relevance` 응답에 적합도 판단 필드 추가
2. compare UI에서 `나와의 관련도` 섹션을 `AI 적합도` 관점으로 재구성
3. 점수 숫자 외에 짧은 설명 문구와 추천 라벨 제공
4. 현재 운영 데이터만으로 가능한 범위의 “지원 판단 힌트” 제공
5. 테스트 및 문서 업데이트

## Out of scope

- LLM 기반 자유서술 분석 새 체인 도입
- 지원 허들 전면 자동 판정
- `compare_meta` backfill 또는 수집기 수정
- 합격률 예측 모델 도입
- compare 전체 레이아웃 리디자인
- 별도 DB 저장 테이블 추가

# Current Implementation Notes

- compare UI: `frontend/app/(landing)/compare/programs-compare-client.tsx`
- BFF: `frontend/app/api/programs/compare-relevance/route.ts`
- 앱 helper: `frontend/lib/api/app.ts`
- 타입: `frontend/lib/types/index.ts`
- backend endpoint: `POST /programs/compare-relevance`
- 핵심 키워드 매칭 로직: `backend/rag/programs_rag.py`의 `_profile_keywords`, `_program_match_context`
- 현재 `frontend/app/api/programs/compare-relevance/route.ts`는 로그인 세션 토큰을 backend `POST /programs/compare-relevance`로 그대로 전달하는 BFF 형태를 유지한다.

이 task는 위 흐름을 유지한 채, endpoint contract와 UI만 확장한다.

# User Problem

현재 compare 사용자는 아래 질문에 답을 원한다.

1. 이 프로그램이 내 프로필과 전반적으로 맞는가
2. 기술 스택만 맞는 것인지, 아니면 전체 배경과도 맞는가
3. 지금 바로 지원해도 되는지, 아니면 보완이 필요한지
4. 왜 그렇게 판단됐는지 한두 줄로 이해할 수 있는가

현재 구현은 1~2의 일부만 숫자로 보여주고, 3~4는 충분히 답하지 못한다.

# Revised Product Shape

## 기존 필드 유지

- `program_id`
- `relevance_score`
- `skill_match_score`
- `matched_skills`

## 새 필드 추가

- `fit_label`
  - 허용 값:
    - `높음`
    - `보통`
    - `낮음`
- `fit_summary`
  - 1문장 요약
  - 예:
    - `보유 기술과 활동 이력이 프로그램 내용과 전반적으로 잘 맞습니다.`
    - `기술 스택은 맞지만 현재 활동 이력 근거가 부족합니다.`
- `readiness_label`
  - 허용 값:
    - `바로 지원 추천`
    - `보완 후 지원`
    - `탐색용 확인`
- `gap_tags`
  - 최대 3개
  - 예:
    - `프로젝트 근거 보강 필요`
    - `기술 스택 근거 부족`
    - `프로필 정보 부족`

## 판단 원칙

- `fit_label`은 현재 `relevance_score`와 `skill_match_score`를 해석한 표시 계층이다.
- `readiness_label`은 법적/정책적 지원 가능 여부 판정이 아니라, **현재 프로필 정보 기준 준비도 힌트**다.
- `gap_tags`는 현재 프로필/활동 데이터가 약한 영역을 짧게 설명하는 UI 태그다.

# Decision Rules

구현 시 아래 규칙으로 고정한다.

## 1. fit_label

- `높음`
  - `relevance_score >= 0.7` 그리고 `skill_match_score >= 0.5`
- `보통`
  - `relevance_score >= 0.4` 또는 `skill_match_score >= 0.3`
- `낮음`
  - 위 조건에 해당하지 않는 경우

## 2. readiness_label

- `바로 지원 추천`
  - `fit_label == 높음`
  - 그리고 `matched_skills`가 2개 이상
- `보완 후 지원`
  - `fit_label == 보통`
  - 또는 `fit_label == 높음`이지만 `matched_skills`가 2개 미만
- `탐색용 확인`
  - `fit_label == 낮음`

## 3. gap_tags`

아래 조건을 검사해 최대 3개까지 반환한다.

- 프로필 `skills`가 비어 있으면 `프로필 기술 정보 부족`
- 공개 활동이 1개 미만이면 `활동 근거 부족`
- `matched_skills`가 비어 있으면 `기술 스택 근거 부족`
- `relevance_score < 0.4`면 `직무 연관성 근거 부족`
- `profile.self_intro`, `bio`, `career`가 모두 약하면 `프로필 정보 보강 필요`

## 4. fit_summary

LLM 없이 템플릿 조합으로 생성한다.

- `fit_label == 높음`
  - `보유 기술과 활동 이력이 프로그램 내용과 전반적으로 잘 맞습니다.`
- `fit_label == 보통`
  - `일부 기술과 경험은 맞지만, 지원 전에 근거를 조금 더 보강하는 편이 좋습니다.`
- `fit_label == 낮음`
  - `현재 프로필 정보만으로는 프로그램과의 직접 연관성이 충분히 확인되지 않습니다.`

필요하면 `gap_tags[0]`를 덧붙여 1문장으로 확장할 수 있지만, 2문장을 넘기지 않는다.

# API Contract

backend endpoint는 계속 `POST /programs/compare-relevance`를 사용한다.

response shape:

```json
{
  "items": [
    {
      "program_id": "abc",
      "relevance_score": 0.82,
      "skill_match_score": 0.67,
      "matched_skills": ["React", "TypeScript"],
      "fit_label": "높음",
      "fit_summary": "보유 기술과 활동 이력이 프로그램 내용과 전반적으로 잘 맞습니다.",
      "readiness_label": "바로 지원 추천",
      "gap_tags": ["활동 근거 부족"]
    }
  ]
}
```

# UI Requirements

compare의 기존 `★ 나와의 관련도` 섹션을 아래 방향으로 바꾼다.

1. 섹션 제목은 `★ AI 적합도`
2. 유지:
   - 상태 행
   - 종합 관련도
   - 기술 스택 일치도
   - 매칭된 스킬
3. 추가:
   - `적합도 판단`
   - `지원 준비도`
   - `AI 한줄 요약`
   - `보완 포인트`

문구 제약:

- 로그인 안 한 경우는 기존과 동일하게 `로그인 후 확인`
- 로딩 중은 `분석 중`
- 실패는 `불러오기 실패`
- `fit_summary`는 2줄 내에서 보이도록 짧게 유지

# Acceptance Criteria

1. 기존 `POST /programs/compare-relevance`는 유지되고, 새 필드가 추가된 응답을 반환한다.
2. 기존 `relevance_score`, `skill_match_score`, `matched_skills` 계약은 깨지지 않는다.
3. 새 필드 `fit_label`, `fit_summary`, `readiness_label`, `gap_tags`가 타입과 응답에 반영된다.
4. compare UI는 새 필드를 사용해 `AI 적합도` 섹션을 렌더링한다.
5. 로그인하지 않은 사용자는 기존처럼 401 기반 흐름을 유지하되, UI는 `로그인 후 확인`으로 안정적으로 표시한다.
6. 프로필 정보가 약한 사용자도 endpoint가 실패하지 않고, `낮음` 또는 `보완 후 지원` 수준으로 일관되게 응답한다.
7. LLM 호출 없이도 endpoint가 동작한다.
8. `backend/tests/test_programs_router.py` 또는 관련 테스트에 새 판단 필드 회귀가 추가된다.
9. `docs/current-state.md`와 `docs/refactoring-log.md`가 업데이트된다.

# Constraints

- 현재 구현된 `compare-relevance` 경로를 새 endpoint로 교체하지 않는다.
- 판단 로직은 deterministic해야 하며, 네트워크 의존 LLM 호출을 추가하지 않는다.
- `readiness_label`은 실제 지원 자격 보장이 아니라는 점을 UI 표현에서 과장하지 않는다.
- `compare_meta`가 비어 있어도 동작해야 한다.
- 기존 compare 페이지의 슬롯/URL state/모달/추천 카드 흐름은 건드리지 않는다.

# Duplicate / Reuse Notes

- 이 task는 새로운 추천 시스템 구현이 아니다.
- 기존 `relevance_score`, `skill_match_score`, `matched_skills` 계산을 재사용하고, 그 위에 interpretation layer를 얹는 작업이다.
- `backend/rag/programs_rag.py`의 키워드/매칭 로직은 최대한 그대로 둔다.

# Risks

- 준비도 라벨이 실제 지원 가능 여부처럼 과하게 읽힐 수 있다.
- 현재 데이터가 약한 사용자에게 `낮음`이 과도하게 많이 나올 수 있다.
- compare 컬럼 정리 task와 동시에 작업하면 UI 충돌 가능성이 있다.

따라서:

- readiness 문구는 “추천/보완” 수준으로 제한
- gap tag를 통해 왜 낮은지 설명
- compare 컬럼 정리와 write scope가 겹치면 순서를 조정

# Non-goals

- 연령/학력/고용보험/내일배움카드 등 정책성 지원 자격 자동 판정
- 맞춤형 LLM 이유 생성
- 적합도 결과 저장/히스토리화
- 대시보드 match 기능과 compare 적합도 통합

# Verification

- backend test: 기존 필드 + 새 판단 필드 응답 검증
- backend test: 프로필 약한 케이스에서도 안정 응답 검증
- frontend build/typecheck: compare UI와 타입 반영 후 빌드 통과
- 가능하면 `/compare`에서 로그인 상태 수동 확인

# Transport Notes

- 원본 packet: `cowork/packets/TASK-2026-04-20-1545-compare-ai-fit-v2.md`
- 승인 후 local 실행 사본: `tasks/inbox/TASK-2026-04-20-1545-compare-ai-fit-v2.md`

## Auto Recovery Context

- source_task: `tasks/blocked/TASK-2026-04-20-1545-compare-ai-fit-v2.md`
- failure_stage: `blocked`
- failure_report: `reports/TASK-2026-04-20-1545-compare-ai-fit-v2-blocked.md`
- recovery_report: `reports/TASK-2026-04-20-1545-compare-ai-fit-v2-recovery.md`
- reviewer_action: review the verification findings, tighten the packet if needed, and only then approve requeueing
