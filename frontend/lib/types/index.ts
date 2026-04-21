// Shared app types for Supabase rows and backend API payloads.

export interface Profile {
  id: string;
  name: string | null;
  avatar_url?: string;
  bio?: string | null;
  portfolio_url?: string | null;
  email: string | null;
  phone: string | null;
  education: string | null;
  career: string[] | null;
  education_history: string[] | null;
  awards: string[] | null;
  certifications: string[] | null;
  languages: string[] | null;
  skills: string[] | null;
  self_intro: string | null;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: string;
  user_id: string;
  type: "회사경력" | "프로젝트" | "대외활동" | "학생활동";
  title: string;
  organization?: string;
  team_size?: number;
  team_composition?: string;
  my_role?: string;
  contributions?: string[];
  image_urls?: string[];
  period: string | null;
  role: string | null;
  skills: string[] | null;
  description: string | null;
  star_situation?: string;
  star_task?: string;
  star_action?: string;
  star_result?: string;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface Resume {
  id: string;
  user_id: string;
  title: string;
  target_job: string | null;
  template_id: string;
  selected_activity_ids: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface CoverLetter {
  id: string;
  user_id: string;
  title: string;
  company_name: string | null;
  job_title: string | null;
  prompt_question: string | null;
  content: string;
  qa_items?: { question: string; answer: string }[] | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface CoachMessage {
  role: "user" | "assistant";
  content: string;
}

export interface StructureDiagnosis {
  has_problem_definition: boolean;
  has_tech_decision: boolean;
  has_quantified_result: boolean;
  has_role_clarification: boolean;
  has_implementation_detail: boolean;
  missing_elements: string[];
  priority_focus: string;
}

export interface RewriteSuggestion {
  text: string;
  focus:
    | "star_gap"
    | "quantification"
    | "verb_strength"
    | "job_fit"
    | "tech_decision"
    | "problem_definition";
  section: string;
  rationale: string;
  reference_pattern?: string | null;
}

export interface CoachSession {
  id: string;
  user_id: string;
  job_title: string;
  section_type: Activity["type"] | "요약";
  activity_description: string;
  iteration_count: number;
  last_feedback: string | null;
  last_suggestions: RewriteSuggestion[];
  selected_suggestion_index: number | null;
  suggestion_type: string | null;
  last_structure_diagnosis: StructureDiagnosis | Record<string, unknown>;
  missing_elements: string[];
  created_at: string;
  updated_at: string;
}

export interface ParsedProfile {
  name: string;
  email: string;
  phone: string;
  bio?: string;
  education: string;
  career?: string[];
  education_history?: string[];
  awards?: string[];
  certifications?: string[];
  languages?: string[];
  skills?: string[];
  self_intro?: string;
}

export interface ParsedActivity {
  type: Activity["type"];
  title: string;
  organization?: string;
  team_size?: number | null;
  team_composition?: string;
  my_role?: string;
  contributions?: string[];
  period: string;
  role: string;
  skills: string[];
  description: string;
}

export interface ParsePdfResponse {
  profile: ParsedProfile;
  activities: ParsedActivity[];
}

export interface CoachFeedbackRequest {
  session_id?: string;
  user_id?: string | null;
  activity_description: string;
  job_title: string;
  section_type: Activity["type"] | "요약";
  selected_suggestion_index?: number | null;
  history: CoachMessage[];
}

export interface CoachIntroGenerateRequest {
  mode: "intro_generate";
  activity_description: string;
  activity_type: string;
  org_name: string;
  period: string;
  team_size: number;
  role: string;
  skills: string[];
  contribution: string;
  section_type?: Activity["type"] | "요약";
}

export interface CoachFeedbackResponse {
  session_id: string;
  feedback: string;
  structure_diagnosis: StructureDiagnosis;
  rewrite_suggestions: RewriteSuggestion[];
  missing_elements: string[];
  iteration_count: number;
  updated_history: CoachMessage[];
}

export interface CoachIntroGenerateResponse {
  intro_candidates: string[];
}

export interface CoachSessionSummary {
  id: string;
  user_id: string;
  job_title: string;
  section_type: string;
  activity_description: string;
  iteration_count: number;
  last_feedback: string | null;
  suggestion_type: string | null;
  missing_elements: string[];
  created_at: string;
  updated_at: string;
}

export interface CoachSessionDetail extends CoachSessionSummary {
  last_suggestions: RewriteSuggestion[];
  selected_suggestion_index: number | null;
  last_structure_diagnosis: StructureDiagnosis | Record<string, unknown>;
  restored_history: CoachMessage[];
}

export interface MatchAnalyzeRequest {
  job_posting: string;
  activities: Pick<Activity, "id" | "title" | "description">[];
  profile_context?: {
    name?: string;
    education?: string;
    career?: string[];
    education_history?: string[];
    awards?: string[];
    certifications?: string[];
    languages?: string[];
    skills?: string[];
    self_intro?: string;
  };
}

export type CompareStatus = "pass" | "warn" | "block";

export interface CompareMeta {
  subsidy_rate?: string | null;
  teaching_method?: string | null;
  employment_connection?: string | null;
  target_group?: string | null;
  age_restriction?: string | null;
  education_requirement?: string | null;
  employment_restriction?: string | null;
  experience_requirement?: string | null;
  coding_skill_required?: string | CompareStatus | null;
  naeilbaeumcard_required?: boolean | CompareStatus | null;
  employment_insurance?: string | boolean | CompareStatus | null;
  portfolio_required?: boolean | CompareStatus | null;
  interview_required?: boolean | CompareStatus | null;
  target_job?: string | null;
}

export interface Program {
  id: string | number | null;
  title: string | null;
  category: string | null;
  location: string | null;
  provider: string | null;
  summary: string | null;
  description?: string | null;
  tags: string[] | string | null;
  skills: string[] | string | null;
  application_url?: string | null;
  application_method?: string | null;
  source?: string | null;
  source_url?: string | null;
  link?: string | null;
  deadline?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  support_type?: string | null;
  teaching_method?: string | null;
  is_certified?: boolean | null;
  is_active?: boolean | null;
  is_ad?: boolean | null;
  relevance_score?: number | null;
  final_score?: number | null;
  urgency_score?: number | null;
  days_left?: number | null;
  compare_meta?: CompareMeta | null;
  _reason?: string | null;
  _fit_keywords?: string[] | null;
  _score?: number | null;
  _relevance_score?: number | null;
}

export type ProgramSort = "deadline" | "latest";

export interface ProgramListParams {
  q?: string;
  category?: string;
  scope?: string;
  region_detail?: string;
  regions?: string[];
  teaching_methods?: string[];
  recruiting_only?: boolean;
  include_closed_recent?: boolean;
  sort?: ProgramSort;
  limit?: number;
  offset?: number;
}

export interface ProgramCountResponse {
  count: number;
}

export interface ProgramRecommendItem {
  program_id: string;
  score: number | null;
  relevance_score: number | null;
  reason: string;
  fit_keywords: string[];
  program: Program;
}

export interface ProgramRecommendResponse {
  items: ProgramRecommendItem[];
}

export interface CalendarRecommendItem {
  program_id: string;
  relevance_score: number;
  urgency_score: number;
  final_score: number;
  deadline: string | null;
  d_day_label: string;
  reason: string;
  program: Program;
}

export interface CalendarRecommendResponse {
  items: CalendarRecommendItem[];
}

export interface ProgramRelevanceItem {
  program_id: string;
  relevance_score: number;
  skill_match_score: number;
  matched_skills: string[];
  fit_label: "높음" | "보통" | "낮음";
  fit_summary: string;
  readiness_label: "바로 지원 추천" | "보완 후 지원" | "탐색용 확인";
  gap_tags: string[];
}

export interface ProgramCompareRelevanceResponse {
  items: ProgramRelevanceItem[];
}

export interface SkillSuggestResponse {
  input_role: string;
  normalized_job_key: string;
  display_name_ko: string;
  job_family: string;
  job_bucket: string;
  matched_alias?: string | null;
  recommended_skill_tags: string[];
  evidence_keywords: string[];
  source_refs: string[];
}

export interface ActivityConvertRequest {
  target: "star" | "portfolio" | "both";
  activity: {
    id?: string | null;
    type: Activity["type"];
    title: string;
    organization?: string | null;
    team_size?: number | null;
    team_composition?: string | null;
    my_role?: string | null;
    contributions?: string[];
    period?: string | null;
    role?: string | null;
    skills?: string[];
    description?: string | null;
    star_situation?: string | null;
    star_task?: string | null;
    star_action?: string | null;
    star_result?: string | null;
  };
}

export interface StarConversionResponse {
  activity_id: string | null;
  title: string;
  type: Activity["type"];
  star_situation: string;
  star_task: string;
  star_action: string;
  star_result: string;
  missing_fields: string[];
  review_tags: string[];
}

export interface PortfolioMetricResponse {
  value: string;
  label: string;
}

export interface PortfolioOverviewResponse {
  title: string;
  activity_type: Activity["type"];
  organization?: string | null;
  period?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  duration?: string | null;
  team_size?: number | null;
  team_composition?: string | null;
  role?: string | null;
  skills: string[];
  summary: string;
  contributions: string[];
}

export interface PortfolioTextSectionResponse {
  label: string;
  content: string;
}

export interface PortfolioImplementationResponse {
  label: string;
  summary: string;
  highlights: string[];
}

export interface PortfolioResultResponse {
  label: string;
  summary: string;
  metrics: PortfolioMetricResponse[];
}

export interface PortfolioConversionResponse {
  activity_id: string | null;
  project_overview: PortfolioOverviewResponse;
  problem_definition: PortfolioTextSectionResponse;
  tech_decision: PortfolioTextSectionResponse;
  implementation_detail: PortfolioImplementationResponse;
  quantified_result: PortfolioResultResponse;
  role_clarification: PortfolioTextSectionResponse;
  missing_elements: string[];
  review_tags: string[];
}

export interface SavedPortfolio {
  id: string;
  title: string;
  sourceActivityId: string | null;
  selectedActivityIds: string[];
  portfolio: PortfolioConversionResponse | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityConvertResponse {
  target: "star" | "portfolio" | "both";
  star: StarConversionResponse | null;
  portfolio: PortfolioConversionResponse | null;
}

export interface MatchDetailedScore {
  key: string;
  label: string;
  score: number;
  max_score: number;
  grade: string;
  reason: string;
}

export interface MatchResult {
  total_score: number;
  grade: string;
  summary: string;
  support_recommendation: string;
  radar_scores: Record<string, number>;
  detailed_scores: MatchDetailedScore[];
  strengths: string[];
  gaps: string[];
  resume_tips: string[];
  highlight_keywords: string[];
  matched_keywords: string[];
  missing_keywords: string[];
  recommended_activities: string[];
  match_basis?: {
    job_keyword_count?: number;
    matched_keyword_count?: number;
    profile_keyword_count?: number;
    activity_keyword_count?: number;
    axis_weights?: Record<string, number>;
  };
}

export interface ExtractJobImageResponse {
  job_posting_text: string;
  sections?: Record<string, string>;
}

export interface ExtractJobPdfResponse {
  job_posting_text: string;
}

export interface CompanyInsightSignal {
  key: string;
  label: string;
  status: "good" | "normal" | "caution";
  status_text: string;
  reason: string;
}

export interface CompanyInsightSource {
  url: string;
  title?: string;
  snippet?: string;
}

export interface CompanyInsightResponse {
  summary: string;
  signals: CompanyInsightSignal[];
  sources: CompanyInsightSource[];
  note: string;
}

export interface MatchAnalysisRecord {
  id: string;
  user_id: string;
  job_title: string | null;
  job_posting: string;
  total_score: number;
  grade: string;
  summary: string;
  matched_keywords: string[] | null;
  missing_keywords: string[] | null;
  recommended_activities: string[] | null;
  created_at: string;
}

export interface DashboardMeResponse {
  user: {
    id: string;
    email: string | null;
    displayName: string;
    avatarUrl: string | null;
  } | null;
}

export interface DashboardProfileResponse {
  profile: Profile | null;
  activities: Activity[];
  matchAnalyses: MatchAnalysisRecord[];
}

export interface ResumeBuilderProfile {
  name: string;
  bio?: string;
  email: string;
  phone: string;
  self_intro: string;
  skills: string[];
}

export interface ResumeBuilderResponse {
  activities: Activity[];
  profile: ResumeBuilderProfile | null;
}

export interface MatchResumeOption {
  id: string;
  title: string;
  target_job: string | null;
  selected_activity_ids: string[] | null;
  created_at: string;
}

export interface SavedMatchAnalysis {
  id: string;
  job_title: string;
  job_posting: string;
  total_score: number;
  grade: string;
  summary: string;
  created_at: string;
  result: MatchResult | null;
}

export interface MatchDashboardResponse {
  savedAnalyses: SavedMatchAnalysis[];
  resumeOptions: MatchResumeOption[];
}

export interface ResumeExportResponse {
  resume: Resume | null;
  activities: Activity[];
}

export interface DocumentsResponse {
  documents: Resume[];
}

export interface ActivityListResponse {
  activities: Activity[];
}

export interface ActivityDetailResponse {
  activity: Activity | null;
}

export interface ActivityMutationResponse {
  activity: Activity;
}

export interface CoverLetterListResponse {
  coverLetters: CoverLetter[];
}

export interface CoverLetterDetailResponse {
  coverLetter: CoverLetter | null;
}

export interface CoverLetterMutationResponse {
  coverLetter: CoverLetter;
}

export interface ProgramListResponse {
  programs: Program[];
}
