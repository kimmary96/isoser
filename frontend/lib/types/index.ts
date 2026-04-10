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

export interface CoachFeedbackResponse {
  session_id: string;
  feedback: string;
  structure_diagnosis: StructureDiagnosis;
  rewrite_suggestions: RewriteSuggestion[];
  missing_elements: string[];
  iteration_count: number;
  updated_history: CoachMessage[];
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
