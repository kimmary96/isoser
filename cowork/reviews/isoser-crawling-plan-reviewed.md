# Isoser 크롤링/수집 기획서 — 검토 개선본

기준일: 2026-04-15  
원본 파일: `isoser-crawling-plan-validated.md`  
검토 기준: 로컬 저장소 실제 코드 (`backend/rag/collector/`, `supabase/migrations/`, `.env.example`) 직접 대조  
HEAD commit 기준: `d2dc9fe36272d06812f26781c8659aad98dd6054`

---

## 검토 요약 — 원본에서 수정된 핵심 사항

원본 기획서와 실제 저장소 코드를 대조한 결과, 아래 6가지 문제가 확인되었다. 본 문서는 이를 전부 수정한 개선본이다.

| # | 원본 문제 | 영향 | 수정 방향 |
|---|---|---|---|
| 1 | `normalizer.py`가 `is_ad=False`를 하드코딩 | HRD클럽 광고 데이터가 DB에 `is_ad=false`로 저장됨 | normalizer에 `is_ad`, `sponsor_name` 전달 경로 명시 |
| 2 | `hrdclub_collector.py`가 scheduler.py에 미등록 | dry run 17건은 scheduler 통합 검증이 아님 | 검증 결과 재서술 + 미등록 사실 명시 |
| 3 | "표준 라이브러리 기반 조정" 설명 | 실제 scheduler.py는 `import requests` 사용 중 | 기술 스택 섹션 수정 |
| 4 | upsert 중복 기준이 기획서와 코드 불일치 | 기획서 `source+title+deadline`, 코드 `title,source` | 코드 기준으로 통일 + 문제점 명시 |
| 5 | HRD-Net API "재확인 필요"로 기재 | 실제 승인 완료 상태 (memory 기준) | 승인 완료로 수정, 엔드포인트 검증 문제만 남김 |
| 6 | Phase 순서 모순 (HRD클럽 "바로 추진 가능" + Phase 3) | 실행 계획 혼선 | Phase 순서를 실제 검증 상태 기준으로 재정렬 |

추가로 아래 항목들이 원본에 없었으나 이번 개선본에 신규 추가되었다.

- Render 512MB 메모리 제약과 배치 크기 원칙
- 데이터 만료/TTL 정책
- 교차 소스 중복 처리 전략
- Rate limiting 및 요청 간격 원칙
- `compare_meta` 필드 연동 계획
- 스키마 충돌 현황 (migration 파일 2개)

---

## 1. 문서 목적

이 문서는 이소서의 프로그램 허브를 위한 데이터 수집 전략 중 `크롤링이 필요한 영역`을 실제 로컬 검증 결과를 바탕으로 정리한 기획서다.

핵심 목적은 아래와 같다.

- 어떤 데이터는 공식 API로 받고 어떤 데이터만 크롤링으로 보완할지 명확히 정의한다
- 실제 저장소 코드와 일치하는 사실만 근거로 삼는다
- 구현자가 문서만 읽어도 우선순위, 범위, 리스크, 운영 원칙을 이해할 수 있게 한다

---

## 2. 검증 결론 요약

### 2-1. 실제로 로컬에서 작동 확인한 것

- `HRD클럽`: 광고/BM 데이터 크롤링 가능. `HrdClubCollector().collect()`를 단독 실행해 17건 수집 확인
- `SBA`: 메인 페이지의 사업공고 목록 5건 HTML 파싱 가능
- `고용24 기관찾기`: 고용센터 목록형 테이블 크롤링 가능
- `scheduler dry run`: `HrdCollector`, `Work24Collector`, `KstartupApiCollector` 기반 플로우 자체 실행 가능 (API 키 없어 0건이지만 실행 경로 정상)

### 2-2. 주의 — scheduler와 HrdClubCollector는 아직 미통합

원본 기획서에서 "scheduler dry run에서 17건 수집 확인"이라고 했으나, 이는 사실과 다르다.

현재 `scheduler.py`는 `HrdClubCollector`를 import하지 않는다. 따라서 dry run 17건은 `HrdClubCollector().collect()`를 별도로 수동 실행한 결과이며, scheduler 통합이 검증된 것이 아니다. scheduler에 HrdClubCollector를 등록하는 작업이 별도로 필요하다.

