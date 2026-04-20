# 현재 개발 상황 점검 보고서

- 작성일: 2026-04-20
- 기준 저장소: `D:\02_2025_AI_Lab\isoser`
- 점검 범위:
  - frontend / backend 주요 라우트와 화면
  - 최근 작업 문서(`docs/current-state.md`, `docs/refactoring-log.md`, `README.md`)
  - 기본 검증 명령

## 1. 이번 점검에서 확인한 사실

- 프론트엔드는 production build 기준으로 정상 빌드된다.
- 공개 랜딩/프로그램 허브/비교 페이지와 대시보드 주요 화면은 코드상 존재한다.
- watcher / cowork watcher / Slack review 자동화 흐름은 문서와 코드 양쪽에 반영되어 있다.
- 백엔드는 기능 코드가 넓게 구현되어 있으나, 현재 로컬 `backend/venv`가 깨져 있어 전체 테스트 재검증이 막혀 있다.
- 일부 화면은 라우트만 있고 실제 기능은 placeholder 수준이다.

## 2. 되는 기능 체크

### 공개 사용자 기능
- [x] 루트에서 `/landing-a`로 리다이렉트
- [x] 랜딩 A / 랜딩 B 노출
- [x] 프로그램 목록 페이지
- [x] 프로그램 상세 페이지
- [x] 프로그램 비교 페이지
- [x] 프로그램 검색 / 카테고리 / 지역 / 모집중 필터 / 정렬 / 페이지네이션

### 로그인 사용자 기능
- [x] 대시보드 홈
- [x] 프로필 조회/수정
- [x] 활동 목록 / 상세 / 신규 작성
- [x] 자기소개서 목록 / 상세
- [x] 이력서 편집
- [x] 이력서 export 페이지
- [x] 추천 프로그램 캘린더 섹션
- [x] 북마크/추천/이력서 prefill용 BFF route

### 운영/자동화 기능
- [x] watcher / cowork watcher 구조 존재
- [x] Slack review interactivity 프록시 route 존재
- [x] task packet / reports / docs 운영 문서 존재

## 3. 안 되는 기능 또는 미완 기능 체크

### 실제 미완 또는 placeholder
- [ ] `frontend/app/dashboard/coach/page.tsx`
  - placeholder 한 줄은 제거됨
  - 현재는 실제 코칭 진입점(활동/자기소개서/매치)으로 안내하는 상태 페이지
  - 통합 코칭 대시보드 자체는 아직 없음
- [ ] `frontend/app/dashboard/portfolio/page.tsx`
  - 정식 포트폴리오 저장/편집 화면이 아니라 sessionStorage 기반 preview 중심
  - preview 데이터가 없을 때도 상태 안내와 진입 경로 안내는 제공하지만, 독립 문서 기능은 아직 없음

### 검증 불가 또는 환경 이슈
- [x] 백엔드 전체 pytest 재검증
  - `backend/venv/Scripts/python.exe`로 직접 재실행 확인
  - 결과: `208 passed, 3 skipped, 7 warnings in 16.49s`
  - 결론: 현재 워크스페이스 기준으로는 backend venv가 실제로 동작하며, 직전 차단은 일시적 실행 환경 문제로 본다

### 구현 완성도 주의 영역
- [ ] `backend/rag/source_adapters/work24_job_support.py`
  - 코드상 TODO가 남아 있어 완성 기능으로 보기 어려움

## 4. 이번 점검에서 실제로 잡은 문제

### 4-1. 테스트 수집 중단 버그 수정
- 대상 파일: `backend/tests/test_know_survey.py`
- 문제:
  - 저장소에 포함되지 않은 KNOW 원본 코드북/원자료 파일을 import 시점에 강제로 찾다가
  - 파일이 없으면 `StopIteration`으로 전체 pytest 수집이 중단됨
- 조치:
  - optional 탐색으로 바꾸고, 원본 파일이 없으면 관련 테스트만 skip하도록 수정
- 효과:
  - 외부 대용량 원본 자료가 없는 일반 개발 환경에서도 전체 테스트 수집이 덜 깨짐

### 4-2. 프론트 standalone 타입체크 거짓 실패 수정
- 대상 파일: `frontend/tsconfig.codex-check.json`
- 문제:
  - `.next/types` stale artifact를 직접 포함해서 `npx tsc -p tsconfig.codex-check.json --noEmit`가 거짓 실패함
- 조치:
  - standalone 타입체크 설정에서 `.next` 의존을 제외
- 효과:
  - 별도 타입체크 명령이 실제 소스 기준으로 동작함

