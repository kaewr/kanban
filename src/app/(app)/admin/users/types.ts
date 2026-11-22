import type { UserRole } from "@/types/domain";

export type UnitOption = { id: string; name: string };

export type AdminUserRow = {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  unitId: string | null;
  unitName: string | null;
  position: string | null;
};