### 2-3. 재확인이 필요한 것

- `HRD넷 API`: 승인은 완료 상태이나, 현재 코드의 엔드포인트(`hrd.go.kr/jsp/HRDP/...`)가 실제 응답을 반환하는지 키를 넣고 검증 필요
- `고용24 OpenAPI`: 현재 코드 경로에서 404 또는 기대 외 응답 발생. 최신 공개 API 문서 기준 경로 재확인 필요
- `K-Startup API`: 키 없는 호출 실패 확인. 키 발급 후 실제 payload 구조 확인 필요

---

## 3. 핵심 원칙

### 3-1. 수집 전략 원칙

- 이소서의 핵심 데이터 전략은 `공공 API 우선`이다
- 크롤링은 `API로 채워지지 않는 영역`만 보완한다
- MVP는 공공 API만으로도 성립해야 한다
- 크롤링은 서비스의 필수 원천이 아니라 `정보 품질 개선 수단`이다

### 3-2. 제품 메시지 원칙

- 이소서는 "크롤링 서비스"가 아니라 `공공 취업 지원 정보 허브`다
- 외부 설명에서는 `공공 API + 보완 크롤링`으로 표현한다
- 광고/BM 데이터와 일반 프로그램 데이터는 목적이 다르므로 분리해서 본다

### 3-3. 운영 안정성 원칙

- 한 소스 실패가 전체 허브 실패로 이어지면 안 된다
- 크롤링 실패 시 기존 데이터는 유지한다
- HTML 구조 변경 가능성을 전제로 소스별로 관리한다
- Render 무료 티어 512MB 메모리 제약을 전제로 배치 크기를 제한한다. 전체 데이터를 한 번에 메모리에 올리지 않는다

---

## 4. 소스별 검증 결과

### 4-1. HRD클럽

**검증 방식**

- 메인 페이지에 실제 HTTP 요청
- HTML 저장 후 광고 영역 구조 확인
- 로컬에서 `HrdClubCollector().collect()` 단독 실행

**검증 결과**

- 응답 수신 성공
- 광고성 데이터 17건 추출 성공
- 추출 가능 필드: 기관명/광고명, 링크, 짧은 소개 문구

**주의 — normalizer is_ad 처리 버그**

현재 `normalizer.py`는 `is_ad=False`와 `sponsor_name=None`을 하드코딩한다. HRD클럽 raw item에 `is_ad=True`를 담아 보내도 normalizer를 통과하면 `is_ad=False`로 덮어쓰인다. 이 문제를 해결하지 않으면 광고 데이터가 일반 프로그램으로 분류된다. normalizer 수정이 필요하다.

**수정 방향**

```python
# normalizer.py 수정 필요 위치
"is_ad": raw_item.get("is_ad", False),          # 하드코딩 제거
"sponsor_name": raw_item.get("sponsor_name"),    # 하드코딩 제거
```

**기획 반영**

- HRD클럽은 `ad_catalog` 성격의 데이터로 분류
- 일반 프로그램 추천/검색 로직과 분리
- normalizer 수정이 선행되어야 광고 데이터가 올바르게 저장됨

---

### 4-2. SBA

**검증 방식**

- 브라우저형 User-Agent로 메인 페이지 요청
- HTML 내 사업공고 영역 확인 및 5건 추출

**검증 결과**

- 메인 페이지 접근 성공
- 추출 가능 필드: 제목, 상세 링크, 게시 날짜
- 현재 `sba_collector.py` 파일은 저장소에 없음. 신규 작성 필요

예시 추출 항목:
- `2026 M+ 국내 글로벌 진출 역량 강화 지원 협력 파트너 모집`
- `2026년 규제특례기업 실증사업화 지원사업 모집(~4/30)`

**기획 반영**

- SBA는 보완 크롤링 1순위로 도입
- 1차: 목록 수집 (제목/링크/날짜)
- 2차: 필요한 공고만 상세 수집 (대상, 접수 상태, 카테고리)
- `source_type='regional_crawl'`로 저장

---

### 4-3. 고용24 기관찾기 / 고용센터 목록

**검증 결과**

