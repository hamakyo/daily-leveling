import { describe, expect, it } from "vitest";
import { moveItem } from "../src/web/utils/todayOrder";

describe("moveItem", () => {
  it("moves an item upward", () => {
    expect(moveItem(["a", "b", "c"], 2, 1)).toEqual(["a", "c", "b"]);
  });

  it("moves an item downward", () => {
    expect(moveItem(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
  });

  it("returns the same order when the move is out of bounds", () => {
    const items = ["a", "b", "c"];
    expect(moveItem(items, 0, -1)).toEqual(items);
    expect(moveItem(items, 2, 3)).toEqual(items);
  });
});
