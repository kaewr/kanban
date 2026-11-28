import "server-only";

export const MIN_PASSWORD_LENGTH = 8; // BR-59 (Supabase Auth itself allows 6; the default password may stay shorter)

/** Returns a Thai error message, or null when the new password is acceptable. */
export function validateNewPassword(newPassword: string, confirmPassword: string): string | null {
  const defaultPassword = process.env.DEFAULT_PASSWORD;
  if (defaultPassword && newPassword === defaultPassword) {
    return "ห้ามใช้รหัสผ่านเริ่มต้น กรุณาตั้งรหัสผ่านใหม่"; // BR-24
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return `รหัสผ่านต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`;
  }
  if (newPassword !== confirmPassword) {
    return "รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน";
  }
  return null;
}

/** Maps Supabase Auth updateUser error codes to Thai messages. */
export function passwordUpdateErrorMessage(code: string | undefined): string {
  switch (code) {
    case "same_password":
      return "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน";
    case "weak_password":
      return "รหัสผ่านไม่ปลอดภัยพอ กรุณาตั้งรหัสผ่านที่คาดเดายากกว่านี้";
    case "reauthentication_needed":
      return "กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่ก่อนเปลี่ยนรหัสผ่าน";
    default:
      return "เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
  }
}