- 목록 페이지 접근 성공
- 기관구분, 기관명, 상세주소, 전화번호 확인

**해석**

- 이것은 `센터 디렉터리 데이터`이지 `행사/설명회/채용행사` 그 자체가 아니다
- 행사성 데이터까지 수집하려면 별도 페이지 탐색이 필요하다

**기획 반영**

- 지역 고용센터는 두 층으로 나눈다
  - 1단계: 센터 목록/기관 메타
  - 2단계: 행사/설명회 페이지 (후순위)
- 유지보수 비용이 높으므로 후순위로 둔다

---

### 4-4. HRD넷

**현황**

- HRD-Net API는 승인 완료 상태다
- 다만 현재 코드의 엔드포인트(`https://www.hrd.go.kr/jsp/HRDP/HRDPO00/HRDPOA60/HRDPOA60_1.jsp`)가 실제로 데이터를 반환하는지는 `HRD_API_KEY`를 주입한 상태에서 별도 검증이 필요하다
- 엔드포인트는 코드에 존재하지만 응답 구조가 기대와 다를 수 있다

**기획 반영**

- HRD넷은 크롤링 대상이 아니다
- API 키를 넣고 실제 응답을 확인한 후 구현 진행

---

### 4-5. 고용24 OpenAPI

**현황**

- 현재 코드 경로에서 404 또는 기대 외 응답 발생
- 최신 공개 API 문서 기준 경로 재확인 필요

**기획 반영**

- 고용24는 크롤링 메인이 아니다
- 엔드포인트 확인 전까지 크롤링 대체안으로 전환하지 않는다

---

### 4-6. K-Startup API

**현황**

- 키 없는 호출 실패 확인
- API 키 발급 후 실제 payload 구조 확인 필요

**기획 반영**

- 창업 카테고리 데이터는 공식 API 우선
- 무키 상태에서는 인터페이스 설계만 진행

---

## 5. 최종 소스 분류

| 구분 | 소스 | 방식 | 현재 구현 상태 | 판단 |
|---|---|---|---|---|
| 핵심 API | HRD넷 | 공식 API (승인 완료) | `hrd_collector.py` 있음, 엔드포인트 검증 필요 | 키 주입 후 검증 |
| 핵심 API | 고용24 | 공식 API | `work24_collector.py` 있음, 엔드포인트 404 | 경로 재확인 |
| 핵심 API | K-Startup | 공식 API | `kstartup_collector.py` 있음, 키 없음 | 키 발급 후 진행 |
| 보완 크롤링 1순위 | SBA | 웹 크롤링 | `sba_collector.py` 없음, 신규 작성 필요 | 즉시 구현 가능 |
| 광고/BM 크롤링 | HRD클럽 | 웹 크롤링 | `hrdclub_collector.py` 있음, scheduler 미등록 | normalizer 수정 + scheduler 등록 후 즉시 가능 |
| 보완 크롤링 후순위 | 지역 고용센터 | 웹 크롤링 | 미구현 | 부분 가능, 추가 탐색 필요 |

---

## 6. 실행 플로우

### 6-1. MVP 플로우 (API 키 확보 후)

1. HRD넷 API 수집
2. 고용24 API 수집
3. 필요 시 K-Startup API 수집
4. normalize → deduplicate → programs 저장

### 6-2. 보완 플로우 (현재 즉시 가능)

1. SBA 목록 크롤링 (신규 collector 작성 필요)
2. 사업공고 제목/링크/날짜 확보
3. 필요한 공고만 상세 진입
4. `source_type='regional_crawl'`로 저장

### 6-3. BM/광고 플로우 (normalizer 수정 후 가능)

1. HRD클럽 메인 광고 영역 수집
2. 광고명/기관명/링크/소개문구 추출
3. `is_ad=true`, `source_type='ad_catalog'`로 저장
4. 일반 프로그램 추천 로직과 분리

**선행 조건:** normalizer.py에서 `is_ad`와 `sponsor_name`을 raw_item에서 전달받도록 수정 필요. 그 전까지는 모든 HRD클럽 데이터가 `is_ad=false`로 저장됨.

### 6-4. 후순위 확장 플로우

