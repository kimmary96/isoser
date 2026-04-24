# SESSION-2026-04-24 Refactor Gap Audit Result

## Changed files
- `reports\session\2026-04\SESSION-2026-04-24-refactor-gap-audit-result.md`

## Why changes were made
- 초기 계획 문서와 2026-04-24 현재 저장소를 대조해 남은 필수 작업, 문서 드리프트, 선택 cleanup 후보, legacy/unused 후보를 우선순위별로 다시 정리했다.
- 패키지 0~5 체인 종료 이후 다음 리팩토링 순서를 흔들림 없이 정하기 위한 감사 기록을 남겼다.

## Preserved behaviors
- 코드, SQL, 운영 데이터는 변경하지 않았다.
- 기존 패키지 5 문서/검증 상태는 그대로 유지했다.

## Findings

### P1. 아직 바로잡아야 하는 남은 본작업

1. 프로필 UI의 "희망 직무" 입력이 아직 `bio`에 연결돼 있다.
   - 근거: `frontend/app/dashboard/profile/_components/profile-edit-modal.tsx:103-106`
   - 근거: `frontend/app/api/dashboard/profile/route.ts:243-245`, `311-312`
   - 근거: `docs/specs/program-recommendation-backend-touchpoints-v1.md:63-70`
   - 판단: 추천 정본 migration은 적용됐지만, 사용자 입력 의미 분리는 아직 끝나지 않았다.
   - 권장: UI field와 저장 payload를 `bio`와 `target_job`로 분리하고, `bio -> target_job` mirror를 제거하는 후속 refactor가 필요하다.

2. 정규화 축(D-axis)이 저장소 전체 공통 레이어로 아직 묶여 있지 않다.
   - 근거: `docs/specs/final-refactor-axis-map-v1.md:124-136`
   - 근거: `frontend/app/api/dashboard/profile/route.ts:37-90`
   - 근거: `frontend/lib/server/recommendation-profile.ts:21-43`
   - 근거: `backend/rag/recommendation_rules_seed.py:68-108`
   - 근거: `backend/routers/programs.py:98-130`, `3778-3811`
   - 판단: 지역/직무/카테고리 규칙이 여러 파일에 흩어져 있어, 추천과 검색과 비교가 장기적으로 다시 벌어질 위험이 있다.
   - 권장: 공통 normalizer 모듈로 묶되, 이번에는 region/job/category 우선으로 최소 통합하는 것이 안전하다.

3. 로드맵에 있던 cleanup migration은 아직 실제 migration 파일로 만들어지지 않았다.
   - 근거: `docs/specs/final-refactor-migration-roadmap-v1.md:264-271`
   - 근거: `supabase/migrations/20260425118000_add_program_list_sample_refresh_helper.sql`
   - 근거: `supabase/migrations/20260425119000_add_program_source_records_sample_backfill_helper.sql`
   - 판단: `20260425118000_dual_write_program_ingest.sql`, `20260425119000_cleanup_program_legacy_columns.sql`라는 이름의 migration은 없다.
   - 해석: dual write 자체는 코드로 이미 들어가 있어 "기능 누락"보다는 "로드맵과 실제 산출물 명칭 불일치"에 가깝다. 반면 legacy column cleanup migration은 실제로 아직 없다.

### P2. 다음 라운드에서 가치가 큰 구조 cleanup

4. `Program` 전환 타입과 private field가 아직 살아 있다.
   - 근거: `frontend/lib/types/index.ts:438-445`
   - 근거: `frontend/lib/types/index.ts:583-617`
   - 근거: `frontend/lib/server/program-card-summary.ts:247-269`
   - 판단: 카드 surface는 상당수 read-model로 전환됐지만, 타입 레벨에서는 아직 `ProgramCardSummary | Program` 혼합 상태다.
   - 권장: dashboard/landing에서 `ProgramCardSummary`와 `ProgramSurfaceContext`만 남기고 `Program` fallback 범위를 줄인다.

5. 추천 카드 변환 헬퍼가 legacy private field fallback에 아직 의존한다.
   - 근거: `frontend/lib/program-card-items.ts:11-16`
   - 근거: `frontend/lib/program-card-items.ts:40-47`
   - 근거: `frontend/lib/program-card-items.ts:90-125`
   - 판단: `_reason`, `_score`, `_relevance_score`, `_fit_keywords`는 이제 정본이 아니라 transition fallback이다.
   - 권장: 남은 payload producer를 정리한 뒤 fallback 분기를 제거한다.

6. backend 프로그램 응답 모델도 여전히 `ProgramListItem/ProgramRecommendItem/CalendarRecommendItem` 중심이다.
   - 근거: `backend/routers/programs.py:306-389`
   - 근거: `backend/routers/programs.py:591`, `644`, `1114`, `1127`, `3124`, `4473-4475`
   - 판단: 화면 계약 문서는 `ProgramCardSummary/ProgramListRow/ProgramDetailResponse`로 정리됐지만, 내부 serializer 계층은 아직 완전히 수렴하지 않았다.
   - 권장: 응답 모델 이름과 serializer 조립 경로를 최종 계약과 맞추는 rename/reuse cleanup이 필요하다.

