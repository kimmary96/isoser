-- profiles 테이블에 bio 컬럼 추가
-- bio: 이름 아래 한 줄 직함 (예: "5년차 마케터 | 브랜드 기획 전문")
-- 추가일: 2026.04.06
ALTER TABLE profiles ADD COLUMN bio text;
