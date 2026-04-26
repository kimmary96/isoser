import { describe, expect, it } from "vitest";

import {
  legacyProgramRowToProgramCardSummary,
  loadDeadlineOrderedProgramCardSummaries,
  loadProgramCardSummariesByIds,
  readModelRowToProgramCardSummary,
} from "./program-card-summary";

type QueryResult = {
  data: Record<string, unknown>[] | null;
  error: { code?: string | null; message?: string | null } | null;
};

function createSupabaseStub(results: Record<string, QueryResult>) {
  const inCalls: Array<{ table: string; column: string; values: string[] }> = [];

  return {
    inCalls,
    client: {
      from(table: string) {
        return {
          select() {
            return {
              in(column: string, values: string[]) {
                inCalls.push({ table, column, values });
                return Promise.resolve(results[table] ?? { data: [], error: null });
              },
            };
          },
        };
      },
    },
  };
}

function createDeadlineSupabaseStub(results: Record<string, QueryResult>) {
  const calls: Array<{
    table: string;
    filter: { type: "eq" | "gte"; column: string; value: boolean | string | number };
    order: { column: string; ascending: boolean; nullsFirst?: boolean };
    limit: number;
  }> = [];

  return {
    calls,
    client: {
      from(table: string) {
        return {
          select() {
            return {
              eq(column: string, value: boolean | string | number) {
                return {
                  order(orderColumn: string, options: { ascending: boolean; nullsFirst?: boolean }) {
                    return {
                      limit(count: number) {
                        calls.push({
                          table,
                          filter: { type: "eq", column, value },
                          order: { column: orderColumn, ...options },
                          limit: count,
                        });
                        return Promise.resolve(results[table] ?? { data: [], error: null });
                      },
                    };
                  },
                };
              },
              gte(column: string, value: string) {
                return {
                  order(orderColumn: string, options: { ascending: boolean; nullsFirst?: boolean }) {
                    return {
                      limit(count: number) {
                        calls.push({
                          table,
                          filter: { type: "gte", column, value },
                          order: { column: orderColumn, ...options },
                          limit: count,
                        });
                        return Promise.resolve(results[table] ?? { data: [], error: null });
                      },
                    };
                  },
                };
              },
            };
          },
        };
      },
    },
  };
}

