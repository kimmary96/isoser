import { describe, expect, it } from "vitest";

import {
  extractCanonicalUrlFromHtml,
  extractReadableTextFromHtml,
  isBlockedIpAddress,
  normalizeExtractedJobPostingText,
  scoreJobPostingText,
} from "./job-posting-url-extract";

describe("job posting url extraction helpers", () => {
  it("blocks private and local network addresses", () => {
    expect(isBlockedIpAddress("127.0.0.1")).toBe(true);
    expect(isBlockedIpAddress("10.0.0.10")).toBe(true);
    expect(isBlockedIpAddress("172.16.0.1")).toBe(true);
    expect(isBlockedIpAddress("192.168.0.1")).toBe(true);
    expect(isBlockedIpAddress("169.254.169.254")).toBe(true);
    expect(isBlockedIpAddress("::1")).toBe(true);
    expect(isBlockedIpAddress("fc00::1")).toBe(true);
    expect(isBlockedIpAddress("8.8.8.8")).toBe(false);
  });

  it("extracts readable text from html and strips scripts", () => {
    const text = extractReadableTextFromHtml(`
      <html>
        <head><style>.x{display:none}</style><script>secret()</script></head>
        <body>
          <h1>백엔드 개발자 채용</h1>
          <p>Python &amp; FastAPI 경험이 필요합니다.</p>
          <ul><li>API 설계</li><li>성능 최적화</li></ul>
        </body>
      </html>
    `);

    expect(text).toContain("백엔드 개발자 채용");
    expect(text).toContain("Python & FastAPI 경험이 필요합니다.");
    expect(text).toContain("API 설계");
    expect(text).not.toContain("secret");
  });

  it("normalizes extracted posting text into stable lines", () => {
    expect(normalizeExtractedJobPostingText("  첫 줄   내용 \r\n\r\n  둘째 줄\t내용  ")).toBe(
      "첫 줄 내용\n둘째 줄 내용"
    );
  });

  it("uses canonical links to identify a cleaner job page URL", () => {
    const canonical = extractCanonicalUrlFromHtml(
      `<html><head><link rel="canonical" href="/zf_user/jobs/view?rec_idx=53358108"></head></html>`,
      "https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=53358108"
    );

    expect(canonical).toBe("https://www.saramin.co.kr/zf_user/jobs/view?rec_idx=53358108");
  });

  it("prioritizes job content containers over navigation text", () => {
    const text = extractReadableTextFromHtml(`
      <html>
        <body>
          <header>
            로그인 회원가입 기업서비스 고객센터 개인정보처리방침 전체메뉴 검색어입력
          </header>
          <div class="wrap_jv_cont">
            <h1>홍익대 세종캠퍼스 계약직 직원 모집</h1>
            <section class="jv_cont jv_summary">
              <dl><dt>경력</dt><dd>무관</dd></dl>
              <dl><dt>학력</dt><dd>대졸(4년제) 이상</dd></dl>
            </section>
            <div class="info-block">
              <p class="info-block__title">주요업무</p>
              <p>실습 준비, 컴퓨터 및 기자재 관리/구매, 행정 보조 등</p>
            </div>
            <div class="info-block">
              <p class="info-block__title">자격요건</p>
              <p>4년제 대학 졸업자 또는 동등 이상의 학력 소지자</p>
            </div>
            <div class="info-block">
              <p class="info-block__title">근무조건</p>
              <p>계약직, 주 5일 09:00~17:30</p>
            </div>
          </div>
          <footer>사람인 고객센터 로그인 회원가입</footer>
        </body>
      </html>
    `);

    expect(text).toContain("주요업무");
    expect(text).toContain("실습 준비, 컴퓨터 및 기자재 관리/구매");
    expect(text).toContain("자격요건");
    expect(text).not.toContain("개인정보처리방침");
  });

  it("scores job-specific text above global page chrome", () => {
    expect(
      scoreJobPostingText("로그인\n회원가입\n기업서비스\n고객센터\n개인정보처리방침\n전체메뉴")
    ).toBeLessThan(
      scoreJobPostingText("주요업무\nAPI 설계\n자격요건\n경력 무관\n근무조건\n정규직")
    );
  });
});
