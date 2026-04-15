---
id: TASK-2026-04-15-1720-recommend-frontend
status: queued
type: feature
title: 추천 프론트엔드 완성 — 카테고리/지역 필터 UI, 추천 이유 표시, 프로필 저장 후 갱신
priority: high
planned_by: claude
planned_at: 2026-04-15T17:20:00+09:00
planned_against_commit: 750fba4f766f86739e94368afa8474e2edbdc6b4
---

# Goal

대시보드에서 유저가 카테고리나 지역을 선택하면 AI가 그에 맞는 프로그램을 추천한다. 추천 이유와 맞춤 키워드도 카드에 표시해서 왜 추천됐는지 유저가 알 수 있게 한다. 프로필이나 활동을 새로 저장하면 추천 결과가 자동 갱신된다.

선결 조건: `TASK-2026-04-15-1710-recommend-api-enhance` 완료 후 진행.

# User Flow

1. 유저가 대시보드에 진입하면 AI 맞춤 추천 카드 9개가 로딩됨.
2. 상단에 카테고리 칩(IT·컴퓨터, 디자인, 경영·마케팅 등)과 지역 칩(서울, 경기, 온라인 등)이 표시됨.
3. 칩을 클릭하면 해당 필터로 추천 결과가 갱신됨. 로딩 스피너가 카드 위치에 표시됨.
4. 각 카드에 추천 이유("React 경험과 연결되는 내용이 있어 추천합니다")와 맞춤 키워드 배지가 표시됨.
5. 프로필 또는 활동을 저장하면 추천 캐시가 무효화되고 다음 대시보드 진입 시 새 추천이 나옴.

# UI Requirements

- 카테고리 필터 칩 5개 (전체, IT·컴퓨터, 디자인, 경영·마케팅, 어학)
- 지역 필터 칩 4개 (전체, 서울, 경기, 온라인)
- 선택된 칩은 색상으로 활성 상태 표시
- 필터 변경 시 카드 영역에 로딩 스피너 표시
- 카드에 추천 이유 (2줄 이내 line-clamp)
- 카드에 맞춤 키워드 배지 최대 3개 (blue-50 배경)
- `_reason`, `_fit_keywords` 없을 때 해당 UI 요소 숨김 처리
- 필터 결과 0건이면 "해당 조건에 맞는 추천 프로그램이 없습니다" 메시지 표시
- 모바일(375px)에서 카드 1열, 필터 칩 줄바꿈 허용

# Acceptance Criteria

1. 대시보드에 카테고리 필터 칩 5개와 지역 필터 칩 4개가 표시됨.
2. 칩 선택 시 로딩 → 새 추천 카드로 교체됨.
3. 카드에 `_reason` 텍스트가 2줄 이내로 표시됨.
4. 카드에 `_fit_keywords` 배지가 최대 3개 표시됨.
5. 활동 저장 후 대시보드로 돌아오면 추천 결과가 갱신됨.
6. 기존 D-day 배지, 마감일, 관련도 표시가 그대로 유지됨.
7. 모바일(375px)에서 카드 1열, 필터 칩이 줄바꿈되어 정상 표시됨.

# Constraints

- 기존 `ProgramCard` 컴포넌트 구조를 최대한 유지. 큰 리팩터링 금지.
- 필터 칩 선택 시 `selectedDate` 캘린더 선택 상태는 초기화하지 않음.
- `_reason`, `_fit_keywords`, `_score`는 타입에만 추가하고, 없을 때 UI에서 안전하게 숨김.
- `invalidateRecommendCache`는 fire-and-forget. 실패해도 사용자에게 오류 표시 안 함.

# Non-goals

- 필터 조합 (카테고리 AND 지역 동시 선택) — 이 태스크는 단일 필터만
- 추천 결과 무한 스크롤
- 북마크와 추천의 연동

# Edge Cases

- `_reason`이 null이거나 빈 문자열이면 추천 이유 영역 숨김
- `_fit_keywords`가 빈 배열이면 키워드 배지 영역 숨김
- 필터 선택 후 추천 결과 0건이면 "해당 조건에 맞는 추천 프로그램이 없습니다" 메시지 표시
- 비로그인 상태에서 필터 선택 시 로그인 없이 최신 목록 기준으로 필터링됨

