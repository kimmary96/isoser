# API_STRUCTURE

## 1. 주요 API 계층

- 브라우저 -> `frontend/app/api/*`
  - 인증 세션, 쿠키, 프론트 전용 fallback을 처리하는 BFF
- 프론트 서버/클라이언트 -> `frontend/lib/api/*`
  - 백엔드 또는 앱 BFF 호출 래퍼
- BFF -> `backend/routers/*`
  - 실제 FastAPI 엔드포인트

## 2. 프로그램 목록/검색/필터 기준

### 공통 쿼리 파라미터

- `q`
- `category`
- `category_detail`
- `scope`
- `region_detail`
- `regions`
- `sources`
- `teaching_methods`
- `cost_types`
- `participation_times`
- `targets`
- `selection_processes`
- `employment_links`
- `recruiting_only`
- `include_closed_recent`
- `sort`
- `limit`, `offset`, `cursor`

### 프론트 표준화 기준

- 프로그램 목록 계열 쿼리 조립은 `frontend/lib/api/program-query.ts::buildProgramListSearchParams(...)`를 사용
- 추천/캘린더 추천 쿼리 조립은 `buildRecommendationSearchParams(...)`를 사용
- 비교 검색 쿼리 조립은 `buildCompareSearchParams(...)`를 사용

## 3. 응답 처리 기준

- 프론트 앱 BFF 응답
  - `frontend/lib/api/route-response.ts`
  - 성공: `apiOk(...)`
  - 실패: `apiError(error, status, code)`
- 앱 클라이언트 fetch 래퍼
  - `frontend/lib/api/app.ts::requestAppJson(...)`
  - 실패 시 `error` 또는 `detail`을 우선 사용
- 백엔드 fetch 래퍼
  - `frontend/lib/api/backend.ts::requestJson(...)`
  - 연결 실패 시 백엔드 주소와 함께 명시적 에러 반환

## 4. 에러 처리 기준

- 가능하면 `error`와 `code`를 함께 반환
- 업스트림 5xx는 BFF에서 `UPSTREAM_ERROR`로 변환
- 인증/권한/입력 오류는 4xx 상태를 유지
- 네트워크 실패는 프론트 fetch 래퍼에서 사용자 이해 가능한 문장으로 정리

## 5. null / undefined / 빈 값 처리 기준

- 쿼리 조립 시 빈 문자열은 전송하지 않음
- 다중 값 배열은 비어 있으면 query에 포함하지 않음
- boolean 플래그는 `true`일 때만 query에 포함
- 숫자 파라미터는 실제 number일 때만 query에 포함

## 6. 응답 구조 변경 여부

- 이번 정리에서는 기존 백엔드 공개 응답 구조를 변경하지 않음
- 변경된 것은 내부 코드 구조와 파라미터 직렬화 방식뿐이며, 외부 계약은 유지됨

## 7. 프로그램 목록 API 예시

기준 fixture:
- `backend/tests/fixtures/program_list_api_examples.json`

### `GET /programs/list` 기본 browse 예시

요청 파라미터 예시:

```json
{
  "limit": 20,
  "offset": 0,
  "sort": "default",
  "recruiting_only": true
}
```

응답 핵심 예시:

```json
{
  "promoted_items": [
    {
      "program": {
        "id": "00000000-0000-0000-0000-000000000901",
        "title": "패스트캠퍼스 AI 실무 부트캠프",
        "source": "Fast Campus",
        "is_ad": true
      },
      "context": {
        "surface": "program_list_promoted",
        "promoted_rank": 1
      }
    }
  ],
  "items": [
    {
      "program": {
        "id": "00000000-0000-0000-0000-000000000101",
        "title": "AI 서비스 개발 취업 부트캠프",
        "category_detail": "data-ai",
        "deadline": "2026-05-20"
      },
      "context": {
        "surface": "program_list"
      }
    }
  ],
  "count": 128,
  "mode": "browse",
  "source": "read_model",
  "cache_hit": false
}
```

### `GET /programs/count` 예시

```json
{
  "count": 42
}
```

### `GET /programs/filter-options` 예시

```json
{
  "sources": [
    { "value": "kstartup", "label": "K-Startup" },
    { "value": "고용24", "label": "고용24" }
  ],
  "targets": [
    { "value": "청년", "label": "청년" }
  ]
}
```

### 고정 기준

- fixture 응답은 `backend/tests/test_program_list_api_examples.py`에서 현재 Pydantic schema로 검증
- fixture 파라미터 키는 현재 지원 계약 키 집합에 속하는지 함께 검증
