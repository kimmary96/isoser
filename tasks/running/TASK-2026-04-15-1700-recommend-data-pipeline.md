---
id: TASK-2026-04-15-1700-recommend-data-pipeline
status: queued
type: feature
title: 추천 시스템 데이터 파이프라인 연결 — env 설정, 마이그레이션 적용, 초기 데이터 수집
priority: high
planned_by: claude
planned_at: 2026-04-15T17:00:00+09:00
planned_against_commit: 750fba4f766f86739e94368afa8474e2edbdc6b4
---

# Goal

추천 시스템이 실제로 동작하려면 Supabase `programs` 테이블과 ChromaDB `programs` 컬렉션에 데이터가 있어야 한다. 현재 `backend/.env`에 `SUPABASE_SERVICE_ROLE_KEY`가 비어 있어서 admin sync API 자체가 실패하는 상태다. 이 태스크는 추천 기능 전체의 선결 조건이다.

# User Flow

이 태스크는 개발자/운영자 작업이다. 사용자 대면 흐름은 없음.

1. `backend/.env`에 환경변수 추가
2. Supabase SQL Editor에서 마이그레이션 SQL 실행
3. 로컬 백엔드 서버 실행 후 admin sync API 호출
4. 대시보드 로그인 후 추천 카드 노출 확인

# UI Requirements

해당 없음. 이 태스크는 인프라/데이터 파이프라인 작업.

# Acceptance Criteria

1. `backend/.env`에 `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_SECRET_KEY` 추가됨.
2. Supabase `recommendations` 테이블이 존재하고 RLS 정책이 적용됨.
3. `programs` 테이블에 `hrd_id`, `source`, `start_date`, `end_date`, `deadline` 컬럼이 존재함.
4. `POST /admin/sync/programs` 호출 시 `synced > 0` 응답 반환.
5. 대시보드 로그인 상태에서 추천 카드가 1개 이상 노출됨.

# Constraints

- `.env` 파일은 절대 git commit하지 않는다. `.gitignore`에 이미 포함되어 있음.
- `SUPABASE_SERVICE_ROLE_KEY`는 서버에서만 사용. 프론트 코드에 절대 노출 금지.
- Supabase SQL은 기존 마이그레이션 파일을 수정하지 않고, 필요하면 새 파일로 추가.

# Non-goals

- 추천 알고리즘 변경
- 프론트엔드 UI 변경
- 자동 스케줄링 (수동 호출로 충분)

# Edge Cases

- Work24 API가 응답 없을 경우: `chroma_synced: 0`으로 종료. Supabase에는 이전 데이터가 유지됨.
- `hrd_id` 중복 시: `on_conflict` 처리로 upsert됨. 기존 row 덮어씀.
- ChromaDB ephemeral 모드: 서버 재시작 시 데이터 초기화. admin sync 재실행 필요.

# Open Questions

없음.

# Implementation Notes

## 1. `backend/.env`에 환경변수 추가

현재 `backend/.env`에 아래 두 줄이 빠져 있다. 추가한다.

```
SUPABASE_URL=https://irvuoqseofydrcplrfti.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<Supabase 대시보드 → Project Settings → API → service_role 키 복사>
ADMIN_SECRET_KEY=<임의 비밀 문자열, 예: isoser-admin-2026>
```

- `SUPABASE_URL`은 `frontend/.env.local`의 `NEXT_PUBLIC_SUPABASE_URL`과 동일한 값.
- `SUPABASE_SERVICE_ROLE_KEY`는 Supabase 대시보드에서 직접 복사.
- `ADMIN_SECRET_KEY`는 admin sync 엔드포인트 보호용. 임의 문자열 설정.

## 2. `recommendations` 테이블 Supabase에 적용

`supabase/migrations/20260415_create_recommendations.sql` 내용을 Supabase SQL Editor에서 실행한다.

```sql
CREATE TABLE IF NOT EXISTS recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
  similarity_score FLOAT DEFAULT 0,
  urgency_score FLOAT DEFAULT 0,
  final_score FLOAT DEFAULT 0,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT recommendations_unique UNIQUE (user_id, program_id)
);
```

RLS 정책도 아래 SQL로 추가한다 (같은 SQL Editor에서 이어서 실행):

```sql
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recommendations_select_own" ON recommendations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "recommendations_insert_own" ON recommendations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "recommendations_update_own" ON recommendations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "recommendations_delete_own" ON recommendations
  FOR DELETE USING (auth.uid() = user_id);
```

## 3. `programs` 테이블 누락 컬럼 확인 및 추가

`admin.py`의 sync 로직이 `hrd_id`를 upsert 기준으로 사용한다. SQL Editor에서 확인 후 없으면 추가한다.

```sql
-- 컬럼 존재 여부 확인
SELECT column_name FROM information_schema.columns
WHERE table_name = 'programs' AND column_name = 'hrd_id';

-- 없으면 추가
ALTER TABLE programs ADD COLUMN IF NOT EXISTS hrd_id TEXT UNIQUE;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS deadline DATE;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS cost INTEGER;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS subsidy_amount INTEGER;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS target TEXT[];
ALTER TABLE programs ADD COLUMN IF NOT EXISTS link TEXT;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS application_method TEXT;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS scope TEXT;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS is_ad BOOLEAN DEFAULT false;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS sponsor_name TEXT;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS embedding_id TEXT;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS compare_meta JSONB;
```

## 4. 백엔드 서버 실행 후 admin sync 호출

```bash
# backend 디렉토리에서
cd backend
.venv\Scripts\activate          # Windows
uvicorn main:app --reload       # http://localhost:8000

# 별도 터미널에서 admin sync 호출
curl -X POST "http://localhost:8000/admin/sync/programs" \
  -H "Authorization: isoser-admin-2026"
```

- 응답 예시: `{"synced": 120, "chroma_synced": 100, "chroma_skipped": 20, "duration_seconds": 45.2}`
- `synced`가 0이면 Work24 API 키 문제. `backend/.env`의 `WORK24_OPEN_API_AUTH_KEY` 값 확인.
- `chroma_synced`가 0이면 `GOOGLE_API_KEY` 문제.

## 5. 대시보드에서 결과 확인

`http://localhost:3000/dashboard` 접속 후 로그인하면 추천 프로그램 카드가 노출되어야 한다.

# Transport Notes

- 로컬 실행 대상: `tasks/inbox/TASK-2026-04-15-1700-recommend-data-pipeline.md`
- 선결 조건: 없음 (이 태스크가 1710, 1720의 선결 조건)
- 다음 태스크: `TASK-2026-04-15-1710-recommend-api-enhance`

## Auto Recovery Context

- source_task: `tasks/drifted/TASK-2026-04-15-1700-recommend-data-pipeline.md`
- failure_stage: `drift`
- failure_report: `reports/TASK-2026-04-15-1700-recommend-data-pipeline-drift.md`
- recovery_report: `reports/TASK-2026-04-15-1700-recommend-data-pipeline-recovery.md`
- reviewer_action: update the packet or provide approval/feedback before requeueing
