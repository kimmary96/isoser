// 공통 타입 정의 - Supabase 테이블 스키마 및 API 요청/응답 타입

// ─── Supabase 테이블 타입 ───────────────────────────────────────────────────

export interface Profile {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  education: string | null;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: string;
  user_id: string;
  type: "회사경력" | "프로젝트" | "대외활동" | "학생활동";
  title: string;
  period: string | null;
  role: string | null;
  skills: string[] | null;
  description: string | null;
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

export interface CoachSession {
  id: string;
  user_id: string;
  activity_id: string;
  messages: CoachMessage[];
  created_at: string;
  updated_at: string;
}

// ─── AI 코치 대화 타입 ─────────────────────────────────────────────────────

export interface CoachMessage {
  role: "user" | "assistant";
  content: string;
}

// ─── FastAPI 요청/응답 타입 ────────────────────────────────────────────────

/** POST /parse/pdf 응답 */
export interface ParsedProfile {
  name: string;
  email: string;
  phone: string;
  education: string;
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

/** POST /coach/feedback 요청 */
export interface CoachFeedbackRequest {
  session_id: string;
  activity_description: string;
  job_title: string;
  history: CoachMessage[];
}

/** POST /coach/feedback 응답 */
export interface CoachFeedbackResponse {
  feedback: string;
  missing_elements: string[];
  iteration_count: number;
  updated_history: CoachMessage[];
}

/** POST /match/analyze 요청 */
export interface MatchAnalyzeRequest {
  job_posting: string;
  activities: Pick<Activity, "id" | "title" | "description">[];
}

/** POST /match/analyze 응답 */
export interface MatchResult {
  match_score: number;
  matched_keywords: string[];
  missing_keywords: string[];
  recommended_activities: string[];
  summary: string;
}
