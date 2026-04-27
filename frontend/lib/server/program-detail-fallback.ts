import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service-role";
import type { ProgramDetail } from "@/lib/types";

type JsonRecord = Record<string, unknown>;

const PROGRAM_DETAIL_FALLBACK_SELECT = [
  "id",
  "title",
  "provider",
  "provider_name",
  "organizer_name",
  "sponsor_name",
  "summary",
  "summary_text",
  "description",
  "category",
  "category_detail",
  "region",
  "region_detail",
  "location",
  "location_text",
  "source",
  "source_url",
  "link",
  "deadline",
  "close_date",
  "reg_start_date",
  "application_start_date",
  "application_end_date",
  "start_date",
  "end_date",
  "program_start_date",
  "program_end_date",
  "teaching_method",
  "cost",
  "cost_type",
  "participation_time",
  "fee_amount",
  "support_amount",
  "subsidy_amount",
  "support_type",
  "business_type",
  "target",
  "target_summary",
  "target_detail",
  "eligibility_labels",
  "tags",
  "skills",
  "is_active",
  "is_ad",
  "selection_process_label",
  "contact_phone",
  "contact_email",
  "capacity_total",
  "capacity_current",
  "rating_value",
  "curriculum_items",
  "certifications",
  "compare_meta",
  "service_meta",
].join(",");

function cleanText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => cleanText(item))
      .filter((item): item is string => Boolean(item));
  }

  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function asRecordArray(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonRecord => Boolean(item && typeof item === "object" && !Array.isArray(item)))
    : [];
}

function firstText(...values: unknown[]): string | null {
  for (const value of values) {
    const text = cleanText(value);
    if (text) {
      return text;
    }
  }

  return null;
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const numberValue = asNumber(value);
    if (numberValue !== null) {
      return numberValue;
    }
  }

  return null;
}

function uniqueStrings(...values: unknown[]): string[] {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const value of values) {
    for (const item of asStringArray(value)) {
      if (seen.has(item)) {
        continue;
      }
      seen.add(item);
      items.push(item);
    }
  }

  return items;
}

function getDetailMeta(programRow: JsonRecord): JsonRecord {
  const compareMeta = asRecord(programRow.compare_meta);
  const serviceMeta = asRecord(programRow.service_meta);
  return {
    ...compareMeta,
    ...serviceMeta,
  };
}

function buildScheduleText(fields: {
  applicationStartDate: string | null;
  applicationEndDate: string | null;
  programStartDate: string | null;
  programEndDate: string | null;
  explicitScheduleText: string | null;
}): string | null {
  if (fields.explicitScheduleText) {
    return fields.explicitScheduleText;
  }

  if (fields.applicationStartDate || fields.applicationEndDate) {
    return `신청 ${fields.applicationStartDate || "시작일 미정"} ~ ${fields.applicationEndDate || "마감일 미정"}`;
  }

  if (fields.programStartDate || fields.programEndDate) {
    return `운영 ${fields.programStartDate || "시작일 미정"} ~ ${fields.programEndDate || "종료일 미정"}`;
  }

  return null;
}

async function createProgramDetailClient() {
  try {
    return createServiceRoleSupabaseClient();
  } catch {
    return createServerSupabaseClient();
  }
}

function toFaqItems(value: unknown): Array<{ question: string; answer: string }> {
  return asRecordArray(value)
    .map((item) => ({
      question: cleanText(item.question) ?? "",
      answer: cleanText(item.answer) ?? "",
    }))
    .filter((item) => item.question && item.answer);
}

