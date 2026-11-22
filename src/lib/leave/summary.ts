// Shape of leave_summary() (SQL) and a safe reader.
import { LEAVE_TYPES, type LeaveType } from "./rules";

export type LeavePerson = {
  id: string;
  displayName: string;
  unitName: string | null;
  isActive: boolean;
  total: number;
  months: Record<string, number>; // "YYYY-MM" -> working days
  types: Partial<Record<LeaveType, number>>;
};

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);

export function parseLeaveSummary(raw: unknown): LeavePerson[] {
  if (!Array.isArray(raw)) throw new Error("Unexpected leave_summary result");
  return raw.filter(isObj).map((p) => {
    const months: Record<string, number> = {};
    if (isObj(p.months)) for (const [k, v] of Object.entries(p.months)) months[k] = num(v);
    const types: Partial<Record<LeaveType, number>> = {};
    if (isObj(p.types)) for (const t of LEAVE_TYPES) if (p.types[t] !== undefined) types[t] = num(p.types[t]);
    return {
      id: String(p.id),
      displayName: String(p.display_name),
      unitName: p.unit_name === null ? null : String(p.unit_name),
      isActive: p.is_active === true,
      total: num(p.total),
      months,
      types,
    };
  });
}
