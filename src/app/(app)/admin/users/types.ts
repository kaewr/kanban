import type { UserRole } from "@/types/domain";

export type AdminUserRow = {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
};