function toProgramDetail(programRow: JsonRecord, sourceRecord: JsonRecord): ProgramDetail {
  const detailMeta = getDetailMeta(programRow);
  const sourceSpecific = asRecord(sourceRecord.source_specific);

  const applicationStartDate = firstText(
    programRow.application_start_date,
    programRow.reg_start_date,
    detailMeta.application_start_date
  );
  const applicationEndDate = firstText(
    programRow.application_end_date,
    programRow.close_date,
    detailMeta.application_deadline,
    detailMeta.application_end_date,
    detailMeta.recruitment_deadline,
    detailMeta.recruitment_end_date,
    programRow.deadline
  );
  const programStartDate = firstText(
    programRow.program_start_date,
    programRow.start_date,
    detailMeta.program_start_date
  );
  const programEndDate = firstText(
    programRow.program_end_date,
    programRow.end_date,
    detailMeta.program_end_date,
    detailMeta.training_end_date
  );
  const trainingFee = firstNumber(
    programRow.fee_amount,
    detailMeta.actual_training_cost,
    detailMeta.actualTrainingCost,
    detailMeta.training_fee_total,
    detailMeta.training_fee,
    programRow.cost
  );
  const explicitSelfPay = firstNumber(
    programRow.verified_self_pay_amount,
    detailMeta.self_payment,
    detailMeta.selfPayment,
    detailMeta.out_of_pocket,
    detailMeta.outOfPocket,
    detailMeta.out_of_pocket_amount,
    detailMeta.outOfPocketAmount
  );
  const supportCandidate = firstNumber(programRow.support_amount, programRow.subsidy_amount);
  const selfPayAmount =
    explicitSelfPay !== null
      ? explicitSelfPay
      : supportCandidate !== null && (trainingFee === null || supportCandidate < trainingFee)
        ? supportCandidate
        : null;

  const capacityTotal = firstNumber(
    programRow.capacity_total,
    detailMeta.capacity_total,
    detailMeta.capacity,
    detailMeta.quota
  );
  const capacityCurrent = firstNumber(
    programRow.capacity_current,
    detailMeta.capacity_current,
    detailMeta.current_capacity,
    detailMeta.registered_count
  );

  return {
    id: cleanText(programRow.id),
    title: firstText(programRow.title),
    provider: firstText(programRow.provider_name, programRow.provider),
    organizer: firstText(
      programRow.organizer_name,
      programRow.sponsor_name,
      detailMeta.supervising_institution,
      detailMeta.department
    ),
    source: firstText(programRow.source, detailMeta.source),
    category: firstText(programRow.category, detailMeta.category),
    category_detail: firstText(programRow.category_detail, detailMeta.category_detail),
    display_categories: uniqueStrings(programRow.display_categories, detailMeta.display_categories),
    ncs_code: firstText(programRow.ncs_code, detailMeta.ncs_code),
    ncs_name: firstText(programRow.ncs_name, detailMeta.ncs_name),
    location: firstText(
      programRow.location_text,
      programRow.location,
      programRow.region_detail,
      programRow.region
    ),
    description: firstText(programRow.description, programRow.summary),
    deadline: firstText(programRow.deadline, applicationEndDate),
    days_left: firstNumber(programRow.days_left),
    application_start_date: applicationStartDate,
    application_end_date: applicationEndDate,
    program_start_date: programStartDate,
    program_end_date: programEndDate,
    teaching_method: firstText(programRow.teaching_method, detailMeta.teaching_method),
    participation_time: firstText(programRow.participation_mode_label, programRow.participation_time),
    participation_time_text: firstText(programRow.participation_time_text, detailMeta.training_time),
    application_method: firstText(
      programRow.application_method,
      sourceSpecific.application_method,
      detailMeta.application_method,
      detailMeta.apply_method
    ),
    selection_process_label: firstText(programRow.selection_process_label, detailMeta.selection_process),
    cost_type: firstText(programRow.cost_type, detailMeta.cost_type),
    support_type: firstText(
      programRow.business_type,
      programRow.support_type,
      detailMeta.business_type,
      detailMeta.subsidy_rate
    ),
    source_url: firstText(
      sourceRecord.application_url,
      sourceRecord.detail_url,
      sourceRecord.source_url,
      programRow.application_url,
      detailMeta.application_url,
      programRow.source_url,
      programRow.link
    ),
    fee: trainingFee,
    support_amount: selfPayAmount,
    eligibility: uniqueStrings(
      programRow.eligibility_labels,
      programRow.target_summary,
      programRow.target_detail,
      programRow.target,
      detailMeta.target_group,
      detailMeta.target_detail,
      detailMeta.target_age
    ),
    schedule_text: buildScheduleText({
      applicationStartDate,
      applicationEndDate,
      programStartDate,
      programEndDate,
      explicitScheduleText: firstText(programRow.schedule_text, detailMeta.schedule_text),
    }),
    rating: firstText(programRow.rating_display, programRow.rating),
    rating_raw: firstText(programRow.rating_raw),
    rating_normalized: firstNumber(programRow.rating_normalized),
    rating_scale: firstNumber(programRow.rating_scale),
    rating_display: firstText(programRow.rating_display, programRow.rating),
    review_count: firstNumber(programRow.review_count),
    job_placement_rate: firstText(detailMeta.employment_rate_6m, detailMeta.employment_rate_3m),
    capacity_total: capacityTotal,
    capacity_remaining:
      capacityTotal !== null && capacityCurrent !== null ? Math.max(0, capacityTotal - capacityCurrent) : null,
    manager_name: firstText(sourceSpecific.manager_name, detailMeta.manager_name, detailMeta.department),
    phone: firstText(programRow.contact_phone, sourceSpecific.contact_phone, detailMeta.contact_phone),
    email: firstText(
      programRow.contact_email,
      sourceSpecific.contact_email,
      detailMeta.contact_email,
      detailMeta.application_method_email
    ),
    certifications: uniqueStrings(
      programRow.certifications,
      sourceSpecific.certifications,
      detailMeta.certifications,
      detailMeta.certificate
    ),
    tech_stack: uniqueStrings(programRow.skills, detailMeta.skills),
    tags: uniqueStrings(programRow.tags, detailMeta.tags),
    extracted_keywords: uniqueStrings(programRow.extracted_keywords, detailMeta.extracted_keywords),
    curriculum: uniqueStrings(
      programRow.curriculum_items,
      sourceSpecific.curriculum_items,
      sourceSpecific.curriculum,
      detailMeta.curriculum_items,
      detailMeta.curriculum
    ),
    faq: toFaqItems(sourceSpecific.faq ?? detailMeta.faq ?? programRow.faq),
    reviews: asRecordArray(sourceSpecific.reviews ?? detailMeta.reviews ?? programRow.reviews),
    recommended_for: uniqueStrings(
      programRow.recommended_for,
      detailMeta.recommended_for,
      detailMeta.target_job,
      detailMeta.target_group
    ),
    learning_outcomes: uniqueStrings(
      programRow.learning_outcomes,
      sourceSpecific.learning_outcomes,
      detailMeta.learning_outcomes
    ),
    career_support: uniqueStrings(
      programRow.career_support,
      sourceSpecific.career_support,
      detailMeta.career_support,
      detailMeta.employment_connection
    ),
    event_banner: firstText(programRow.event_banner, sourceSpecific.event_banner, detailMeta.event_banner),
    ai_matching_summary: firstText(
      programRow.ai_matching_summary,
      sourceSpecific.ai_matching_summary,
      detailMeta.ai_matching_summary
    ),
  };
}

export async function loadProgramDetailFallback(programId: string): Promise<ProgramDetail | null> {
  const supabase = await createProgramDetailClient();
  const { data: programRow, error } = await supabase
    .from("programs")
    .select(PROGRAM_DETAIL_FALLBACK_SELECT)
    .eq("id", programId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "program detail fallback failed");
  }

  if (!programRow) {
    return null;
  }

  let sourceRecord: JsonRecord = {};
  try {
    const { data } = await supabase
      .from("program_source_records")
      .select("source_url,detail_url,application_url,source_specific,is_primary")
      .eq("program_id", programId)
      .eq("is_primary", true)
      .limit(1)
      .maybeSingle();

    sourceRecord = asRecord(data);
  } catch {
    sourceRecord = {};
  }

  return toProgramDetail(asRecord(programRow), sourceRecord);
}
