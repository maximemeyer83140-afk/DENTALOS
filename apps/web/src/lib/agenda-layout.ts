export interface LayoutInterval {
  id: string;
  startAt: Date;
  endAt: Date;
}

export interface LayoutResult {
  id: string;
  /** 0-indexed column within its overlap cluster. */
  lane: number;
  /** How many lanes wide the cluster this appointment belongs to is — width = 100% / laneCount. */
  laneCount: number;
}

/**
 * Lays out a day column's appointments side by side when they overlap in time (two practitioners
 * both booked at 10:00, shown in a shared day column in week view) — the standard calendar
 * "overlap cluster" algorithm: appointments are grouped into clusters of mutually-touching
 * intervals, each cluster gets its own lane count, so one early overlap doesn't shrink every later,
 * non-overlapping appointment in the same day to a fraction width for no reason.
 *
 * Appointments for a single practitioner never overlap here in practice (the conflict engine
 * refuses to double-book one practitioner — see appointment-conflict.ts), so lanes only ever
 * appear when *different* practitioners share a time slot in the same day/room view.
 */
export function layoutDayAppointments(intervals: LayoutInterval[]): LayoutResult[] {
  const sorted = [...intervals].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  const results: LayoutResult[] = [];

  let clusterStart = 0;
  let clusterEnd = -Infinity;

  function flushCluster(from: number, to: number): void {
    const laneEnds: number[] = [];
    const laneById = new Map<string, number>();
    for (let i = from; i < to; i++) {
      const interval = sorted[i]!;
      let lane = laneEnds.findIndex((end) => end <= interval.startAt.getTime());
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(interval.endAt.getTime());
      } else {
        laneEnds[lane] = interval.endAt.getTime();
      }
      laneById.set(interval.id, lane);
    }
    const laneCount = laneEnds.length;
    for (let i = from; i < to; i++) {
      const interval = sorted[i]!;
      results.push({ id: interval.id, lane: laneById.get(interval.id) ?? 0, laneCount });
    }
  }

  for (let i = 0; i < sorted.length; i++) {
    const interval = sorted[i]!;
    if (interval.startAt.getTime() >= clusterEnd) {
      if (i > clusterStart) flushCluster(clusterStart, i);
      clusterStart = i;
      clusterEnd = interval.endAt.getTime();
    } else {
      clusterEnd = Math.max(clusterEnd, interval.endAt.getTime());
    }
  }
  if (sorted.length > 0) flushCluster(clusterStart, sorted.length);

  return results;
}
