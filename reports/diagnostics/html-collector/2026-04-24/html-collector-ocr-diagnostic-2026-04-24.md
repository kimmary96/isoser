# HTML Collector Dynamic Retrieve Diagnostic

## Summary

- Mode: `read-only-live-diagnostic`
- Started at: `2026-04-24T00:31:07+0900`
- Duration: `21776.8` ms
- HTML collectors checked: `14`
- Playwright probe candidates: `0`

- `healthy_static_html`: `12`
- `partial_parse_empty_monitor`: `2`

## Sources

| Source | Class | Raw | Normalized | Duration ms | Status | Classification |
| --- | --- | ---: | ---: | ---: | --- | --- |
| 서울경제진흥원 사업신청 | `SbaPostingCollector` | 10 | 10 | 2319.88 | success | healthy_static_html |
| 서울시 50플러스 | `Seoul50PlusCollector` | 12 | 12 | 549.43 | success | healthy_static_html |
| 서울일자리포털 | `SeoulJobPortalCollector` | 10 | 10 | 1923.36 | success | healthy_static_html |
| 서울캠퍼스타운 | `CampusTownCollector` | 20 | 20 | 714.97 | success | healthy_static_html |
| 서울커리업 | `SeoulWomanUpCollector` | 18 | 18 | 369.25 | success | healthy_static_html |
| 청년취업사관학교 SeSAC | `SesacCollector` | 12 | 12 | 225.98 | success | healthy_static_html |
| KISED | `KisedCollector` | 39 | 39 | 739.66 | success | healthy_static_html |
| KOBIA | `KobiaCollector` | 10 | 10 | 434.66 | success | healthy_static_html |
| 구로 청년이룸 | `GuroCollector` | 3 | 3 | 231.88 | success | healthy_static_html |
| 노원구 청년일자리센터 청년내일 | `NowonCollector` | 10 | 10 | 1754.35 | success | healthy_static_html |
| 도봉구청 일자리경제과 | `DobongCollector` | 1 | 1 | 4301.97 | success | partial_parse_empty_monitor |
| 도봉구청년창업센터 | `DobongStartupCollector` | 33 | 33 | 1283.94 | success | healthy_static_html |
| 마포구고용복지지원센터 | `MapoCollector` | 6 | 6 | 1096.53 | success | healthy_static_html |
| 서울청년센터 성동 | `SeongdongCollector` | 3 | 3 | 5828.74 | success | partial_parse_empty_monitor |

## Recommendations

### 도봉구청 일자리경제과

- Classification: `partial_parse_empty_monitor`
- Evidence: `status=success`, `raw=1`, `normalized=1`, `parse_empty=1`, `request_failed=0`
- Recommendation: 일부 URL은 비었지만 같은 source에서 수집 성공도 있다. Playwright 도입 전 빈 URL의 HTML snapshot/selector drift를 확인한다.

### 서울청년센터 성동

- Classification: `partial_parse_empty_monitor`
- Evidence: `status=success`, `raw=3`, `normalized=3`, `parse_empty=1`, `request_failed=0`
- Recommendation: 일부 URL은 비었지만 같은 source에서 수집 성공도 있다. Playwright 도입 전 빈 URL의 HTML snapshot/selector drift를 확인한다.

## Playwright Decision

No source currently has enough evidence for Playwright fallback. Keep dynamic retrieve behind source-specific opt-in after repeated full parse-empty and HTML snapshot evidence.

## HTML Snapshots

- Output directory: `reports\html-collector-snapshots-2026-04-24`
- Saved snapshots: `2`

### 도봉구청 일자리경제과

- `parse_empty` `https://www.dobong.go.kr/bbs.asp?code=10008769` -> `reports\html-collector-snapshots-2026-04-24\dobong_district_jobs-list-1-parse_empty.html` (title=`열린행정>알림마당>공지사항(목록)`, scripts=25, noscript=0, selector_hits=2/2)

### 서울청년센터 성동

