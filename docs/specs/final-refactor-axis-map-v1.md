# Final Refactor Axis Map v1

기준일: 2026-04-24  
상태: proposed  
범위: 프로그램 정본 개편, 사용자 추천 개편, API/정규화/운영 축을 포함한 전체 개편 기준 맵

## 1. 문서 목적

이 문서는 현재 진행 중인 대규모 개편을 `어떤 축으로 나눠서`, `어떤 순서로`, `어떤 기준 계약 아래` 진행할지를 한 장으로 고정하는 최상위 스펙이다.

이 문서는 아래 문서를 상위에서 묶는다.

- [program-surface-contract-v2.md](./program-surface-contract-v2.md)
- [user-recommendation-schema-v1.md](./user-recommendation-schema-v1.md)
- [user-recommendation-schema-migration-plan-v1.md](./user-recommendation-schema-migration-plan-v1.md)
- [user-recommendation-serializer-contract-v1.md](./user-recommendation-serializer-contract-v1.md)

## 2. 이번 개편의 최상위 목표

이번 개편의 최종 목표는 아래 3가지다.

1. 같은 `program_id`가 모든 화면에서 같은 의미와 같은 값으로 보이게 만든다.
2. 맞춤형 프로그램 추천이 `user/program/program surface` 기준 계약 위에서 일관되게 동작하게 만든다.
3. collector -> DB -> backend -> BFF -> frontend 전 구간에서 의미 drift가 다시 생기지 않게 만든다.

## 3. 이번 개편에서 이미 고정된 계약

### 3.1 프로그램 화면 계약

프로그램 화면 계약 정본은 [program-surface-contract-v2.md](./program-surface-contract-v2.md)다.

고정 판단:

- 카드형 화면은 `ProgramCardSummary`
- 테이블형 목록은 `ProgramListRow`
- 상세는 `ProgramDetailResponse`
- 화면 문맥은 `ProgramSurfaceContext`

### 3.2 사용자 추천 계약

사용자 추천 정본 계약은 [user-recommendation-serializer-contract-v1.md](./user-recommendation-serializer-contract-v1.md)다.

고정 판단:

- 사용자 직접 선호 정본: `user_program_preferences`
- 추천 엔진 입력 정본: `user_recommendation_profile`
- 추천은 프로그램 요약값을 덮어쓰지 않고 `context`만 붙인다

## 4. 최종 개편 전체 축 맵

이번 개편은 아래 6축으로 본다.

| 축 | 이름 | 역할 | 중요도 | 지금 같이 해야 하는가 |
| --- | --- | --- | --- | --- |
| A | 프로그램 정본 / source provenance 축 | 프로그램의 정본 구조와 source raw/evidence 경계를 정리 | 최상 | 예 |
| B | 프로그램 화면 / serializer / API 계약 축 | 같은 프로그램이 화면마다 다르게 보이지 않게 공통 응답 구조를 고정 | 최상 | 예 |
| C | 사용자 추천 정본 축 | 추천용 사용자 선호와 파생 프로필을 정리 | 최상 | 예 |
| D | 정규화 사전 축 | 직무, 스킬, 지역, 카테고리 canonical rule을 고정 | 상 | 예 |
| E | 행동 신호 축 | 북마크, 캘린더, 상세 클릭 같은 관심 신호를 추천에 반영 | 중 | 부분만 |
| F | migration / validation / 운영 정합성 축 | SQL.md, migration chain, 검증 SQL, rollback, cleanup를 정리 | 최상 | 예 |

핵심은 `A + B + C + D + F`가 이번 개편의 메인 축이고, `E`는 1차 일부 반영 후 2차 확장으로 보는 것이다.

## 5. 축별 고정 정의

## 5.1 A축: 프로그램 정본 / source provenance 축

### 목적

- `programs`를 서비스 정본으로 재정의한다.
- source raw, field evidence, source-specific 식별자를 정본 테이블에서 분리한다.
- `compare_meta`를 보조 메타로 축소한다.

### 최종 구조

- `programs`: 서비스 정본
- `program_source_records`: raw payload, field evidence, source-specific meta
- `program_list_index`: 카드/목록 공통 summary projection

### 지금 꼭 해야 하는 이유

- 지금 가장 큰 문제는 같은 프로그램이 화면마다 다르게 보이는 것인데, 그 출발점이 `programs` 의미 혼합이다.

## 5.2 B축: 프로그램 화면 / serializer / API 계약 축

### 목적

- backend/BFF/frontend가 같은 프로그램 데이터를 각자 재가공하지 못하게 한다.

### 최종 구조

- 카드형 화면: `ProgramCardItem`
- 테이블형 목록: `ProgramListRowItem`
- 상세: `ProgramDetailResponse`
- 비교 본문: `ProgramCompareItem`

### 지금 꼭 해야 하는 이유

- DB만 고쳐도 serializer가 화면마다 다르면 다시 drift가 난다.
- 이 축이 없으면 랜딩 카드, 라이브보드, 오퍼튜니티 피드, 대시보드 추천 카드가 다시 갈라진다.

## 5.3 C축: 사용자 추천 정본 축

### 목적

