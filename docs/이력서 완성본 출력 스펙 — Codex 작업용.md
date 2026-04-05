# 이력서 완성본 출력 스펙 — Codex 작업용

<aside>
🎯

**목적**: Coach AI가 사용자 활동 데이터를 기반으로 **이소서 레퍼런스 포트폴리오 구조의 완성본 이력서/경력기술서**를 생성하는 기능의 구현 스펙.

**작업자**: Codex (AI 코딩 에이전트)

**관련 엔드포인트**: `POST /resume/generate` (신규)

</aside>

---

## 1. 기능 개요

사용자가 Coach AI와 대화하며 입력한 **활동(activities)**들을 모아, 레퍼런스 포트폴리오 6단계 구조에 맞춰 **완성본 이력서 섹션**을 자동 생성합니다.

### 입력 → 출력 흐름

```
[사용자 활동 데이터]
  activities[] (Supabase)
  coach_sessions[] (코칭 이력)
  job_title (목표 직무)
      ↓
[Resume Generator]
  RAG context (job_keyword_patterns + star_examples)
  6단계 구조 프롬프트
  Gemini API
      ↓
[완성본 이력서 섹션]
  프로젝트별 6단계 구조 마크다운
  PDF 렌더링용 JSON
```

---

## 2. 레퍼런스 포트폴리오 6단계 출력 구조

각 프로젝트/활동이 아래 구조로 생성됩니다:

### 2-1. 출력 마크다운 템플릿

```markdown
## 프로젝트: {project_title}

{one_line_description}

- **기간**: {start_date} ~ {end_date} ({duration})
- **인원**: {team_size}인 ({role_description})
- **기술**: {tech_stack}
- **기여**:
  - {contribution_1}
  - {contribution_2}
  - {contribution_3}

### 문제 정의

**문제 1 - {problem_title_1}**

{problem_description_1}

**문제 2 - {problem_title_2}**

{problem_description_2}

### 기술적 의사결정

**의사결정 1 - {decision_title_1}**

{alternative_comparison}: {why_chosen}

**의사결정 2 - {decision_title_2}**

{alternative_comparison}: {why_chosen}

### 구현

{architecture_description}

{key_implementation_details}

### 성과

{achievement_narrative}

- **{metric_1_value}** {metric_1_label}
- **{metric_2_value}** {metric_2_label}
- **{metric_3_value}** {metric_3_label}

### 트러블슈팅 (선택)

**{trouble_title}**

{problem} → {cause} → {solution} → {result}
```

### 2-2. 출력 JSON 스키마

PDF 렌더링 및 프론트엔드용 구조화 데이터:

```tsx
interface ResumeProject {
  // 1단계: 프로젝트 개요
  project_title: string;
  one_line_description: string;
  period: {
    start: string;      // "2025-07"
    end: string;        // "2025-11"
    duration: string;   // "약 4개월"
  };
  team: {
    size: number;
    role: string;       // "풀스택 개발자"
    composition: string; // "총괄1/PM1/풀스택1/임베디드1/..."
  };
  tech_stack: string[];
  contributions: string[];

  // 2단계: 문제 정의
  problems: Array<{
    title: string;
    description: string;
    business_impact: string;
  }>;

  // 3단계: 기술적 의사결정
  decisions: Array<{
    title: string;
    alternatives: string;     // "Polling vs WebSocket"
    chosen: string;           // "WebSocket"
    rationale: string;        // 선택 근거
    expected_benefit: string; // 기대 효과
  }>;

  // 4단계: 구현
  implementation: {
    architecture_summary: string;
    key_details: string[];
  };

  // 5단계: 성과
  results: {
    narrative: string;
    metrics: Array<{
      value: string;   // "일 15,000건"
      label: string;   // "주문 지연 없이 처리"
    }>;
  };

  // 6단계: 트러블슈팅 (선택)
  troubleshooting?: {
    title: string;
    problem: string;
    cause: string;
    solution: string;
    result: string;
  };
}

interface ResumeOutput {
  job_title: string;
  user_name: string;
  generated_at: string;
  projects: ResumeProject[];
}
```

---

## 3. Gemini 시스템 프롬프트

### 3-1. 이력서 생성 프롬프트