- `parse_empty` `https://youth.seoul.go.kr/orang/cntr/notice.do?key=2309210001&cntrId=CT00006` -> `reports\html-collector-snapshots-2026-04-24\seongdong_youth_center-list-2-parse_empty.html` (title=`내 지역 센터 찾기 | 서울청년센터`, scripts=18, noscript=0, selector_hits=3/4)

## Scheduler Dry-Run Summary

- HTML sources: `14`
- Sources with quality warnings: `0`
- Sources with quality errors: `0`
- Schema path: `docs/schemas/html-collector-scheduler-summary.schema.json`

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
| 구로 청년이룸 | dry_run | 3 | 0 | 0 |
| 노원구 청년일자리센터 청년내일 | dry_run | 10 | 0 | 0 |
| 도봉구청 일자리경제과 | dry_run | 1 | 0 | 0 |
| 도봉구청년창업센터 | dry_run | 33 | 0 | 0 |
| 마포구고용복지지원센터 | dry_run | 6 | 0 | 0 |
| 서울청년센터 성동 | dry_run | 3 | 0 | 0 |

- Aggregated quality checked rows: `187`
- Aggregated issue counts: `error=0, warning=0, info=175`

## OCR / Image Preflight

- Mode: `read-only-detail-html-preflight`
- Detail sample limit per source: `2`
- OCR runtime opt-in candidates: `0`
- Poster/attachment review candidates: `7`
- Detail/parser follow-up candidates: `3`
- Sources with any field gaps: `13`
- Sources with info-only field gaps: `13`

- `detail_probe_inconclusive`: `3`
- `poster_or_attachment_candidate`: `7`
- `text_sufficient_no_ocr`: `4`
- Aggregated field gaps: `provider=175`

| Source | OCR classification | Field gap rows | Top field gaps | Evidence |
| --- | --- | ---: | --- | --- |
| 서울경제진흥원 사업신청 | text_sufficient_no_ocr | 10 | provider=10 | items=10, short_list_text=0, attachment_signals=0, image_signals=0 |
| 서울시 50플러스 | detail_probe_inconclusive | 12 | provider=12 | items=12, short_list_text=4, attachment_signals=0, image_signals=0 |
| 서울일자리포털 | poster_or_attachment_candidate | 10 | provider=10 | items=10, short_list_text=8, attachment_signals=0, image_signals=0, detail_checked=2, detail_fetch_failed=0, detail_attachments=4, detail_low_text_images=0, detail_text_sufficient=2 |
| 서울캠퍼스타운 | poster_or_attachment_candidate | 20 | provider=20 | items=20, short_list_text=10, attachment_signals=0, image_signals=0, detail_checked=2, detail_fetch_failed=0, detail_attachments=2, detail_low_text_images=0, detail_text_sufficient=2 |
| 서울커리업 | text_sufficient_no_ocr | 18 | provider=18 | items=18, short_list_text=18, attachment_signals=0, image_signals=0, detail_checked=2, detail_fetch_failed=0, detail_attachments=0, detail_low_text_images=0, detail_text_sufficient=2 |
| 청년취업사관학교 SeSAC | detail_probe_inconclusive | 0 | - | items=12, short_list_text=4, attachment_signals=0, image_signals=0 |
| KISED | detail_probe_inconclusive | 39 | provider=39 | items=39, short_list_text=37, attachment_signals=0, image_signals=0, detail_checked=2, detail_fetch_failed=0, detail_attachments=0, detail_low_text_images=0, detail_text_sufficient=0 |
| KOBIA | poster_or_attachment_candidate | 10 | provider=10 | items=10, short_list_text=10, attachment_signals=0, image_signals=0, detail_checked=2, detail_fetch_failed=0, detail_attachments=2, detail_low_text_images=0, detail_text_sufficient=2 |
| 구로 청년이룸 | text_sufficient_no_ocr | 3 | provider=3 | items=3, short_list_text=3, attachment_signals=0, image_signals=0, detail_checked=2, detail_fetch_failed=0, detail_attachments=0, detail_low_text_images=0, detail_text_sufficient=2 |
| 노원구 청년일자리센터 청년내일 | poster_or_attachment_candidate | 10 | provider=10 | items=10, short_list_text=6, attachment_signals=0, image_signals=0, detail_checked=2, detail_fetch_failed=0, detail_attachments=3, detail_low_text_images=0, detail_text_sufficient=2 |
| 도봉구청 일자리경제과 | poster_or_attachment_candidate | 1 | provider=1 | items=1, short_list_text=1, attachment_signals=0, image_signals=0, detail_checked=1, detail_fetch_failed=0, detail_attachments=1, detail_low_text_images=0, detail_text_sufficient=1 |
| 도봉구청년창업센터 | poster_or_attachment_candidate | 33 | provider=33 | items=33, short_list_text=27, attachment_signals=0, image_signals=0, detail_checked=2, detail_fetch_failed=0, detail_attachments=1, detail_low_text_images=0, detail_text_sufficient=2 |
| 마포구고용복지지원센터 | poster_or_attachment_candidate | 6 | provider=6 | items=6, short_list_text=6, attachment_signals=0, image_signals=0, detail_checked=2, detail_fetch_failed=0, detail_attachments=6, detail_low_text_images=0, detail_text_sufficient=2 |
| 서울청년센터 성동 | text_sufficient_no_ocr | 3 | provider=3 | items=3, short_list_text=3, attachment_signals=0, image_signals=0, detail_checked=2, detail_fetch_failed=0, detail_attachments=0, detail_low_text_images=0, detail_text_sufficient=2 |

