// FR-16: shape of dashboard_summary() and helpers to read it safely.
import type { TaskStatus } from "@/types/domain";

export type PersonRow = {
  id: string;
  displayName: string;
  unitName: string | null;
  isActive: boolean;
  counts: Record<TaskStatus, number>;
  overdue: number;
  cycleDaysAvg: number | null;
};

export type DashboardSummary = {
  today: string;
  totals: { open: number; overdue: number; done: number; doneThisMonth: number; cycleDaysAvg: number | null };
  byStatus: Record<TaskStatus, number>;
  monthly: { month: string; done: number }[]; // month = "YYYY-MM" (Gregorian)
  categories: { id: string; name: string; done: number }[];
  review: { entered: number; reworks: number; reworkRate: number | null; avgWaitDays: number | null };
  longTerm: { total: number; done: number; avgProgress: number | null };
  people: PersonRow[];
};

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): number => (typeof v === "number" ? v : typeof v === "string" ? Number(v) : 0);
const numOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : num(v));

function statusCounts(o: Obj): Record<TaskStatus, number> {
  return {
    long_term: num(o.long_term),
    short_term: num(o.short_term),
    in_progress: num(o.in_progress),
    review: num(o.review),
    done: num(o.done),
  };
}

export function parseSummary(raw: unknown): DashboardSummary {
  if (!isObj(raw) || !isObj(raw.totals) || !isObj(raw.by_status) || !isObj(raw.review) || !isObj(raw.long_term)) {
    throw new Error("Unexpected dashboard_summary result");
  }
  const t = raw.totals;
  const r = raw.review;
  const l = raw.long_term;
  const list = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter(isObj) : []);

  return {
    today: String(raw.today),
    totals: {
      open: num(t.open),
      overdue: num(t.overdue),
      done: num(t.done),
      doneThisMonth: num(t.done_this_month),
      cycleDaysAvg: numOrNull(t.cycle_days_avg),
    },
    byStatus: statusCounts(raw.by_status),
    monthly: list(raw.monthly).map((m) => ({ month: String(m.month), done: num(m.done) })),
    categories: list(raw.categories).map((c) => ({ id: String(c.id), name: String(c.name), done: num(c.done) })),
    review: {
      entered: num(r.entered),
      reworks: num(r.reworks),
      reworkRate: numOrNull(r.rework_rate),
      avgWaitDays: numOrNull(r.avg_wait_days),
    },
    longTerm: { total: num(l.total), done: num(l.done), avgProgress: numOrNull(l.avg_progress) },
    people: list(raw.people).map((p) => ({
      id: String(p.id),
      displayName: String(p.display_name),
      unitName: p.unit_name === null ? null : String(p.unit_name),
      isActive: p.is_active === true,
      counts: statusCounts(p),
      overdue: num(p.overdue),
      cycleDaysAvg: numOrNull(p.cycle_days_avg),
    })),
  };
}

const THAI_SHORT_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

/**
 * The 12 months of a board year (Buddhist Era), oldest first, with the done count of each.
 * fiscal: starts in `fiscalStartMonth` of the previous year (named by the year it ends in).
 */
export function monthSeries(
  year: number,
  yearType: "fiscal" | "calendar",
  fiscalStartMonth: number,
  monthly: { month: string; done: number }[],
): { key: string; label: string; done: number }[] {
  const counts = new Map(monthly.map((m) => [m.month, m.done]));
  const gregorian = year - 543;
  const fiscal = yearType === "fiscal" && fiscalStartMonth > 1;
  let y = fiscal ? gregorian - 1 : gregorian;
  let m = fiscal ? fiscalStartMonth : 1;
  const result: { key: string; label: string; done: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    result.push({ key, label: `${THAI_SHORT_MONTHS[m - 1]} ${String(y + 543).slice(-2)}`, done: counts.get(key) ?? 0 });
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return result;
}