```jsx
[System]
너는 이력서/경력기술서 작성 전문가야.
사용자가 입력한 활동 데이터를 기반으로, 아래 6단계 구조에 맞춰 프로젝트별 경력기술서를 생성해.

## 출력 구조 (반드시 모든 단계 포함)

### 1단계: 프로젝트 개요
- 프로젝트 제목 + 한줄 설명
- 기간, 인원(전체 팀 규모 + 본인 역할), 기술 스택
- 기여 요약 (bullet 3~5개)

### 2단계: 문제 정의 (2~3개)
- 각 문제는 "문제 N - {제목}" 형식
- 구체적인 기술적/비즈니스 문제 서술
- "~하는 문제가 있었다" → 비즈니스 임팩트 연결
- 예시: "기존 수동 배차 방식은 피크타임에 평균 대기 12분으로 고객 이탈과 매출 손실로 이어졌다"

### 3단계: 기술적 의사결정 (1~3개)
- 반드시 **대안 비교** 포함: "A vs B → 왜 B를 선택했는지"
- 선택 근거를 기술적으로 설명
- 예시: "PostgreSQL만으로는 매칭 속도 보장이 어려워, 실시간 연산에 적합한 Redis를 매칭 엔진 저장소로 도입했다"

### 4단계: 구현
- 아키텍처 요약 (1~2문장)
- 핵심 구현 디테일 (어떻게 만들었는지)
- 예시: "Redis Sorted Set 기반 매칭 엔진을 설계하여 반경·대기시간·완료율 기준으로 자동 매칭 구조를 구현했다"

### 5단계: 성과 (정량 수치 3개 이상 필수)
- 성과 서술문 + bullet형 수치
- 숫자는 볼드 처리: **2,000명**, **4.7/5**, **89%**
- 기술 성과 → 비즈니스 가치 연결
- 예시: "매칭 시간 75% 단축 → 배달 완료율 94% → 재주문율 38% 증가"

### 6단계: 트러블슈팅 (선택, 있으면 포함)
- 문제 → 원인 분석 → 해결 방법 → 결과
- 예시: "커넥션 풀 고갈 → 동적 스케일링 도입 → 동시접속 3배 안정 처리"

## 작성 원칙
1. **현실어 우선** — NCS 표준 용어 대신 실제 이력서/채용 공고에서 쓰는 표현
2. **정량화 필수** — 모든 프로젝트에 숫자 3개 이상 (명, %, 배, 시간, 건)
3. **대안 비교 필수** — 기술 선택 시 반드시 "A vs B → 왜 B" 구조
4. **과장 금지** — 실제 데이터 기반. 없는 수치를 만들지 않음
5. **역할 명확화** — 팀 프로젝트 시 전체 인원과 본인 역할 반드시 명시
6. **한 문장 = 한 메시지** — 복합 문장 지양

## 부족 데이터 처리
- 정량 수치가 없는 경우: "[수치 보완 필요]" 플레이스홀더 삽입
- 문제 정의가 부족한 경우: 기여 내용에서 역추론하여 초안 생성 + "[검토 필요]" 태그
- 기술 선택 근거가 없는 경우: 일반적 근거로 초안 + "[본인 경험으로 수정 필요]" 태그
```

### 3-2. 활동 데이터 → 프롬프트 주입 포맷

```
[User Activities]

--- 프로젝트 {i} ---
제목: {activity.title}
직무: {activity.job_title}
섹션: {activity.section_type}  // 회사경력/프로젝트/대외활동/학생활동
설명: {activity.description}
코칭 이력:
  - 피드백: {session.feedback}
  - 선택한 suggestion: {session.selected_suggestion}
  - 반복 횟수: {session.iteration_count}
RAG 컨텍스트:
  - 직무 패턴: {rag.job_keyword_patterns_top3}
  - STAR 예시: {rag.star_examples_top3}

---

목표 직무: {user.target_job_title}
```

---

## 4. 구현 스펙

### 4-1. 엔드포인트

```python
# backend/routers/resume.py

@router.post("/resume/generate")
async def generate_resume(
    request: ResumeGenerateRequest,
    user: User = Depends(get_current_user)
) -> ResumeGenerateResponse:
    """
    사용자의 활동 데이터를 기반으로 6단계 구조 이력서를 생성합니다.
    
    1. Supabase에서 사용자 activities + coach_sessions 조회
    2. 각 activity별 RAG context 수집 (job_keyword_patterns + star_examples)
    3. Gemini에 시스템 프롬프트 + 활동 데이터 전달
    4. 구조화된 JSON + 마크다운 이력서 반환
    """
    pass
```

### 4-2. Request / Response