### 4-3. job posting rewrite fallback 비동기 경고 수정
- 대상 파일:
  - `backend/chains/job_posting_rewrite_chain.py`
  - `backend/tests/test_job_posting_rewrite_chain.py`
- 문제:
  - LLM fallback 테스트에서 `coroutine was never awaited` RuntimeWarning이 발생함
- 조치:
  - LLM `ainvoke()` 호출을 직접 `wait_for()`에 넘기지 않고 별도 task로 감싼 뒤 cancel/cleanup까지 정리하는 helper로 변경
  - 회귀 방지를 위해 fallback 테스트에서 unawaited coroutine warning이 다시 생기지 않는지 검증 추가
- 효과:
  - backend 전체 테스트 warning 1건 감소
  - fallback 경로의 비동기 정리 안정성 향상

### 4-4. coach / portfolio 노출 정리
- 대상 파일:
  - `frontend/app/dashboard/layout.tsx`
  - `frontend/app/dashboard/coach/page.tsx`
  - `frontend/app/dashboard/portfolio/page.tsx`
- 문제:
  - 대시보드 사이드바에 실제 완성도보다 과하게 노출된 메뉴가 있었고
  - 개별 페이지는 placeholder 또는 내부 preview 전용 용도에 비해 사용자 기대치를 과도하게 높였다
- 조치:
  - 사이드바에서 `포트폴리오`, `코치 이력서 첨삭` 직접 메뉴를 제거
  - `coach` 페이지는 실제 사용 가능한 코칭 진입점 안내 페이지로 전환
  - `portfolio` 페이지는 preview 전용 성격과 현재 제약을 명시하는 상태 페이지로 보강
- 효과:
  - 미완 기능을 메인 탐색에서 과노출하지 않게 됨
  - 직접 진입 시에도 사용 가능한 대체 경로와 현재 제약을 명확히 설명함

## 5. 실행한 검증

### 성공
- `frontend`: `npx tsc -p tsconfig.codex-check.json --noEmit`
- `frontend`: `npm run build`

### 백엔드
- 저장소 루트: `backend\venv\Scripts\python.exe -m pytest backend/tests tests -q`
  - 결과: `208 passed, 3 skipped, 6 warnings in 16.15s`
  - skip 사유:
    - 저장소에 포함되지 않는 KNOW 원본 파일 의존 테스트
  - warning 메모:
    - Python 3.10 EOL 관련 `google.api_core` FutureWarning
    - PyMuPDF/Swig 계열 DeprecationWarning

## 6. 앞으로 구현할 것 체크리스트

### 우선순위 높음
- [ ] `/dashboard/coach`를 통합 코칭 허브로 만들지, 현재 안내형 상태 페이지로 유지할지 제품 결정
- [ ] `/dashboard/portfolio`를 정식 문서 저장/편집 기능으로 확장할지, preview 전용으로 유지할지 결정

### 우선순위 중간
- [ ] `README.md`의 현재 상태 설명을 실제 2026-04-20 코드 기준으로 갱신
- [ ] `work24_job_support` TODO 영역의 실제 API 확정 여부 점검
- [ ] 프론트 검증 기준을 CI에서 `build + codex-check`로 고정

### 우선순위 낮음
- [ ] placeholder 화면 목록을 문서로 따로 관리
- [ ] 기능별 smoke test 목록 정리
- [ ] 운영 문서와 README 중복 설명 축소

## 7. 지금 필요한 리팩토링 / 버그 정리

### 바로 필요한 것
- 외부 의존 warning 정리 계획 수립
  - 현재 남은 warning은 Python 3.10 지원 종료 예고와 PyMuPDF/Swig 계열 DeprecationWarning이다.

### 리팩토링 후보
- README 최신화
  - 현재 문서가 실제 구현보다 뒤처진 부분이 있다.
- 검증 경로 명확화
  - 프론트는 `build`와 `codex-check`, 백엔드는 `pytest`를 공식 기준으로 문서화할 필요가 있다.
- 상태 문서 단일화
  - `README`, `docs/current-state.md`, 개별 결과 보고서 간 중복이 커지고 있어 기준 문서 역할을 더 명확히 나눌 필요가 있다.

## 8. 현재 판단 요약

- 프론트는 빌드 기준으로 운영 가능한 수준에 가깝다.
- 백엔드는 현재 기준으로 전체 테스트가 통과한다.
- 사용자에게 노출되는 미완 기능 중 `coach`, `portfolio`는 과노출을 줄이고 현재 제약을 설명하는 상태로 정리했다.
- 이번 점검에서 즉시 수정 가능한 검증 안정성 이슈 2건은 반영 완료했고, 백엔드 테스트 재검증까지 끝났다.
