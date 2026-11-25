import { SparklesIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { formatThaiDate } from "@/lib/board/dates";
import { APP_VERSION, parseChangelog } from "@/lib/changelog";
import { cn } from "@/lib/utils";

export const metadata = { title: "มีอะไรใหม่ | Kanban Board บันทึกงาน" };
// Every page reads the session per request, so it cannot be an instant navigation.
export const instant = false;

/** Release notes from CHANGELOG.md, inlined at build time (next.config env). */
export default async function ChangelogPage() {
  await requireProfile();
  const releases = parseChangelog(process.env.APP_CHANGELOG ?? "");

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <SparklesIcon className="size-6 text-primary" aria-hidden />
          มีอะไรใหม่
        </h1>
        <p className="text-sm text-muted-foreground">
          ตอนนี้ใช้เวอร์ชัน {APP_VERSION} · เลขเวอร์ชันแบบ MAJOR.MINOR.PATCH: MINOR = เพิ่มความสามารถใหม่, PATCH = แก้ไขข้อผิดพลาด
        </p>
      </div>

      <ol className="flex flex-col gap-4" data-testid="changelog">
        {releases.map((r) => (
          <li key={r.version} data-version={r.version}>
            <Card className={cn(r.version === APP_VERSION && "ring-2 ring-primary/30")}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span>เวอร์ชัน {r.version}</span>
                  {r.date && <span className="text-sm font-normal text-muted-foreground">{formatThaiDate(r.date)}</span>}
                  {r.version === APP_VERSION && (
                    <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">ปัจจุบัน</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {r.sections.map((s) => (
                  <div key={s.title} className="flex flex-col gap-1">
                    {s.title && <p className="text-sm font-medium">{s.title}</p>}
                    <ul className="list-disc space-y-1 pl-5 text-sm">
                      {s.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}