# Open Questions

없음.

# Implementation Notes

## 변경 파일

- `frontend/app/api/dashboard/recommended-programs/route.ts`
- `frontend/app/dashboard/page.tsx`
- `frontend/lib/api/app.ts`
- `frontend/lib/types/index.ts`

## 1. BFF route에 필터 파라미터 추가

파일: `frontend/app/api/dashboard/recommended-programs/route.ts`

현재 `GET` route에 query string 처리 추가. `?category=`, `?region=`, `?force_refresh=true` 파라미터를 받아 FastAPI `POST /programs/recommend` body에 전달한다.

응답에서 `program + _reason + _fit_keywords + _score`를 병합해 `items` 배열로 반환한다.

## 2. `Program` 타입에 추천 전용 필드 추가

파일: `frontend/lib/types/index.ts` — 기존 필드 유지하고 아래만 추가.

```typescript
export interface Program {
  // ... 기존 필드 유지 ...
  _reason?: string | null;
  _fit_keywords?: string[] | null;
  _score?: number | null;
}
```

## 3. `getRecommendedPrograms()` 파라미터 추가

파일: `frontend/lib/api/app.ts`

```typescript
export interface RecommendProgramsParams {
  category?: string;
  region?: string;
  forceRefresh?: boolean;
}

export async function getRecommendedPrograms(
  params?: RecommendProgramsParams
): Promise<{ programs: Program[] }> {
  const searchParams = new URLSearchParams();
  if (params?.category) searchParams.set("category", params.category);
  if (params?.region) searchParams.set("region", params.region);
  if (params?.forceRefresh) searchParams.set("force_refresh", "true");

  const query = searchParams.toString();
  const url = `/api/dashboard/recommended-programs${query ? `?${query}` : ""}`;

  return requestAppJson<{ programs: Program[] }>(
    url,
    { method: "GET" },
    "추천 프로그램을 불러오지 못했습니다."
  );
}

export async function invalidateRecommendCache(): Promise<void> {
  try {
    await getRecommendedPrograms({ forceRefresh: true });
  } catch {
    // 갱신 실패는 무시 — 다음 대시보드 진입 시 자연스럽게 갱신됨
  }
}
```

## 4. 대시보드 페이지 — 필터 UI + 추천 이유 표시

파일: `frontend/app/dashboard/page.tsx`

필터 상수 (컴포넌트 밖):

```typescript
const CATEGORY_OPTIONS = [
  { label: "전체", value: null },
  { label: "IT·컴퓨터", value: "IT" },
  { label: "디자인", value: "디자인" },
  { label: "경영·마케팅", value: "경영" },
  { label: "어학", value: "어학" },
];

const REGION_OPTIONS = [
  { label: "전체", value: null },
  { label: "서울", value: "서울" },
  { label: "경기", value: "경기" },
  { label: "온라인", value: "온라인" },
];
```

상태 추가: `selectedCategory`, `selectedRegion` (둘 다 `string | null`, 초기값 `null`)

`loadPrograms`를 `useCallback`으로 감싸 `category`, `region`, `forceRefresh` 옵션을 받도록 변경. 필터 변경 시 `useEffect`로 자동 재호출.

필터 칩 UI는 카드 그리드 위, 추천 섹션 `<h2>` 아래에 배치. 활성 칩은 `border-blue-600 bg-blue-600 text-white`, 비활성은 `border-slate-200 bg-white text-slate-600`.

`ProgramCard` 내부에 추천 키워드 배지와 추천 이유 텍스트 추가. 기존 제목·마감일·D-day 배지 블록은 건드리지 않음.

## 5. 프로필/활동 저장 후 캐시 무효화

`frontend/app/dashboard/activities/new/page.tsx` 및 프로필 저장 성공 핸들러에서:

```typescript
import { invalidateRecommendCache } from "@/lib/api/app";
// 저장 성공 후
await invalidateRecommendCache();
```

# Transport Notes

- 로컬 실행 대상: `tasks/inbox/TASK-2026-04-15-1720-recommend-frontend.md`
- 선결 조건: `TASK-2026-04-15-1710-recommend-api-enhance`
- 실행 순서: 1700 → 1710 → 1720 (순서 중요)
