---
id: TASK-2026-04-16-1130-relevance-score-accuracy
status: draft
type: improvement
title: "관련도 점수 정확도 개선 — 순수 적합도·마감 임박도 분리 및 프로필 쿼리 정제"
planned_at: 2026-04-16
planned_against_commit: 469cd3f
priority: high
planned_by: Claude (PM)
---

# 관련도 점수 정확도 개선

## Goal

현재 대시보드 추천 프로그램과 비교 페이지의 "나와의 관련도"는 두 가지 문제를 가진다.

첫째, `final_score = semantic_score * 0.8 + urgency_score * 0.2` 공식으로 관련도와 마감 임박도를 혼합하여 표시한다. 결과적으로 유저 프로필과 거리가 있는 프로그램이더라도 마감이 임박하면 관련도가 높게 표시된다. 유저 입장에서는 "내 관련도 65%"가 진짜 적합도인지, 마감 급박도가 올린 숫자인지 알 수 없다.

둘째, 쿼리 구성 시 `name`(이름), `portfolio_url`(URL 문자열) 같은 의미 없는 텍스트가 섞여 시맨틱 검색 품질을 떨어뜨린다.

이 태스크의 목표는 두 지표를 완전히 분리하고, 프로필 쿼리에서 노이즈 필드를 제거하여 "관련도"가 실제 프로필-프로그램 의미 유사도를 나타내도록 개선하는 것이다.

비교 페이지 "나와의 관련도" 구현(`feat-compare-relevance-score.md`, commit 60da25d 기준 작성)도 같은 설계 원칙을 따르므로, 해당 스펙을 이 태스크와 함께 검토하고 현재 HEAD(`469cd3f`)와 drift 여부를 확인한 뒤 진행한다.

---

## 배경 — 현재 구현 위치

| 항목 | 파일 | 핵심 내용 |
|------|------|-----------|
| 점수 계산 (메인) | `backend/rag/programs_rag.py` L436 | `final_score = semantic_score * 0.8 + urgency_score * 0.2` |
| 점수 계산 (fallback) | `backend/rag/programs_rag.py` L315 | 동일 공식 |
| 프로필 쿼리 구성 | `backend/rag/programs_rag.py` L89 `_profile_document()` | `name`, `portfolio_url` 포함, 활동 10개 |
| fallback 키워드 | `backend/rag/programs_rag.py` L182 `_profile_keywords()` | 활동 20개, 광의 키워드 부분 일치 |
| 추천 응답 스키마 | `backend/routers/programs.py` L80 | `final_score`, `urgency_score` 반환 |
| 프론트 대시보드 | `frontend/app/api/dashboard/recommended-programs/route.ts` | `final_score`를 `%` 변환 표시 |
| 비교 페이지 스펙 | `cowork/packets/feat-compare-relevance-score.md` (uploaded) | `/programs/compare-relevance` 엔드포인트 + 키워드 교집합 방식 |

---

## User Flow

1. 유저가 대시보드를 열면 추천 프로그램 카드에 "관련도 XX%" 배지가 보인다.
2. 현재: 이 XX%는 `semantic_score * 0.8 + urgency_score * 0.2` 혼합값이다.
3. 개선 후: 카드는 "관련도 XX%"(순수 적합도)와 "D-5 마감 임박"(urgency 별도 표시)을 분리해 보여준다.
4. 유저가 비교 페이지에서 프로그램 2–3개를 비교할 때도 같은 기준(순수 관련도)으로 표시된다.
5. 관련도 점수가 실제 스킬/경력 맥락과 맞지 않는 프로그램이 상단에 올라오는 현상이 줄어든다.

---

## UI Requirements

### 대시보드 추천 카드 (캘린더 뷰 포함)

- 기존: "관련도 XX%" 배지 하나
- 변경: "관련도 XX%" 배지 + 마감 7일 이내일 때만 별도 "마감 D-N" 칩 표시
- 마감 임박 칩은 관련도 배지와 시각적으로 구분된 색상 (예: 관련도 → 파랑 계열, 마감 임박 → 주황/빨강 계열)
- urgency_score가 0이거나 마감 정보가 없는 경우 임박 칩을 표시하지 않음

