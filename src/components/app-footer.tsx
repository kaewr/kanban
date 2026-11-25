import Link from "next/link";
import { APP_VERSION, COMMIT_SHA } from "@/lib/changelog";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

/** Version line on every page; inside the app it links to the release notes. */
export function AppFooter({ linkToChangelog = false, className }: { linkToChangelog?: boolean; className?: string }) {
  const version = `เวอร์ชัน ${APP_VERSION}`;
  return (
    <footer className={cn("px-4 py-3 text-center text-xs text-muted-foreground", className)} data-testid="app-footer">
      Kanban บันทึกงาน ·{" "}
      {linkToChangelog ? (
        <Link href={ROUTES.changelog} className="underline-offset-4 hover:text-primary hover:underline" data-testid="app-version">
          {version}
        </Link>
      ) : (
        <span data-testid="app-version">{version}</span>
      )}{" "}
      · <span className="font-mono" title="รหัส commit ที่ deploy">{COMMIT_SHA}</span>
    </footer>
  );
}
