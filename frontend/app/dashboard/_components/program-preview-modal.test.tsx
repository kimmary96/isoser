import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ProgramCardItem, ProgramCardSummary, ProgramDetail } from "@/lib/types";

import { ProgramPreviewModal } from "./program-preview-modal";

const program: ProgramCardSummary = {
  id: "00809863-7e04-4b7b-a79a-c93994fd3f27",
  title: "전기기능사 필기 자격증 취득",
  category: "전기·전자",
  location: "서울 영등포구",
  provider: "수도직업전문학교",
  source: "고용24",
  source_url: "https://example.com/source",
  link: "https://example.com/apply",
  deadline: "2026-04-30",
  start_date: "2026-04-30",
  end_date: "2026-06-26",
  summary: "수도직업전문학교",
  tags: [],
  skills: [],
  days_left: 3,
  is_active: true,
};

const item: ProgramCardItem = {
  program,
  context: null,
};

const detail: ProgramDetail = {
  id: program.id,
  title: program.title,
  provider: program.provider,
  organizer: null,
  source: program.source,
  category: program.category,
  category_detail: null,
  display_categories: ["전기·전자"],
  ncs_code: null,
  ncs_name: null,
  location: program.location,
  description: "상세 설명입니다.",
  deadline: program.deadline,
  days_left: program.days_left,
  application_start_date: "2026-04-01",
  application_end_date: "2026-04-30",
  program_start_date: "2026-04-30",
  program_end_date: "2026-06-26",
  teaching_method: "혼합",
  participation_time: "part-time",
  participation_time_text: null,
  application_method: null,
  selection_process_label: null,
  cost_type: "paid",
  support_type: null,
  source_url: program.source_url ?? null,
  fee: 616500,
  support_amount: 277430,
  eligibility: [],
  schedule_text: null,
  rating: null,
  rating_raw: null,
  rating_normalized: null,
  rating_scale: null,
  rating_display: null,
  review_count: null,
  job_placement_rate: null,
  capacity_total: null,
  capacity_remaining: null,
  manager_name: null,
  phone: null,
  email: null,
  certifications: [],
  tech_stack: [],
  tags: [],
  extracted_keywords: [],
  curriculum: [],
  faq: [],
  reviews: [],
  recommended_for: ["전기기능사 준비생"],
  learning_outcomes: [],
  career_support: [],
  event_banner: null,
  ai_matching_summary: null,
};

function renderModal(props: Partial<React.ComponentProps<typeof ProgramPreviewModal>> = {}) {
  return renderToStaticMarkup(
    React.createElement(ProgramPreviewModal, {
      open: true,
      item,
      detail,
      loading: false,
      error: null,
      onClose: () => undefined,
      ...props,
    })
  );
}

describe("ProgramPreviewModal", () => {
  it("renders fetched detail without throwing", () => {
    const html = renderModal();

    expect(html).toContain("과정 미리보기");
    expect(html).toContain("전기기능사 필기 자격증 취득");
    expect(html).toContain("상세 설명입니다.");
    expect(html).toContain("전기기능사 준비생");
    expect(html).toContain("/programs/00809863-7e04-4b7b-a79a-c93994fd3f27");
  });

  it("falls back to card summary while detail is not loaded", () => {
    const html = renderModal({ detail: null });

    expect(html).toContain("수도직업전문학교");
    expect(html).toContain("전기·전자");
    expect(html).toContain("신청 링크 열기");
  });

  it("renders loading and error states without throwing", () => {
    expect(renderModal({ loading: true, detail: null })).toContain("과정 상세를 불러오는 중입니다.");
    expect(renderModal({ error: "과정 상세를 불러오지 못했습니다.", detail: null })).toContain(
      "과정 상세를 불러오지 못했습니다."
    );
  });
});
