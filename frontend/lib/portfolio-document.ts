import type {
  Activity,
  PortfolioConversionResponse,
  PortfolioDocumentPayload,
  PortfolioImagePlacement,
  PortfolioProjectDraft,
  PortfolioSectionKey,
} from "@/lib/types";

export const PORTFOLIO_DOCUMENT_VERSION = 2;

type PortfolioDisplaySectionKey = Exclude<PortfolioSectionKey, "overview" | "troubleshooting">;

const PORTFOLIO_DISPLAY_SECTION_TITLES: Record<PortfolioDisplaySectionKey, string> = {
  problemDefinition: "문제 정의",
  techDecision: "기술 선택 근거",
  implementation: "구현",
  result: "성과",
};

export type PortfolioProjectDisplaySection = {
  key: PortfolioDisplaySectionKey;
  title: string;
  text: string | null;
  highlights: string[];
  isDuplicateText: boolean;
};

type PortfolioDisplayOptions = {
  hidePlaceholders?: boolean;
  enhanceMissingResult?: boolean;
};

export type PortfolioProjectMeta = {
  period: string | null;
  role: string | null;
  organization: string | null;
  skills: string[];
};

export type PortfolioProjectResultMetric = {
  value: string;
  label: string | null;
};

const PORTFOLIO_PLACEHOLDER_PHRASES = [
  "활동이 시작된 배경이나 해결하려던 문제를 입력해주세요",
  "비교한 대안과 선택 이유를 입력해주세요",
  "결과와 수치를 입력해주세요",
  "정량 성과를 입력해주세요",
  "본인이 맡았던 목표와 해결 과제를 입력해주세요",
] as const;

const PORTFOLIO_INTERNAL_REVIEW_TAGS = [
  "수치 보완 필요",
  "검토 필요",
  "본인 경험으로 수정 필요",
  "보완 필요",
  "수정 필요",
] as const;

function compact(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function normalizeStringList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const result: string[] = [];
  for (const value of values) {
    if (typeof value !== "string") continue;
    const text = value.trim();
    if (text && !result.includes(text)) result.push(text);
  }
  return result;
}

function toComparableText(value: string): string {
  return value
    .trim()
    .replace(/^[\s\-*•]+/gm, "")
    .replace(/\s+/g, " ")
    .replace(/[.,!?…·:;()[\]{}"'“”‘’`~\-_/\\|]+/g, "")
    .toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function addDisplayText(seenTexts: Set<string>, value: string | null | undefined) {
  const key = toComparableText(value ?? "");
  if (key.length >= 12) seenTexts.add(key);
}

function isDuplicateDisplayText(seenTexts: Set<string>, value: string | null | undefined): boolean {
  const key = toComparableText(value ?? "");
  return key.length >= 12 && seenTexts.has(key);
}

export function isPortfolioPlaceholderText(value: string | null | undefined): boolean {
  const key = toComparableText(value ?? "");
  if (!key) return false;
  return [...PORTFOLIO_PLACEHOLDER_PHRASES, ...PORTFOLIO_INTERNAL_REVIEW_TAGS].some((phrase) =>
    key.includes(toComparableText(phrase))
  );
}

function cleanOutputText(value: string | null | undefined): string | null {
  const text = compact(value);
  return text && !isPortfolioPlaceholderText(text) ? text : null;
}

export function getPortfolioProjectReviewTags(
  project: PortfolioProjectDraft,
  options: { includeInternal?: boolean } = {}
): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const tag of normalizeStringList(project.reviewTags)) {
    const cleaned = tag.replace(/^\[+|\]+$/g, "").trim();
    const key = toComparableText(cleaned);
    if (!cleaned || seen.has(key)) continue;
    if (!options.includeInternal && isPortfolioPlaceholderText(cleaned)) continue;
    seen.add(key);
    tags.push(cleaned);
  }

  return tags;
}

export function getPortfolioProjectMeta(project: PortfolioProjectDraft): PortfolioProjectMeta {
  const overview = project.portfolio.project_overview;

  return {
    period: cleanOutputText(overview.period),
    role:
      cleanOutputText(overview.role) ||
      cleanOutputText(project.sourceActivity?.role) ||
      cleanOutputText(project.portfolio.role_clarification.content),
    organization: cleanOutputText(overview.organization),
    skills: normalizeStringList(overview.skills).filter((skill) => !isPortfolioPlaceholderText(skill)),
  };
}

export function getPortfolioProjectResultMetrics(
  project: PortfolioProjectDraft
): PortfolioProjectResultMetric[] {
  return project.portfolio.quantified_result.metrics
    .map((metric) => {
      const value = cleanOutputText(metric.value);
      if (!value) return null;

      return {
        value,
        label: cleanOutputText(metric.label),
      };
    })
    .filter((metric): metric is PortfolioProjectResultMetric => Boolean(metric));
}

function getPortfolioProjectQualitativeResult(project: PortfolioProjectDraft): string {
  const title = getPortfolioProjectTitle(project);
  const meta = getPortfolioProjectMeta(project);
  const skills = meta.skills.slice(0, 3);
  const skillClause = skills.length > 0 ? `${skills.join(", ")} 기반으로 ` : "";
  const roleClause = meta.role ? `${meta.role} 관점에서 ` : "";

  return `${roleClause}${skillClause}${title}의 기획 의도를 실행 단위로 정리하고, 팀이 후속 제작과 운영 판단에 재사용할 수 있는 기준을 만들었습니다.`;
}

export function getPortfolioProjectFinalResultText(project: PortfolioProjectDraft): string | null {
  const directResult = cleanOutputText(getPortfolioSectionText(project, "result"));
  if (directResult) return directResult;

  if (getPortfolioProjectResultMetrics(project).length > 0) return null;
  return getPortfolioProjectQualitativeResult(project);
}

export function isPortfolioConversionPayload(
  value: unknown
): value is PortfolioConversionResponse {
  if (!isRecord(value)) return false;
  return (
    isRecord(value.project_overview) &&
    isRecord(value.problem_definition) &&
    isRecord(value.tech_decision) &&
    isRecord(value.implementation_detail) &&
    isRecord(value.quantified_result)
  );
}

export function isPortfolioDocumentPayload(value: unknown): value is PortfolioDocumentPayload {
  if (!isRecord(value)) return false;
  return value.version === PORTFOLIO_DOCUMENT_VERSION && Array.isArray(value.projects);
}

export function getPortfolioProjectTitle(project: PortfolioProjectDraft): string {
  return (
    compact(project.sectionOverrides?.projectTitle) ||
    compact(project.portfolio.project_overview.title) ||
    "포트폴리오 프로젝트"
  );
}

export function getPortfolioProjectSummary(project: PortfolioProjectDraft): string {
  return (
    compact(project.sectionOverrides?.overviewSummary) ||
    compact(project.portfolio.project_overview.summary) ||
    compact(project.portfolio.implementation_detail.summary) ||
    "성과저장소 원문을 기반으로 구성한 포트폴리오 프로젝트입니다."
  );
}

function firstMeaningfulText(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const text = compact(value);
    if (text.length >= 8) return text;
  }
  return "";
}

