import { ClipboardCheckIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { PRIORITY_LABEL } from "@/lib/board/constants";
import { formatThaiDate } from "@/lib/board/dates";
import { listPeople } from "@/lib/people";
import { REVIEW_STATUS_LABEL, type ReviewStatus } from "@/lib/reviews";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { TaskPriority } from "@/types/domain";
import { ReviewItem } from "./review-item";

export const metadata = { title: "ตรวจงาน | Kanban Board บันทึกงาน" };
// Reads the session per request, so it cannot be an instant navigation.
export const instant = false;

const dateTime = (iso: string) =>
  new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso),
  );

/** BR-54: requests waiting for me, requests I sent, and what I reviewed recently. */
export default async function ReviewsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  // Explicit filters: an admin can read every request under RLS, but this page is personal.
  const [mineRes, sentRes, doneRes, people] = await Promise.all([
    supabase
      .from("task_reviews")
      .select("id, task_id, owner_id, requested_at, comment")
      .eq("reviewer_id", profile.id)
      .eq("status", "open")
      .order("requested_at"),
    supabase
      .from("task_reviews")
      .select("id, task_id, reviewer_id, requested_at, comment")
      .eq("owner_id", profile.id)
      .eq("status", "open")
      .order("requested_at"),
    supabase
      .from("task_reviews")
      .select("id, task_id, owner_id, status, comment, decided_at")
      .eq("reviewer_id", profile.id)
      .in("status", ["approved", "returned"])
      .order("decided_at", { ascending: false })
      .limit(10),
    listPeople(),
  ]);
  if (mineRes.error || sentRes.error || doneRes.error) throw new Error("โหลดข้อมูลการตรวจงานไม่สำเร็จ");

  const taskIds = [...new Set([...mineRes.data, ...sentRes.data, ...doneRes.data].map((r) => r.task_id))];
  const [tasksRes, categoriesRes] = await Promise.all([
    taskIds.length > 0
      ? supabase
          .from("tasks")
          .select("id, title, description, status, is_deleted, due_date, priority, category_id")
          .in("id", taskIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("categories").select("id, name"),
  ]);
  if (tasksRes.error || categoriesRes.error) throw new Error("โหลดข้อมูลงานไม่สำเร็จ");

  const taskById = new Map(tasksRes.data.map((t) => [t.id, t]));
  const nameOf = new Map(people.map((p) => [p.id, p.name]));
  const categoryOf = new Map(categoriesRes.data.map((c) => [c.id, c.name]));
  const who = (id: string) => nameOf.get(id) ?? "ผู้ใช้ที่ไม่พบ";

  // Only requests whose task is still waiting in "รอตรวจสอบ".
  const waiting = mineRes.data.filter((r) => {
    const t = taskById.get(r.task_id);
    return t && !t.is_deleted && t.status === "review";
  });

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <ClipboardCheckIcon className="size-6 text-primary" aria-hidden />
          ตรวจงาน
        </h1>
        <p className="text-sm text-muted-foreground">
          งานที่มีคนขอให้คุณตรวจ ผ่าน = ย้ายไป &ldquo;เสร็จแล้ว&rdquo; / ส่งกลับแก้ = ย้ายไป &ldquo;กำลังทำ&rdquo; /
          ให้ความเห็น = งานอยู่ที่เดิม เจ้าของงานได้รับแจ้งเตือนทุกครั้ง
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            รอฉันตรวจ{" "}
            <span className="text-muted-foreground tabular-nums" data-testid="review-waiting-count">
              ({waiting.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {waiting.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">ไม่มีงานรอคุณตรวจ</p>
          ) : (
            <ol className="flex flex-col gap-3" data-testid="review-waiting">
              {waiting.map((r) => {
                const t = taskById.get(r.task_id)!;
                return (
                  <ReviewItem
                    key={r.id}
                    reviewId={r.id}
                    title={t.title}
                    description={t.description}
                    owner={who(r.owner_id)}
                    meta={[
                      `ส่งเมื่อ ${dateTime(r.requested_at)}`,
                      categoryOf.get(t.category_id),
                      `ความสำคัญ${PRIORITY_LABEL[t.priority as TaskPriority]}`,
                      t.due_date ? `กำหนดเสร็จ ${formatThaiDate(t.due_date)}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    previousComment={r.comment}
                  />
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>งานที่ฉันส่งให้ตรวจ</CardTitle>
          <CardDescription>ย้ายงานออกจาก &ldquo;รอตรวจสอบ&rdquo; บนบอร์ดเพื่อยกเลิกคำขอ</CardDescription>
        </CardHeader>
        <CardContent>
          {sentRes.data.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">ไม่มีงานที่รอผู้อื่นตรวจ</p>
          ) : (
            <ul className="flex flex-col divide-y" data-testid="review-sent">
              {sentRes.data.map((r) => (
                <li key={r.id} className="flex flex-col gap-1 py-2.5 text-sm">
                  <span className="font-medium">{taskById.get(r.task_id)?.title ?? "—"}</span>
                  <span className="text-muted-foreground">
                    รอ {who(r.reviewer_id)} ตรวจ · ส่งเมื่อ {dateTime(r.requested_at)}
                  </span>
                  {r.comment && <span className="rounded-md bg-primary/8 px-2 py-1">ความเห็น: {r.comment}</span>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ตรวจแล้วล่าสุด</CardTitle>
        </CardHeader>
        <CardContent>
          {doneRes.data.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">ยังไม่มีงานที่ตรวจแล้ว</p>
          ) : (
            <ul className="flex flex-col divide-y" data-testid="review-done">
              {doneRes.data.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                  <span
                    className={cn(
                      "rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset",
                      r.status === "approved"
                        ? "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-900"
                        : "bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-900",
                    )}
                  >
                    {REVIEW_STATUS_LABEL[r.status as ReviewStatus]}
                  </span>
                  <span className="min-w-0 flex-1 font-medium">{taskById.get(r.task_id)?.title ?? "—"}</span>
                  <span className="text-muted-foreground">
                    {who(r.owner_id)}
                    {r.decided_at && ` · ${dateTime(r.decided_at)}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