1. 고용24 기관찾기 또는 관련 페이지에서 지역 센터 목록 확보
2. 행사/설명회 페이지 구조 추가 탐색
3. 소스별 맞춤 collector 작성

---

## 7. 실행 우선순위

원본에서 Phase 순서와 섹션 11의 "바로 추진 가능" 목록이 모순되었다. 실제 검증 상태를 기준으로 수정한다.

### Phase 1 — 즉시 가능

- HRD클럽 광고 크롤러 (normalizer 수정 + scheduler 등록)
- SBA 보완 크롤러 신규 작성

### Phase 2 — API 키 확보 후

- HRD넷 API (승인 완료, 엔드포인트 검증 후)
- 고용24 API (경로 재확인 후)
- K-Startup API (키 발급 후)

### Phase 3 — 후순위

- 지역 고용센터 행사/설명회 크롤러

---

## 8. 스키마 및 중복 처리

### 8-1. 현재 programs 테이블 스키마 현황

저장소에 2개의 programs 테이블 migration 파일이 존재한다.

- `20260410120000_create_programs_and_bookmarks.sql`: id, title, category, location, provider, summary, description, tags, skills 기반 스키마
- `20260415_create_programs.sql`: source, source_type, collection_method, scope, title, category, target, region, region_detail, deadline, link, is_ad, sponsor_name 기반 스키마

수집 아키텍처(normalizer, scheduler)는 `20260415_create_programs.sql` 스키마와 일치한다. 실제 Supabase에 어느 스키마가 적용됐는지 확인이 필요하다. 충돌 시 최신 스키마(`20260415`) 기준으로 정리해야 한다.

**구현 러너 참고:** `20260415_create_programs.sql`의 UNIQUE constraint는 `(title, source)`다. scheduler.py의 `on_conflict: "title,source"`와 일치한다.

### 8-2. 중복 제거 기준

**일반 프로그램**

- Supabase upsert `on_conflict` 기준: `title, source` (현재 코드 및 DB 제약 기준)
- 같은 프로그램이 여러 소스에 등장하는 경우(HRD-Net과 고용24 동시 수록): 소스가 다르므로 별개 행으로 저장된다. 프론트엔드에서 동일 프로그램이 중복 노출되는 문제가 발생할 수 있다. 해결 방안은 아래 중 택일 한다.
  - 방안 A: `title + deadline` 조합으로 교차 소스 중복을 별도 쿼리로 필터링
  - 방안 B: 소스 우선순위 컬럼(예: `canonical_source`)을 추가해 대표 소스를 명시
  - MVP에서는 방안 A로 시작하고, 방안 B는 데이터 규모가 커지면 검토한다

**광고 데이터**

- `is_ad=true`인 항목은 일반 프로그램과 분리
- `source + sponsor_name + link` 조합으로 중복 판단

**지역 기관 목록**

- `기관명 + 주소 + 전화번호` 조합으로 중복 판단

---

## 9. 실패 처리 기준

- 한 소스 실패가 전체 수집 실패로 이어지지 않게 한다
- 수집 실패 시 기존 DB 데이터는 유지한다
- 파싱 결과 0건이면 즉시 정상으로 간주하지 않는다
- API 소스에서 0건이 발생했을 때 원인 구분:
  - "키 없음"으로 인한 0건 — 환경 변수 미설정
  - "엔드포인트 오류"로 인한 0건 — HTTP 에러 또는 응답 파싱 실패
  - "데이터 없음"으로 인한 0건 — 정상 (검색 결과가 실제로 0건)
  - 세 경우를 로그에서 구별할 수 있어야 한다
- 3회 연속 0건 또는 3회 연속 예외 시 구조 변경 의심

---

## 10. 데이터 만료 및 TTL 정책

원본 기획서에 없던 항목. 추가한다.

- `deadline`이 오늘보다 이전인 프로그램은 "만료 상태"로 본다
- 만료 데이터 처리 방안 (택일):
  - 방안 A: `is_active=false`로 마킹하고 보존
  - 방안 B: 만료 N일 경과 후 삭제
  - 현재 `programs` 테이블에 `is_active` 컬럼이 있는 migration(`20260410`)과 없는 migration(`20260415`)이 혼재한다
  - MVP에서는 프론트엔드 필터에서 `deadline >= today`를 조건으로 걸어 표시 범위를 제한하고, DB 삭제는 하지 않는다
