import { describe, expect, it } from "vitest";

import { layoutDayAppointments } from "./agenda-layout";

function iv(id: string, startHour: number, startMin: number, endHour: number, endMin: number) {
  return {
    id,
    startAt: new Date(2026, 0, 1, startHour, startMin),
    endAt: new Date(2026, 0, 1, endHour, endMin),
  };
}

describe("layoutDayAppointments", () => {
  it("gives every appointment its own lane when nothing overlaps", () => {
    const result = layoutDayAppointments([iv("a", 8, 0, 8, 30), iv("b", 9, 0, 9, 30), iv("c", 10, 0, 11, 0)]);
    expect(result.every((r) => r.lane === 0 && r.laneCount === 1)).toBe(true);
  });

  it("back-to-back appointments (touching, not overlapping) each get full width", () => {
    const result = layoutDayAppointments([iv("a", 8, 0, 8, 30), iv("b", 8, 30, 9, 0)]);
    expect(result.every((r) => r.laneCount === 1)).toBe(true);
  });

  it("splits two overlapping appointments into two lanes", () => {
    const result = layoutDayAppointments([iv("a", 9, 0, 10, 0), iv("b", 9, 30, 10, 30)]);
    const byId = new Map(result.map((r) => [r.id, r]));
    expect(byId.get("a")!.laneCount).toBe(2);
    expect(byId.get("b")!.laneCount).toBe(2);
    expect(byId.get("a")!.lane).not.toBe(byId.get("b")!.lane);
  });

  it("a later, non-overlapping appointment is not squeezed by an earlier overlap", () => {
    const result = layoutDayAppointments([
      iv("a", 9, 0, 10, 0),
      iv("b", 9, 30, 10, 30), // overlaps a
      iv("c", 14, 0, 14, 30), // isolated, later in the day
    ]);
    const byId = new Map(result.map((r) => [r.id, r]));
    expect(byId.get("c")!.laneCount).toBe(1);
    expect(byId.get("c")!.lane).toBe(0);
  });

  it("reuses a freed lane for a third appointment that doesn't overlap the first", () => {
    // a: 9:00-10:00, b: 9:30-10:30 (overlaps a), c: 10:15-11:00 (overlaps b, not a)
    const result = layoutDayAppointments([iv("a", 9, 0, 10, 0), iv("b", 9, 30, 10, 30), iv("c", 10, 15, 11, 0)]);
    const byId = new Map(result.map((r) => [r.id, r]));
    expect(byId.get("a")!.lane).toBe(byId.get("c")!.lane);
    expect(byId.get("a")!.laneCount).toBe(2);
  });

  it("handles an empty list", () => {
    expect(layoutDayAppointments([])).toEqual([]);
  });
});
