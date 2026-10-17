import type { StaffRole } from "./roles";

export type HmsModule = "dashboard" | "patients" | "encounters" | "requests" | "wards" | "billing" | "inventory" | "staff" | "audit";

export const MODULES: Record<HmsModule, { label: string; path: string; roles: StaffRole[] }> = {
  dashboard: { label: "Overview", path: "/", roles: ["admin", "info_officer", "emergency_nurse", "cashier", "pharmacy", "lab", "nurse_station"] },
  patients: { label: "Patients", path: "/patients", roles: ["info_officer", "emergency_nurse", "nurse_station"] },
  encounters: { label: "Encounters", path: "/encounters", roles: ["emergency_nurse", "nurse_station"] },
  requests: { label: "Requests", path: "/requests", roles: ["emergency_nurse", "cashier", "pharmacy", "lab", "nurse_station"] },
  wards: { label: "Wards & beds", path: "/wards", roles: ["admin", "emergency_nurse", "nurse_station"] },
  billing: { label: "Billing & discharge", path: "/billing", roles: ["cashier", "nurse_station"] },
  inventory: { label: "Inventory", path: "/inventory", roles: ["pharmacy", "lab"] },
  staff: { label: "Staff", path: "/staff", roles: ["admin"] },
  audit: { label: "Audit log", path: "/audit", roles: ["admin"] },
};

export function canAccessModule(role: StaffRole, module: HmsModule): boolean {
  return MODULES[module].roles.includes(role);
}

export function homePathForRole(role: StaffRole): string {
  if (role === "admin") return "/staff";
  if (role === "info_officer") return "/patients";
  if (role === "emergency_nurse" || role === "nurse_station") return "/encounters";
  if (role === "cashier") return "/billing";
  if (role === "pharmacy" || role === "lab") return "/inventory";
  return "/";
}