- 수집 주기와 만료 정책은 연동: 하루 1회 수집 시 당일 마감 프로그램이 누락될 수 있다. 마감 임박 필터는 `days_left` 기준으로 프론트에서 처리한다

---

## 11. Rate Limiting 및 요청 원칙

원본 기획서에 없던 항목. 추가한다.

- 크롤링 대상 사이트에 과도한 요청을 보내지 않는다
- HTML 기반 collector는 요청 사이에 최소 1~2초 간격을 둔다
- User-Agent는 브라우저 식별자를 사용한다 (현재 SBA 검증에서 확인된 방식)
- robots.txt를 확인하고, 수집 금지 경로는 접근하지 않는다
- API 소스는 공식 API 사용이므로 rate limiting 정책은 각 API 문서 기준을 따른다
- Render 서버에서 실행 시 512MB 메모리 제약을 감안해 collector당 페이지 단위 배치 처리를 유지한다

---

## 12. compare_meta 필드 연동

원본 기획서에 없던 항목. 추가한다.

`/programs/compare` 페이지는 허들 데이터(연령 제한, 코딩 실력 요건, 내일배움카드 여부 등)를 `compare_meta JSONB` 컬럼에서 읽는다. 이 컬럼은 `TASK-2026-04-15-1100-programs-compare` Task에서 migration으로 추가된다.

수집 파이프라인과의 연동 방향:

- HRD-Net, 고용24 API가 이 필드들을 직접 제공하면 normalizer에서 `compare_meta`를 채운다
- 제공하지 않으면 `compare_meta=null`로 저장하고, `/programs/compare` 페이지는 "정보 없음"으로 표시한다
- `compare_meta` 데이터 수동 입력 또는 별도 수집 파이프라인은 이 Task 범위 밖이며 별도 Task로 처리한다

---

## 13. 구현 시 저장 스키마

`20260415_create_programs.sql` 기준 최소 공통 필드:

| 컬럼 | 타입 | 역할 |
|---|---|---|
| `source` | TEXT | 데이터 출처 (HRD넷, SBA, HRD클럽 등) |
| `source_type` | TEXT | national_api / regional_crawl / ad_catalog |
| `collection_method` | TEXT | public_api / web_crawl |
| `scope` | TEXT | national / seoul / regional |
| `title` | TEXT | 프로그램명 |
| `category` | TEXT | AI / IT / 디자인 / 경영 / 창업 / 기타 |
| `target` | TEXT[] | 청년 / 여성 / 중장년 / 일반 등 |
| `region` | TEXT | 전국 / 서울 등 |
| `region_detail` | TEXT | 강남구 등 |
| `deadline` | DATE | 마감일 |
| `link` | TEXT | 원본 링크 |
| `is_ad` | BOOLEAN | 광고 여부 |
| `sponsor_name` | TEXT | 광고주 기관명 |

추가 보관 가능 필드:
- `raw` (JSONB): 원본 응답 전체 보관
- `start_date`, `end_date`: 운영 기간
- `compare_meta` (JSONB): 비교 페이지용 허들 데이터 (별도 migration으로 추가)

---

## 14. 중복 제거 기준

(섹션 8과 중복 방지 — 구현 참조용 요약)

- 일반 프로그램 upsert: `on_conflict: "title, source"` (현재 코드 기준)
- 광고 데이터: `source + sponsor_name + link`
- 지역 기관 목록: `기관명 + 주소 + 전화번호`

---

## 15. 기술 스택

### 15-1. 언어 및 런타임

- Python 3.10 (백엔드 기준)

### 15-2. HTTP 요청

- `requests` 라이브러리 사용 (scheduler.py 실제 코드 기준)
- 원본 기획서의 "표준 라이브러리 기반 조정" 설명은 실제와 달랐으므로 수정

### 15-3. 파싱 방식

- API 응답: `json`
- HTML 파싱: 현재는 정규식 + 문자열 기반 추출로 최소 검증. 구조가 복잡해지면 `BeautifulSoup` 도입 검토

### 15-4. 정규화 레이어

