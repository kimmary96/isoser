import { apiError, apiOk } from "@/lib/api/route-response";
import { normalizePortfolioDocumentPayload } from "@/lib/portfolio-document";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { DashboardDocumentItem } from "@/lib/types";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error("로그인이 필요합니다.");
    }

    const [resumeResult, portfolioResult] = await Promise.all([
      supabase
        .from("resumes")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("portfolios")
        .select("id, title, portfolio_payload, created_at, updated_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

    if (resumeResult.error) throw new Error(resumeResult.error.message);

    const resumeDocuments: DashboardDocumentItem[] = (resumeResult.data ?? []).map((resume) => ({
      id: resume.id,
      kind: "resume",
      title: resume.title,
      subtitle: `지원 직무: ${resume.target_job ?? "미입력"}`,
      createdAt: resume.created_at,
      updatedAt: resume.updated_at,
      exportHref: `/dashboard/resume/export?resumeId=${encodeURIComponent(resume.id)}`,
    }));

    const portfolioDocuments: DashboardDocumentItem[] = portfolioResult.error
      ? []
      : (portfolioResult.data ?? []).map((portfolio) => {
          const document = normalizePortfolioDocumentPayload(portfolio.portfolio_payload, {
            fallbackTitle: portfolio.title,
          });
          const projectCount = document?.selectedActivityIds.length ?? document?.projects.length ?? 0;
          const targetJob = document?.targetJob?.trim();

          return {
            id: portfolio.id,
            kind: "portfolio",
            title: portfolio.title,
            subtitle: targetJob
              ? `지원 직무: ${targetJob} | 프로젝트 ${projectCount}개`
              : `프로젝트 ${projectCount}개`,
            createdAt: portfolio.created_at,
            updatedAt: portfolio.updated_at,
            exportHref: `/dashboard/portfolio/export?portfolioId=${encodeURIComponent(portfolio.id)}`,
          };
        });

    const documents = [...resumeDocuments, ...portfolioDocuments].sort((a, b) =>
      (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt)
    );

    return apiOk({ documents });
  } catch (error) {
    const message = error instanceof Error ? error.message : "문서 목록을 불러오지 못했습니다.";
    return apiError(message, 400, "BAD_REQUEST");
  }
}