### OCR Sample Highlights

#### 서울일자리포털

- Field gap audit: checked_rows=10, rows_with_any_issues=10, rows_with_info_only=10
- Field gap issue codes: `missing_provider=10`
- Attachment URL samples: `https://job.seoul.go.kr/hmpg/comm/file/fileDownLoad.do?file_no=4699D1094E3E06ECE063C0A8A0286D49`, `https://job.seoul.go.kr/hmpg/comm/file/fileDownLoad.do?file_no=47D6CBB8FE9504B0E063C0A8A0284F4C`, `https://job.seoul.go.kr/hmpg/comm/file/fileDownLoad.do?file_no=4699D1094E4006ECE063C0A8A0286D49`
- Image URL samples: `https://job.seoul.go.kr/images/hmpg/logo.png`, `https://job.seoul.go.kr/images/hmpg/logo_bottom.png`, `https://job.seoul.go.kr/images/hmpg/WA_Mark.png`, `https://framerusercontent.com/images/wL3gFGdvFKnBDEAtALgd21nxY.png?width=925&height=858`, `https://framerusercontent.com/images/KFODyDPMf85CInVsmz95yO4c.png?width=856&height=820`, `https://framerusercontent.com/images/pkRgS6EqUrjkbv3C1CJ7RRwj4.png?width=875&height=802`
- `fetched` `https://job.seoul.go.kr/hmpg/chjb/prmg/prmgDetail.do?recmnt_pbanc_no=4680960E0D970230E063C0A8A0281CEB` (text=7548, images=5, attachments=4)
  attachment URLs: `https://job.seoul.go.kr/hmpg/comm/file/fileDownLoad.do?file_no=4699D1094E3E06ECE063C0A8A0286D49`, `https://job.seoul.go.kr/hmpg/comm/file/fileDownLoad.do?file_no=47D6CBB8FE9504B0E063C0A8A0284F4C`, `https://job.seoul.go.kr/hmpg/comm/file/fileDownLoad.do?file_no=4699D1094E4006ECE063C0A8A0286D49`
  image URLs: `https://job.seoul.go.kr/images/hmpg/logo.png`, `https://job.seoul.go.kr/images/hmpg/logo_bottom.png`, `https://job.seoul.go.kr/images/hmpg/WA_Mark.png`