function joinDistinctParagraphs(...values: Array<string | null | undefined>): string {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const text = compact(value);
    const key = toComparableText(text);
    if (!text || key.length < 8 || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }
  return result.join("\n\n");
}

function buildInitialSectionOverrides(
  portfolio: PortfolioConversionResponse,
  activity?: Activity
) {
  if (!activity) return {};

  const problemDefinition = joinDistinctParagraphs(
    activity.star_situation,
    activity.star_task,
    portfolio.problem_definition.content
  );
  const implementationSummary = joinDistinctParagraphs(
    activity.star_action,
    activity.contributions?.join("\n"),
    portfolio.implementation_detail.summary
  );
  const resultSummary = joinDistinctParagraphs(
    activity.star_result,
    portfolio.quantified_result.summary
  );
  const overviewSummary = firstMeaningfulText(
    activity.description,
    portfolio.project_overview.summary,
    implementationSummary,
    resultSummary
  );

  return {
    projectTitle: firstMeaningfulText(activity.title, portfolio.project_overview.title),
    overviewSummary,
    problemDefinition: problemDefinition || portfolio.problem_definition.content,
    techDecision: firstMeaningfulText(portfolio.tech_decision.content),
    implementationSummary: implementationSummary || portfolio.implementation_detail.summary,
    resultSummary: resultSummary || portfolio.quantified_result.summary,
  };
}

export function getPortfolioSectionText(
  project: PortfolioProjectDraft,
  sectionKey: PortfolioSectionKey
): string {
  const overrides = project.sectionOverrides ?? {};
  if (sectionKey === "overview") return getPortfolioProjectSummary(project);
  if (sectionKey === "problemDefinition") {
    return compact(overrides.problemDefinition) || project.portfolio.problem_definition.content;
  }
  if (sectionKey === "techDecision") {
    return compact(overrides.techDecision) || project.portfolio.tech_decision.content;
  }
  if (sectionKey === "implementation") {
    return compact(overrides.implementationSummary) || project.portfolio.implementation_detail.summary;
  }
  if (sectionKey === "result") {
    return compact(overrides.resultSummary) || project.portfolio.quantified_result.summary;
  }
  return compact(overrides.troubleshooting) || "";
}

