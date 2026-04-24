# Compare Meta Runtime Touchpoints v1

기준일: 2026-04-24  
상태: current-audit  
범위: 현재 저장소 코드 기준 `compare_meta`의 실제 생산/변환/읽기 경로와 cleanup 순서 정리

## 1. 문서 목적

이 문서는 `compare_meta`를 지금 당장 지워도 되는지, 아니면 어디에 아직 남아 있는지를 코드 기준으로 짧게 고정하는 문서다.

핵심 목적은 두 가지다.

1. `compare_meta`가 이미 정본이 아닌데도 아직 필요한 경로를 한눈에 보이게 한다.
2. 오래된 추천 체크리스트 문서와 현재 런타임 판단 기준을 분리한다.

중요:

- 이 문서는 실제 저장소 코드를 읽고 정리한 현재 audit 문서다.
- 저장소 밖 수동 SQL, 외부 리포트, 운영자 개인 스크립트까지는 확인하지 않았으므로 그 부분은 판단 범위 밖이다.

## 2. 현재 고정 판단

- `compare_meta`는 더 이상 최종 정본이 아니다.
- 하지만 아직 여러 경로에서 호환용 bridge 또는 fallback 메타로 실제 사용 중이다.
- 따라서 `compare_meta` 전체 삭제는 아직 안전하지 않다.
- 현재 cleanup 목표는 “새 정본 컬럼 우선 사용 -> 남은 fallback 경로 축소 -> 마지막 제거” 순서다.

추가 판단:

- `programs.compare_meta`는 아직 active compatibility bridge다.
- `program_list_index.compare_meta`는 최종 제거 대상이지만, 현재 일부 목록/필터/표시 fallback에 아직 남아 있다.
- 반대로 compare 선택 요약 카드나 주요 dashboard BFF 주 경로처럼 이미 `compare_meta` 의존이 제거된 곳도 있다.

## 3. 현재 실제 사용 경로

## 3.1 생산 경로

아래 파일은 아직 `compare_meta`를 만들어 낸다.

- `backend/rag/collector/program_field_mapping.py`
  - Work24, K-Startup 원천 데이터를 정규화하면서 `field_sources`, 지원 링크, 모집 정보 같은 source 메타를 `compare_meta`에 담는다.
- `backend/rag/collector/work24_detail_parser.py`
  - Work24 상세 HTML에서 만족도, 모집인원, 신청 마감, 훈련시간, 연락처 같은 상세 파생값을 `compare_meta`로 만든다.

정리:

- collector 계층은 아직 `compare_meta`를 source-specific 임시 저장소로 쓰고 있다.
- 이 단계가 먼저 바뀌지 않으면 이후 적재/읽기 경로도 한 번에 지우기 어렵다.

## 3.2 적재 / 변환 경로

아래 파일은 `compare_meta`를 읽어 canonical 필드와 provenance 필드로 옮긴다.

- `backend/routers/admin.py`
  - 관리자 sync 입력에서 들어온 `compare_meta`를 이용해 deadline 보정과 additive field seed를 만든다.
- `backend/rag/collector/scheduler.py`
  - collector 저장 배치에서 `merge_program_dual_write_fields(...)`를 거쳐 `compare_meta` 기반 additive field를 같이 만든다.
- `backend/services/program_dual_write.py`
  - 현재 `compare_meta`를 가장 많이 실제로 소비하는 bridge다.
  - `application_end_date`, `target_detail`, `eligibility_labels`, `selection_process_label`, `contact_phone`, `contact_email`, `capacity_total`, `rating_value`, `service_meta`, `field_evidence` 등을 여기서 뽑아낸다.

정리:

- 이 계층은 `compare_meta`를 그대로 화면에 보여주기 위한 곳이 아니라, 새 정본 컬럼으로 옮기는 중간 다리다.
- 따라서 지금 제거하면 additive migration 이후 구조가 다시 비게 된다.

## 3.3 backend 읽기 경로

아래 파일은 아직 실제 응답 조립이나 fallback 판정에 `compare_meta`를 쓴다.

- `backend/routers/programs.py`
  - 상세 응답 조립
    - 정본 컬럼이 있으면 먼저 쓰지만, 정원/자격/문의처/커리큘럼/지원 링크 같은 값은 여전히 `compare_meta` fallback이 남아 있다.
    - 다만 현재는 상세 builder가 direct field-by-field read 대신 공용 legacy meta helper를 먼저 거치도록 정리돼, 이후 제거 범위를 더 작게 나눌 수 있다.
  - 모집 마감 판정
    - Work24의 `traStartDate` 오판 회피 같은 보수적 deadline 판정에 `compare_meta.deadline_source` 계열을 사용한다.
  - 목록 검색/필터 fallback
    - read-model이 아닌 fallback 경로에서는 `compare_meta` 안의 training type, region, selection 메타를 검색/필터 추론에 아직 사용한다.
    - 다만 검색 텍스트 조립 helper도 이제 direct `compare_meta` 대신 공용 legacy meta helper를 먼저 거친다.
  - 지역/참여 방식 추론
    - `teaching_method`, `region`, `address`가 정본 컬럼에 없거나 비어 있을 때 `compare_meta`를 보조 근거로 쓴다.
    - 최근 cleanup으로 목록/정렬/지역 매칭은 `service_meta` 우선 + legacy bridge helper를 통하게 정리됐고, direct `compare_meta` 분산 읽기는 줄어든 상태다.
  - filter-options legacy fallback
    - browse facet snapshot을 못 쓰는 경우 `compare_meta`를 포함한 source row에서 옵션을 다시 뽑는다.