- 파일: `backend/rag/collector/normalizer.py`
- 수정 필요 사항: `is_ad`, `sponsor_name`을 raw_item에서 전달받도록 변경

### 15-5. 실행 레이어

- 파일: `backend/rag/collector/scheduler.py`
- 현재 등록된 collector: `HrdCollector`, `Work24Collector`, `KstartupApiCollector`
- 미등록 (추가 필요): `HrdClubCollector`, `SbaCollector`(신규 작성)

### 15-6. 저장소

- Supabase REST endpoint 기반 upsert
- `on_conflict: "title,source"`

---

## 16. 환경 변수

`.env.example` 기준 실제 키 이름:

| 변수 | 용도 |
|---|---|
| `HRD_API_KEY` | HRD넷 API 인증 |
| `WORK24_API_KEY` | 고용24 API 인증 |
| `KSTARTUP_API_KEY` | K-Startup API 인증 |
| `SUPABASE_URL` | DB 저장 |
| `SUPABASE_SERVICE_ROLE_KEY` | DB 서버 접근 |

운영 원칙:
- API 키는 프론트에 노출하지 않는다
- 서비스 키는 서버에서만 사용한다
- collector 실행 전 키 유무를 먼저 검사하고, 없으면 해당 collector는 skip하며 로그에 "키 없음"을 남긴다

---

## 17. 수집 아키텍처

### 17-1. 전체 흐름

`Source → Collector → Normalize → Deduplicate → Upsert → API/Frontend 소비`

### 17-2. Collector 종류

**API Collector** (HRD넷, 고용24, K-Startup)

- 공식 API 우선, 페이지네이션 기반, JSON 응답 파싱
- 장점: 구조 안정성 높음, 운영 비용 낮음
- 단점: 키 발급 필요, 공개 범위 밖 데이터 확보 불가

**Crawling Collector** (HRD클럽, SBA, 지역 고용센터)

- HTML 기반, 소스별 맞춤 파싱 필요
- 장점: API에 없는 데이터 확보 가능
- 단점: HTML 구조 변경 리스크, 유지보수 비용 높음

---

## 18. 실행 방식

### 18-1. Dry Run

```python
from backend.rag.collector.scheduler import run_all_collectors
result = run_all_collectors(upsert=False)
print(result)
```

### 18-2. Upsert Run

