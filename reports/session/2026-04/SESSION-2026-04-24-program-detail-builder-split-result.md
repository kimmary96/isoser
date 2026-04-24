# SESSION-2026-04-24-program-detail-builder-split-result

## Changed files

- `backend/services/program_detail_builder.py`
- `backend/routers/programs.py`

## Why changes were made

- `backend/routers/programs.py` 안에 상세 응답 조립 로직이 길게 남아 있어 라우터 책임이 과도했음
- 상세 응답 조립은 외부 I/O 없이 입력 row를 응답 모델로 변환하는 순수 성격이 강해 서비스 분리 경계가 명확했음

## Preserved behaviors

- `ProgramDetailResponse` 공개 응답 구조 유지
- K-Startup / Work24 일정 매핑 규칙 유지
- canonical field 우선 + sparse legacy overlay 규칙 유지
- batch detail 조회 동작 유지

## Risks / possible regressions

- detail builder는 여전히 `serialize_program_base_summary`, `resolve_program_deadline` callback에 의존하므로 이후 추가 분리 시 이 경계를 더 명확히 다듬어야 함

## Follow-up refactoring candidates

- `backend/routers/programs.py`의 recommendation/profile hash helper cluster 추가 분리
- detail builder callback 의존을 줄이기 위한 summary serializer/service boundary 재정리
