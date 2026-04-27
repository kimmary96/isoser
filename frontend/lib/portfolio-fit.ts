import type { Activity, PortfolioFitActivityAnalysis, PortfolioFitAnalysis } from "@/lib/types";

const TECH_KEYWORDS = [
  "react",
  "next",
  "typescript",
  "javascript",
  "python",
  "fastapi",
  "django",
  "node",
  "express",
  "java",
  "spring",
  "kotlin",
  "redis",
  "postgresql",
  "mysql",
  "supabase",
  "firebase",
  "aws",
  "docker",
  "kubernetes",
  "figma",
  "sql",
  "api",
  "websocket",
  "ai",
  "llm",
  "rag",
  "gemini",
  "openai",
  "데이터",
  "백엔드",
  "프론트엔드",
  "풀스택",
  "기획",
  "pm",
  "마케팅",
  "운영",
  "분석",
  "자동화",
  "실시간",
  "추천",
  "매칭",
  "대시보드",
];

const ROLE_KEYWORDS = [
  "개발",
  "백엔드",
  "프론트엔드",
  "풀스택",
  "pm",
  "기획",
  "디자인",
  "마케팅",
  "운영",
  "데이터",
  "분석",
  "리드",
  "협업",
  "자동화",
  "개선",
  "구축",
  "설계",
  "검증",
];

const STOPWORDS = new Set([
  "및",
  "또는",
  "그리고",
  "으로",
  "에서",
  "에게",
  "대한",
  "관련",
  "경험",
  "업무",
  "담당",
  "필수",
  "우대",
  "자격",
  "요건",
  "모집",
  "채용",
]);

