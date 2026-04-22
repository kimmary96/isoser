# 관련도 가중치 규칙 v2 (이력서/프로필 기반)

- 작성일: 2026-04-23
- 작성자: 기획 세션 (Claude)
- 상태: 초안 (cowork/drafts)
- 참조 대상: `backend/routers/programs.py`의 `compare-relevance`, `backend/rag/programs_rag.py`
- 관련 세션: 프로그램 목록 UI 개선 방향 v2 (카드 액션 제거, 찜 기반 비교, 관련도 방향 3 채택)

---

## 1. 문서 목적

이소서(Isoser)의 "내 맞춤 추천" 관련도 점수를 **실제 DB에 존재하는 사용자 필드만으로 계산**하기 위한 가중치 규칙을 정의한다. UI에서 숫자만 노출하는 것이 아니라 **근거 문구(설명 가능한 AI)**를 함께 제공하기 위한 계산 breakdown 스펙을 포함한다.

## 2. 설계 전제

### 2-1. 가용 데이터 원칙
이력서/프로필/활동에서 실제로 확보 가능한 신호만 사용한다. 존재하지 않는 필드를 가정한 가중치는 배제한다.

### 2-2. 주소 필드 추가 예정
`profiles` 테이블에 주소 관련 필드가 추가될 예정이다. 본 문서는 주소 필드 추가를 전제로 지역 매칭을 포함한다.

- 필드명은 확정 전 (예: `address`, `region`, `sido`, `sigungu` 중 택일 또는 조합)
- 주소 원문 전체가 아닌 **시/도 수준 정규화 값**을 매칭에 사용할 것을 권장
- 주소 필드 추가 전에는 해당 가중치를 다른 요소에 재분배

### 2-3. 설명 가능한 AI (XAI) 원칙
관련도 점수는 반드시 **근거 문구**와 함께 제공한다. 숫자만 노출하는 UI는 차별점이 되지 못한다.

### 2-4. 데이터 현실
스킬 필드는 사용자와 프로그램 양쪽 모두 배열 기반으로 저장된다.

- `profiles.skills`: Postgres `text[]`, 프론트 타입 `string[] | null`
- `programs.skills`: Postgres `text[]`, 프론트 타입 `string[] | string | null`, 백엔드 응답 타입 `list[str] | str | None`

다만 `programs.skills` 컬럼은 존재하지만 현재 collector normalizer에서 직접 채워지지 않는다. Work24/K-Startup 매핑(`program_field_mapping.py`)도 현재 `skills`를 반환하지 않으므로, 실운영 DB에서 `programs.skills`는 대체로 비어 있을 가능성이 크다.

현재 관련도 계산은 이 현실을 일부 보완하기 위해 `programs.skills`가 비어 있어도 `title`, `summary`, `description`, `compare_meta`를 토큰화해 매칭 후보로 사용한다. 따라서 v2 가중치 설계에서는 `programs.skills`를 정식 소스로 보되, 운영 전환 전까지는 텍스트 토큰 fallback을 필수 전제로 둔다.

## 3. 데이터 소스 인벤토리

### 3-1. 이력서/프로필에서 확보 가능한 신호

| 필드 | 저장 위치 | 관련도 활용도 |
|---|---|---|
| 스킬 | `profiles.skills`, `activities.skills` | 핵심 매칭 |
| 희망 직무 | `resumes.target_job`, `cover_letters.job_title` | 핵심 방향성 |
| 자기소개 | `profiles.bio`, `profiles.self_intro` | 키워드 추출 |
| 경력 | `profiles.career` | 직무 방향 추론 |
| 학력 | `profiles.education_history`, `profiles.education` | 전공 매칭 |
| 자격증 | `profiles.certifications` | 준비도 |
| 활동 경험 | `activities.*` | 실전 스킬 근거 |
| 거주 지역 | `profiles` (주소 필드 추가 예정) | 지역 매칭 |
| 행동 신호 | `bookmarks`, `calendar_program_selections` | 관심 패턴 |

### 3-2. 이력서에 존재하지 않는 신호 (계산 제외)

- 참여 가능 시간 선호 (풀타임/파트타임)
- 비용 조건 선호 (국비/자부담)
- 학습 기간 선호

위 항목은 **필터(유저가 명시적으로 선택)**로만 다루고 관련도 점수에는 포함하지 않는다.

## 4. 가중치 테이블

### 4-1. 최종 가중치 (주소 필드 추가 후)