- `fetched` `https://newdeal.koraia.org/` (text=1935, images=13, attachments=0)
  image URLs: `https://framerusercontent.com/images/wL3gFGdvFKnBDEAtALgd21nxY.png?width=925&height=858`, `https://framerusercontent.com/images/KFODyDPMf85CInVsmz95yO4c.png?width=856&height=820`, `https://framerusercontent.com/images/pkRgS6EqUrjkbv3C1CJ7RRwj4.png?width=875&height=802`
  field gap sample: `청년취업사관학교 새싹(SeSAC) 교육운영 주니어 매니저` issues=missing_provider
  field gap sample: `생성형 AI 리터러시 중심 기획·콘텐츠 실무 인재 양성 교육 및 취업 과정` issues=missing_provider
  field gap sample: `AI기반 디지털 교육콘텐츠 실무인재 양성 및 취업과정` issues=missing_provider

#### 서울캠퍼스타운

- Field gap audit: checked_rows=20, rows_with_any_issues=20, rows_with_info_only=20
- Field gap issue codes: `missing_provider=20`
- Attachment URL samples: `https://campustown.seoul.go.kr/site/main/file/download/uu/e1f020a77c004d21b407ab535cdf9cbf`, `https://campustown.seoul.go.kr/site/main/file/download/uu/73b56f7f1f904de09b5e3b6a60effbd9`
- Image URL samples: `https://campustown.seoul.go.kr/design/theme/campustown/images/logo.png`, `https://campustown.seoul.go.kr/design/theme/campustown/images/footer_logo.png`, `https://campustown.seoul.go.kr/design/theme/campustown/images/up_arrow.png`, `https://campustown.seoul.go.kr/site/main/file/image/uu/3275e73c4f24415d9c17e2a885ad787a`
- `fetched` `https://campustown.seoul.go.kr/site/main/board/university_news/3003?cp=1&sortOrder=BA_REGDATE&sortDirection=DESC&listType=list&bcId=university_news&baNotice=false&baCommSelec=false&baOpenDay=false&baUse=true` (text=1743, images=5, attachments=1)
  attachment URLs: `https://campustown.seoul.go.kr/site/main/file/download/uu/e1f020a77c004d21b407ab535cdf9cbf`
  image URLs: `https://campustown.seoul.go.kr/design/theme/campustown/images/logo.png`, `https://campustown.seoul.go.kr/design/theme/campustown/images/footer_logo.png`, `https://campustown.seoul.go.kr/design/theme/campustown/images/up_arrow.png`
- `fetched` `https://campustown.seoul.go.kr/site/main/board/university_news/2993?cp=1&sortOrder=BA_REGDATE&sortDirection=DESC&listType=list&bcId=university_news&baNotice=false&baCommSelec=false&baOpenDay=false&baUse=true` (text=2659, images=6, attachments=1)
  attachment URLs: `https://campustown.seoul.go.kr/site/main/file/download/uu/73b56f7f1f904de09b5e3b6a60effbd9`
  image URLs: `https://campustown.seoul.go.kr/design/theme/campustown/images/logo.png`, `https://campustown.seoul.go.kr/design/theme/campustown/images/footer_logo.png`, `https://campustown.seoul.go.kr/site/main/file/image/uu/3275e73c4f24415d9c17e2a885ad787a`
  field gap sample: `[국민대학교 캠퍼스타운] 2026 국민대학교 캠퍼스타운 CLUB HOUSE IR 자료 고도화 워크샵(~04.27(월), 23시 30분까지)` issues=missing_provider
  field gap sample: `2026년 서울대학교 RISE 사업단(캠퍼스타운) 추가 입주기업 모집(마감일: ~4월 10일 13:00까지)` issues=missing_provider
  field gap sample: `[중앙대학교 캠퍼스타운] 2026년 제12회 중앙대학교 캠퍼스타운 입주기업 선발 경진대회(~4/12)` issues=missing_provider

#### KISED