function compact(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function normalizeList(values: string[] | null | undefined): string[] {
  if (!Array.isArray(values)) return [];
  return values.map((value) => value.trim()).filter(Boolean);
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function includesText(haystack: string, needle: string): boolean {
  return haystack.includes(needle.toLowerCase());
}

function extractTokens(text: string): string[] {
  const normalized = text.toLowerCase();
  const rawTokens = normalized.match(/[a-z0-9+#.]+|[가-힣]{2,}/g) ?? [];
  return unique(
    rawTokens.filter((token) => token.length >= 2 && !STOPWORDS.has(token))
  ).slice(0, 80);
}

function extractJobKeywords(targetJob: string | null | undefined, jobPostingText: string | null | undefined): string[] {
  const source = `${compact(targetJob)}\n${compact(jobPostingText)}`.toLowerCase();
  const known = [...TECH_KEYWORDS, ...ROLE_KEYWORDS].filter((keyword) =>
    includesText(source, keyword)
  );
  const tokens = extractTokens(source).filter((token) => token.length >= 3);
  return unique([...known, ...tokens]).slice(0, 60);
}

function activitySearchText(activity: Activity): string {
  return [
    activity.title,
    activity.type,
    activity.organization,
    activity.period,
    activity.role,
    activity.my_role,
    activity.team_composition,
    activity.description,
    ...normalizeList(activity.skills),
    ...normalizeList(activity.contributions),
    activity.star_situation,
    activity.star_task,
    activity.star_action,
    activity.star_result,
  ]
    .map((value) => compact(value))
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

function countStarFields(activity: Activity): number {
  return [
    activity.star_situation,
    activity.star_task,
    activity.star_action,
    activity.star_result,
  ].filter((value) => compact(value).length >= 12).length;
}

function hasMetricSignal(text: string): boolean {
  return /(\d+[%명건회배시간개월년분초점]|[0-9]+(?:\.[0-9]+)?\/[0-9]+)/u.test(text);
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreActivity(
  activity: Activity,
  jobKeywords: string[],
  targetJob: string | null | undefined,
  jobPostingText: string | null | undefined
): PortfolioFitActivityAnalysis {
  const text = activitySearchText(activity);
  const skills = normalizeList(activity.skills).map((skill) => skill.toLowerCase());
  const matchedJobKeywords = unique(jobKeywords.filter((keyword) => includesText(text, keyword))).slice(0, 12);
  const matchedSkillKeywords = unique(
    skills.filter((skill) => jobKeywords.some((keyword) => includesText(skill, keyword) || includesText(keyword, skill)))
  );
  const matchedEvidenceKeywords = unique([...matchedSkillKeywords, ...matchedJobKeywords]).slice(0, 12);

  const keywordScore = Math.min(25, matchedJobKeywords.length * 4 + matchedSkillKeywords.length * 3);
  const roleScore = ROLE_KEYWORDS.some((keyword) => includesText(text, keyword)) ? 12 : 0;
  const targetRoleScore =
    compact(targetJob) && includesText(text, compact(targetJob).toLowerCase()) ? 8 : 0;
  const starScore = (countStarFields(activity) / 4) * 14;
  const contributionScore = Math.min(6, normalizeList(activity.contributions).length * 2);
  const completenessScore = Math.min(20, starScore + contributionScore);
  const metricScore = hasMetricSignal(text) ? 15 : 0;
  const densityScore = Math.min(10, Math.floor(text.length / 120) * 2);
  const imageScore = normalizeList(activity.image_urls).length > 0 ? 5 : 0;
  const typeScore = activity.type === "프로젝트" || activity.type === "회사경력" ? 5 : 3;
  const fallbackScore = !compact(jobPostingText) && !compact(targetJob) ? completenessScore + metricScore : 0;

  const score = clampScore(
    keywordScore +
      roleScore +
      targetRoleScore +
      completenessScore +
      metricScore +
      densityScore +
      imageScore +
      typeScore +
      Math.min(8, fallbackScore)
  );

  const strongReasons: string[] = [];
  if (matchedEvidenceKeywords.length > 0) {
    strongReasons.push(`공고/직무 키워드 ${matchedEvidenceKeywords.slice(0, 4).join(", ")}와 연결됩니다.`);
  }
  if (countStarFields(activity) >= 3) {
    strongReasons.push("STAR 근거가 비교적 잘 채워져 포트폴리오 섹션으로 전환하기 좋습니다.");
  }
  if (metricScore > 0) {
    strongReasons.push("정량 성과 신호가 있어 결과 섹션을 설득력 있게 구성할 수 있습니다.");
  }
  if (imageScore > 0) {
    strongReasons.push("성과 이미지가 있어 포트폴리오의 시각 자료로 활용할 수 있습니다.");
  }

  const gapReasons: string[] = [];
  if (matchedEvidenceKeywords.length === 0 && (compact(targetJob) || compact(jobPostingText))) {
    gapReasons.push("공고 키워드와 직접 연결되는 활동 근거가 약합니다.");
  }
  if (!compact(activity.star_situation) && !compact(activity.star_task)) {
    gapReasons.push("문제 정의 근거를 STAR에 더 보강하면 좋습니다.");
  }
  if (!compact(activity.star_result) && !hasMetricSignal(text)) {
    gapReasons.push("정량 성과가 부족해 결과 섹션에 보완 태그가 필요합니다.");
  }
  if (!compact(activity.my_role) && !compact(activity.role)) {
    gapReasons.push("내 역할이 명확하지 않아 역할 설명을 보강해야 합니다.");
  }

  const riskFlags: PortfolioFitActivityAnalysis["riskFlags"] = [];
  if (!compact(activity.star_result) && !hasMetricSignal(text)) riskFlags.push("수치 보완 필요");
  if (gapReasons.some((reason) => reason.includes("약합니다"))) riskFlags.push("근거 부족");
  if (!compact(activity.my_role) && !compact(activity.role)) riskFlags.push("검토 필요");

  return {
    activityId: activity.id,
    score,
    rank: 0,
    matchedJobKeywords,
    matchedEvidenceKeywords,
    strongReasons: strongReasons.length > 0 ? strongReasons : ["성과저장소 원문을 기반으로 포트폴리오 후보에 포함할 수 있습니다."],
    gapReasons,
    riskFlags: unique(riskFlags),
  };
}

function diversifyTopResults(
  activities: Activity[],
  analyses: PortfolioFitActivityAnalysis[],
  limit: number
): PortfolioFitActivityAnalysis[] {
  const activityMap = new Map(activities.map((activity) => [activity.id, activity]));
  const selected: PortfolioFitActivityAnalysis[] = [];
  const typeCount = new Map<string, number>();

  for (const analysis of analyses) {
    const activity = activityMap.get(analysis.activityId);
    const type = activity?.type ?? "기타";
    const currentTypeCount = typeCount.get(type) ?? 0;
    if (selected.length < limit && currentTypeCount < 2) {
      selected.push(analysis);
      typeCount.set(type, currentTypeCount + 1);
    }
    if (selected.length >= limit) break;
  }

  if (selected.length < limit) {
    for (const analysis of analyses) {
      if (!selected.some((item) => item.activityId === analysis.activityId)) {
        selected.push(analysis);
      }
      if (selected.length >= limit) break;
    }
  }

  return selected;
}

export function analyzePortfolioFit({
  activities,
  targetJob,
  jobPostingText,
  recommendLimit = 3,
}: {
  activities: Activity[];
  targetJob?: string | null;
  jobPostingText?: string | null;
  recommendLimit?: number;
}): PortfolioFitAnalysis {
  const visibleActivities = activities.filter((activity) => activity.is_visible !== false);
  const jobKeywords = extractJobKeywords(targetJob, jobPostingText);
  const analyses = visibleActivities
    .map((activity) => scoreActivity(activity, jobKeywords, targetJob, jobPostingText))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.activityId.localeCompare(b.activityId);
    });

  const recommended = diversifyTopResults(
    visibleActivities,
    analyses,
    Math.max(1, recommendLimit)
  ).map((analysis, index) => ({ ...analysis, rank: index + 1 }));
  const rankMap = new Map(recommended.map((analysis) => [analysis.activityId, analysis.rank]));

  return {
    targetJob: compact(targetJob) || null,
    analyzedAt: new Date().toISOString(),
    recommendedActivityIds: recommended.map((analysis) => analysis.activityId),
    activities: analyses.map((analysis) => ({
      ...analysis,
      rank: rankMap.get(analysis.activityId) ?? 0,
    })),
  };
}

