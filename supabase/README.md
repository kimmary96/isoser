# Supabase Migrations

이 폴더는 이소서 프로젝트의 DB 변경 이력을 관리합니다.

## 실행 방법
새로운 환경에서 DB를 세팅할 때는 아래 순서대로
Supabase SQL Editor에서 파일을 순서대로 실행하세요.

001_init_schema.sql     → 전체 테이블 초기 생성
002_add_bio_to_profiles.sql  → profiles.bio 컬럼 추가

## 규칙
- 파일명은 숫자_설명.sql 형식으로 작성
- 한 번 실행한 파일은 수정하지 않음
- 새로운 변경사항은 항상 새 파일로 추가