- Field gap audit: checked_rows=39, rows_with_any_issues=39, rows_with_info_only=39
- Field gap issue codes: `missing_provider=39`
- `fetched` `https://www.k-startup.go.kr/web/contents/webDSCSN_MNG.do` (text=34, images=0, attachments=0)
- `fetched` `https://www.open.go.kr` (text=12, images=0, attachments=0)
  field gap sample: `고객광장` issues=missing_provider
  field gap sample: `정보공개` issues=missing_provider
  field gap sample: `민간기업 분야 우수인재 특별귀화 추천 신청 모집 공고 (Announcement on the Call for Applications for Recommendation for Special Naturalization of Outstanding Private-Sector Talent)` issues=missing_provider

#### KOBIA

- Field gap audit: checked_rows=10, rows_with_any_issues=10, rows_with_info_only=10
- Field gap issue codes: `missing_provider=10`
- Attachment URL samples: `http://www.kobia.or.kr/organ/ci.do`
- Image URL samples: `http://www.kobia.or.kr/images/common/kobia_ci_kor_eng_1.png`, `http://www.kobia.or.kr/KobiaAdmin/upload/board/images/20260416133201-217-6ed32ef02a0e.jpg`, `http://www.kobia.or.kr/KobiaAdmin/upload/board/images/20260416133207-216-4a22097332e2.jpg`, `http://www.kobia.or.kr/KobiaAdmin/upload/board/images/20260423131351-cfd-d7112ea67d64.jpg`, `http://www.kobia.or.kr/images/common/kobia_ci_kor_eng_white_1.png`
- `fetched` `http://www.kobia.or.kr/board/view.do?idx=2870&board_kind=KNOTICE&page=1` (text=1085, images=9, attachments=1)
  attachment URLs: `http://www.kobia.or.kr/organ/ci.do`
  image URLs: `http://www.kobia.or.kr/images/common/kobia_ci_kor_eng_1.png`, `http://www.kobia.or.kr/KobiaAdmin/upload/board/images/20260416133201-217-6ed32ef02a0e.jpg`, `http://www.kobia.or.kr/KobiaAdmin/upload/board/images/20260416133207-216-4a22097332e2.jpg`
- `fetched` `http://www.kobia.or.kr/board/view.do?idx=2874&board_kind=KNOTICE&page=1` (text=999, images=3, attachments=1)
  attachment URLs: `http://www.kobia.or.kr/organ/ci.do`
  image URLs: `http://www.kobia.or.kr/images/common/kobia_ci_kor_eng_1.png`, `http://www.kobia.or.kr/KobiaAdmin/upload/board/images/20260423131351-cfd-d7112ea67d64.jpg`, `http://www.kobia.or.kr/images/common/kobia_ci_kor_eng_white_1.png`
  field gap sample: `공고 [채용공고] (사)한국창업보육협회 2026년 제2차 직원 채용 공고` issues=missing_provider
  field gap sample: `안내 한국여성경제인협회 2026년 펨테크 산업 육성 지원기업 모집 통합 공고` issues=missing_provider
  field gap sample: `안내 [ICT콤플랙스] 지역 우수기업-개발자 네트워킹` issues=missing_provider

#### 노원구 청년일자리센터 청년내일

