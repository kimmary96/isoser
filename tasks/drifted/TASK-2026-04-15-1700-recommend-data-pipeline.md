---
id: TASK-2026-04-15-1700-recommend-data-pipeline
status: queued
type: ops
title: 추천 시스템 데이터 파이프라인 검증 — admin sync 실행, 추천 API 기준선 확인
priority: high
planned_by: claude
planned_at: 2026-04-15T18:45:00+09:00
planned_against_commit: 33e49ae3d87fe9d20f60c1aee08a5389c67a0ba5
auto_recovery_attempts: 2
---

# Goal

추천 기능의 선결 조건인 데이터 파이프라인이 현재 저장소와 운영 설정 기준으로 실제 동작하는지 검증한다.

이 task는 더 이상 `.env` 작성이나 수동 SQL 추가 지시를 만드는 문서 작업이 아니다.
현재 코드와 이미 적용된 migration/env를 전제로, 로컬 backend 기준으로 다음 세 가지를 확인하는 운영 검증 task다.

1. `POST /admin/sync/programs` 실행 가능 여부
2. sync 후 `programs` 데이터가 추천 API 경로에서 읽히는지
3. `1710`이 시작할 수 있는 최소 기준선이 충족됐는지

# User Flow

이 task는 개발자/운영자 검증 작업이다.

1. 로컬 backend를 현재 코드 기준으로 정상 기동한다.
2. admin sync를 1회 실행한다.
3. 추천 API 기준 경로를 호출해 추천 결과가 비어 있지 않은지 확인한다.
4. 성공이면 `1710`이 진행 가능하다고 판단한다.
5. 실패면 정확한 런타임 blocker를 blocked report에 남긴다.

# UI Requirements

해당 없음.

# Acceptance Criteria

1. 로컬 backend가 현재 저장소 상태에서 import/runtime 오류 없이 기동된다.
2. `POST /admin/sync/programs` 호출이 가능하고, 응답에 `synced > 0` 또는 명확한 외부 blocker가 기록된다.
3. 추천 API 기준 경로인 `frontend/app/api/dashboard/recommended-programs/route.ts`가 참조하는 backend `/programs/recommend` 흐름을 검증할 수 있다.
4. `1710` 진행 여부를 막는 원인이 남아 있다면, 코드 드리프트가 아니라 구체적인 런타임 blocker로 보고된다.

# Constraints

- `.env` 파일 내용은 수정하더라도 git에 포함하지 않는다.
- 기존 migration 파일을 수정하지 않는다.
- 이미 적용된 Supabase migration과 env를 기준으로 검증한다.
- 새 schema 설계나 recommendations 캐싱 설계는 이 task 범위 밖이다.
- 성공 기준은 “추천 기능의 데이터 기반이 실제 동작 가능한지 확인”이지, 추천 품질 개선이 아니다.

# Non-goals

- `recommendations` 테이블 캐싱 레이어 구현
- 추천 점수 공식 변경
- 프론트 UI 수정
- 새 SQL 수동 작성 가이드 문서화

# Edge Cases

- `WORK24_TRAINING_AUTH_KEY` 누락: blocked 보고
- `GOOGLE_API_KEY` 또는 Chroma 초기화 실패: blocked 보고
- sync는 성공했지만 추천 결과가 비는 경우: 사용자 profile/activity 전제 부족 여부까지 같이 기록
- 외부 API rate limit 또는 Supabase 연결 문제: blocked 보고

# Open Questions

없음.

# Implementation Notes

## 현재 저장소 기준선

- admin sync 진입점: `backend/routers/admin.py`
- 추천 API 진입점: `backend/routers/programs.py`
- 프론트 추천 fetch 경로: `frontend/app/api/dashboard/recommended-programs/route.ts`
- Supabase admin 설정 로딩: `backend/utils/supabase_admin.py`
- 추천 경로는 현재 working tree 기준으로 추가 필터 파라미터와 `recommendations` 캐시 경로를 포함할 수 있다.
- 이번 검증의 기준선은 해당 확장 동작까지 포함한 현재 `/programs/recommend` 흐름이 sync 이후 실제 데이터를 읽을 수 있는지 확인하는 것이다.

## 검증 순서

1. backend import/runtime 오류를 먼저 해소한다.
2. `POST /admin/sync/programs`를 현재 env 기준으로 실행한다.
3. sync 결과를 기준으로 `/programs/recommend`가 최소 1개 이상 item을 반환할 수 있는지 확인한다.
4. 실패 시에는 drift가 아니라 운영 blocker로 기록한다.

## 1710과의 관계

- 이 task가 성공해야 `TASK-2026-04-15-1710-recommend-api-enhance`를 안전하게 진행할 수 있다.
- 이 task가 실패하면 1710은 구현보다 데이터 기반 확보가 먼저다.