describe("program card summary loader", () => {
  it("maps support_amount into subsidy_amount for snapshot and canonical legacy rows", () => {
    expect(
      readModelRowToProgramCardSummary({
        id: "program-a",
        title: "지원금 테스트",
        support_amount: 22730,
      }),
    ).toMatchObject({
      id: "program-a",
      support_amount: 22730,
      subsidy_amount: 22730,
    });

    expect(
      legacyProgramRowToProgramCardSummary({
        id: "program-b",
        title: "레거시 지원금 테스트",
        support_amount: 0,
      }),
    ).toMatchObject({
      id: "program-b",
      support_amount: 0,
      subsidy_amount: 0,
    });
  });

  it("prefers verified_self_pay_amount over legacy support aliases", () => {
    expect(
      readModelRowToProgramCardSummary({
        id: "program-c",
        title: "검증 자부담 테스트",
        verified_self_pay_amount: 93100,
        support_amount: 265980,
        subsidy_amount: 265980,
      }),
    ).toMatchObject({
      id: "program-c",
      verified_self_pay_amount: 93100,
      support_amount: 93100,
      subsidy_amount: 93100,
    });
  });

  it("keeps compare_meta on summary rows so display helpers can prefer self-payment fields", () => {
    expect(
      readModelRowToProgramCardSummary({
        id: "program-a",
        title: "리드모델 메타 테스트",
        compare_meta: {
          self_payment: "93,100",
        },
      }),
    ).toMatchObject({
      id: "program-a",
      compare_meta: {
        self_payment: "93,100",
      },
    });

    expect(
      legacyProgramRowToProgramCardSummary({
        id: "program-b",
        title: "레거시 메타 테스트",
        compare_meta: {
          out_of_pocket: 0,
        },
      }),
    ).toMatchObject({
      id: "program-b",
      compare_meta: {
        out_of_pocket: 0,
      },
    });
  });

  it("prefers program_list_index rows and preserves requested id order", async () => {
    const { client, inCalls } = createSupabaseStub({
      program_list_index: {
        data: [
          {
            id: "program-b",
            title: "두 번째 프로그램",
            category: "IT",
            provider_name: "기관 B",
            source_label: "고용24",
            application_end_date: "2026-05-20",
            program_start_date: "2026-06-01",
            program_end_date: "2026-06-30",
            primary_link: "https://example.com/b",
            summary_text: "요약 B",
          },
          {
            id: "program-a",
            title: "첫 번째 프로그램",
            category: "AI",
            provider_name: "기관 A",
            source_label: "K-Startup",
            application_end_date: "2026-05-10",
            program_start_date: "2026-05-15",
            program_end_date: "2026-06-15",
            primary_link: "https://example.com/a",
            summary_text: "요약 A",
          },
        ],
        error: null,
      },
    });

    const items = await loadProgramCardSummariesByIds(client, ["program-a", "program-b"]);

    expect(inCalls).toEqual([
      { table: "program_list_index", column: "id", values: ["program-a", "program-b"] },
    ]);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      id: "program-a",
      title: "첫 번째 프로그램",
      provider: "기관 A",
      source: "K-Startup",
      deadline: "2026-05-10",
      start_date: "2026-05-15",
      end_date: "2026-06-15",
      application_url: "https://example.com/a",
      summary: "요약 A",
    });
    expect(items[1]).toMatchObject({
      id: "program-b",
      title: "두 번째 프로그램",
      provider: "기관 B",
      source: "고용24",
    });
  });

  it("falls back to programs when program_list_index is missing", async () => {
    const { client, inCalls } = createSupabaseStub({
      program_list_index: {
        data: null,
        error: {
          code: "42P01",
          message: 'relation "public.program_list_index" does not exist',
        },
      },
      programs: {
        data: [
          {
            id: "program-a",
            title: "레거시 프로그램",
            provider: "기관 A",
            source: "고용24",
            deadline: "2026-05-10",
          },
        ],
        error: null,
      },
    });

    const items = await loadProgramCardSummariesByIds(client, ["program-a"]);

    expect(inCalls).toEqual([
      { table: "program_list_index", column: "id", values: ["program-a"] },
      { table: "programs", column: "id", values: ["program-a"] },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "program-a",
      title: "레거시 프로그램",
      provider: "기관 A",
      source: "고용24",
      deadline: "2026-05-10",
    });
  });

  it("fetches only missing ids from programs when read-model rows are partial", async () => {
    const { client, inCalls } = createSupabaseStub({
      program_list_index: {
        data: [
          {
            id: "program-a",
            title: "리드 모델 프로그램",
            source_label: "고용24",
          },
        ],
        error: null,
      },
      programs: {
        data: [
          {
            id: "program-b",
            title: "레거시 프로그램",
            source: "기타",
          },
        ],
        error: null,
      },
    });

    const items = await loadProgramCardSummariesByIds(client, ["program-a", "program-b"]);

    expect(inCalls).toEqual([
      { table: "program_list_index", column: "id", values: ["program-a", "program-b"] },
      { table: "programs", column: "id", values: ["program-b"] },
    ]);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ id: "program-a", title: "리드 모델 프로그램" });
    expect(items[1]).toMatchObject({ id: "program-b", title: "레거시 프로그램" });
  });

  it("loads deadline-ordered fallback rows from program_list_index first", async () => {
    const { client, calls } = createDeadlineSupabaseStub({
      program_list_index: {
        data: [
          {
            id: "program-a",
            title: "읽기 전환 프로그램",
            source_label: "고용24",
            application_end_date: "2026-05-10",
            deadline_confidence: "high",
          },
        ],
        error: null,
      },
    });

    const items = await loadDeadlineOrderedProgramCardSummaries(client, {
      today: "2026-04-24",
      limit: 50,
    });

    expect(calls).toEqual([
      {
        table: "program_list_index",
        filter: { type: "eq", column: "is_open", value: true },
        order: { column: "deadline", ascending: true, nullsFirst: false },
        limit: 50,
      },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "program-a",
      title: "읽기 전환 프로그램",
      source: "고용24",
      deadline: "2026-05-10",
    });
  });

  it("falls back to programs for deadline-ordered queries when program_list_index is unavailable", async () => {
    const { client, calls } = createDeadlineSupabaseStub({
      program_list_index: {
        data: null,
        error: {
          code: "42P01",
          message: 'relation "public.program_list_index" does not exist',
        },
      },
      programs: {
        data: [
          {
            id: "program-a",
            title: "레거시 마감 프로그램",
            source: "고용24",
            deadline: "2026-05-10",
          },
        ],
        error: null,
      },
    });

    const items = await loadDeadlineOrderedProgramCardSummaries(client, {
      today: "2026-04-24",
      limit: 20,
    });

    expect(calls).toEqual([
      {
        table: "program_list_index",
        filter: { type: "eq", column: "is_open", value: true },
        order: { column: "deadline", ascending: true, nullsFirst: false },
        limit: 20,
      },
      {
        table: "programs",
        filter: { type: "gte", column: "deadline", value: "2026-04-24" },
        order: { column: "deadline", ascending: true, nullsFirst: false },
        limit: 20,
      },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "program-a",
      title: "레거시 마감 프로그램",
      source: "고용24",
      deadline: "2026-05-10",
    });
  });
});