정리:

- `backend/routers/programs.py`는 이미 “정본 컬럼 우선, `compare_meta` fallback” 구조로 많이 줄었다.
- 하지만 상세/검색/필터/지역 추론 일부가 남아 있어 지금은 전면 삭제 단계가 아니다.

## 3.4 점수 / 추천 보조 경로

아래 파일도 아직 `compare_meta`를 보조 입력으로 쓴다.

- `backend/services/program_list_scoring.py`
  - 만족도 점수, 리뷰 수, 모집 마감 신뢰도는 이제 공용 legacy meta helper를 통해 `service_meta` 우선 + `compare_meta` fallback으로 읽는다.
- `backend/rag/programs_rag.py`
  - 추천 relevance 계산에서 모집 마감 해석과 일부 메타 텍스트를 보완한다.
  - 최근 cleanup으로 `_resolve_recruitment_deadline(...)`도 공용 legacy meta helper를 먼저 거치게 바뀌었다.

정리:

- 추천과 목록 점수는 이미 새 필드를 먼저 보지만, sparse row에서는 `compare_meta`가 아직 안전망 역할을 한다.

## 3.5 프런트 표시 fallback 경로

아래 파일은 사용자 화면 표시 helper에서 `compare_meta`를 마지막 fallback으로 쓴다.

- `frontend/lib/program-display.ts`
  - 신뢰 가능한 마감일 판정
  - 비용/지원 badge
  - 내일배움카드 필요 여부
  - 수업 방식
  - 평점 표시
  - 선발 키워드 추출
  - 현재는 이 helper들도 direct `program.compare_meta` 접근 대신 공용 `getLegacyProgramMeta(...)`를 통해 마지막 fallback만 읽도록 정리돼 있다.
- `frontend/lib/types/index.ts`
  - `ProgramListRow.compare_meta`
  - legacy `Program.compare_meta`

정리:

- 프런트 주 경로는 이미 summary-first로 많이 줄었지만, 표시 문구 보정 helper에는 `compare_meta` fallback이 아직 남아 있다.
- 따라서 타입에서 바로 제거하면 helper와 일부 landing/legacy consumer가 같이 깨질 수 있다.

## 4. 이미 의존이 줄어든 경로

아래는 이번 cleanup 체인에서 이미 `compare_meta` 직접 의존을 줄인 곳이다.

- `frontend/lib/types/index.ts::ProgramSelectSummary`
  - compare 선택 요약 카드는 더 이상 `compare_meta`를 들고 다니지 않는다.
- `frontend/app/api/dashboard/recommend-calendar/route.ts`
  - route 안에서 직접 `compare_meta`를 파싱하지 않고, 공용 helper 경로로 옮겼다.
- `frontend/app/api/dashboard/bookmarks/route.ts`
- `frontend/app/api/dashboard/calendar-selections/route.ts`
  - 두 BFF 모두 `program_list_index` summary read 우선 구조라 full `Program + compare_meta` 주 경로 의존이 아니다.

## 5. 오래된 추천 체크리스트와의 관계

- `docs/recommendation/program-recommendation-checklist.md`는 2026-04-16 기준 추천/스키마 감사 기록이다.
- 이 문서는 현재 정본 판단 문서가 아니다.
- 특히 아래 항목은 이미 역사 기록으로 봐야 한다.
  - `program_bookmarks`와 `bookmarks` 중 정본 확정
  - 추천 cache 컬럼 존재 여부
  - `compare_meta`가 아직 정본처럼 넓게 쓰이던 시절의 점검 항목

현재 기준 문서는 아래를 우선한다.

- `docs/current-state.md`
- `docs/specs/final-refactor-axis-map-v1.md`
- `docs/specs/program-canonical-schema-design-v1.md`
- `docs/specs/program-recommendation-backend-touchpoints-v1.md`
- `supabase/README.md`

## 6. 다음 cleanup 순서

1. collector/admin/dual-write가 `compare_meta`에서 끌어오던 값을 정본 컬럼, `service_meta`, `program_source_records.field_evidence/source_specific`로 더 옮긴다.
2. `backend/routers/programs.py`의 Work24 deadline source 판정, select string, collector/dual-write 생산 경로처럼 아직 direct `compare_meta`가 필요한 구조적 묶음을 분리해서 다시 나눈다.
3. `frontend/lib/program-display.ts`의 표시 helper에서 정본 필드가 있는 항목부터 `compare_meta` fallback을 더 줄일 수 있는지, 실제 화면 사용처 기준으로 다시 좁힌다.
4. `ProgramListRow.compare_meta`를 제거 가능한지 다시 판정한다.
5. 마지막에만 legacy `Program.compare_meta` 제거를 검토한다.

## 7. 이번 문서에서 고정하는 판단

- `compare_meta`는 “지금 당장 삭제할 레거시”가 아니라 “아직 축소 중인 호환 bridge”다.
- 삭제 후보 판단은 파일 개수보다 역할 기준으로 봐야 한다.
- 현재 가장 먼저 지워야 할 것은 `compare_meta` 그 자체가 아니라, 오래된 체크리스트가 현재 정본처럼 읽히는 문서 drift다.
