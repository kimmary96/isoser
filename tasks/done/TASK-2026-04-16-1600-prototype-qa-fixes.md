---
id: TASK-2026-04-16-1600-prototype-qa-fixes
status: queued
type: bugfix
title: 프로토타입 QA 검수 결과 — Critical/Warning 픽스
priority: high
planned_by: claude
planned_at: 2026-04-16T16:00:00+09:00
planned_against_commit: cb77836d2b61ccbaf784b9fc1188ea10fcfdab2a
---

# Goal

`cowork/drafts/` 아래 4개 프로토타입 HTML 파일(landing-A, landing-B, programs, compare-v3)에 대한 전체 QA 검수를 2026-04-16에 수행했다.
이 Task는 검수에서 발견된 **Critical · Warning 이슈를 실제 Next.js 구현에서 사전 차단**하기 위한 요구사항 명세다.

프로토타입 HTML 자체를 고치는 것이 아니라, 해당 기능이 Next.js로 구현될 때 같은 실수가 반복되지 않도록 제약과 수용 기준을 정의한다.

---

# 검수 범위 및 발견 이슈 요약

## Landing A (`isoser-landing-A.html`)

**Critical**
- 검색 인풋 필드: JavaScript 핸들러 완전 누락. 입력해도 아무 반응 없음
- 필터 칩 (전체 / 마감임박 / AI·데이터 등): onclick 핸들러 없음
- "D-day 더보기" 스타일 버튼: 클릭 이벤트 없음

**Warning**
- `grid-template-columns: repeat(3,1fr)` 고정 — 미디어 쿼리 없어 모바일에서 가로 스크롤 발생
- DOM 요소 선택 후 null 체크 없음

**Minor**
- 프로그램 카드 3개가 HTML에 하드코딩됨 (K-디지털, 청년 AI, 코드잇)
- 검색 `<input>`에 `<label>` 연결 없음

---

## Landing B (`isoser-landing-B.html`)

**Critical**
- `onDF()` 함수: Q3 직접입력 `focus` 이벤트에서 `onDF()`를 호출하는데, `onDF()` 자체가 `focus` 핸들러 → 순환 의존성 발생 가능
- 분야별 프로그램 개수: `Math.random()`으로 생성 → 새로고침마다 숫자가 바뀜. 실제 API 연동 필요

**Warning**
- `document.getElementById()` 반환값에 null 방어 없음
- Q3 직접입력 공백 문자열 제출 허용 가능성 (`.trim()` 체크 보강 필요)

**Minor**
- 진행 바(`prog-fill`)에 `role="progressbar"`, `aria-valuenow` 속성 없음

---

## Programs (`isoser-programs.html`)

**Critical**
- 사이드바 필터 선택 → 카드 목록 필터링 로직 미구현. 클릭해도 카드 변화 없음
- 정렬 버튼 (마감임박순 / 관련도순 / 최신순): onclick 핸들러 없음
- 그리드/리스트 뷰 토글 버튼: onclick 없음
- 페이지네이션 버튼 전체: onclick 없음
- 필터 초기화 버튼: onclick 없음
- 카드의 "비교에 추가" 버튼: onclick 없음

**Warning**
- `grid-template-columns: repeat(3,1fr)` + `220px` 사이드바 고정 — 미디어 쿼리 없어 좁은 화면에서 오버플로우
- 활성 필터 태그(`.active-filters`) UI가 실제 선택 상태와 연동되지 않음

**Minor**
- 카드 9개 및 필터 항목 카운트(847, 568 등)가 HTML에 하드코딩됨

---

## Compare (`isoser-compare-v3.html`)

**Critical** (모달 기능은 2026-04-16 별도 패킷으로 프로토타입에 구현 완료. Next.js 통합은 별도 Task 참조)
- 슬롯 × 삭제 버튼: onclick 미연결 → 프로토타입에서 수정 완료. Next.js 구현 시 반드시 슬롯 상태와 URL ids 동기화 필요
- AI 분석 결과 영역: 로그인 상태에 따른 표시/숨김 로직 없음
- CTA 버튼 ("지금 지원하기", "이력서 즉시 만들기") href 미연결

**Warning**
- `display: contents` 브라우저 호환성: IE, 구형 Safari에서 미지원. 폴백 검토 필요
- 허들 배지 색상만으로 의미 전달 — 색맹 사용자 대응을 위한 텍스트 레이블 병행 필요