export function getPortfolioProjectDisplaySections(
  project: PortfolioProjectDraft,
  options: PortfolioDisplayOptions = {}
): PortfolioProjectDisplaySection[] {
  const seenTexts = new Set<string>();
  addDisplayText(seenTexts, getPortfolioProjectSummary(project));

  const rawSections: Array<{
    key: PortfolioDisplaySectionKey;
    text: string;
    highlights?: string[];
  }> = [
    {
      key: "problemDefinition",
      text: getPortfolioSectionText(project, "problemDefinition"),
    },
    {
      key: "techDecision",
      text: getPortfolioSectionText(project, "techDecision"),
    },
    {
      key: "implementation",
      text: getPortfolioSectionText(project, "implementation"),
      highlights: project.portfolio.implementation_detail.highlights,
    },
    {
      key: "result",
      text:
        options.hidePlaceholders && options.enhanceMissingResult
          ? getPortfolioProjectFinalResultText(project) ?? ""
          : getPortfolioSectionText(project, "result"),
    },
  ];

  return rawSections.map((section) => {
    const text = compact(section.text);
    const isPlaceholderText = options.hidePlaceholders && isPortfolioPlaceholderText(text);
    const isDuplicateText = isDuplicateDisplayText(seenTexts, text);
    const displayText = text && !isPlaceholderText && !isDuplicateText ? text : null;
    if (displayText) addDisplayText(seenTexts, displayText);

    const highlights = normalizeStringList(section.highlights).filter((highlight) => {
      if (options.hidePlaceholders && isPortfolioPlaceholderText(highlight)) return false;
      if (isDuplicateDisplayText(seenTexts, highlight)) return false;
      addDisplayText(seenTexts, highlight);
      return true;
    });

    return {
      key: section.key,
      title: PORTFOLIO_DISPLAY_SECTION_TITLES[section.key],
      text: displayText,
      highlights,
      isDuplicateText,
    };
  });
}

export function buildDefaultPortfolioImagePlacements(
  projects: PortfolioProjectDraft[]
): PortfolioImagePlacement[] {
  const placements: PortfolioImagePlacement[] = [];
  for (const project of projects) {
    const imageUrls = project.portfolio.activity_image_urls ?? [];
    imageUrls.forEach((imageUrl, index) => {
      placements.push({
        id: `${project.activityId || "activity"}-${index}`,
        activityId: project.activityId,
        imageUrl,
        sectionKey: index === 0 ? "overview" : "implementation",
        order: index,
        captionDraft: null,
        source: "activity.image_urls",
        needsUserCheck: true,
      });
    });
  }
  return placements;
}

export function attachActivityImagesToPortfolio(
  portfolio: PortfolioConversionResponse,
  activity?: Activity
): PortfolioConversionResponse {
  const nextImages = activity ? normalizeStringList(activity.image_urls) : portfolio.activity_image_urls ?? [];
  if (nextImages.length === 0) return portfolio;
  return {
    ...portfolio,
    activity_image_urls: nextImages,
  };
}

export function createPortfolioProjectDraft({
  portfolio,
  activity,
  fitScore,
  fitReasons = [],
  gapNotes = [],
}: {
  portfolio: PortfolioConversionResponse;
  activity?: Activity;
  fitScore?: number;
  fitReasons?: string[];
  gapNotes?: string[];
}): PortfolioProjectDraft {
  const resolvedPortfolio = attachActivityImagesToPortfolio(portfolio, activity);
  const reviewTags = normalizeStringList([
    ...(resolvedPortfolio.review_tags ?? []),
    ...(resolvedPortfolio.missing_elements ?? []).map((item) =>
      item === "정량적 성과" ? "수치 보완 필요" : "검토 필요"
    ),
  ]);

  return {
    activityId: resolvedPortfolio.activity_id || activity?.id || "",
    sourceActivity: activity
      ? {
          id: activity.id,
          title: activity.title,
          type: activity.type,
          period: activity.period,
          role: activity.my_role ?? activity.role,
          skills: activity.skills ?? [],
        }
      : null,
    portfolio: resolvedPortfolio,
    sectionOverrides: buildInitialSectionOverrides(resolvedPortfolio, activity),
    reviewTags,
    fitScore,
    fitReasons,
    gapNotes,
  };
}