7. `compare_meta` 의존이 아직 넓다.
   - 근거: `docs/specs/program-canonical-schema-design-v1.md:242-245`
   - 근거: `backend/routers/programs.py:3542-3670`
   - 근거: `backend/routers/programs.py:3778-3811`
   - 근거: `backend/routers/programs.py:4358`
   - 근거: `frontend/app/(landing)/programs/page.tsx:394-425`
   - 근거: `frontend/app/(landing)/landing-c/_program-utils.ts:72-85`, `154-160`, `220-229`
   - 근거: `frontend/lib/program-display.ts:184-186`
   - 판단: canonical/detail 필드가 생겼어도, 표시/검색/비교의 여러 fallback이 아직 `compare_meta`를 직접 읽는다.
   - 권장: 우선 landing list/landing card 유틸부터 `compare_meta` 직접 참조를 줄이는 것이 안전하다.

### P3. 문서 드리프트와 정리 필요 항목

8. `program-canonical-schema-design-v1.md` 초반 상태 설명은 현재 저장소와 어긋난다.
   - 근거: `docs/specs/program-canonical-schema-design-v1.md:21-24`
   - 판단: 현재는 `program_source_records` 테이블과 migration이 이미 존재하므로, 이 문단은 역사 기록으로 남길지 현재 사실로 갱신할지 정리가 필요하다.

9. `user-recommendation-schema-v1.md`의 일부 현재 상태 설명도 live 기준으로는 오래됐다.
   - 근거: `docs/specs/user-recommendation-schema-v1.md:25-35`
   - 근거: `docs/specs/user-recommendation-schema-v1.md:190-199`
   - 판단: 설계 문서로는 유효하지만, "현재 없음" 서술은 이제 실제 DB와 다르다.
   - 권장: "초기 설계 당시 상태"라는 표시를 붙이거나, 별도 historical note로 분리한다.

### P4. 코드 기준으로 실사용 흔적이 약한 legacy 후보

10. `public.bookmarks` 테이블은 현재 코드 참조를 찾지 못했다.
    - 근거: `supabase/SQL.md:39`
    - 근거: `supabase/SQL.md:185`
    - 근거: `backend/routers/bookmarks.py:47-49`, `78-92`, `110-113`
    - 판단: 런타임 코드는 `program_bookmarks`만 사용한다. `public.bookmarks`는 저장소 내 사용 흔적을 찾지 못했다.
    - 주의: 외부 운영 스크립트나 수동 SQL에서 쓸 가능성은 배제하지 못하므로, 현재 기준으로는 "unused 추정"이다.

11. backend `GET /bookmarks` 목록 API는 현재 caller 흔적이 약하다.
    - 근거: `backend/routers/bookmarks.py:44-70`
    - 근거: 프런트 호출은 `frontend/app/api/dashboard/bookmarks/[programId]/route.ts:18`만 확인되며 이는 mutation 경로다.
    - 판단: 현재 프런트 bookmark 목록은 BFF가 `program_bookmarks`와 `program-card-summary`를 직접 사용한다.
    - 권장: 실제 외부 caller가 없으면 GET 목록 API는 제거 또는 read-model 기준으로 축소 가능하다.

12. `frontend/lib/api/backend.ts::getProgram()`과 `ProgramListResponse`는 저장소 내 직접 사용 흔적이 없다.
    - 근거: `frontend/lib/api/backend.ts:393-400`
    - 근거: `frontend/lib/types/index.ts:946-948`
    - 판단: 검색 결과 기준 declaration만 있고 사용처를 찾지 못했다.
    - 주의: 동적 import나 외부 도구 참조 가능성은 있으므로, 삭제 전 최종 grep 재확인은 필요하다.

## Risks / possible regressions
- `bio`와 `target_job` 분리는 사용자 입력 의미가 바뀌는 작업이라, 기존 폼 데이터와 migration 순서를 잘못 잡으면 추천 입력이 비어 보일 수 있다.
- `compare_meta` 축소는 화면 누락을 만들기 쉬워서, landing/compare/detail 순으로 작은 단위로 줄여야 한다.
- `bookmarks` 같은 unused 추정 테이블/헬퍼 삭제는 외부 운영 스크립트가 있으면 깨질 수 있다.

## Follow-up refactoring candidates
- `bio`/`target_job` UI 분리와 write path 정리
- 공통 normalizer 계층 추출
- `ProgramCardRenderable` 축소와 `Program` private field 제거
- `compare_meta` 직접 참조 제거
- `GET /bookmarks` 목록 API 및 `public.bookmarks` 사용 여부 최종 판정
- declaration-only 타입/API helper 삭제