- Field gap audit: checked_rows=10, rows_with_any_issues=10, rows_with_info_only=10
- Field gap issue codes: `missing_provider=10`
- Attachment URL samples: `https://www.nwjob.kr/post_file_download.cm?c=YTo1OntzOjEwOiJib2FyZF9jb2RlIjtzOjIyOiJiMjAyMzAyMTkyOTI2OGMwNWUxMzliIjtzOjk6InBvc3RfY29kZSI7czoyMjoicDIwMjYwNDIxNTVmNjY0ZDg3NTMwNyI7czo5OiJmaWxlX2NvZGUiO3M6MjI6InAyMDI2MDQyMWU2NzNlN2MwOTIyNTMiO3M6MTk6InBvc3RfZG93bmxvYWRfdG9rZW4iO3M6MTM6IjY5ZWEzYjJmZDdhODEiO3M6MTE6Im1lbWJlcl9jb2RlIjtOO30=`, `https://www.nwjob.kr/post_file_download.cm?c=YTo1OntzOjEwOiJib2FyZF9jb2RlIjtzOjIyOiJiMjAyMzAyMTkyOTI2OGMwNWUxMzliIjtzOjk6InBvc3RfY29kZSI7czoyMjoicDIwMjYwNDIxNTVmNjY0ZDg3NTMwNyI7czo5OiJmaWxlX2NvZGUiO3M6MjI6InAyMDI2MDQyMWViMjQ4NmZlMTI4NTMiO3M6MTk6InBvc3RfZG93bmxvYWRfdG9rZW4iO3M6MTM6IjY5ZWEzYjJmZDg0NTIiO3M6MTE6Im1lbWJlcl9jb2RlIjtOO30=`, `https://www.nwjob.kr/post_file_download.cm?c=YTo1OntzOjEwOiJib2FyZF9jb2RlIjtzOjIyOiJiMjAyMzAyMTkyOTI2OGMwNWUxMzliIjtzOjk6InBvc3RfY29kZSI7czoyMjoicDIwMjYwNDIwYTM3N2VkNjUzOWNhZSI7czo5OiJmaWxlX2NvZGUiO3M6MjI6InAyMDI2MDQyMGYwZTBmOGVmOGQ2ODMiO3M6MTk6InBvc3RfZG93bmxvYWRfdG9rZW4iO3M6MTM6IjY5ZWEzYjMwN2RmMjkiO3M6MTE6Im1lbWJlcl9jb2RlIjtOO30=`
- Image URL samples: `https://www.nwjob.kr/common/img/default_profile.png`, `https://cdn.imweb.me/thumbnail/20230322/068b03ab88ff0.png`, `https://cdn.imweb.me/thumbnail/20230311/f34de9b5802f0.png`
- `fetched` `https://www.nwjob.kr/18/?q=YToxOntzOjEyOiJrZXl3b3JkX3R5cGUiO3M6MzoiYWxsIjt9&bmode=view&idx=170956396&t=board` (text=763, images=16, attachments=2)
  attachment URLs: `https://www.nwjob.kr/post_file_download.cm?c=YTo1OntzOjEwOiJib2FyZF9jb2RlIjtzOjIyOiJiMjAyMzAyMTkyOTI2OGMwNWUxMzliIjtzOjk6InBvc3RfY29kZSI7czoyMjoicDIwMjYwNDIxNTVmNjY0ZDg3NTMwNyI7czo5OiJmaWxlX2NvZGUiO3M6MjI6InAyMDI2MDQyMWU2NzNlN2MwOTIyNTMiO3M6MTk6InBvc3RfZG93bmxvYWRfdG9rZW4iO3M6MTM6IjY5ZWEzYjJmZDdhODEiO3M6MTE6Im1lbWJlcl9jb2RlIjtOO30=`, `https://www.nwjob.kr/post_file_download.cm?c=YTo1OntzOjEwOiJib2FyZF9jb2RlIjtzOjIyOiJiMjAyMzAyMTkyOTI2OGMwNWUxMzliIjtzOjk6InBvc3RfY29kZSI7czoyMjoicDIwMjYwNDIxNTVmNjY0ZDg3NTMwNyI7czo5OiJmaWxlX2NvZGUiO3M6MjI6InAyMDI2MDQyMWViMjQ4NmZlMTI4NTMiO3M6MTk6InBvc3RfZG93bmxvYWRfdG9rZW4iO3M6MTM6IjY5ZWEzYjJmZDg0NTIiO3M6MTE6Im1lbWJlcl9jb2RlIjtOO30=`
  image URLs: `https://www.nwjob.kr/common/img/default_profile.png`, `https://cdn.imweb.me/thumbnail/20230322/068b03ab88ff0.png`, `https://cdn.imweb.me/thumbnail/20230311/f34de9b5802f0.png`
