# HTML Collector Dynamic Retrieve Diagnostic

## Summary

- Mode: `read-only-live-diagnostic`
- Started at: `2026-04-23T23:54:23+0900`
- Duration: `26939.66` ms
- HTML collectors checked: `14`
- Playwright probe candidates: `0`

- `healthy_static_html`: `12`
- `partial_parse_empty_monitor`: `2`

## Sources

| Source | Class | Raw | Normalized | Duration ms | Status | Classification |
| --- | --- | ---: | ---: | ---: | --- | --- |
| 서울경제진흥원 사업신청 | `SbaPostingCollector` | 10 | 10 | 2526.22 | success | healthy_static_html |
| 서울시 50플러스 | `Seoul50PlusCollector` | 12 | 12 | 589.15 | success | healthy_static_html |
| 서울일자리포털 | `SeoulJobPortalCollector` | 10 | 10 | 1820.12 | success | healthy_static_html |
| 서울캠퍼스타운 | `CampusTownCollector` | 20 | 20 | 648.22 | success | healthy_static_html |
| 서울커리업 | `SeoulWomanUpCollector` | 18 | 18 | 313.98 | success | healthy_static_html |
| 청년취업사관학교 SeSAC | `SesacCollector` | 12 | 12 | 232.73 | success | healthy_static_html |
| KISED | `KisedCollector` | 39 | 39 | 738.71 | success | healthy_static_html |
| KOBIA | `KobiaCollector` | 10 | 10 | 208.1 | success | healthy_static_html |
| 구로 청년이룸 | `GuroCollector` | 4 | 4 | 237.78 | success | healthy_static_html |
| 노원구 청년일자리센터 청년내일 | `NowonCollector` | 10 | 10 | 8500.03 | success | healthy_static_html |
| 도봉구청 일자리경제과 | `DobongCollector` | 1 | 1 | 3433.56 | success | partial_parse_empty_monitor |
| 도봉구청년창업센터 | `DobongStartupCollector` | 33 | 33 | 605.31 | success | healthy_static_html |
| 마포구고용복지지원센터 | `MapoCollector` | 6 | 6 | 1088.38 | success | healthy_static_html |
| 서울청년센터 성동 | `SeongdongCollector` | 5 | 5 | 5994.91 | success | partial_parse_empty_monitor |

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

## OCR / Image Preflight

- Mode: `read-only-detail-html-preflight`
- Detail sample limit per source: `2`
- OCR runtime opt-in candidates: `0`
- Poster/attachment review candidates: `7`
- Detail/parser follow-up candidates: `3`

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

### OCR Sample Highlights

#### 서울일자리포털

- `fetched` `https://job.seoul.go.kr/hmpg/chjb/prmg/prmgDetail.do?recmnt_pbanc_no=4680960E0D970230E063C0A8A0281CEB` (text=7548, images=5, attachments=4)
- `fetched` `https://newdeal.koraia.org/` (text=1935, images=13, attachments=0)

#### 서울캠퍼스타운

- `fetched` `https://campustown.seoul.go.kr/site/main/board/university_news/3003?cp=1&sortOrder=BA_REGDATE&sortDirection=DESC&listType=list&bcId=university_news&baNotice=false&baCommSelec=false&baOpenDay=false&baUse=true` (text=1743, images=5, attachments=1)
- `fetched` `https://campustown.seoul.go.kr/site/main/board/university_news/2993?cp=1&sortOrder=BA_REGDATE&sortDirection=DESC&listType=list&bcId=university_news&baNotice=false&baCommSelec=false&baOpenDay=false&baUse=true` (text=2659, images=6, attachments=1)

#### KISED

- `fetched` `https://www.k-startup.go.kr/web/contents/webDSCSN_MNG.do` (text=34, images=0, attachments=0)
- `fetched` `https://www.open.go.kr` (text=12, images=0, attachments=0)

#### KOBIA

- `fetched` `http://www.kobia.or.kr/board/view.do?idx=2870&board_kind=KNOTICE&page=1` (text=1085, images=9, attachments=1)
- `fetched` `http://www.kobia.or.kr/board/view.do?idx=2874&board_kind=KNOTICE&page=1` (text=999, images=3, attachments=1)

#### 노원구 청년일자리센터 청년내일

- `fetched` `https://www.nwjob.kr/18/?q=YToxOntzOjEyOiJrZXl3b3JkX3R5cGUiO3M6MzoiYWxsIjt9&bmode=view&idx=170956396&t=board` (text=763, images=16, attachments=2)
- `fetched` `https://www.nwjob.kr/18/?q=YToxOntzOjEyOiJrZXl3b3JkX3R5cGUiO3M6MzoiYWxsIjt9&bmode=view&idx=170938349&t=board` (text=1087, images=12, attachments=1)

#### 도봉구청 일자리경제과

- `fetched` `https://www.dobong.go.kr/bbs.asp?bmode=D&pcode=12742709&code=10008770` (text=9906, images=41, attachments=1)

#### 도봉구청년창업센터

- `fetched` `https://dobongstartup.com/bbs/board.php?bo_table=donotic&wr_id=148` (text=1602, images=5, attachments=0)
- `fetched` `https://dobongstartup.com/bbs/board.php?bo_table=donotic&wr_id=147` (text=1256, images=7, attachments=1)

#### 마포구고용복지지원센터

- `fetched` `https://mapoworkfare.or.kr/1136099` (text=5474, images=45, attachments=1)
- `fetched` `https://mapoworkfare.or.kr/1136037` (text=5496, images=48, attachments=5)


## OCR Decision

No source currently has enough evidence for OCR runtime adoption. Poster/attachment signals exist, but sampled detail HTML still exposes enough text; verify field gaps before proposing source-specific OCR opt-in.
