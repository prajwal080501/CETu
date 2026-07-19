/**
 * MHT-CET (First Year Engineering) admission schedule.
 *
 * `confirmed` dates come from the official CET Cell notices (fe2026.mahacet.org);
 * the rest are `estimated` from the tight year-over-year pattern (2025 actuals)
 * and are refined to exact dates as the CET Cell publishes them. All times are
 * IST (+05:30). This is intentionally a plain config so dates are easy to edit;
 * it can move to an admin-editable collection later.
 */

export type MilestoneStatus = "past" | "live" | "upcoming";

export interface Milestone {
  key: string;
  label: string;
  detail?: string;
  /** ISO datetime (IST) we count down to — the start of the event/window. */
  start: string;
  /** Optional end of a window; while now is within [start,end] the event is "live". */
  end?: string;
  /** true = official CET Cell date; false = estimated from prior years. */
  confirmed: boolean;
}

export const MHTCET_YEAR = 2026;

export const SCHEDULE: Milestone[] = [
  {
    key: "registration",
    label: "Registration & document verification closes",
    detail: "Last date to register for CAP and complete document verification.",
    start: "2026-07-20T17:00:00+05:30",
    confirmed: true,
  },
  {
    key: "provisional-merit",
    label: "Provisional merit list",
    detail: "Provisional state merit list published on mahacet.org.",
    start: "2026-07-22T17:00:00+05:30",
    confirmed: true,
  },
  {
    key: "grievance",
    label: "Grievance / objection window",
    detail: "Raise objections to your provisional merit number.",
    start: "2026-07-22T17:00:00+05:30",
    end: "2026-07-24T17:00:00+05:30",
    confirmed: false,
  },
  {
    key: "final-merit",
    label: "Final merit list",
    detail: "Final merit number that decides your CAP rank.",
    start: "2026-07-25T17:00:00+05:30",
    confirmed: false,
  },
  {
    key: "cap1-options",
    label: "CAP Round 1 — option form filling",
    detail: "Fill and lock your college/branch preferences for Round 1.",
    start: "2026-07-27T10:00:00+05:30",
    end: "2026-07-29T17:00:00+05:30",
    confirmed: false,
  },
  {
    key: "cap1-allot",
    label: "CAP Round 1 — seat allotment",
    detail: "Round 1 provisional allotment declared.",
    start: "2026-08-01T17:00:00+05:30",
    confirmed: false,
  },
  {
    key: "cap2",
    label: "CAP Round 2 — option form filling",
    start: "2026-08-06T10:00:00+05:30",
    end: "2026-08-08T17:00:00+05:30",
    confirmed: false,
  },
  {
    key: "cap3",
    label: "CAP Round 3 — option form filling",
    start: "2026-08-18T10:00:00+05:30",
    end: "2026-08-20T17:00:00+05:30",
    confirmed: false,
  },
  {
    key: "institute",
    label: "Institute-level / SPOT rounds",
    detail: "Vacant-seat rounds at institute level.",
    start: "2026-08-27T10:00:00+05:30",
    end: "2026-09-13T17:00:00+05:30",
    confirmed: false,
  },
];

export interface MilestoneState extends Milestone {
  status: MilestoneStatus;
  /** The instant to count down to: the end while live, else the start. */
  countTo: number;
}

export function scheduleState(now: number): MilestoneState[] {
  return SCHEDULE.map((m) => {
    const start = new Date(m.start).getTime();
    const end = m.end ? new Date(m.end).getTime() : start;
    const status: MilestoneStatus =
      now > end ? "past" : now >= start ? "live" : "upcoming";
    return { ...m, status, countTo: status === "live" ? end : start };
  });
}

/** Non-past milestones (live first, then upcoming), in chronological order. */
export function upcomingMilestones(now: number): MilestoneState[] {
  return scheduleState(now).filter((m) => m.status !== "past");
}
