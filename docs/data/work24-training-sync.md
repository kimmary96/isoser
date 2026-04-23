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
| `WORK24_COMMON_CODES_AUTH_KEY` | `authKey` | 없음 | 선택. 공통 코드 API `dtlGb=1` 지역 중분류를 `region_detail` 시군구명으로 변환할 때 사용 |

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

## Deadline Mapping

목록 API는 실제 신청 마감일 필드를 제공하지 않습니다. 그래서 `traStartDate`를 모집기한 fallback으로 `programs.deadline`과 `compare_meta.application_deadline`에 저장하고, `compare_meta.deadline_source=traStartDate`를 함께 남깁니다. `traEndDate`는 훈련 종료일이므로 `programs.end_date`와 `compare_meta.training_end_date`로만 저장합니다.

## Region Partition Sync

전국 단일 조회는 6개월 기준 Work24 API의 100,000건 페이지 한도를 넘을 수 있으므로 `scripts/work24_partition_sync.py`로 `srchTraArea1` 광역 지역별 partition sync를 실행합니다. 기본 순서는 서울을 이미 sync했다는 전제에서 서울 인접 권역부터 진행합니다.

```text
경기(41) -> 인천(28) -> 강원(51) -> 충북(43) -> 충남(44) -> 세종(36) -> 대전(30) -> 전북(45) -> 경북(47) -> 대구(27) -> 경남(48) -> 울산(31) -> 부산(26) -> 전남(46) -> 광주(29) -> 제주(50)
```

Preview:

```powershell
backend\venv\Scripts\python.exe scripts\work24_partition_sync.py --report-path reports\work24_partition_preview_YYYYMMDD.json
```

서울부터 포함해 전체 실행:

```powershell
backend\venv\Scripts\python.exe scripts\work24_partition_sync.py --include-seoul --apply --report-path reports\work24_partition_sync_YYYYMMDD.json
```

서울을 건너뛰고 경기부터 대전까지만 실행:

```powershell
backend\venv\Scripts\python.exe scripts\work24_partition_sync.py --apply --stop-after 대전 --report-path reports\work24_partition_sync_to_daejeon_YYYYMMDD.json
```

DB upsert가 끝난 뒤 추천 인덱스까지 함께 갱신하려면 persistent Chroma 환경에서 `--sync-chroma-at-end`를 붙입니다. 이 옵션은 `--apply` 실행 뒤 처리한 row의 `source_unique_key`로 DB row를 다시 조회해 canonical `id`를 확보한 다음 Chroma programs collection에 sync합니다. `CHROMA_MODE`가 `persistent`가 아니면 인덱스가 프로세스 종료 후 유지되지 않으므로 report에 `status=skipped`, `reason=non_persistent_chroma_mode`를 남기고 Chroma sync를 실행하지 않습니다.

```powershell
$env:CHROMA_MODE="persistent"
$env:CHROMA_PERSIST_DIR="D:\isoser-chroma-store"
backend\venv\Scripts\python.exe scripts\work24_partition_sync.py --apply --sync-chroma-at-end --report-path reports\work24_partition_sync_with_chroma_YYYYMMDD.json
```

## Region Normalization

Work24 응답의 `address`와 `trngAreaCd`를 사용해 `programs.region`과 `programs.region_detail`을 채웁니다.
`WORK24_COMMON_CODES_AUTH_KEY`가 있으면 공통 코드 API의 `dtlGb=1` 지역 코드표를 먼저 읽어 `trngAreaCd=41135` 같은 중분류 코드를 `성남시 분당구`처럼 시군구명으로 변환합니다.
공통 코드 조회가 불가하거나 코드가 없으면 주소 텍스트를 사용하고, 주소도 없으면 지역 코드 앞 두 자리의 광역 지역까지만 fallback합니다.

| 입력 | 결과 |
|---|---|
| `address=서울 강남구` | `region=서울`, `region_detail=강남구` |
| `address=부산광역시 해운대구` | `region=부산`, `region_detail=해운대구` |
| `trngAreaCd=41135`, 공통 코드 map 있음 | `region=경기`, `region_detail=성남시 분당구` |
| `trngAreaCd=41135`, 공통 코드 map 없음, 주소 없음 | `region=경기`, `region_detail=경기` |