```python
# backend/rag/schema.py 에 추가

class ResumeGenerateRequest(BaseModel):
    activity_ids: list[str] | None = None  # None이면 전체 활동
    target_job_title: str
    include_troubleshooting: bool = True
    output_format: Literal["json", "markdown", "both"] = "both"

class ResumeProjectOutput(BaseModel):
    project_title: str
    one_line_description: str
    period: dict  # {start, end, duration}
    team: dict    # {size, role, composition}
    tech_stack: list[str]
    contributions: list[str]
    problems: list[dict]      # [{title, description, business_impact}]
    decisions: list[dict]     # [{title, alternatives, chosen, rationale}]
    implementation: dict      # {architecture_summary, key_details[]}
    results: dict             # {narrative, metrics[{value, label}]}
    troubleshooting: dict | None = None
    review_tags: list[str] = []  # ["수치 보완 필요", "검토 필요"] 등

class ResumeGenerateResponse(BaseModel):
    job_title: str
    user_name: str
    generated_at: str
    projects: list[ResumeProjectOutput]
    markdown: str | None = None  # output_format이 markdown 또는 both일 때
```

### 4-3. 처리 파이프라인

```python
# backend/chains/resume_generator.py (신규)

async def generate_resume_pipeline(
    user_id: str,
    activity_ids: list[str] | None,
    target_job_title: str,
    include_troubleshooting: bool = True
) -> ResumeGenerateResponse:
    """
    파이프라인:
    1. fetch_activities(user_id, activity_ids)
       → Supabase activities 테이블에서 조회
    
    2. fetch_coach_sessions(user_id, activity_ids)
       → 각 활동별 코칭 이력 (피드백, 선택한 suggestion 등)
    
    3. for each activity:
       a. get_rag_context(activity, target_job_title)
          → ChromaDB에서 job_keyword_patterns top-3 + star_examples top-3
       b. build_activity_prompt(activity, sessions, rag_context)
          → 활동 데이터 + 코칭 이력 + RAG를 프롬프트 포맷으로 조립
    
    4. build_system_prompt(include_troubleshooting)
       → 3-1 시스템 프롬프트 로드
    
    5. call_gemini(system_prompt, user_prompt)
       → 구조화 출력 (JSON mode)
    
    6. parse_and_validate(gemini_response)
       → ResumeProjectOutput[] 파싱 + review_tags 자동 태깅
    
    7. generate_markdown(projects)
       → 2-1 마크다운 템플릿으로 렌더링
    
    8. return ResumeGenerateResponse
    """
    pass
```

---

## 5. 프론트엔드 연동 포인트

### 5-1. 이력서 미리보기 화면

```
[이력서 생성 버튼] → POST /resume/generate
     ↓
[미리보기 화면]
  - 마크다운 렌더링 (프로젝트별 섹션)
  - [수치 보완 필요] 태그 → 노란색 하이라이트
  - [검토 필요] 태그 → 주황색 하이라이트
  - 각 섹션 개별 편집 가능
     ↓
[PDF 다운로드] → @react-pdf/renderer로 렌더링
```

### 5-2. review_tags 처리

| **태그** | **의미** | **UI 처리** |
| --- | --- | --- |
| `[수치 보완 필요]` | 정량 데이터가 없어 플레이스홀더 삽입됨 | 노란색 하이라이트 + 입력 유도 tooltip |
| `[검토 필요]` | AI가 역추론한 내용이라 본인 확인 필요 | 주황색 하이라이트 + "본인 경험으로 수정해주세요" 안내 |
| `[본인 경험으로 수정 필요]` | 일반적 근거로 작성된 기술 선택 근거 | 녹색 하이라이트 + 편집 모드 자동 활성화 |

---

## 6. Codex 작업 체크리스트

<aside>
🤖

아래 순서대로 구현하세요. 각 단계의 테스트까지 완료 후 다음으로 넘어갑니다.

</aside>

- [ ]  **Step 1**: `backend/rag/schema.py`에 `ResumeGenerateRequest`, `ResumeProjectOutput`, `ResumeGenerateResponse` Pydantic 모델 추가
- [ ]  **Step 2**: `backend/chains/resume_generator.py` 생성 — 파이프라인 골격 구현
    - `fetch_activities()` → Supabase 조회
    - `fetch_coach_sessions()` → 코칭 이력 조회
    - `get_rag_context()` → ChromaDB 검색
    - `build_activity_prompt()` → 프롬프트 조립
    - `build_system_prompt()` → 시스템 프롬프트 로드
- [ ]  **Step 3**: `backend/chains/resume_generator.py` — Gemini 호출 + 파싱
    - `call_gemini()` → JSON mode로 호출
    - `parse_and_validate()` → 응답 파싱 + `review_tags` 자동 태깅
    - `generate_markdown()` → 마크다운 렌더링
