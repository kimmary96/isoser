# 이소서 (Isoser) PRD

> AI 이력서 · 경력기술서 편집 서비스  
> Product Requirements Document  
> v1.1 | 2026-04-06

## 1. 제품 정의

### 1.1 한 줄 정의
기존 이력서(PDF)에서 시작해 활동 데이터를 자산화하고, AI 코치 피드백을 통해 직무 맞춤 이력서를 빠르게 완성하는 서비스.

### 1.2 핵심 가치
- 시작 장벽 최소화: PDF 업로드로 프로필/활동 자동 추출
- 재사용성: 활동 원본을 보존하고 공고별로 조합
- 코치형 AI: 대필보다 수정 가능한 피드백 중심

## 2. 현재 제품 상태 (최신)

### 2.1 구현 완료
- Google OAuth + 게스트 모드
- 온보딩 PDF 파싱(`/parse/pdf`) 후 `profiles`, `activities` 저장
- 대시보드 프로필 편집(통합 모달):
  - 이름 저장(`profiles.name`)
  - 희망 직무 저장(`profiles.bio`)
  - 프로필 이미지 업로드(`activity-images` 버킷) + `profiles.avatar_url` 저장
  - 영어 이름 입력 UI 제공(현재 DB 저장 없음)
- 활동 목록/상세/수정/삭제, STAR 항목 저장
- 활동 상세 AI 코치 멀티턴(`coach_sessions` 저장)
- 공고 매칭 분석/저장/삭제(`match_analyses`)
- 이력서 편집 페이지:
  - 활동/기술/자기소개서 항목 선택
  - 선택 항목 기반 이력서 생성(`resumes` 저장)
- 문서 저장소(`/dashboard/documents`):
  - 생성된 이력서 목록 조회
  - 문서별 PDF 내보내기 이동
- PDF 내보내기(`/dashboard/resume/export`):
  - `@react-pdf/renderer` 기반 다운로드
  - NotoSansKR 폰트 적용(한글 출력 안정화)

### 2.2 현재 제약
- 템플릿은 UI 선택 가능하나 PDF 렌더링 다양화는 제한적
- `profiles.name_en` 컬럼 미존재(영어 이름은 UI 입력만)
- 게스트 모드는 로컬 저장 중심

## 3. 타깃 사용자

- 1차: 부트캠프 수강생/취준생(동시다발 지원)
- 2차: 이직 준비 재직자(경력 재구성 필요)
- 3차: 후보자 문서를 대량 정리하는 리크루터/헤드헌터

## 4. 주요 사용자 플로우

1. 로그인 또는 게스트 진입
2. 온보딩:
   - PDF 업로드 분석 또는 직접 입력
3. 대시보드에서 프로필/활동 정리
4. 활동 상세에서 AI 코치 피드백으로 문장 개선
5. 이력서 편집 화면에서 활동 조합 + 직무 설정
6. 문서 생성 후 문서 저장소에 저장
7. 문서 저장소에서 PDF 내보내기

## 5. 기능 요구사항 (I/P/O)

### F1. PDF 파싱 온보딩
- Input: PDF 파일
- Process: PyMuPDF 추출 → LLM 구조화
- Output: `profiles`, `activities` 저장

### F2. 활동 저장소
- Input: 활동 기본/확장 정보, STAR
- Process: `activities` CRUD + visible 관리
- Output: 활동 카드/상세/이력서 조합 데이터

### F3. AI 코치
- Input: 활동 설명, 직무, 대화 히스토리
- Process: 피드백 생성 + `coach_sessions` 저장
- Output: 누락 요소, 개선 문장, 반복 피드백

### F4. 공고 매칭
- Input: 공고 텍스트, 사용자 활동/프로필
- Process: 점수화/키워드 분석
- Output: 점수, 강점/갭, 추천 활동 + `match_analyses` 저장

### F5. 이력서 생성/문서 저장소
- Input: 선택 활동, 직무, 템플릿
- Process: `resumes` 생성
- Output: 문서 저장소 목록 반영 + PDF 내보내기 경로 제공

### F6. 프로필 통합 모달
- Input: 이름, 영어 이름(UI), 희망 직무, 프로필 사진
- Process:
  - 이미지: Storage `activity-images` 업로드
  - 프로필: `profiles` upsert/update
- Output: 저장 직후 대시보드 카드 즉시 반영

## 6. 데이터 모델 (Supabase)

현재 기준 주요 테이블:
- `profiles`: id, name, bio, email, phone, education, career, education_history, awards, certifications, languages, skills, self_intro, avatar_url, created_at, updated_at
- `activities`: 활동 기본/확장/STAR 필드
- `resumes`: 이력서 버전 저장
- `coach_sessions`: AI 코치 대화 이력
- `match_analyses`: 매칭 분석 결과
- `portfolios`: 스키마 존재(현재 코드 사용 낮음)

스토리지:
- 버킷: `activity-images`

## 7. API 요약

- `POST /parse/pdf`: PDF 구조화
- `POST /coach/feedback`: 코치 피드백
- `POST /match/analyze`: 공고 매칭
- (프론트 내부) `/api/summary`: 보조 요약/어시스턴트 응답

## 8. 비기능 요구사항

- RLS: 사용자 본인 데이터만 접근
- 에러 복원력: 스키마 캐시 지연(예: `bio`) 시 fallback 처리
- 성능: 대시보드/문서 목록 로딩 1차 체감 지연 최소화
- 배포: Frontend(Vercel), Backend(Render)

## 9. 마이그레이션 운영

DB 변경은 `supabase/migrations` 기준 파일 관리:
- `001_init_schema.sql`
- `002_add_bio_to_profiles.sql`

규칙:
- 기존 마이그레이션 파일 수정 금지
- 변경사항은 새 SQL 파일로 추가

## 10. 다음 우선순위

1. `profiles.name_en` 컬럼 정식 추가 및 저장 연동
2. 문서 저장소 검색/필터/정렬
3. 템플릿별 PDF 렌더링 실체화
4. 포트폴리오 기능과 `portfolios` 테이블 연결

## 변경 이력
- v1.1 (2026-04-06)
  - 문서 저장소 플로우 반영
  - 프로필 통합 모달 반영
  - `profiles.bio` 기반 희망 직무 저장 반영
  - Supabase 마이그레이션 파일 운영 반영