- 추천 입력을 `profiles`에서 분리한다.
- 희망 직무, 지역 선호, 희망 스킬, 파생 키워드, 추천 readiness를 구조화한다.

### 최종 구조

- `profiles`: 기본 사용자 프로필
- `user_program_preferences`: 사용자 직접 선호
- `user_recommendation_profile`: 추천 엔진 입력 정본
- `recommendations`: 추천 결과 cache

### 지금 꼭 해야 하는 이유

- 지금은 `bio`, `skills`, `activities`, payload가 즉석 조합돼 캐시와 관련도 계산이 흔들린다.

## 5.4 D축: 정규화 사전 축

### 목적

- `job`, `skill`, `region`, `category`를 저장소 전체에서 같은 기준으로 정규화한다.

### 최종 구조

- `job normalizer`
- `skill normalizer`
- `region normalizer`
- `category mapper`

### 지금 꼭 해야 하는 이유

- 추천과 검색과 비교가 같은 의미를 기준으로 계산되려면 canonical rule이 먼저 있어야 한다.
- 이 축이 빠지면 `target_job_normalized`, `skills`, `preferred_regions`가 있어도 품질이 흔들린다.

## 5.5 E축: 행동 신호 축

### 목적

- 북마크, 캘린더 선택, 상세 클릭 같은 실제 관심 신호를 추천에 반영한다.

### 최종 구조

- 1차: 기존 `program_bookmarks`, `calendar_program_selections` 직접 활용
- 2차: 필요하면 `user_program_events` 같은 통합 이벤트 축으로 확장

### 왜 2순위인가

- 중요하지만, 프로그램 정본/추천 정본/serializer를 고치기 전에는 얹을 토대가 불안정하다.

## 5.6 F축: migration / validation / 운영 정합성 축

### 목적

- 설계만 맞고 실제 migration chain, SQL.md, 코드 계약이 어긋나는 상태를 막는다.

### 포함 범위

- migration 파일 체인
- backfill
- dual write
- read switch
- validate SQL
- rollback
- `supabase/SQL.md`
- `supabase/README.md`

### 지금 꼭 해야 하는 이유

- 이번 개편은 범위가 커서 검증 축이 없으면 다시 drift가 누적된다.

## 6. 무엇을 지금 같이 하고, 무엇을 나중에 할지

### 지금 같이 해야 하는 것

- A축 프로그램 정본 구조
- B축 프로그램 화면/API/serializer 계약
- C축 사용자 추천 정본 구조
- D축 정규화 사전 최소 버전
- F축 migration / validation 체계

### 지금 일부만 하고 나중에 확장할 것

- E축 행동 신호

행동 신호는 1차에서 아래까지만 반영한다.

- `program_bookmarks`
- `calendar_program_selections`

아래는 2차로 미룬다.

- 상세 클릭 개인 이벤트
- `user_program_events` 통합 이벤트 모델
- 추천 피드백 loop

## 7. 최종 구현 순서

### Phase 0. 계약 고정

- `program-surface-contract-v2`
- `user-recommendation-serializer-contract-v1`
- 이 문서

### Phase 1. 사용자 추천 축 선반영

- `profiles.target_job`
- `user_program_preferences`
- `user_recommendation_profile`
- `recommendations` contract align

이 단계는 이미 설계와 draft SQL까지 내려와 있다.

### Phase 2. 프로그램 정본 스키마 개편

- `programs`
- `program_source_records`
- `program_list_index`

### Phase 3. 공통 serializer / API 계약 전환

- 카드형 화면 공통 summary
- 테이블형 목록 row 계약
- 상세 계약
- 추천 context 연결

### Phase 4. 정규화 사전 공용화

- job
- skill
- region
- category

### Phase 5. 행동 신호 1차 반영

- bookmark
- calendar selection

### Phase 6. cleanup / validation / docs sync

- legacy fallback 제거
- `compare_meta` 축소
- `SQL.md`, `README`, `current-state` 정리

## 8. 축 간 의존 관계

의존 관계는 아래처럼 고정한다.

- `B축`은 `A축` 없이는 완성될 수 없다.
- `C축`은 `D축` 없이는 품질이 흔들린다.
- `E축`은 `C축` 위에 얹어야 한다.
- `F축`은 전 축을 따라간다.

즉, 실제 실행 의존 순서는 아래다.

1. 계약 고정
2. 사용자 추천 정본
3. 프로그램 정본
4. serializer / API 전환
5. 정규화 사전
6. 행동 신호
7. cleanup / validate

## 9. 이번 문서에서 최종 고정하는 판단

- 이번 개편은 `DB 2축`만의 문제가 아니다.
- 실제 메인 축은 `프로그램 정본`, `프로그램 화면/API 계약`, `사용자 추천 정본`, `정규화 사전`, `운영 정합성`까지 5축이다.
- 행동 신호는 중요하지만 1차 전체 개편의 메인 축이 아니라 `1.5차 확장 축`이다.
- 프로그램 축과 추천 축은 반드시 `program-surface-contract-v2`를 기준으로 다시 만나야 한다.
- 앞으로 새 창에서 작업을 이어갈 때도 이 문서를 상위 기준으로 삼는다.
