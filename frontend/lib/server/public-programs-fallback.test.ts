import { describe, expect, it } from "vitest";

import type { ProgramListRow } from "@/lib/types";

import {
  filterOpenProgramsByReferenceDate,
  getKstTodayDateString,
  isProgramOpenOnReferenceDate,
  parseProgramLandingChipSnapshotItems,
  PUBLIC_PROGRAM_LANDING_SNAPSHOT_LIMIT,
} from "./public-program-snapshot-utils";

describe("public landing chip snapshots", () => {
  it("keeps the first valid rows in order and removes duplicate program ids", () => {
    const items = parseProgramLandingChipSnapshotItems([
      { id: "program-a", title: "첫 번째" },
      { id: "program-b", title: "두 번째" },
      { id: "program-a", title: "중복" },
      { id: "", title: "빈 id" },
      null,
      { title: "id 없음" },
    ]);

    expect(items).toEqual([
      { id: "program-a", title: "첫 번째" },
      { id: "program-b", title: "두 번째" },
    ]);
  });

  it("caps the parsed snapshot rows to the requested limit", () => {
    const items = parseProgramLandingChipSnapshotItems(
      Array.from({ length: PUBLIC_PROGRAM_LANDING_SNAPSHOT_LIMIT + 5 }, (_, index) => ({
        id: `program-${index + 1}`,
        title: `프로그램 ${index + 1}`,
      })),
      6,
    );

    expect(items).toHaveLength(6);
    expect(items[0]?.id).toBe("program-1");
    expect(items[5]?.id).toBe("program-6");
  });

  it("filters out rows that are already closed on the reference date", () => {
    const rows: ProgramListRow[] = [
      { id: "open-program", deadline: "2026-05-01", title: "열림", summary: null, tags: null, skills: null, category: null, location: null, provider: null },
      { id: "closed-program", deadline: "2026-04-01", title: "마감", summary: null, tags: null, skills: null, category: null, location: null, provider: null },
      { id: "unknown-program", is_active: true, title: "확인 필요", summary: null, tags: null, skills: null, category: null, location: null, provider: null },
    ];

    expect(
      filterOpenProgramsByReferenceDate(rows, "2026-04-26"),
    ).toEqual([
      rows[0],
      rows[2],
    ]);
  });

  it("treats negative days_left rows as closed even if deadline text is missing", () => {
    expect(
      isProgramOpenOnReferenceDate(
        {
          days_left: -1,
        },
        "2026-04-26",
      ),
    ).toBe(false);
  });

  it("returns a normalized KST date string", () => {
    expect(getKstTodayDateString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