전제 조건: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` + 필요한 API 키

```python
from backend.rag.collector.scheduler import run_all_collectors
result = run_all_collectors(upsert=True)
print(result)
```

### 18-3. 관리자 수동 동기화

- FastAPI `POST /admin/programs/sync` 또는 유사 endpoint 연결 권장
- 초기에는 cron보다 수동 sync가 안전
- Render cold start 지연을 감안해 타임아웃 핸들링 필요

### 18-4. 배치 운영 권장 순서

1. API collector (HRD넷, 고용24, K-Startup)
2. SBA 보완 크롤링
3. HRD클럽 광고 크롤러
4. 후처리/집계

---

## 19. 로컬 실행 검증 기록

### 19-1. HrdClubCollector 단독 실행 확인

- `HrdClubCollector().collect()` 단독 실행 → 17건 수집
- 확인 필드: `title`, `link`, `is_ad`, `sponsor_name`, `raw.description`
- **주의**: scheduler 통합 검증은 아님. scheduler 등록 및 normalizer 수정 후 재검증 필요

### 19-2. Scheduler Dry Run 결과

`run_all_collectors(upsert=False)` 실행 결과:

```python
{
  'saved_count': 17,  # HrdClubCollector 단독 실행 건수이므로 실제 scheduler 통합 결과 아님
  'failed_count': 0,
  'sources': [
    {'tier': 1, 'source': 'HRD넷', 'saved': 0, 'failed': 0},       # 키 없음
    {'tier': 1, 'source': 'K-Startup 창업진흥원', 'saved': 0, 'failed': 0},  # 키 없음
    {'tier': 1, 'source': '고용24', 'saved': 0, 'failed': 0},       # 키 없음 또는 경로 오류
    {'tier': 2, 'source': 'HRD클럽', 'saved': 17, 'failed': 0}      # 단독 실행 결과
  ]
}
```

scheduler 플로우 자체(HrdCollector, Work24Collector, KstartupApiCollector 포함)는 실행 가능 상태다. HrdClubCollector는 scheduler에 미등록이므로 위 결과는 참고 수준으로만 본다.

### 19-3. SBA 구조 검증

- 메인 HTML 수집, 사업공고 5건 추출 성공
- 제목/링크/날짜 추출 가능 확인

### 19-4. 고용센터 목록 구조 검증

- 기관구분, 기관명, 주소, 전화번호 포함 확인

---

## 20. 로컬에서 확인된 리스크

| 리스크 | 내용 | 대응 |
|---|---|---|
| normalizer is_ad 버그 | 광고 데이터가 일반 프로그램으로 분류됨 | normalizer.py 수정 선행 필요 |
| API 엔드포인트 최신성 | HRD넷/고용24 API 경로가 유효한지 미확인 | 키 주입 상태에서 별도 검증 |
| HTML 구조 변경 | SBA, HRD클럽, 고용센터 HTML 변경 시 파싱 실패 | 소스별 collector 분리, 로그 모니터링 |
| 교차 소스 중복 | 같은 프로그램이 HRD넷과 고용24에 동시 수록 | 프론트 필터로 우선 처리, 장기 대응은 canonical_source |
| Render 메모리 | 512MB 제약, 대량 배치 시 OOM 가능 | 페이지 단위 수집, 배치 크기 제한 |
| 수집 주기와 마감 | 하루 1회 수집 시 당일 마감 공고 누락 가능 | 프론트 `days_left` 기준 필터로 보완 |
| scheduler HrdClub 미등록 | 광고 플로우 불완전 | scheduler.py에 HrdClubCollector 등록 필요 |

---

## 21. 운영 설계

### 21-1. 수집 주기

- API collector: 하루 1회 배치 (관리자 수동 or cron 예정)
- SBA: 하루 1회 이하
- HRD클럽: 하루 1회 이하
- 고용센터: 주기보다 필요 시 수동 점검 형태가 적합

### 21-2. 로그 설계

소스별로 아래를 남긴다.
- collector 이름
- 요청 성공/실패 여부
- 0건 원인 (키 없음 / 엔드포인트 오류 / 실제 데이터 없음)
- raw item 수
- normalized row 수
- upsert 성공/실패 수
- 마지막 실행 시각

### 21-3. 모니터링 기준

- 평소 대비 수집 건수 급감
- 연속 3회 0건
- 연속 3회 예외
- 광고 데이터가 `is_ad=false`로 유입되는 현상 (normalizer 버그 재발)

---

## 22. 바로 구현 가능한 작업 목록

### 22-1. 즉시 가능 (현재 코드 기반)

1. `normalizer.py`: `is_ad`, `sponsor_name`을 raw_item에서 전달받도록 수정
2. `scheduler.py`: `HrdClubCollector` import 및 등록
3. `sba_collector.py` 신규 작성 및 scheduler 등록 (`source_type='regional_crawl'`)

### 22-2. API 키 확보 후 가능

4. HRD넷 `HRD_API_KEY` 주입 후 엔드포인트 응답 검증
5. 고용24 최신 OpenAPI 경로 확인 및 `WORK24_API_KEY` 주입
6. K-Startup `KSTARTUP_API_KEY` 발급 후 payload 구조 확인

### 22-3. 후순위

7. 지역 고용센터 행사/설명회 collector 추가
8. `compare_meta` 연동 — HRD-Net 응답에서 허들 필드 추출 가능 여부 확인

---

## 23. 이 문서의 신뢰도 범위

"작동 확인"은 아래 범위에서 사실이다.
- HTML 접근 가능 (HRD클럽, SBA, 고용센터)
- 일부 실제 데이터 추출 가능
- scheduler 실행 경로 정상 (API 소스 포함, 키 없어 0건)
- HrdClubCollector 단독 실행 17건 수집

아래는 아직 후속 검증이 필요하다.
- API 키 주입 상태에서의 HRD넷/고용24/K-Startup 실데이터 upsert
- normalizer 수정 후 HRD클럽 광고 데이터 is_ad=true 저장 재검증
- 장기 운영 안정성