| 매칭 요소 | 가중치 | 데이터 소스 | 매칭 방식 |
|---|---|---|---|
| 희망 직무 일치 | 30% | `resumes.target_job`, `cover_letters.job_title`, `profiles.bio/self_intro` | 프로그램 카테고리/제목과 키워드 매칭 |
| 보유 스킬 일치 | 25% | `profiles.skills`, `activities.skills` | 프로그램 요구 스킬과 교집합 비율 |
| 경험 도메인 일치 | 15% | `activities.title/description/type` | 프로그램 분야와 활동 분야 매칭 |
| 거주 지역 일치 | 15% | `profiles.address` (신규) | 프로그램 운영 지역과 시/도 매칭 |
| 준비도 | 10% | `certifications`, `portfolio_url`, 활동 개수, STAR 완결도 | 프로그램 난이도와 유저 준비도 fit |
| 행동 신호 | 5% | 최근 30일 `bookmarks`, `calendar_program_selections` | 북마크한 프로그램과의 카테고리 유사도 |

합계 100%.

### 4-2. 주소 필드 추가 전 임시 가중치

주소 필드가 DB에 반영되기 전에는 지역 매칭 15%를 아래와 같이 재분배한다.

| 매칭 요소 | 임시 가중치 |
|---|---|
| 희망 직무 일치 | 35% (+5) |
| 보유 스킬 일치 | 30% (+5) |
| 경험 도메인 일치 | 20% (+5) |
| 거주 지역 일치 | 0% (비활성) |
| 준비도 | 10% |
| 행동 신호 | 5% |

주소 필드 마이그레이션 완료 시 4-1 표로 전환한다.

## 5. 요소별 상세 계산 규칙

### 5-1. 희망 직무 일치 (30%)

**데이터 확보 우선순위**
1. `resumes.target_job` (가장 최근 이력서)
2. `cover_letters.job_title` (가장 최근 자소서)
3. `profiles.self_intro` (LLM으로 직무 키워드 추출)
4. `profiles.bio` (LLM으로 직무 키워드 추출)
5. 전부 없으면 이 요소는 점수에서 제외하고 나머지를 재가중

**매칭 로직**
- 목표 직무 텍스트 → 직무 카테고리 사전(AI·데이터 / IT·개발 / 디자인 / 경영·마케팅 / 창업 등)으로 정규화
- 프로그램의 카테고리/제목/요약과 매칭
- 카테고리 완전 일치: 만점
- 제목/요약 키워드 부분 일치: 부분 점수
- 무관 카테고리: 0점

**근거 문구 템플릿**
- "내 희망 직무 '{target_job}'와 일치"
- "내 관심 분야 '{category}'와 일치"

### 5-2. 보유 스킬 일치 (25%)

**프로그램 측 스킬 소스 우선순위**
1. `programs.skills` 배열 (정식 필드)
2. `programs.skills`가 비어 있으면 `title + summary + description + compare_meta` 토큰화 결과

`programs.skills`는 DB상 `text[]`이지만, 프론트 타입과 백엔드 응답 타입은 운영/레거시 응답을 방어하기 위해 `string | string[] | null`을 허용한다. 따라서 API 경계에서는 아래 케이스를 모두 안전하게 처리해야 한다.

- `string[]`: 그대로 정규화
- `string`: 쉼표, 슬래시, 공백 기반 분리 후 정규화
- `null` 또는 빈 값: 텍스트 토큰 fallback 사용

정규화 유틸 자체는 `text[]` / `string[]` 전제를 기본으로 설계할 수 있으므로 복잡도는 낮다. 복잡도는 정규화보다 **프로그램 원천 데이터에서 `programs.skills`를 얼마나 안정적으로 채우는지**에 있다.

**계산식**
```
유저 스킬 세트 = profiles.skills ∪ (모든 activities.skills, is_visible=true)
프로그램 스킬 세트 = programs.skills 우선, 없으면 title/summary/description/compare_meta 토큰 fallback

매칭률 = |교집합| / max(|프로그램 요구 스킬|, 1)
점수 = 매칭률 × 25
```

**정규화 규칙**
- 대소문자 통일 (`Python` = `python` = `PYTHON`)
- 약칭 통합 (`React.js` = `React`, `JS` = `JavaScript`)
- 공백/특수문자 제거 후 비교
- 스킬 정규화 사전을 별도 모듈로 관리 (`backend/rag/skill_normalizer.py` 신설 권장)

**근거 문구 템플릿**
- "{skill_list} {n}개 스킬 매칭"
- "요구 스킬 {total}개 중 {matched}개 보유"

### 5-3. 경험 도메인 일치 (15%)

**데이터 소스**
- `activities.type` (회사경력/프로젝트/대외활동/학생활동)
- `activities.title`, `activities.description`

