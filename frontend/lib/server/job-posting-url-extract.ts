import { lookup } from "node:dns/promises";
import net from "node:net";

const MAX_REDIRECTS = 3;
const MAX_RESPONSE_BYTES = 768 * 1024;
const MAX_RETURNED_TEXT_LENGTH = 12000;
const MAX_HTML_CANDIDATE_LENGTH = 180 * 1024;
const FETCH_TIMEOUT_MS = 10_000;

const BLOCKED_HOSTNAMES = new Set(["localhost", "localhost.localdomain"]);
const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".home", ".lan"];
const JOB_CONTAINER_CLASS_OR_ID_PATTERN =
  /<[^>]+(?:id|class)=["'][^"']*(?:wrap_jv_cont|jv_cont|job[-_ ]?(?:detail|posting|view|description|content)|recruit[-_ ]?(?:detail|content|template|view)|posting[-_ ]?(?:detail|content|view)|position[-_ ]?(?:detail|content)|description|job-detail-section|info-block)[^"']*["'][^>]*>/gi;
const JOB_CONTAINER_END_PATTERNS = [
  /<div[^>]+class=["'][^"']*jv_remote[^"']*["'][^>]*>/i,
  /<footer\b/i,
  /<aside\b/i,
  /<\/body\b/i,
];
const JOB_SIGNAL_TERMS = [
  "모집",
  "담당업무",
  "주요업무",
  "자격요건",
  "지원자격",
  "우대사항",
  "근무조건",
  "근무지",
  "고용형태",
  "급여",
  "연봉",
  "학력",
  "경력",
  "접수기간",
  "채용절차",
  "전형절차",
  "복지",
  "혜택",
  "마감일",
];
const PAGE_NOISE_TERMS = [
  "로그인",
  "회원가입",
  "기업서비스",
  "고객센터",
  "공지사항",
  "개인정보처리방침",
  "전체메뉴",
  "검색어입력",
  "소셜 계정으로 간편 로그인",
  "구직자의 개인정보 보호",
];
const NON_POSTING_LINE_PATTERNS = [
  /^본문 바로가기$/,
  /^커리어의 시작, 사람인!$/,
  /^AI 검색$/,
  /^로그인$/,
  /^회원가입$/,
  /^기업서비스$/,
  /^전체메뉴$/,
  /^검색어입력$/,
  /^공유하기$/,
  /^페이스북$/,
  /^트위터$/,
  /^URL복사$/,
  /^SMS발송$/,
  /^신고하기$/,
  /^지도보기$/,
  /^조회수\s+\d+/,
  /^자사양식다운수\s+\d+/,
  /^채용중\s+\d+/,
  /^D-\d+\s+입사지원$/,
  /^\d+$/,
  /^닫기\s+-\s+/,
];

type ValidatedPublicUrl = {
  url: URL;
  addresses: string[];
};

function parseIpv4(address: string): number[] | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;

  const octets = parts.map((part) => Number(part));
  if (octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return null;
  }

  return octets;
}

function isBlockedIpv4(address: string): boolean {
  const octets = parseIpv4(address);
  if (!octets) return true;

  const [a, b, c, d] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224 ||
    (a === 255 && b === 255 && c === 255 && d === 255)
  );
}

function isBlockedIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized.startsWith("::ffff:")) {
    return isBlockedIpv4(normalized.replace("::ffff:", ""));
  }

  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("ff")
  );
}

export function isBlockedIpAddress(address: string): boolean {
  const ipVersion = net.isIP(address);
  if (ipVersion === 4) return isBlockedIpv4(address);
  if (ipVersion === 6) return isBlockedIpv6(address);
  return true;
}

function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  return (
    BLOCKED_HOSTNAMES.has(normalized) ||
    BLOCKED_HOST_SUFFIXES.some((suffix) => normalized.endsWith(suffix))
  );
}