- `fetched` `https://www.nwjob.kr/18/?q=YToxOntzOjEyOiJrZXl3b3JkX3R5cGUiO3M6MzoiYWxsIjt9&bmode=view&idx=170938349&t=board` (text=1087, images=12, attachments=1)
  attachment URLs: `https://www.nwjob.kr/post_file_download.cm?c=YTo1OntzOjEwOiJib2FyZF9jb2RlIjtzOjIyOiJiMjAyMzAyMTkyOTI2OGMwNWUxMzliIjtzOjk6InBvc3RfY29kZSI7czoyMjoicDIwMjYwNDIwYTM3N2VkNjUzOWNhZSI7czo5OiJmaWxlX2NvZGUiO3M6MjI6InAyMDI2MDQyMGYwZTBmOGVmOGQ2ODMiO3M6MTk6InBvc3RfZG93bmxvYWRfdG9rZW4iO3M6MTM6IjY5ZWEzYjMwN2RmMjkiO3M6MTE6Im1lbWJlcl9jb2RlIjtOO30=`
  image URLs: `https://www.nwjob.kr/common/img/default_profile.png`, `https://cdn.imweb.me/thumbnail/20230322/068b03ab88ff0.png`, `https://cdn.imweb.me/thumbnail/20230311/f34de9b5802f0.png`
  field gap sample: `[~4/27] 2026년 노원구 『경춘스테이션 북&커피 카페』 초단시간 기간제근로자 채용 공고` issues=missing_provider
  field gap sample: `[~4/26] 서울시 매력일자리 서울통신원(10명) 모집` issues=missing_provider
  field gap sample: `[~4/26] 서울시 매력일자리 진로컨설팅 전문가(3명) 모집` issues=missing_provider

#### 도봉구청 일자리경제과

- Field gap audit: checked_rows=1, rows_with_any_issues=1, rows_with_info_only=1
- Field gap issue codes: `missing_provider=1`
- Attachment URL samples: `https://www.hancom.com/cs_center/csDownload.do`
- Image URL samples: `https://www.dobong.go.kr/images/2025/main/ico_gonfalon.png`, `https://www.dobong.go.kr/images/2025/main/ico_login.png`, `https://www.dobong.go.kr/images/2023/main/logo.png`
- `fetched` `https://www.dobong.go.kr/bbs.asp?bmode=D&pcode=12742709&code=10008770` (text=9906, images=41, attachments=1)
  attachment URLs: `https://www.hancom.com/cs_center/csDownload.do`
  image URLs: `https://www.dobong.go.kr/images/2025/main/ico_gonfalon.png`, `https://www.dobong.go.kr/images/2025/main/ico_login.png`, `https://www.dobong.go.kr/images/2023/main/logo.png`
  field gap sample: `2026년 5월 구민정보화교육 수강생 모집 안내` issues=missing_provider

#### 도봉구청년창업센터

- Field gap audit: checked_rows=33, rows_with_any_issues=33, rows_with_info_only=33
- Field gap issue codes: `missing_provider=33`
- Attachment URL samples: `https://dobongstartup.com/bbs/download.php?bo_table=donotic&wr_id=147&no=0`
- Image URL samples: `https://dobongstartup.com/data/common/clogo_img`, `https://dobongstartup.com/data/common/mobile_clogo_img`, `https://dobongstartup.com/theme/webon/img/sub_menu_tel.png`
- `fetched` `https://dobongstartup.com/bbs/board.php?bo_table=donotic&wr_id=148` (text=1602, images=5, attachments=0)
  image URLs: `https://dobongstartup.com/data/common/clogo_img`, `https://dobongstartup.com/data/common/mobile_clogo_img`, `https://dobongstartup.com/theme/webon/img/sub_menu_tel.png`