### 비교 페이지 ("나와의 관련도" 섹션)

- `feat-compare-relevance-score.md` 스펙 그대로 적용 (종합 관련도 + 기술 스택 일치도 + 매칭된 스킬 태그)
- urgency를 관련도와 혼합하지 않음 — 비교 페이지 관련도는 순수 프로필-프로그램 유사도만 반영

---

## 변경 명세

### 1. `backend/rag/programs_rag.py` — `_profile_document()` 쿼리 정제

현재 포함 필드 중 제거 대상:
- `name`: 이름은 시맨틱 검색과 무관
- `portfolio_url`: URL 문자열은 임베딩 노이즈

유지 및 강조 대상 (텍스트 반복으로 가중치 부여 가능):
- `self_intro`, `bio`: 직무 관심사와 목표가 담김 → 2회 포함
- `skills`: 직무 스킬 → 2회 포함
- `career`, `education_history`, `certifications`, `languages`: 1회

활동 데이터 한도:
- 현재 10개 → 20개로 상향 (title + role + description + skills)

구현 방향 (구체적 코드 고정 없이 의도 기술):
- `_profile_document` 함수 내 `name`과 `portfolio_url` 제거
- `self_intro`와 `skills`를 두 번 포함하여 임베딩 가중치 상향
- 활동 순회 한도를 `activities[:20]`으로 조정

### 2. `backend/rag/programs_rag.py` — 점수 분리

현재 `final_score` 계산 로직 (메인 경로 L436, fallback 경로 L315):

```
# 현재
final_score = semantic_score * 0.8 + urgency_score * 0.2
```

변경 의도:
- `relevance_score` = 순수 시맨틱 유사도 (메인) 또는 키워드 교집합 정규화값 (fallback)
- `urgency_score` = 마감 임박도 (기존 공식 유지)
- `final_score` = 정렬 전용 보조 점수 (내부 사용). 유저에게 직접 노출하지 않거나, 노출 시 "정렬 기준"임을 명확히 함
- API 응답에 `relevance_score`를 별도 필드로 추가

`ProgramRecommendItem` 스키마에 `relevance_score: float | None = None` 필드 추가.

### 3. `backend/rag/programs_rag.py` — fallback 키워드 가중치 조정

현재 fallback은 `skills`, `career`, `bio`, `self_intro`를 동일 가중치로 처리.

변경 의도:
- `skills` 키워드는 프로그램 title/skills 매칭 시 가중치 1.5 적용
- `self_intro` 키워드는 가중치 1.2 적용
- 활동 한도를 `activities[:30]`으로 상향
- 단일 글자 또는 2글자 이하 한글 토큰 stopword 처리 강화

### 4. 추천 캐시 스키마 — `recommendations` 테이블

현재 저장: `similarity_score`, `urgency_score`, `final_score`
추가: `relevance_score` 컬럼 (float, nullable)

마이그레이션 파일로 컬럼 추가. 기존 행은 `relevance_score = null` (신규 추천 시 갱신됨).

### 5. 프론트엔드 — 대시보드 카드 UI

파일 위치: 추천 프로그램을 표시하는 캘린더/카드 컴포넌트 (구현 러너가 현재 파일 위치 확인)

변경 의도:
- `final_score` 대신 `relevance_score`를 "관련도 XX%" 배지에 사용
- `urgency_score`가 임계값 초과 시 (예: `>= 0.5`, 즉 마감 15일 이내) 별도 "마감 임박" 칩 표시
- `urgency_score`가 없거나 낮으면 임박 칩 미표시

### 6. 비교 페이지 관련도 구현

`feat-compare-relevance-score.md` (업로드된 파일 기준 스펙)을 그대로 구현.
단, 현재 HEAD(`469cd3f`)와 비교해 drift 여부를 먼저 점검 후 진행.

점검 항목:
- `frontend/app/(landing)/compare/programs-compare-client.tsx` L483–L493 "준비 중" 하드코딩 존재 여부
- `backend/routers/programs.py`에 `/compare-relevance` 엔드포인트 미존재 여부
- `frontend/lib/types/index.ts`에 `ProgramRelevanceItem` 타입 미존재 여부