export async function validatePublicHttpUrl(rawUrl: string): Promise<ValidatedPublicUrl> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Error("올바른 공고 URL을 입력해주세요.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("http 또는 https URL만 사용할 수 있습니다.");
  }
  if (url.username || url.password) {
    throw new Error("계정 정보가 포함된 URL은 사용할 수 없습니다.");
  }
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new Error("비표준 포트 URL은 사용할 수 없습니다.");
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (isBlockedHostname(hostname)) {
    throw new Error("내부 네트워크 주소는 사용할 수 없습니다.");
  }

  const literalIpVersion = net.isIP(hostname);
  if (literalIpVersion !== 0) {
    if (isBlockedIpAddress(hostname)) {
      throw new Error("내부 네트워크 주소는 사용할 수 없습니다.");
    }
    return { url, addresses: [hostname] };
  }

  const resolved = await lookup(hostname, { all: true, verbatim: true });
  const addresses = resolved.map((item) => item.address);
  if (addresses.length === 0 || addresses.some(isBlockedIpAddress)) {
    throw new Error("내부 네트워크로 연결되는 URL은 사용할 수 없습니다.");
  }

  return { url, addresses };
}

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    const lowered = entity.toLowerCase();
    const named: Record<string, string> = {
      amp: "&",
      gt: ">",
      lt: "<",
      nbsp: " ",
      quot: "\"",
      apos: "'",
    };

    if (named[lowered]) return named[lowered];
    if (lowered.startsWith("#x")) {
      const code = Number.parseInt(lowered.slice(2), 16);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : match;
    }
    if (lowered.startsWith("#")) {
      const code = Number.parseInt(lowered.slice(1), 10);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : match;
    }

    return match;
  });
}

function extractHtmlAttribute(tag: string, name: string): string | null {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = tag.match(new RegExp(`${escapedName}\\s*=\\s*["']([^"']+)["']`, "i"));
  return match ? decodeHtmlEntities(match[1]) : null;
}

export function extractCanonicalUrlFromHtml(html: string, baseUrl: string): string | null {
  const linkTags = html.match(/<link\b[^>]*>/gi) ?? [];
  for (const tag of linkTags) {
    const rel = extractHtmlAttribute(tag, "rel");
    if (!rel?.split(/\s+/).some((item) => item.toLowerCase() === "canonical")) continue;

    const href = extractHtmlAttribute(tag, "href");
    if (!href) continue;

    try {
      return new URL(href, baseUrl).toString();
    } catch {
      return null;
    }
  }

  return null;
}

function extractJobContainerSegments(html: string): string[] {
  const segments: string[] = [];
  const seen = new Set<number>();
  const matches = html.matchAll(JOB_CONTAINER_CLASS_OR_ID_PATTERN);

  for (const match of matches) {
    const start = match.index ?? -1;
    if (start < 0 || seen.has(start)) continue;
    seen.add(start);

    const htmlAfterStart = html.slice(start);
    const endOffsets = JOB_CONTAINER_END_PATTERNS.map((pattern) => {
      const endMatch = htmlAfterStart.match(pattern);
      return endMatch?.index ?? -1;
    }).filter((index) => index > 0);
    const endOffset = endOffsets.length > 0 ? Math.min(...endOffsets) : MAX_HTML_CANDIDATE_LENGTH;
    const length = Math.min(endOffset, MAX_HTML_CANDIDATE_LENGTH, html.length - start);
    if (length > 0) {
      segments.push(html.slice(start, start + length));
    }
  }

  return segments;
}

function countTermMatches(text: string, terms: string[]): number {
  return terms.reduce((count, term) => {
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matches = text.match(new RegExp(escapedTerm, "g"));
    return count + (matches?.length ?? 0);
  }, 0);
}

export function scoreJobPostingText(text: string): number {
  const lineCount = text.split("\n").filter(Boolean).length;
  const jobSignalCount = countTermMatches(text, JOB_SIGNAL_TERMS);
  const noiseCount = countTermMatches(text, PAGE_NOISE_TERMS);

  return (
    jobSignalCount * 120 +
    Math.min(text.length, 8000) / 20 -
    noiseCount * 70 -
    Math.max(0, lineCount - 280) * 2
  );
}

export function extractReadableTextFromHtml(html: string): string {
  const containerSegments = extractJobContainerSegments(html);
  const candidateHtmls = containerSegments.length > 0 ? containerSegments : [html];
  const candidates = candidateHtmls
    .map((candidateHtml) => extractReadableTextFromHtmlSegment(candidateHtml))
    .filter((text) => text.length >= 50);

  if (candidates.length === 0) {
    return extractReadableTextFromHtmlSegment(html);
  }

  return candidates.sort((a, b) => scoreJobPostingText(b) - scoreJobPostingText(a))[0];
}