**매칭 로직**
- 유저 활동에서 도메인 키워드 추출 (사전 기반 1차, LLM 보조 2차)
- 프로그램 카테고리와 교차 매칭
- 관련 활동이 여러 개면 가장 최근 활동 1~2개만 반영
- `is_visible=false` 활동은 제외

**근거 문구 템플릿**
- "내 프로젝트 '{activity_title}'와 같은 분야"
- "{domain} 관련 활동 {n}건 보유"

### 5-4. 거주 지역 일치 (15%)

**전제**
- `profiles`에 주소 관련 필드 추가 필요
- 매칭은 **시/도 수준**에서 수행 (구/동까지 세밀하게 비교하지 않음)
- 주소 원문 → 시/도 정규화 유틸 필요 (`backend/rag/region_normalizer.py` 신설 권장)

**계산 규칙**
| 상황 | 점수 |
|---|---|
| 프로그램 운영 지역과 유저 시/도 완전 일치 | 15점 |
| 인접 시/도 (수도권 내 서울-경기-인천 등) | 10점 |
| 온라인 프로그램 | 12점 (지역 무관하게 가점) |
| 혼합형 (온·오프라인) | 10점 |
| 원격지 오프라인 | 0점 |
| 유저 주소 미입력 | 요소 제외 후 재가중 |

**근거 문구 템플릿**
- "{sido} 거주 지역과 일치"
- "온라인 과정으로 지역 무관"
- "수도권 내 {sido}에서 참여 가능"

**주의**
- 주소는 민감 정보이므로 근거 문구에서 구/동 단위 노출 금지
- 시/도 단위까지만 노출

### 5-5. 준비도 (10%)

**계산 구성**

| 요소 | 배점 |
|---|---|
| 활동 3개 이상 보유 (`is_visible=true`) | 3점 |
| 포트폴리오 URL 또는 `portfolios` 테이블 엔트리 보유 | 3점 |
| 자격증 1개 이상 보유 | 2점 |
| STAR 완결 활동 1개 이상 (`star_action`, `star_result` 모두 있음) | 2점 |

**프로그램 난이도와의 fit**
- 프로그램에 난이도 메타데이터가 있다면 (초급/중급/고급)
  - 초급 프로그램: 준비도 낮을수록 가점 (역방향)
  - 중급 이상 프로그램: 준비도 높을수록 가점 (정방향)
- 난이도 메타데이터가 없다면 준비도 점수를 그대로 사용

**근거 문구 템플릿**
- "자격증 {n}개 + 활동 {m}건으로 중급 과정에 적합"
- "첫 국비 과정으로 추천"
- "STAR 작성 완료 활동 {n}건 보유"

### 5-6. 행동 신호 (5%)

**데이터 소스**
- 최근 30일 `bookmarks` 기록
- 최근 30일 `calendar_program_selections`

**계산 로직**
```
최근 행동한 프로그램 집합 → 카테고리/스킬 집합 추출
현재 프로그램 카테고리가 위 집합에 포함되면 가점
```

| 상황 | 점수 |
|---|---|
| 최근 30일 내 같은 카테고리 북마크/선택 3건 이상 | 5점 |
| 1~2건 | 3점 |
| 0건 | 0점 |

**근거 문구 템플릿**
- "최근 북마크한 {category} 과정들과 유사"
- "관심 분야 {category}에 부합"

## 6. 총점 계산 및 UI 노출 규칙

### 6-1. 총점
각 요소 점수의 합산.

### 6-2. 임계값 기반 뱃지/노출

| 점수 구간 | 뱃지 | 노출 위치 | 근거 문구 노출 수 |
|---|---|---|---|
| 80~100 | 🎯 딱 맞아요 | 맞춤 추천 상단 | 최대 3개 |
| 60~79 | ✨ 추천 | 맞춤 추천 | 최대 3개 |
| 40~59 | 💡 조건 일치 | 맞춤 추천 하단 | 최대 2개 |
| 40 미만 | - | 맞춤 추천 섹션 제외 (전체 목록에만 노출) | - |

### 6-3. 근거 문구 선별 규칙
- 점수 기여도 8점 이상인 요소만 문구 생성 후보
- 기여도 내림차순으로 상위 3개까지 노출
- 동점이면 사전 정의 우선순위 적용: 희망직무 > 스킬 > 경험 > 지역 > 준비도 > 행동

## 7. 데이터 부족 케이스 fallback

