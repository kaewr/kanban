import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Centered card used by /login. */
export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-16">
      {/* Soft brand glow behind the card */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_50%_-10%,color-mix(in_oklab,var(--brand-purple)_18%,transparent),transparent),radial-gradient(40rem_20rem_at_90%_110%,color-mix(in_oklab,var(--brand-gold)_14%,transparent),transparent)]"
      />
      <ThemeToggle className="absolute top-4 right-4" />
      <div className="relative flex w-full max-w-sm flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <BrandMark className="size-12 rounded-xl" />
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-medium text-brand-gold">คณะเทคโนโลยีสารสนเทศและการสื่อสาร</p>
            <p className="text-xs text-muted-foreground">มหาวิทยาลัยพะเยา</p>
          </div>
        </div>
        <Card className="w-full shadow-lg shadow-primary/5">
          <CardHeader>
            <CardTitle className="text-xl">{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </main>
  );
}
