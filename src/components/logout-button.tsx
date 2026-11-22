"use client";

import { LogOutIcon } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { clearAllDrafts } from "@/lib/board/draft";

export function LogoutButton({ className }: { className?: string }) {
  return (
    // Board drafts live in this browser; remove them so the next person cannot see them.
    <form action={logout} className={className} onSubmit={() => clearAllDrafts()}>
      <Button type="submit" variant="outline" className="w-full gap-1.5">
        <LogOutIcon aria-hidden />
        ออกจากระบบ
      </Button>
    </form>
  );
}
