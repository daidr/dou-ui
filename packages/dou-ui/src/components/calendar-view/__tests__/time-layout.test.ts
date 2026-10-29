import { describe, expect, it } from "vitest";
import { layoutDay, toMinutes } from "../time-layout";

const at = (time: string, endTime?: string, title = time) => ({
  date: "2026-10-28",
  time,
  endTime,
  title,
});

describe("layoutDay", () => {
  it("reads HH:mm and rejects anything else", () => {
    expect(toMinutes("09:30")).toBe(570);
    expect(toMinutes("24:00")).toBe(1440);
    expect(toMinutes("nine")).toBeNull();
    expect(toMinutes(undefined)).toBeNull();
  });

  it("defaults to an hour and keeps very short events readable", () => {
    const [plain, tiny] = layoutDay([at("09:00"), at("12:00", "12:05")]);
    expect([plain!.start, plain!.end]).toEqual([540, 600]);
    expect(tiny!.end - tiny!.start).toBe(15);
  });

  it("puts overlapping events side by side and reuses free columns", () => {
    const placed = layoutDay([
      at("14:00", "15:30", "a"),
      at("14:30", "16:00", "b"),
      at("15:30", "16:30", "c"),
      at("18:00", "19:00", "d"),
    ]);
    const by = (title: string) => placed.find((item) => item.event.title === title)!;
    expect([by("a").column, by("b").column, by("c").column]).toEqual([0, 1, 0]);
    expect([by("a").columns, by("b").columns, by("c").columns]).toEqual([2, 2, 2]);
    expect([by("d").column, by("d").columns]).toEqual([0, 1]);
  });

  it("widens an event over columns that stay free", () => {
    const placed = layoutDay([
      at("09:00", "12:00", "long"),
      at("09:00", "10:00", "first"),
      at("09:30", "10:00", "second"),
      at("11:00", "12:00", "later"),
    ]);
    const by = (title: string) => placed.find((item) => item.event.title === title)!;
    expect(by("long").columns).toBe(3);
    expect(by("later").column).toBe(1);
    expect(by("later").span).toBe(2);
    expect(by("first").span).toBe(1);
  });
});
