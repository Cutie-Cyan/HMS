import { useQuery } from "@tanstack/react-query";
import {
  Activity, ArrowUpRight, BedDouble, Boxes, ClipboardCheck, ClipboardList,
  FileText, PackageCheck, Stethoscope,
  UserRoundCheck, Users, Wallet,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { MODULES } from "../../lib/permissions";
import { getSupabaseClient } from "../../lib/supabase";

type Metric = { label: string; value: number | string; detail: string; icon: typeof Users; to: string };
type PatientRow = { patient_id: string; status: string };
type EncounterRow = { encounter_id: string; encounter_status: string; patient_status: string };
type RequestRow = { request_id: string; request_type: "medicine" | "lab"; status: string; total: number; bill_paid: boolean };
type InventoryRow = { id: string; item_name: string; quantity_on_hand: number; low_stock_threshold: number };



export function DashboardPage() {
  const { profile } = useAuth();
  const role = profile?.role ?? "";
  const isAdmin = role === "admin";
  const isInfo = role === "info_officer";
  const isEmergency = role === "emergency_nurse";
  const isStation = role === "nurse_station";
  const isCashier = role === "cashier";
  const isPharmacy = role === "pharmacy";
  const isLab = role === "lab";
  const canSeePatients = isInfo || isEmergency || isStation;
  const canSeeEncounters = isEmergency || isStation;
  const canSeeRequests = isEmergency || isStation || isCashier || isPharmacy || isLab;
  const department = isLab ? "lab" : "medicine";

  const staff = useQuery({
    queryKey: ["admin", "dashboard-staff-count"], enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc("admin_staff_directory");
      if (error) throw error;
      const rows = (data ?? []) as { is_active: boolean }[];
      return { total: rows.length, active: rows.filter((row) => row.is_active).length, inactive: rows.filter((row) => !row.is_active).length };
    },
  });
  const beds = useQuery({
    queryKey: ["dashboard", "bed-board"], enabled: isAdmin || isEmergency || isStation,
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc("staff_ward_bed_workspace");
      if (error) throw error;
      const rows = (data ?? []) as { bed_id: string | null; occupied: boolean; ward_name?: string }[];
      const configured = rows.filter((row) => row.bed_id);
      return { total: configured.length, occupied: configured.filter((row) => row.occupied).length, available: configured.filter((row) => !row.occupied).length };
    },
  });
  const patients = useQuery({
    queryKey: ["dashboard", "patient-count", role], enabled: canSeePatients,
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc("staff_patient_directory", { p_search: null });
      if (error) throw error;
      return (data ?? []) as PatientRow[];
    },
  });
  const encounters = useQuery({
    queryKey: ["dashboard", "encounters", role], enabled: canSeeEncounters,
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc("staff_encounter_queue", { p_status: "open" });
      if (error) throw error;
      return (data ?? []) as EncounterRow[];
    },
  });
  const requests = useQuery({
    queryKey: ["dashboard", "requests", role], enabled: canSeeRequests,
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc("staff_request_workspace");
      if (error) throw error;
      return (data ?? []) as RequestRow[];
    },
  });
  const inventory = useQuery({
    queryKey: ["dashboard", "inventory", department], enabled: isPharmacy || isLab,
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc("staff_inventory_items", { p_department: department });
      if (error) throw error;
      return (data ?? []) as InventoryRow[];
    },
  });

  const pendingRequests = (requests.data ?? []).filter((row) => row.status === "pending_payment");
  const readyRequests = (requests.data ?? []).filter((row) => row.status === "paid");
  const activePatients = (patients.data ?? []).filter((row) => row.status !== "discharged");
  const lowStock = (inventory.data ?? []).filter((row) => row.quantity_on_hand <= row.low_stock_threshold);
  const metrics: Metric[] = isAdmin ? [
    { label: "Staff accounts", value: staff.data?.total ?? "—", detail: staff.data ? `${staff.data.active} active · ${staff.data.inactive} inactive` : "Live staff directory", icon: Users, to: MODULES.staff.path },
    { label: "Configured beds", value: beds.data?.total ?? "—", detail: "Across all four wards", icon: BedDouble, to: MODULES.wards.path },
    { label: "Available beds", value: beds.data?.available ?? "—", detail: beds.data ? `${beds.data.occupied} currently occupied` : "Live bed board", icon: BedDouble, to: MODULES.wards.path },
  ] : isInfo ? [
    { label: "Total patient records", value: patients.data?.length ?? "—", detail: "All registered patients", icon: Users, to: MODULES.patients.path },
    { label: "Active patients", value: patients.data ? activePatients.length : "—", detail: "Patients not marked discharged", icon: Activity, to: MODULES.patients.path },
    { label: "Discharged patients", value: patients.data ? patients.data.filter((row) => row.status === "discharged").length : "—", detail: "Completed patient stays", icon: ClipboardList, to: MODULES.patients.path },
  ] : isEmergency ? [
    { label: "Open encounters", value: encounters.data?.length ?? "—", detail: "Consultations to review or continue", icon: Stethoscope, to: MODULES.encounters.path },
    { label: "Registered / active patients", value: patients.data?.length ?? "—", detail: "Patient directory", icon: Users, to: MODULES.patients.path },
    { label: "Beds available", value: beds.data?.available ?? "—", detail: beds.data ? `${beds.data.occupied} occupied` : "Live ward capacity", icon: BedDouble, to: MODULES.wards.path },
  ] : isStation ? [
    { label: "Open encounters", value: encounters.data?.length ?? "—", detail: "Patients in the encounter queue", icon: Stethoscope, to: MODULES.encounters.path },
    { label: "Available beds", value: beds.data?.available ?? "—", detail: beds.data ? `${beds.data.occupied} occupied across visible wards` : "Live bed board", icon: BedDouble, to: MODULES.wards.path },
    { label: "Requests in progress", value: requests.data ? requests.data.filter((row) => ["paid", "in_progress", "completed"].includes(row.status)).length : "—", detail: "Follow medicine and lab requests", icon: ClipboardList, to: MODULES.requests.path },
  ] : isCashier ? [
    { label: "Requests awaiting payment", value: requests.data ? pendingRequests.length : "—", detail: "Medicine and laboratory requests", icon: Wallet, to: MODULES.requests.path },
    { label: "Paid requests", value: requests.data ? readyRequests.length : "—", detail: "Already paid; handled by department staff", icon: ClipboardCheck, to: MODULES.requests.path },
    { label: "Billing workspace", value: "Open", detail: "Final bills and discharge closeout", icon: FileText, to: MODULES.billing.path },
  ] : (isPharmacy || isLab) ? [
    { label: "Requests ready", value: requests.data ? readyRequests.filter((row) => row.request_type === department).length : "—", detail: "Paid requests for your department", icon: PackageCheck, to: MODULES.inventory.path },
    { label: "Awaiting payment", value: requests.data ? pendingRequests.filter((row) => row.request_type === department).length : "—", detail: "Cannot release until cashier payment", icon: Wallet, to: MODULES.requests.path },
    { label: "Low-stock items", value: inventory.data ? lowStock.length : "—", detail: "At or below configured threshold", icon: Boxes, to: MODULES.inventory.path },
  ] : [];

  const hasDataError = [staff, beds, patients, encounters, requests, inventory].some((query) => query.isError);
  if (isEmergency) return <div className="mx-auto max-w-[1440px] space-y-6 pb-8">
    {hasDataError && <div role="status" className="rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Some live dashboard data could not be loaded. Open the relevant workspace to retry.</div>}
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {metrics.map(({ label, value, detail, icon: Icon, to }) => <Link key={label} to={to} className="group rounded-2xl border border-border bg-card p-5 transition hover:border-primary/40 hover:shadow-sm">
        <div className="flex items-center justify-between gap-3"><span className="text-sm font-medium text-muted-foreground">{label}</span><span className="grid size-10 place-items-center rounded-xl bg-muted text-foreground"><Icon size={18}/></span></div>
        <p className="mt-5 text-3xl font-semibold tabular-nums">{value}</p><div className="mt-2 flex items-center justify-between gap-3"><span className="text-xs text-muted-foreground">{detail}</span><ArrowUpRight size={16} className="shrink-0 text-muted-foreground group-hover:text-foreground"/></div>
      </Link>)}
    </section>
  </div>;
  return <div className="mx-auto max-w-[1440px] space-y-7 pb-8">
    {hasDataError && <div role="status" className="rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Some live dashboard data could not be loaded. Open the relevant workspace to retry; metrics are not being replaced with sample data.</div>}
    
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {metrics.map(({ label, value, detail, icon: Icon, to }) => <Link key={label} to={to} className="group rounded-2xl border border-border bg-card p-5 transition hover:border-primary/40 hover:shadow-sm"><div className="flex items-center justify-between gap-3"><span className="text-sm font-medium text-muted-foreground">{label}</span><span className="grid size-10 place-items-center rounded-xl bg-muted text-foreground"><Icon size={18}/></span></div><p className="mt-5 text-3xl font-semibold tabular-nums">{value}</p><div className="mt-2 flex items-center justify-between gap-3"><span className="text-xs text-muted-foreground">{detail}</span><ArrowUpRight size={16} className="shrink-0 text-muted-foreground group-hover:text-foreground"/></div></Link>)}
    </section>
  </div>;
}
