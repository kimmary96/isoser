# HTML Collector Dynamic Retrieve Diagnostic

## Summary

- Mode: `read-only-live-diagnostic`
- Started at: `2026-04-23T22:50:26+0900`
- Duration: `20464.8` ms
- HTML collectors checked: `14`
- Playwright probe candidates: `0`

- `healthy_static_html`: `12`
- `partial_parse_empty_monitor`: `2`

## Sources

| Source | Class | Raw | Normalized | Duration ms | Status | Classification |
| --- | --- | ---: | ---: | ---: | --- | --- |
| 서울경제진흥원 사업신청 | `SbaPostingCollector` | 10 | 10 | 2362.84 | success | healthy_static_html |
| 서울시 50플러스 | `Seoul50PlusCollector` | 12 | 12 | 530.13 | success | healthy_static_html |
| 서울일자리포털 | `SeoulJobPortalCollector` | 10 | 10 | 1742.46 | success | healthy_static_html |
| 서울캠퍼스타운 | `CampusTownCollector` | 20 | 20 | 666.83 | success | healthy_static_html |
| 서울커리업 | `SeoulWomanUpCollector` | 18 | 18 | 327.67 | success | healthy_static_html |
| 청년취업사관학교 SeSAC | `SesacCollector` | 12 | 12 | 226.01 | success | healthy_static_html |
| KISED | `KisedCollector` | 39 | 39 | 643.8 | success | healthy_static_html |
| KOBIA | `KobiaCollector` | 10 | 10 | 170.81 | success | healthy_static_html |
| 구로 청년이룸 | `GuroCollector` | 4 | 4 | 252.72 | success | healthy_static_html |
| 노원구 청년일자리센터 청년내일 | `NowonCollector` | 10 | 10 | 2207.28 | success | healthy_static_html |
| 도봉구청 일자리경제과 | `DobongCollector` | 1 | 1 | 3556.47 | success | partial_parse_empty_monitor |
| 도봉구청년창업센터 | `DobongStartupCollector` | 33 | 33 | 702.74 | success | healthy_static_html |
| 마포구고용복지지원센터 | `MapoCollector` | 6 | 6 | 1062.28 | success | healthy_static_html |
| 서울청년센터 성동 | `SeongdongCollector` | 5 | 5 | 6012.36 | success | partial_parse_empty_monitor |

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

## OCR / Image Preflight

- Mode: `read-only-detail-html-preflight`
- Detail sample limit per source: `2`
- OCR runtime opt-in candidates: `0`
- Poster/attachment review candidates: `7`

- `detail_probe_inconclusive`: `3`
- `poster_or_attachment_candidate`: `7`
- `text_sufficient_no_ocr`: `4`

| Source | OCR classification | Evidence |
| --- | --- | --- |
| 서울경제진흥원 사업신청 | text_sufficient_no_ocr | items=10, short_list_text=0, attachment_signals=0, image_signals=0 |
| 서울시 50플러스 | detail_probe_inconclusive | items=12, short_list_text=4, attachment_signals=0, image_signals=0 |
| 서울일자리포털 | poster_or_attachment_candidate | items=10, short_list_text=8, attachment_signals=0, image_signals=0, detail_checked=2, detail_fetch_failed=0, detail_attachments=4, detail_low_text_images=0, detail_text_sufficient=2 |
| 서울캠퍼스타운 | poster_or_attachment_candidate | items=20, short_list_text=10, attachment_signals=0, image_signals=0, detail_checked=2, detail_fetch_failed=0, detail_attachments=2, detail_low_text_images=0, detail_text_sufficient=2 |
| 서울커리업 | text_sufficient_no_ocr | items=18, short_list_text=18, attachment_signals=0, image_signals=0, detail_checked=2, detail_fetch_failed=0, detail_attachments=0, detail_low_text_images=0, detail_text_sufficient=2 |
| 청년취업사관학교 SeSAC | detail_probe_inconclusive | items=12, short_list_text=4, attachment_signals=0, image_signals=0 |
| KISED | detail_probe_inconclusive | items=39, short_list_text=37, attachment_signals=0, image_signals=0, detail_checked=2, detail_fetch_failed=0, detail_attachments=0, detail_low_text_images=0, detail_text_sufficient=0 |
| KOBIA | poster_or_attachment_candidate | items=10, short_list_text=10, attachment_signals=0, image_signals=0, detail_checked=2, detail_fetch_failed=0, detail_attachments=2, detail_low_text_images=0, detail_text_sufficient=2 |
| 구로 청년이룸 | text_sufficient_no_ocr | items=4, short_list_text=4, attachment_signals=0, image_signals=0, detail_checked=2, detail_fetch_failed=0, detail_attachments=0, detail_low_text_images=0, detail_text_sufficient=2 |
| 노원구 청년일자리센터 청년내일 | poster_or_attachment_candidate | items=10, short_list_text=6, attachment_signals=0, image_signals=0, detail_checked=2, detail_fetch_failed=0, detail_attachments=3, detail_low_text_images=0, detail_text_sufficient=2 |
| 도봉구청 일자리경제과 | poster_or_attachment_candidate | items=1, short_list_text=1, attachment_signals=0, image_signals=0, detail_checked=1, detail_fetch_failed=0, detail_attachments=1, detail_low_text_images=0, detail_text_sufficient=1 |
| 도봉구청년창업센터 | poster_or_attachment_candidate | items=33, short_list_text=27, attachment_signals=0, image_signals=0, detail_checked=2, detail_fetch_failed=0, detail_attachments=1, detail_low_text_images=0, detail_text_sufficient=2 |
| 마포구고용복지지원센터 | poster_or_attachment_candidate | items=6, short_list_text=6, attachment_signals=0, image_signals=0, detail_checked=2, detail_fetch_failed=0, detail_attachments=6, detail_low_text_images=0, detail_text_sufficient=2 |
| 서울청년센터 성동 | text_sufficient_no_ocr | items=5, short_list_text=3, attachment_signals=0, image_signals=0, detail_checked=2, detail_fetch_failed=0, detail_attachments=0, detail_low_text_images=0, detail_text_sufficient=2 |

## OCR Decision

No source currently has enough evidence for OCR runtime adoption. Poster/attachment signals exist, but sampled detail HTML still exposes enough text; verify field gaps before proposing source-specific OCR opt-in.
