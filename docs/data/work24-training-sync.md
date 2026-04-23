# Work24 Training Sync

고용24 국민내일배움카드 훈련과정 목록 API(`callOpenApiSvcInfo310L01.do`) 수집 설정입니다.

## Scheduler Env

| env | API param | 기본값 | 설명 |
|---|---|---|---|
| `WORK24_TRAINING_AUTH_KEY` | `authKey` | 없음 | 필수 인증키 |
| `WORK24_TRAINING_START_DT` | `srchTraStDt` | 오늘 | 훈련시작일 From, `YYYYMMDD` |
| `WORK24_TRAINING_END_DT` | `srchTraEndDt` | 오늘 + 6개월 | 훈련시작일 To, `YYYYMMDD` |
| `WORK24_TRAINING_AREA1` | `srchTraArea1` | `11` | 훈련지역 대분류. `ALL`이면 파라미터 생략 |
| `WORK24_TRAINING_AREA2` | `srchTraArea2` | 없음 | 훈련지역 중분류 |
| `WORK24_TRAINING_NCS1` | `srchNcs1` | 없음 | NCS 1차분류 |
| `WORK24_TRAINING_NCS2` | `srchNcs2` | 없음 | NCS 2차분류 |
| `WORK24_TRAINING_NCS3` | `srchNcs3` | 없음 | NCS 3차분류 |
| `WORK24_TRAINING_NCS4` | `srchNcs4` | 없음 | NCS 4차분류 |
| `WORK24_TRAINING_WKEND_SE` | `wkendSe` | 없음 | 주말/주중 구분 |
| `WORK24_TRAINING_CRSE_TRACSE_SE` | `crseTracseSe` | 없음 | 훈련유형 |
| `WORK24_TRAINING_TRA_GBN` | `srchTraGbn` | 없음 | 훈련구분코드 |
| `WORK24_TRAINING_TRA_TYPE` | `srchTraType` | 없음 | 훈련종류 |
| `WORK24_TRAINING_PROCESS_NAME` | `srchTraProcessNm` | 없음 | 훈련과정명 |
| `WORK24_TRAINING_ORGAN_NAME` | `srchTraOrganNm` | 없음 | 훈련기관명 |
| `WORK24_TRAINING_SORT` | `sort` | `ASC` | 정렬방법 |
| `WORK24_TRAINING_SORT_COL` | `sortCol` | `2` | 정렬컬럼. `2`는 훈련시작일 |

## Admin Sync Query

`POST /admin/sync/programs`는 같은 API 파라미터를 query alias로 받습니다.

```text
start_dt=20260423
end_dt=20261023
srchTraArea1=11
srchTraArea2=11680
srchNcs1=20
srchNcs2=2001
srchNcs3=200102
srchNcs4=20010201
wkendSe=3
crseTracseSe=C0104
srchTraGbn=M1005
srchTraType=M1010
srchTraProcessNm=AI
srchTraOrganNm=테스트기관
sort=DESC
sortCol=5
max_pages=2
```

기존 `area_code`와 `ncs_code` query는 후방 호환으로 유지합니다. `ncs_code`만 전달하면 코드 길이에 따라 `srchNcs1~4` 중 하나로 변환합니다.

## Region Normalization

Work24 응답의 `address`와 `trngAreaCd`를 사용해 `programs.region`과 `programs.region_detail`을 채웁니다.

| 입력 | 결과 |
|---|---|
| `address=서울 강남구` | `region=서울`, `region_detail=강남구` |
| `address=부산광역시 해운대구` | `region=부산`, `region_detail=해운대구` |
| `trngAreaCd=41135`, 주소 없음 | `region=경기`, `region_detail=경기` |
