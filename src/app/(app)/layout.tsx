import { Suspense } from "react";
import { AppHeader, AppHeaderFallback } from "@/components/app-header";
import { DefaultPasswordBanner } from "@/components/default-password-banner";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <Suspense fallback={<AppHeaderFallback />}>
        <AppHeader />
      </Suspense>
      <Suspense fallback={null}>
        <DefaultPasswordBanner />
      </Suspense>
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6">{children}</main>
    </div>
  );
}