- [ ]  **Step 4**: `backend/routers/resume.py` 생성 — `POST /resume/generate` 엔드포인트
    - 인증 (Supabase JWT)
    - 요청 검증
    - 파이프라인 호출
    - 응답 반환
- [ ]  **Step 5**: 테스트
    - 활동 2개 이상 → 프로젝트별 6단계 구조 생성 확인
    - 정량 수치 없는 활동 → `[수치 보완 필요]` 태그 삽입 확인
    - Gemini 실패 시 에러 핸들링 확인
    - 마크다운 출력 형식 검증

---

## 7. 레퍼런스 출력 예시

아래는 가상 프로젝트를 기준으로 한 **이상적인 출력 예시**입니다:

- 📎 이소서 레퍼런스 — 이상적인 출력 예시
    
    ### 프로젝트: 실시간 배달 매칭 플랫폼 (FoodRunner)
    
    주문-라이더 실시간 매칭 및 배달 추적 플랫폼
    
    - **기간**: 2025.03 ~ 2025.07 (약 4개월)
    - **인원**: 5인 (PM 1 / 백엔드 2 / 프론트엔드 1 / 디자이너 1) — **백엔드 개발자로 참여**
    - **기술**: Python, FastAPI, Redis, PostgreSQL, WebSocket, Docker, AWS
    - **기여**:
        - Redis 기반 실시간 매칭 엔진 설계 및 구현
        - WebSocket 통신을 통한 라이더 위치 추적 및 주문 상태 실시간 동기화
        - FastAPI 기반 주문/배달 관리 API 구현
        - PostgreSQL 기반 배달 이력 및 통계 데이터 파이프라인 구축
    
    **문제 1 — 수동 배차로 인한 대기 시간 문제**
    
    기존 시스템은 운영자가 수동으로 주문을 라이더에게 배정하는 방식이었습니다. 피크타임에는 평균 대기 시간이 12분으로 늘어나고, 주문 누락이 발생하여 고객 불만과 매출 손실로 이어졌습니다.
    
    **문제 2 — 모놀리식 구조의 확장성 한계**
    
    초기에는 단일 서버에서 주문 접수부터 매칭, 알림까지 모두 처리했습니다. 주문 급증 시 서버 응답 지연이 발생하고, 매칭 로직과 알림 전송이 동기적으로 연결되어 병목이 불가피했습니다.
    
    **의사결정 1 — 실시간 통신 방식 (Polling vs WebSocket)**
    
    기존 Polling 방식은 1초 간격 재요청으로 서버 부하가 높고 실시간성이 떨어졌습니다. WebSocket 기반 양방향 통신을 도입하여 라이더 위치 업데이트와 주문 상태 동기화를 지연 없이 처리할 수 있도록 했습니다.
    
    **의사결정 2 — 매칭 엔진 데이터 저장소 (PostgreSQL vs Redis)**
    
    매칭 로직은 초단위 속도가 필요하여 PostgreSQL만으로는 응답 시간 보장이 어려웠습니다. Redis를 매칭 엔진의 핵심 데이터 저장소로 채택하고, 확정된 매칭 결과만 PostgreSQL에 영구 저장하는 구조로 설계했습니다.
    
    **구현**
    
    Redis Sorted Set을 활용한 매칭 엔진을 설계하여, 주문 접수 시 반경·대기 시간·완료율 기반으로 최적의 라이더를 자동 매칭하는 구조를 구현했습니다. WebSocket을 통해 라이더에게 실시간 주문 알림을 전송하고, 고객에게는 배달 진행 상태를 실시간으로 표시했습니다.
    
    **성과**
    
    Redis 기반 매칭 엔진과 WebSocket 실시간 통신 도입으로 피크타임에도 안정적으로 운영했습니다.
    
    - **일 15,000건** 주문 지연 없이 처리
    - **매칭 시간 75% 단축** (12초 → 3초)
    - **배달 완료율 94%** 달성
    - **피크타임 장애 0건** 운영

---

## 8. 주의사항

<aside>
⚠️

1. **과장 금지** — 사용자가 입력하지 않은 수치를 AI가 만들어내면 안 됨. 없으면 `[수치 보완 필요]`
2. **구조 일관성** — 모든 프로젝트가 6단계 구조를 반드시 따라야 함. 빈 섹션은 플레이스홀더로 채움
3. **코칭 이력 활용** — `coach_sessions`의 피드백과 선택된 suggestion을 반영하여 품질 향상
4. **review_tags 자동 태깅** — AI가 추론한 부분에는 반드시 태그를 붙여 사용자 검토 유도
5. **Gemini fallback** — API 실패 시 기본 템플릿 + 사용자 원문만으로 최소 출력 생성
</aside>