export function normalizePortfolioDocumentPayload(
  rawPayload: unknown,
  options?: {
    fallbackTitle?: string;
    targetJob?: string | null;
    templateId?: string;
  }
): PortfolioDocumentPayload | null {
  if (isPortfolioDocumentPayload(rawPayload)) {
    const projects = rawPayload.projects.map((project) => ({
      ...project,
      sectionOverrides: project.sectionOverrides ?? {},
      reviewTags: normalizeStringList(project.reviewTags),
      fitReasons: normalizeStringList(project.fitReasons),
      gapNotes: normalizeStringList(project.gapNotes),
    }));
    const projectOrder =
      normalizeStringList(rawPayload.projectOrder).length > 0
        ? normalizeStringList(rawPayload.projectOrder)
        : projects.map((project) => project.activityId).filter(Boolean);

    return {
      ...rawPayload,
      version: PORTFOLIO_DOCUMENT_VERSION,
      title: compact(rawPayload.title) || options?.fallbackTitle || "포트폴리오",
      targetJob: compact(rawPayload.targetJob) || options?.targetJob || null,
      selectedActivityIds:
        normalizeStringList(rawPayload.selectedActivityIds).length > 0
          ? normalizeStringList(rawPayload.selectedActivityIds)
          : projectOrder,
      projectOrder,
      projects,
      imagePlacements: Array.isArray(rawPayload.imagePlacements)
        ? rawPayload.imagePlacements
        : buildDefaultPortfolioImagePlacements(projects),
      templateId: compact(rawPayload.templateId) || options?.templateId || "simple",
      createdFrom: rawPayload.createdFrom || "portfolio-builder",
    };
  }

  if (isPortfolioConversionPayload(rawPayload)) {
    const project = createPortfolioProjectDraft({ portfolio: rawPayload });
    const selectedActivityIds = project.activityId ? [project.activityId] : [];
    return {
      version: PORTFOLIO_DOCUMENT_VERSION,
      title:
        options?.fallbackTitle ||
        rawPayload.project_overview.title ||
        "포트폴리오",
      targetJob: options?.targetJob ?? null,
      jobPostingSummary: null,
      selectedActivityIds,
      projectOrder: selectedActivityIds,
      projects: [project],
      fitAnalysis: null,
      imagePlacements: buildDefaultPortfolioImagePlacements([project]),
      templateId: options?.templateId || "simple",
      createdFrom: "legacy-portfolio",
    };
  }

  return null;
}

export function createPortfolioDocumentPayload({
  title,
  targetJob,
  jobPostingSummary,
  projects,
  projectOrder,
  fitAnalysis = null,
  imagePlacements,
  templateId = "simple",
}: {
  title: string;
  targetJob?: string | null;
  jobPostingSummary?: string | null;
  projects: PortfolioProjectDraft[];
  projectOrder?: string[];
  fitAnalysis?: PortfolioDocumentPayload["fitAnalysis"];
  imagePlacements?: PortfolioImagePlacement[];
  templateId?: string;
}): PortfolioDocumentPayload {
  const selectedActivityIds = projects.map((project) => project.activityId).filter(Boolean);
  const resolvedProjectOrder =
    projectOrder && projectOrder.length > 0 ? projectOrder : selectedActivityIds;

  return {
    version: PORTFOLIO_DOCUMENT_VERSION,
    title: compact(title) || "포트폴리오",
    targetJob: compact(targetJob) || null,
    jobPostingSummary: compact(jobPostingSummary) || null,
    selectedActivityIds,
    projectOrder: resolvedProjectOrder,
    projects,
    fitAnalysis,
    imagePlacements: imagePlacements ?? buildDefaultPortfolioImagePlacements(projects),
    templateId,
    createdFrom: "portfolio-builder",
  };
}

export function reorderPortfolioProjects(
  document: PortfolioDocumentPayload,
  activityId: string,
  direction: "up" | "down"
): PortfolioDocumentPayload {
  const order = document.projectOrder.length > 0
    ? [...document.projectOrder]
    : document.projects.map((project) => project.activityId);
  const index = order.indexOf(activityId);
  if (index < 0) return document;
  const nextIndex = direction === "up" ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex >= order.length) return document;
  [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
  return { ...document, projectOrder: order };
}

export function updatePortfolioImagePlacement(
  document: PortfolioDocumentPayload,
  placementId: string,
  patch: Partial<Pick<PortfolioImagePlacement, "sectionKey" | "captionDraft">>
): PortfolioDocumentPayload {
  return {
    ...document,
    imagePlacements: document.imagePlacements.map((placement) =>
      placement.id === placementId ? { ...placement, ...patch } : placement
    ),
  };
}

export function getOrderedPortfolioProjects(
  document: PortfolioDocumentPayload
): PortfolioProjectDraft[] {
  const projectMap = new Map(document.projects.map((project) => [project.activityId, project]));
  const ordered: PortfolioProjectDraft[] = [];
  const orderedIds = new Set<string>();
  for (const activityId of document.projectOrder) {
    const project = projectMap.get(activityId);
    if (!project || orderedIds.has(project.activityId)) continue;
    ordered.push(project);
    orderedIds.add(project.activityId);
  }
  const remaining = document.projects.filter((project) => !orderedIds.has(project.activityId));
  return [...ordered, ...remaining];
}
