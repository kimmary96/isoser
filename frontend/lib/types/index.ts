// Shared app types for Supabase rows and backend API payloads.

export interface Profile {
  id: string;
  name: string | null;
  avatar_url?: string;
  bio?: string | null;
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