function extractReadableTextFromHtmlSegment(html: string): string {
  const withoutHiddenBlocks = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ");
  const withLineBreaks = withoutHiddenBlocks
    .replace(/<\/(p|div|section|article|header|footer|main|li|ul|ol|h[1-6]|tr|table)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n");
  const withoutTags = withLineBreaks.replace(/<[^>]+>/g, " ");

  return normalizeExtractedJobPostingText(decodeHtmlEntities(withoutTags));
}

export function normalizeExtractedJobPostingText(text: string): string {
  const normalizedLines = text
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const filteredLines: string[] = [];
  let skippingAiMatchBlock = false;
  for (const line of normalizedLines) {
    if (line === "AI 서류 합격률") {
      skippingAiMatchBlock = true;
      continue;
    }
    if (skippingAiMatchBlock) {
      if (line === "상세요강") {
        skippingAiMatchBlock = false;
        filteredLines.push(line);
      }
      continue;
    }
    if (NON_POSTING_LINE_PATTERNS.some((pattern) => pattern.test(line))) continue;
    filteredLines.push(line);
  }

  return filteredLines
    .join("\n")
    .slice(0, MAX_RETURNED_TEXT_LENGTH)
    .trim();
}

async function readResponseTextLimited(response: Response): Promise<string> {
  const contentLength = Number(response.headers.get("content-length") || "0");
  if (contentLength > MAX_RESPONSE_BYTES) {
    throw new Error("공고 페이지 용량이 너무 큽니다.");
  }

  const reader = response.body?.getReader();
  if (!reader) return response.text();

  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    received += value.byteLength;
    if (received > MAX_RESPONSE_BYTES) {
      throw new Error("공고 페이지 용량이 너무 큽니다.");
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

async function fetchPublicUrlText(url: URL, redirectCount = 0): Promise<{
  text: string;
  finalUrl: string;
  contentType: string;
}> {
  await validatePublicHttpUrl(url.toString());

  const response = await fetch(url, {
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      Accept: "text/html,text/plain,application/xhtml+xml;q=0.9,*/*;q=0.1",
      "User-Agent":
        "Mozilla/5.0 (compatible; isoser-job-posting-url-extractor/1.0; +https://isoser.local)",
    },
  });

  if (response.status >= 300 && response.status < 400) {
    if (redirectCount >= MAX_REDIRECTS) {
      throw new Error("공고 URL 리다이렉트가 너무 많습니다.");
    }
    const location = response.headers.get("location");
    if (!location) throw new Error("공고 URL 리다이렉트 정보를 읽지 못했습니다.");
    return fetchPublicUrlText(new URL(location, url), redirectCount + 1);
  }

  if (!response.ok) {
    throw new Error(`공고 URL을 읽지 못했습니다. (${response.status})`);
  }

  const contentType = response.headers.get("content-type") || "";
  const normalizedContentType = contentType.split(";")[0]?.trim().toLowerCase() || "";
  const isTextLike =
    normalizedContentType.startsWith("text/") ||
    normalizedContentType === "application/xhtml+xml" ||
    normalizedContentType === "";
  if (!isTextLike) {
    throw new Error("텍스트 또는 HTML 공고 URL만 지원합니다. PDF는 파일 업로드를 사용해주세요.");
  }

  return {
    text: await readResponseTextLimited(response),
    finalUrl: url.toString(),
    contentType,
  };
}

export async function extractJobPostingTextFromUrl(rawUrl: string): Promise<{
  job_posting_text: string;
  final_url: string;
  content_type: string;
}> {
  const { url } = await validatePublicHttpUrl(rawUrl);
  const result = await fetchPublicUrlText(url);
  const textCandidates = [
    {
      text: result.contentType.toLowerCase().includes("html")
        ? extractReadableTextFromHtml(result.text)
        : normalizeExtractedJobPostingText(result.text),
      finalUrl: result.finalUrl,
      contentType: result.contentType,
    },
  ];

  const canonicalUrl = result.contentType.toLowerCase().includes("html")
    ? extractCanonicalUrlFromHtml(result.text, result.finalUrl)
    : null;
  if (canonicalUrl && canonicalUrl !== result.finalUrl) {
    const currentUrl = new URL(result.finalUrl);
    const nextUrl = new URL(canonicalUrl);
    if (currentUrl.hostname === nextUrl.hostname) {
      try {
        const canonicalResult = await fetchPublicUrlText(nextUrl);
        textCandidates.push({
          text: canonicalResult.contentType.toLowerCase().includes("html")
            ? extractReadableTextFromHtml(canonicalResult.text)
            : normalizeExtractedJobPostingText(canonicalResult.text),
          finalUrl: canonicalResult.finalUrl,
          contentType: canonicalResult.contentType,
        });
      } catch {
        // Keep the original page extraction when canonical fallback is unavailable.
      }
    }
  }

  const bestCandidate = textCandidates.sort(
    (a, b) => scoreJobPostingText(b.text) - scoreJobPostingText(a.text)
  )[0];
  const text = bestCandidate.text;

  if (text.length < 50) {
    throw new Error("URL에서 충분한 공고 텍스트를 추출하지 못했습니다.");
  }

  return {
    job_posting_text: text,
    final_url: bestCandidate.finalUrl,
    content_type: bestCandidate.contentType,
  };
}