- `fetched` `https://dobongstartup.com/bbs/board.php?bo_table=donotic&wr_id=147` (text=1256, images=7, attachments=1)
  attachment URLs: `https://dobongstartup.com/bbs/download.php?bo_table=donotic&wr_id=147&no=0`
  image URLs: `https://dobongstartup.com/data/common/clogo_img`, `https://dobongstartup.com/data/common/mobile_clogo_img`, `https://dobongstartup.com/theme/webon/img/sub_menu_tel.png`
  field gap sample: `4월 '전문가 창업상담' 참여자 모집(04.24.)(마감)` issues=missing_provider
  field gap sample: `[스타아카데미2] '외주 없이 AI로 홍보 영상 만들기' 수강생 모집(마감)` issues=missing_provider
  field gap sample: `2026 도봉 스타아카데미 - 수강생 모집` issues=missing_provider

#### 마포구고용복지지원센터

- Field gap audit: checked_rows=6, rows_with_any_issues=6, rows_with_info_only=6
- Field gap issue codes: `missing_provider=6`
- Attachment URL samples: `https://mapoworkfare.or.kr/index.php?module=file&act=procFileDownload&file_srl=1136101&sid=aab7b6e6d731f9afeccf2f715d36f814`, `https://mapoworkfare.or.kr/?document_srl=1136037&act=zip`, `https://mapoworkfare.or.kr/index.php?module=file&act=procFileDownload&file_srl=1136057&sid=a1bb23c37a3aa85dd0164241f53b2b19`, `https://mapoworkfare.or.kr/index.php?module=file&act=procFileDownload&file_srl=1136058&sid=546294083f09a153832959f5d33f0bf9`
- Image URL samples: `https://mapoworkfare.or.kr/layouts/NewInclude/img/mapo_sms.jpg`, `https://mapoworkfare.or.kr/files/attach/images/1125363/99b983892094b5c6d2fc3736e15da7d1.png`, `https://mapoworkfare.or.kr/layouts/NewSubLayoutNew/img/title_arrow.png`
- `fetched` `https://mapoworkfare.or.kr/1136099` (text=5475, images=45, attachments=1)
  attachment URLs: `https://mapoworkfare.or.kr/index.php?module=file&act=procFileDownload&file_srl=1136101&sid=aab7b6e6d731f9afeccf2f715d36f814`
  image URLs: `https://mapoworkfare.or.kr/layouts/NewInclude/img/mapo_sms.jpg`, `https://mapoworkfare.or.kr/files/attach/images/1125363/99b983892094b5c6d2fc3736e15da7d1.png`, `https://mapoworkfare.or.kr/layouts/NewSubLayoutNew/img/title_arrow.png`
- `fetched` `https://mapoworkfare.or.kr/1136037` (text=5498, images=48, attachments=5)
  attachment URLs: `https://mapoworkfare.or.kr/?document_srl=1136037&act=zip`, `https://mapoworkfare.or.kr/index.php?module=file&act=procFileDownload&file_srl=1136057&sid=a1bb23c37a3aa85dd0164241f53b2b19`, `https://mapoworkfare.or.kr/index.php?module=file&act=procFileDownload&file_srl=1136058&sid=546294083f09a153832959f5d33f0bf9`
  image URLs: `https://mapoworkfare.or.kr/layouts/NewInclude/img/mapo_sms.jpg`, `https://mapoworkfare.or.kr/files/attach/images/1125363/99b983892094b5c6d2fc3736e15da7d1.png`, `https://mapoworkfare.or.kr/layouts/NewSubLayoutNew/img/title_arrow.png`
  field gap sample: `2026 [느린학습자 아동을 위한 디지털 교육 강사 양성 사업]` issues=missing_provider
  field gap sample: `[2026청년도전지원사업]중.단기 프로그램 참여자 모집` issues=missing_provider
  field gap sample: `[최종결과발표] 청년도전 매...` issues=missing_provider


## OCR Decision

No source currently has enough evidence for OCR runtime adoption. Poster/attachment signals exist, but sampled detail HTML still exposes enough text; verify field gaps before proposing source-specific OCR opt-in.
