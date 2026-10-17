export const STAFF_ROLES = [
  "admin",
  "info_officer",
  "emergency_nurse",
  "cashier",
  "pharmacy",
  "lab",
  "nurse_station",
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export interface StaffProfile {
  userId: string;
  email: string;
  displayName: string;
  role: StaffRole;
  wardId: string | null;
  isActive: boolean;
}
