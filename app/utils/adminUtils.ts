// Admin 使用者列表
export const ADMIN_EMAILS = [
  'dada878@gmail.com',
  // 可以在這裡添加更多 admin email
];

// 檢查是否為 admin
export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}