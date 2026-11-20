import { logout } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

export function LogoutButton({ className }: { className?: string }) {
  return (
    <form action={logout} className={className}>
      <Button type="submit" variant="outline" className="w-full">
        ออกจากระบบ
      </Button>
    </form>
  );
}
