import { describe, expect, it } from "vitest";
import { groupSetsByDay, mergeRestOnlyDays } from "./history";

describe("groupSetsByDay", () => {
  it("keeps reverse-chronological groups from an already-sorted list", () => {
    const groups = groupSetsByDay([
      { id: "a", localDate: "2024-06-12" },
      { id: "b", localDate: "2024-06-12" },
      { id: "c", localDate: "2024-06-11" },
    ]);
    expect(groups).toEqual([
      {
        localDate: "2024-06-12",
        items: [
          { id: "a", localDate: "2024-06-12" },
          { id: "b", localDate: "2024-06-12" },
        ],
      },
      { localDate: "2024-06-11", items: [{ id: "c", localDate: "2024-06-11" }] },
    ]);
  });
});

describe("mergeRestOnlyDays", () => {
  it("inserts rest-only dates that have no sets, newest first", () => {
    const merged = mergeRestOnlyDays(
      [{ localDate: "2024-06-12", items: [{ id: "a" }] }],
      ["2024-06-11", "2024-06-12", "2024-06-10"],
    );
    expect(merged.map((group) => group.localDate)).toEqual([
      "2024-06-12",
      "2024-06-11",
      "2024-06-10",
    ]);
    expect(merged[0].items).toEqual([{ id: "a" }]);
    expect(merged[1].items).toEqual([]);
  });
});