모두 확인되면 스펙 그대로 구현. 파일이 이미 변경된 경우 해당 부분만 조정.

---

## Acceptance Criteria

1. 대시보드 추천 카드에서 "관련도 XX%" 배지의 값이 `relevance_score` (순수 적합도) 기반으로 표시된다.
2. `urgency_score`가 높은(마감 임박) 프로그램은 관련도 배지와 별개의 "마감 임박" 칩으로 표시된다.
3. `POST /programs/recommend` 응답에 `relevance_score` 필드가 포함된다.
4. `_profile_document` 쿼리에서 `name`, `portfolio_url`이 제거되었음을 코드로 확인할 수 있다.
5. 비교 페이지 "나와의 관련도" 섹션이 "준비 중" 대신 실제 점수와 바 차트를 표시한다.
6. 비로그인 상태에서 비교 페이지는 "로그인 후 확인" 배지를 표시한다.
7. TypeScript 빌드 오류 없음 (`npx tsc --noEmit`).
8. Python 타입 힌트 오류 없음 (`python -m mypy routers/programs.py --ignore-missing-imports`).

---

## Constraints

- LLM 호출 없음 — 관련도 계산은 임베딩 거리 또는 키워드 교집합으로만 처리
- 기존 `final_score` 필드와 캐시 구조를 완전히 제거하지 않음 (정렬 보조용으로 유지)
- `recommendations` 테이블 마이그레이션은 기존 마이그레이션 파일 수정 없이 새 SQL 파일로 추가
- 24시간 추천 캐시 TTL 유지 — 이번 변경으로 기존 캐시를 강제 무효화하지 않음 (신규 추천 시 자연 갱신)
- 브라우저에서 Supabase 직접 접근 없음 — 모든 데이터는 Next API Route 경유

---

## Non-goals

- 추천 알고리즘 자체의 전면 교체 (ChromaDB 시맨틱 검색 구조 유지)
- 관련도 점수 계산에 LLM 투입 (Phase 2 후보)
- 프로그램 추천 개수 변경 (상위 9개 유지)
- 유저별 추천 캐시 즉시 무효화 기능 추가 (현재 24시간 TTL 유지)
- `urgency_score` 계산 공식 변경 (`max(0, 1 - days_left/30)` 유지)

---

## Edge Cases

- `relevance_score`가 null인 캐시 행 (마이그레이션 이전 저장된 행): `final_score`를 `relevance_score`로 fallback 처리하여 기존 캐시 유효 기간 내 UI 표시 유지
- 비교 페이지에서 프로그램 슬롯이 0개인 경우: `/programs/compare-relevance` API 호출하지 않음
- 비교 페이지에서 동일 program_id가 중복 추가된 경우: 서버 측에서 dedup 후 점수 반환
- `skills` 필드가 빈 배열이거나 null인 유저: `skill_match_score = 0` 반환, 에러 없이 처리
- 활동 데이터가 없는 신규 유저: `self_intro` + `bio` + `skills` 만으로 쿼리 구성, 결과 품질 저하는 허용

---

## Open Questions

1. 정렬 기준: 추천 목록 정렬을 `final_score` (혼합값) 대신 `relevance_score` 기준으로 완전히 바꿀지, 아니면 `relevance_score` 내림차순 + `urgency_score` 보조 정렬로 바꿀지 결정 필요. 현재는 후자(유저에게 더 관련 높은 것 상단, 동점 시 마감 임박 우선)를 권장.
2. 관련도 임계값 표시: 관련도 점수가 낮은 경우 (예: 20점 미만) "분석 중" 또는 미표시로 처리할지, 낮은 점수 그대로 보여줄지. UX 관점에서는 낮은 점수를 보여주는 것이 신뢰도를 높일 수 있음.
3. 비교 페이지 drift 확인: `feat-compare-relevance-score.md`가 commit `60da25d` 기준으로 작성되었고 현재 HEAD는 `469cd3f`. 구현 러너가 실제 파일 상태 확인 후 diff 있으면 패킷 조정 필요.