---

# User Flow

이 Task는 단일 사용자 플로우가 없는 **구현 제약 명세** Task다.
각 페이지 구현 시 아래 항목들이 충족된 상태로 개발이 시작되어야 한다.

---

# Acceptance Criteria

## 공통 (모든 페이지)

1. 모든 버튼, 링크, 인터랙티브 요소에 실제 동작하는 핸들러가 연결되어 있다
2. `document.getElementById()` 또는 동등한 DOM 선택자 사용 시 null 반환 방어 코드가 존재한다
3. 데이터를 표시하는 숫자(카드 수, 카테고리 수 등)가 실제 API 응답 기반으로 렌더링된다
4. 주요 인터랙티브 요소(`<input>`)에 명시적 `<label>` 또는 `aria-label`이 연결되어 있다

## Landing A

5. 검색 인풋 입력 시 프로그램 목록이 실시간 또는 submit 기반으로 필터링된다
6. 필터 칩 클릭 시 해당 카테고리 기준으로 카드 목록이 갱신된다
7. 프로그램 카드가 하드코딩이 아닌 API 응답으로 렌더링된다

## Landing B

8. `onDF()` 함수와 focus 이벤트 간 순환 참조가 없다
9. 분야별 프로그램 개수가 `Math.random()`이 아닌 실제 집계값 또는 고정 상수로 표시된다
10. Q3 직접입력에서 `.trim()` 후 빈 문자열이면 다음 버튼이 비활성화된다

## Programs

11. 사이드바 필터 항목 클릭 시 카드 목록이 해당 조건으로 필터링된다
12. 정렬 버튼 클릭 시 카드 목록이 선택된 기준으로 정렬된다 (최소: 마감임박순, 최신순)
13. 페이지네이션이 실제 페이지 이동을 수행한다
14. 활성 필터 태그가 실제 선택된 필터 상태와 동기화된다 (필터 해제 시 태그도 제거)

## Compare

15. AI 관련도 섹션이 로그인 여부에 따라 다르게 렌더링된다 (비로그인: "로그인 후 확인" 표시, 로그인: 점수 또는 "준비 중" 표시)
16. "지금 지원하기" CTA가 `application_url`이 있는 경우 새탭으로 열린다
17. "이력서 즉시 만들기" CTA가 로그인 시 `/dashboard/resume`, 비로그인 시 `/login`으로 이동한다

---

# Constraints

- 이 Task는 프로토타입 HTML 파일을 수정하는 것이 아니라 **Next.js 구현 시 준수해야 할 기준**을 정의한다
- `display: contents` 사용 시 IE/구형 Safari 폴백 여부를 구현 전 팀에서 결정한다 (이소서의 지원 브라우저 정책 기준)
- 반응형 미디어 쿼리는 이 Task의 Primary Scope가 아니나, 모바일 오버플로우가 발생하는 레이아웃은 구현 시 최소한의 `overflow-x: hidden` 처리를 한다

---

# Non-goals

- 프로토타입 HTML 파일 자체 수정 (별도 판단)
- 접근성 전체 개선 (WCAG AA 레벨 준수) — 별도 Task로 분리
- 반응형 전체 레이아웃 개편 — 별도 Task로 분리
- Compare 페이지 프로그램 추가 모달 — 별도 Task (TASK-2026-04-16-1610-compare-add-program-modal) 참조

---

# Edge Cases

- Landing B: Q3에서 직접입력 탭 전환 시 이전 답변 상태가 초기화되지 않아야 한다
- Programs: 필터 중복 선택(예: 카테고리 2개 동시) 시 AND 조건인지 OR 조건인지 구현 전 정의 필요
- Programs: 필터 초기화 버튼 클릭 시 URL 파라미터도 함께 제거되어야 한다
- Compare: `application_url`이 null인 슬롯에서 "지금 지원하기" 버튼 상태 — disabled 처리 또는 미표시 여부를 기존 TASK-2026-04-15-1100 기준과 일치시킨다

---

# Open Questions

1. Landing A/B는 현재 `/programs` 또는 별도 루트에 구현될 예정인가? 구현 경로 확정 필요
2. Programs 페이지 필터: 다중 선택 시 AND/OR 중 어느 조건을 기본으로 하는가?
3. `display: contents` — 이소서 지원 브라우저 범위에 IE가 포함되는가? (포함되지 않으면 폴백 불필요)
