import type { StaffRole } from "./roles";

export type HmsModule =
  | "dashboard"
  | "patients"
  | "patient-registration"
  | "encounters"
  | "available-doctors"
  | "requests"
  | "wards"
  | "billing"
  | "inventory"
  | "medicine-stock"
  | "profit-inventory"
  | "staff"
  | "audit";

export const MODULES: Record<
  HmsModule,
  { label: string; path: string; roles: StaffRole[] }
> = {
  dashboard: {
    label: "Overview",
    path: "/overview",
    roles: [
      "admin",
      "info_officer",
      "emergency_nurse",
      "cashier",
      "pharmacy",
      "lab",
      "nurse_station",
    ],
  },
  patients: {
    label: "Patient Records",
    path: "/patients",
    roles: ["info_officer", "emergency_nurse", "nurse_station"],
  },
  "patient-registration": {
    label: "Patient Registration",
    path: "/patient-registration-workspace",
    roles: ["info_officer"],
  },
  encounters: {
    label: "Encounters",
    path: "/encounters",
    roles: ["emergency_nurse"],
  },
  "available-doctors": {
    label: "Available Doctors",
    path: "/available-doctors",
    roles: ["admin", "info_officer"],
  },
  requests: {
    label: "Requests",
    path: "/requests",
    roles: ["emergency_nurse", "cashier", "nurse_station"],
  },
  wards: {
    label: "Wards & beds",
    path: "/wards",
    roles: ["admin", "emergency_nurse", "nurse_station"],
  },
  billing: {
    label: "Billing & discharge",
    path: "/billing",
    roles: ["cashier", "nurse_station"],
  },
  inventory: {
    label: "Lab Inventory",
    path: "/inventory",
    roles: ["lab"],
  },
  "medicine-stock": {
    label: "Medicine Stock",
    path: "/medicine-stock",
    roles: ["pharmacy"],
  },
  "profit-inventory": {
    label: "Profit Inventory",
    path: "/profit-inventory",
    roles: ["pharmacy"],
  },
  staff: { label: "Staff", path: "/staff", roles: ["admin"] },
  audit: { label: "Audit log", path: "/audit", roles: ["admin"] },
};

export function canAccessModule(role: StaffRole, module: HmsModule): boolean {
  return MODULES[module].roles.includes(role);
}

export function homePathForRole(role: StaffRole): string {
  if (role === "admin") return "/staff";
  if (role === "info_officer") return "/patients";
  if (role === "emergency_nurse") return "/encounters";
  if (role === "nurse_station") return "/wards";
  if (role === "cashier") return "/billing";
  if (role === "pharmacy" || role === "lab") return "/inventory";
  return "/";
}
