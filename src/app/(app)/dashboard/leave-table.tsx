import { CalendarOffIcon } from "lucide-react";
import { LeaveTypeBadge } from "@/components/leave/leave-type-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LEAVE_TYPES } from "@/lib/leave/rules";
import type { LeavePerson } from "@/lib/leave/summary";
import { cn } from "@/lib/utils";

/** BR-43: working days of leave per person and month of the selected year (admin dashboard). */
export function LeaveTable({ people, months }: { people: LeavePerson[]; months: { key: string; label: string }[] }) {
  const totals = Object.fromEntries(months.map((m) => [m.key, people.reduce((n, p) => n + (p.months[m.key] ?? 0), 0)]));
  const grand = people.reduce((n, p) => n + p.total, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarOffIcon className="size-5 text-primary" aria-hidden />
          วันลารายเดือน
        </CardTitle>
        <CardDescription>จำนวนวันทำการที่ลา (จันทร์–ศุกร์) แยกตามเดือน</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table data-testid="leave-table">
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-card">ชื่อ-นามสกุล</TableHead>
              {months.map((m) => (
                <TableHead key={m.key} className="text-right whitespace-nowrap">
                  {m.label}
                </TableHead>
              ))}
              <TableHead className="text-right">รวม</TableHead>
              <TableHead>แยกประเภท</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {people.map((p) => (
              <TableRow key={p.id} data-person={p.displayName}>
                <TableCell className="sticky left-0 bg-card font-medium whitespace-nowrap">
                  {p.displayName}
                  {!p.isActive && <span className="ml-1 text-xs text-muted-foreground">(ปิดใช้งาน)</span>}
                </TableCell>
                {months.map((m) => {
                  const n = p.months[m.key] ?? 0;
                  return (
                    <TableCell
                      key={m.key}
                      data-month={m.key}
                      className={cn("text-right tabular-nums", n === 0 ? "text-muted-foreground/50" : "font-medium")}
                    >
                      {n}
                    </TableCell>
                  );
                })}
                <TableCell className="text-right font-semibold tabular-nums" data-testid="leave-row-total">
                  {p.total}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {LEAVE_TYPES.filter((t) => p.types[t]).map((t) => (
                      <span key={t} className="inline-flex items-center gap-1 text-xs whitespace-nowrap">
                        <LeaveTypeBadge type={t} />
                        <span className="tabular-nums">{p.types[t]}</span>
                      </span>
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/40 font-semibold">
              <TableCell className="sticky left-0 bg-muted">รวมทุกคน</TableCell>
              {months.map((m) => (
                <TableCell key={m.key} className="text-right tabular-nums">
                  {totals[m.key]}
                </TableCell>
              ))}
              <TableCell className="text-right tabular-nums">{grand}</TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
