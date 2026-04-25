import { describe, expect, it } from "vitest";

import {
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
});