| 케이스 | 상황 | 처리 |
|---|---|---|
| A | 프로필·활동 모두 비어있음 | 맞춤 추천 섹션에 "프로필을 채우면 맞춤 추천을 받을 수 있어요" CTA. 일반 목록(마감 임박/신규/인기)으로 대체 |
| B | 직무만 있고 스킬 없음 | 직무 50% + 경험 30% + 지역 20% 로 재가중. "스킬을 추가하면 더 정확한 추천을 받을 수 있어요" 안내 |
| C | 활동만 있고 프로필 비어있음 | `activities.skills`를 `profiles.skills`로 간주. 신뢰도 낮음 표시 (뱃지에 "참고" 문구) |
| D | 주소 미입력 | 지역 가중치를 다른 요소에 재분배 (4-2 임시 가중치 적용) |
| E | 모든 요소 확보 | 정상 계산, 최고 신뢰도 |

## 8. 응답 스키마 제안

`compare-relevance` 및 `/recommend` 응답에 아래 필드를 추가한다.

```json
{
  "relevance_score": 87,
  "relevance_grade": "strong",
  "relevance_badge": "딱 맞아요",
  "matched_skills": ["Python", "React", "SQL"],
  "score_breakdown": {
    "target_job": 30,
    "skills": 25,
    "experience": 12,
    "region": 15,
    "readiness": 5,
    "signal": 0
  },
  "relevance_reasons": [
    "내 희망 직무 '풀스택 개발자'와 일치",
    "Python, React 2개 스킬 매칭",
    "서울 거주 지역과 일치"
  ]
}
```

- `relevance_grade`: `strong` / `match` / `partial` / `low` 네 단계
- `relevance_badge`: UI 노출용 한글 문구
- `score_breakdown`: 디버깅 및 향후 튜닝용 (UI 기본 비노출, 개발자 모드에서만 노출 권장)
- `relevance_reasons`: UI 근거 문구 배열, 최대 3개

## 9. 구현 단계 제안

### Phase 1: 최소 구현 (기존 `compare-relevance` 확장)
- 응답에 `relevance_reasons`, `score_breakdown`, `relevance_grade`, `relevance_badge` 추가
- 기존 로직 유지, 근거 문구 생성 로직만 신규
- 주소 필드 없는 상태의 임시 가중치 사용 (4-2)

### Phase 2: 주소 필드 마이그레이션
- `profiles` 테이블에 주소 필드 추가
- 프론트엔드 프로필 입력 폼에 주소 필드 추가
- 주소 정규화 유틸 추가 (`region_normalizer.py`)
- 가중치를 4-1 최종 테이블로 전환

### Phase 2.5: programs.skills 채우기 (collector normalizer 개선)
- Work24/K-Startup 매핑에 `skills` 추출 로직 추가
- 프로그램 제목/설명/NCS 코드/카테고리/`compare_meta`에서 스킬 키워드 추출
- 추출 결과를 `programs.skills` 배열에 저장
- 영향: 보유 스킬 일치 25% 가중치의 실효성이 비로소 확보됨

이 Phase가 빠지면 25% 가중치 항목이 실제로는 정식 스킬 필드가 아니라 `title/summary/description/compare_meta` fallback 토큰 매칭에 의존한다. 초기 추천 품질은 유지할 수 있지만, 설명 가능한 "스킬 일치" 근거의 신뢰도는 낮아진다.

### Phase 3: Feature Builder 공용화
- `backend/rag/user_features.py`에 유저 feature 추출 통합
- `backend/rag/relevance_scorer.py`에 점수 계산 통합
- `compare-relevance`와 `/recommend`가 동일 로직 공유

### Phase 4: 사용 로그 기반 튜닝
- 추천 → 북마크 전환율, 북마크 → 지원 전환율 기반으로 가중치 재조정
- A/B 테스트 단위로 가중치 변경

## 10. 열린 질문

- `profiles.skills`의 저장 형태: 확인 완료 (`text[]`, 프론트 `string[] | null`)
- `programs.skills` 별도 필드 여부: 확인 완료 (`text[]` 존재, 다만 현재 collector normalizer에서 대체로 미적재)
- 프로그램 난이도(초급/중급/고급) 메타데이터 확보 가능 여부 확인 필요
- 주소 필드의 스키마 결정 (단일 `address` 문자열 vs `sido`/`sigungu` 분리)
- 스킬 정규화 사전의 초기 버전을 어디서 얻을 것인지 (수동 작성 / 오픈소스 / LLM 생성)
- 온라인 프로그램의 지역 점수(12점 vs 15점 동등)는 사용자 선호에 따라 조정 가능

## 11. 비고

- 본 문서는 초안(draft)이며 구현 확정 전 리뷰 대상
- 실제 구현 Task Packet은 본 문서 승인 후 `cowork/packets/`에 별도 작성
- `compare-relevance` 변경 시 기존 응답 사용처(프론트엔드)와의 호환성 검토 필요
- `programs.skills`가 비어있는 운영 현실 때문에, Phase 2.5 없이는 스킬 매칭 가중치의 실효성이 낮음
