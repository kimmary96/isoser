# HTML Collector Dynamic Retrieve Diagnostic

## Summary

- Mode: `read-only-live-diagnostic`
- Started at: `2026-04-23T22:47:25+0900`
- Duration: `13599.05` ms
- HTML collectors checked: `14`
- Playwright probe candidates: `0`

- `healthy_static_html`: `12`
- `partial_parse_empty_monitor`: `2`

## Sources

| Source | Class | Raw | Normalized | Duration ms | Status | Classification |
| --- | --- | ---: | ---: | ---: | --- | --- |
| 서울경제진흥원 사업신청 | `SbaPostingCollector` | 10 | 10 | 2347.15 | success | healthy_static_html |
| 서울시 50플러스 | `Seoul50PlusCollector` | 12 | 12 | 486.12 | success | healthy_static_html |
| 서울일자리포털 | `SeoulJobPortalCollector` | 10 | 10 | 1470.59 | success | healthy_static_html |
| 서울캠퍼스타운 | `CampusTownCollector` | 20 | 20 | 232.85 | success | healthy_static_html |
| 서울커리업 | `SeoulWomanUpCollector` | 18 | 18 | 127.76 | success | healthy_static_html |
| 청년취업사관학교 SeSAC | `SesacCollector` | 12 | 12 | 225.44 | success | healthy_static_html |
| KISED | `KisedCollector` | 39 | 39 | 376.3 | success | healthy_static_html |
| KOBIA | `KobiaCollector` | 10 | 10 | 43.08 | success | healthy_static_html |
| 구로 청년이룸 | `GuroCollector` | 4 | 4 | 103.96 | success | healthy_static_html |
| 노원구 청년일자리센터 청년내일 | `NowonCollector` | 10 | 10 | 627.93 | success | healthy_static_html |
| 도봉구청 일자리경제과 | `DobongCollector` | 1 | 1 | 1843.62 | success | partial_parse_empty_monitor |
| 도봉구청년창업센터 | `DobongStartupCollector` | 33 | 33 | 1606.84 | success | healthy_static_html |
| 마포구고용복지지원센터 | `MapoCollector` | 6 | 6 | 283.48 | success | healthy_static_html |
| 서울청년센터 성동 | `SeongdongCollector` | 5 | 5 | 3823.62 | success | partial_parse_empty_monitor |

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
