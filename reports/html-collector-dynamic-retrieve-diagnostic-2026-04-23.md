# HTML Collector Dynamic Retrieve Diagnostic

## Summary

- Mode: `read-only-live-diagnostic`
- Started at: `2026-04-23T23:54:09+0900`
- Duration: `13127.23` ms
- HTML collectors checked: `14`
- Playwright probe candidates: `0`

- `healthy_static_html`: `12`
- `partial_parse_empty_monitor`: `2`

## Sources

| Source | Class | Raw | Normalized | Duration ms | Status | Classification |
| --- | --- | ---: | ---: | ---: | --- | --- |
| 서울경제진흥원 사업신청 | `SbaPostingCollector` | 10 | 10 | 2732.7 | success | healthy_static_html |
| 서울시 50플러스 | `Seoul50PlusCollector` | 12 | 12 | 480.46 | success | healthy_static_html |
| 서울일자리포털 | `SeoulJobPortalCollector` | 10 | 10 | 1579.39 | success | healthy_static_html |
| 서울캠퍼스타운 | `CampusTownCollector` | 20 | 20 | 254.42 | success | healthy_static_html |
| 서울커리업 | `SeoulWomanUpCollector` | 18 | 18 | 125.32 | success | healthy_static_html |
| 청년취업사관학교 SeSAC | `SesacCollector` | 12 | 12 | 216.14 | success | healthy_static_html |
| KISED | `KisedCollector` | 39 | 39 | 347.83 | success | healthy_static_html |
| KOBIA | `KobiaCollector` | 10 | 10 | 36.97 | success | healthy_static_html |
| 구로 청년이룸 | `GuroCollector` | 4 | 4 | 107.12 | success | healthy_static_html |
| 노원구 청년일자리센터 청년내일 | `NowonCollector` | 10 | 10 | 797.15 | success | healthy_static_html |
| 도봉구청 일자리경제과 | `DobongCollector` | 1 | 1 | 2421.31 | success | partial_parse_empty_monitor |
| 도봉구청년창업센터 | `DobongStartupCollector` | 33 | 33 | 317.98 | success | healthy_static_html |
| 마포구고용복지지원센터 | `MapoCollector` | 6 | 6 | 339.53 | success | healthy_static_html |
| 서울청년센터 성동 | `SeongdongCollector` | 5 | 5 | 3368.03 | success | partial_parse_empty_monitor |

## Recommendations

### 도봉구청 일자리경제과

- Classification: `partial_parse_empty_monitor`
- Evidence: `status=success`, `raw=1`, `normalized=1`, `parse_empty=1`, `request_failed=0`
- Recommendation: 일부 URL은 비었지만 같은 source에서 수집 성공도 있다. Playwright 도입 전 빈 URL의 HTML snapshot/selector drift를 확인한다.

### 서울청년센터 성동

- Classification: `partial_parse_empty_monitor`
- Evidence: `status=success`, `raw=5`, `normalized=5`, `parse_empty=1`, `request_failed=0`
- Recommendation: 일부 URL은 비었지만 같은 source에서 수집 성공도 있다. Playwright 도입 전 빈 URL의 HTML snapshot/selector drift를 확인한다.

## Playwright Decision

No source currently has enough evidence for Playwright fallback. Keep dynamic retrieve behind source-specific opt-in after repeated full parse-empty and HTML snapshot evidence.

## HTML Snapshots

- Output directory: `reports\html-collector-snapshots-2026-04-23`
- Saved snapshots: `2`

### 도봉구청 일자리경제과

- `parse_empty` `https://www.dobong.go.kr/bbs.asp?code=10008769` -> `reports\html-collector-snapshots-2026-04-23\dobong_district_jobs-list-1-parse_empty.html` (title=`열린행정>알림마당>공지사항(목록)`, scripts=25, noscript=0)

### 서울청년센터 성동

- `parse_empty` `https://youth.seoul.go.kr/orang/cntr/notice.do?key=2309210001&cntrId=CT00006` -> `reports\html-collector-snapshots-2026-04-23\seongdong_youth_center-list-2-parse_empty.html` (title=`내 지역 센터 찾기 | 서울청년센터`, scripts=18, noscript=0)

## Scheduler Dry-Run Summary

- HTML sources: `14`
- Sources with quality warnings: `0`
- Sources with quality errors: `0`

- `dry_run`: `14`

| Source | Dry-run status | Checked rows | Warnings | Errors |
| --- | --- | ---: | ---: | ---: |
| 서울경제진흥원 사업신청 | dry_run | 10 | 0 | 0 |
| 서울시 50플러스 | dry_run | 12 | 0 | 0 |
| 서울일자리포털 | dry_run | 10 | 0 | 0 |
| 서울캠퍼스타운 | dry_run | 20 | 0 | 0 |
| 서울커리업 | dry_run | 18 | 0 | 0 |
| 청년취업사관학교 SeSAC | dry_run | 12 | 0 | 0 |
| KISED | dry_run | 39 | 0 | 0 |
| KOBIA | dry_run | 10 | 0 | 0 |
| 구로 청년이룸 | dry_run | 4 | 0 | 0 |
| 노원구 청년일자리센터 청년내일 | dry_run | 10 | 0 | 0 |
| 도봉구청 일자리경제과 | dry_run | 1 | 0 | 0 |
| 도봉구청년창업센터 | dry_run | 33 | 0 | 0 |
| 마포구고용복지지원센터 | dry_run | 6 | 0 | 0 |
| 서울청년센터 성동 | dry_run | 5 | 0 | 0 |

- Aggregated quality checked rows: `190`
- Aggregated issue counts: `error=0, warning=0, info=178`
