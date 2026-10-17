import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity, ArrowRight, ArrowUpRight, BedDouble, Boxes, ClipboardCheck,
  ClipboardList, FileText, PackageCheck, ScrollText, ShieldCheck, Stethoscope,
  Users, Wallet,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { MODULES, canAccessModule, type HmsModule } from "../../lib/permissions";
import { getSupabaseClient } from "../../lib/supabase";

type Metric = { label: string; value: number | string; detail: string; icon: typeof Users; to: string };
type PatientRow = { patient_id: string; status: string };
type EncounterRow = { encounter_id: string; encounter_status: string; patient_status: string };
type RequestRow = { request_id: string; request_type: "medicine" | "lab"; status: string; total: number; bill_paid: boolean };
type InventoryRow = { id: string; item_name: string; quantity_on_hand: number; low_stock_threshold: number };

const iconByModule: Record<HmsModule, typeof Users> = {
  dashboard: Activity, patients: Users, encounters: Stethoscope, requests: ClipboardList,
  wards: BedDouble, billing: Wallet, inventory: Boxes, staff: ShieldCheck, audit: ScrollText,
};
const roleCopy: Record<string, { title: string; description: string }> = {
  admin: { title: "Hospital overview", description: "Monitor system access, ward capacity, and operational setup." },
  info_officer: { title: "Patient services", description: "Register patients, maintain doctor records, and find existing patient records." },
  emergency_nurse: { title: "Emergency care", description: "Review active encounters, continue consultations, and coordinate admissions." },
  nurse_station: { title: "Ward station", description: "Track your ward's patients, follow request progress, and manage bed transfers." },
  cashier: { title: "Cashier desk", description: "Prioritize unpaid requests and final bills waiting for payment." },
  pharmacy: { title: "Pharmacy operations", description: "Monitor medicine requests, release paid orders, and watch stock levels." },
  lab: { title: "Laboratory operations", description: "Review paid lab requests, record results, and monitor laboratory stock." },
};

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

  const availableModules = useMemo(() => (Object.keys(MODULES) as HmsModule[]).filter(
    (module) => module !== "dashboard" && profile && canAccessModule(profile.role, module),
  ), [profile]);
  const roleName = role.replaceAll("_", " ") || "Staff";
  const copy = roleCopy[role] ?? { title: "HMS overview", description: "Your role-based workspace and current operational priorities." };
  const pendingRequests = (requests.data ?? []).filter((row) => row.status === "pending_payment");
  const readyRequests = (requests.data ?? []).filter((row) => row.status === "paid");
  const activePatients = (patients.data ?? []).filter((row) => row.status !== "discharged");
  const lowStock = (inventory.data ?? []).filter((row) => row.quantity_on_hand <= row.low_stock_threshold);
  const metrics: Metric[] = isAdmin ? [
    { label: "Staff accounts", value: staff.data?.total ?? "—", detail: staff.data ? `${staff.data.active} active · ${staff.data.inactive} inactive` : "Live staff directory", icon: Users, to: MODULES.staff.path },
    { label: "Configured beds", value: beds.data?.total ?? "—", detail: "Across all four wards", icon: BedDouble, to: MODULES.wards.path },
    { label: "Available beds", value: beds.data?.available ?? "—", detail: beds.data ? `${beds.data.occupied} currently occupied` : "Live bed board", icon: BedDouble, to: MODULES.wards.path },
  ] : isInfo ? [
    { label: "Patient records", value: patients.data?.length ?? "—", detail: "Searchable patient directory", icon: Users, to: MODULES.patients.path },
    { label: "Currently active", value: activePatients.length || (patients.data ? 0 : "—"), detail: "Not marked discharged", icon: Activity, to: MODULES.patients.path },
    { label: "Doctor records", value: "Manage", detail: "Doctor records are not login accounts", icon: Stethoscope, to: MODULES.patients.path },
  ] : isEmergency ? [
    { label: "Open encounters", value: encounters.data?.length ?? "—", detail: "Consultations to review or continue", icon: Stethoscope, to: MODULES.encounters.path },
    { label: "Registered / active patients", value: patients.data?.length ?? "—", detail: "Patient directory", icon: Users, to: MODULES.patients.path },
    { label: "Beds available", value: beds.data?.available ?? "—", detail: beds.data ? `${beds.data.occupied} occupied` : "Live ward capacity", icon: BedDouble, to: MODULES.wards.path },
  ] : isStation ? [
    { label: "Open encounters", value: encounters.data?.length ?? "—", detail: "Patients in the encounter queue", icon: Stethoscope, to: MODULES.encounters.path },
    { label: "Available beds", value: beds.data?.available ?? "—", detail: beds.data ? `${beds.data.occupied} occupied across visible wards` : "Live bed board", icon: BedDouble, to: MODULES.wards.path },
    { label: "Requests in progress", value: (requests.data ?? []).filter((row) => ["paid", "in_progress", "completed"].includes(row.status)).length || (requests.data ? 0 : "—"), detail: "Follow medicine and lab requests", icon: ClipboardList, to: MODULES.requests.path },
  ] : isCashier ? [
    { label: "Requests awaiting payment", value: pendingRequests.length || (requests.data ? 0 : "—"), detail: "Medicine and laboratory requests", icon: Wallet, to: MODULES.requests.path },
    { label: "Paid requests", value: readyRequests.length || (requests.data ? 0 : "—"), detail: "Already paid; handled by department staff", icon: ClipboardCheck, to: MODULES.requests.path },
    { label: "Billing workspace", value: "Open", detail: "Final bills and discharge closeout", icon: FileText, to: MODULES.billing.path },
  ] : (isPharmacy || isLab) ? [
    { label: "Requests ready", value: readyRequests.filter((row) => row.request_type === department).length || (requests.data ? 0 : "—"), detail: "Paid requests for your department", icon: PackageCheck, to: MODULES.inventory.path },
    { label: "Awaiting payment", value: pendingRequests.filter((row) => row.request_type === department).length || (requests.data ? 0 : "—"), detail: "Cannot release until cashier payment", icon: Wallet, to: MODULES.requests.path },
    { label: "Low-stock items", value: lowStock.length || (inventory.data ? 0 : "—"), detail: "At or below configured threshold", icon: Boxes, to: MODULES.inventory.path },
  ] : [];

  const quickActions: { label: string; description: string; to: string; icon: typeof Users }[] =
    isAdmin ? [
      { label: "Staff administration", description: "Invite staff and manage role access", to: MODULES.staff.path, icon: ShieldCheck },
      { label: "Ward & bed setup", description: "Review capacity and configured beds", to: MODULES.wards.path, icon: BedDouble },
      { label: "Audit log", description: "Review sensitive administrative activity", to: MODULES.audit.path, icon: ScrollText },
    ] : isInfo ? [
      { label: "Register a patient", description: "Create a new patient record", to: MODULES.patients.path, icon: Users },
      { label: "Patient directory", description: "Find records by name or patient number", to: MODULES.patients.path, icon: FileText },
    ] : isEmergency ? [
      { label: "Open encounter queue", description: "Record findings and recommendations", to: MODULES.encounters.path, icon: Stethoscope },
      { label: "Review patients", description: "Find a registered patient", to: MODULES.patients.path, icon: Users },
      { label: "Bed board", description: "Check availability and admit patients", to: MODULES.wards.path, icon: BedDouble },
    ] : isStation ? [
      { label: "Ward bed board", description: "Review occupied beds and transfer patients", to: MODULES.wards.path, icon: BedDouble },
      { label: "Request status", description: "Track medicines and lab requests", to: MODULES.requests.path, icon: ClipboardList },
      { label: "Billing & discharge", description: "Check patient closeout status", to: MODULES.billing.path, icon: Wallet },
    ] : isCashier ? [
      { label: "Payment queue", description: "Collect payment for pending requests", to: MODULES.requests.path, icon: Wallet },
      { label: "Final bills", description: "Prepare bills and record final payment", to: MODULES.billing.path, icon: FileText },
    ] : isPharmacy ? [
      { label: "Medicine requests", description: "Release paid medicine orders", to: MODULES.inventory.path, icon: PackageCheck },
      { label: "Medicine stock", description: "Review stock and low-stock alerts", to: MODULES.inventory.path, icon: Boxes },
    ] : isLab ? [
      { label: "Lab request queue", description: "Enter verified results and release paid tests", to: MODULES.inventory.path, icon: ClipboardCheck },
      { label: "Laboratory stock", description: "Review supplies and low-stock alerts", to: MODULES.inventory.path, icon: Boxes },
    ] : [];

  const hasDataError = [staff, beds, patients, encounters, requests, inventory].some((query) => query.isError);
  return <div className="mx-auto max-w-[1440px] space-y-7 pb-8">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{roleName} workspace</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{copy.title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{copy.description}</p><p className="mt-3 text-sm font-medium">{profile?.displayName ?? "Staff account"}</p></div>
      <span className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium capitalize">{roleName}</span>
    </header>
    {hasDataError && <div role="status" className="rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Some live dashboard data could not be loaded. Open the relevant workspace to retry; metrics are not being replaced with sample data.</div>}
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {metrics.map(({ label, value, detail, icon: Icon, to }) => <Link key={label} to={to} className="group rounded-2xl border border-border bg-card p-5 transition hover:border-primary/40 hover:shadow-sm">
        <div className="flex items-center justify-between gap-3"><span className="text-sm font-medium text-muted-foreground">{label}</span><span className="grid size-10 place-items-center rounded-xl bg-muted text-foreground"><Icon size={18}/></span></div>
        <p className="mt-5 text-3xl font-semibold tabular-nums">{value}</p><div className="mt-2 flex items-center justify-between gap-3"><span className="text-xs text-muted-foreground">{detail}</span><ArrowUpRight size={16} className="shrink-0 text-muted-foreground group-hover:text-foreground"/></div>
      </Link>)}
    </section>
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,.8fr)]">
      <div className="rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="font-semibold">Priority queue</h2><p className="mt-1 text-xs text-muted-foreground">Live operational items relevant to your role</p></div><ClipboardList size={18} className="text-muted-foreground"/></div>
        <div className="divide-y divide-border">
          {(isAdmin ? [
            { title: "Staff access", detail: staff.isLoading ? "Loading staff directory…" : staff.isError ? "Staff directory unavailable" : staff.data?.total ? `${staff.data.active} active staff account(s)` : "No staff profiles yet", to: MODULES.staff.path, icon: Users },
            { title: "Ward capacity", detail: beds.isLoading ? "Loading bed board…" : beds.isError ? "Bed board unavailable" : beds.data?.total ? `${beds.data.available} available of ${beds.data.total} configured beds` : "No beds configured yet", to: MODULES.wards.path, icon: BedDouble },
            { title: "Audit trail", detail: "Review staff and administrative changes", to: MODULES.audit.path, icon: ScrollText },
          ] : isInfo ? [
            { title: "Patient registration", detail: "New patients can be registered from Patient Services", to: MODULES.patients.path, icon: Users },
            { title: "Doctor records", detail: "Maintain real doctor details; doctors do not sign in", to: MODULES.patients.path, icon: Stethoscope },
          ] : isEmergency ? [
            { title: "Open encounters", detail: encounters.isLoading ? "Loading encounter queue…" : encounters.isError ? "Encounter queue unavailable" : `${encounters.data?.length ?? 0} open encounter(s) to review`, to: MODULES.encounters.path, icon: Stethoscope },
            { title: "Bed availability", detail: beds.isLoading ? "Loading ward capacity…" : beds.isError ? "Bed board unavailable" : `${beds.data?.available ?? 0} available bed(s)`, to: MODULES.wards.path, icon: BedDouble },
            { title: "Patient records", detail: patients.isLoading ? "Loading patient directory…" : patients.isError ? "Patient directory unavailable" : `${patients.data?.length ?? 0} record(s) searchable`, to: MODULES.patients.path, icon: Users },
          ] : isStation ? [
            { title: "Requests needing follow-up", detail: requests.isLoading ? "Loading request workspace…" : requests.isError ? "Request queue unavailable" : `${(requests.data ?? []).filter((r) => ["paid", "in_progress", "completed"].includes(r.status)).length} paid or processing request(s)`, to: MODULES.requests.path, icon: ClipboardList },
            { title: "Ward bed board", detail: beds.isLoading ? "Loading bed board…" : beds.isError ? "Bed board unavailable" : `${beds.data?.occupied ?? 0} occupied · ${beds.data?.available ?? 0} available`, to: MODULES.wards.path, icon: BedDouble },
            { title: "Discharge closeout", detail: "Check request clearance and final bill status", to: MODULES.billing.path, icon: Wallet },
          ] : isCashier ? [
            { title: "Pending request payments", detail: requests.isLoading ? "Loading payments…" : requests.isError ? "Request queue unavailable" : `${pendingRequests.length} request(s) awaiting payment`, to: MODULES.requests.path, icon: Wallet },
            { title: "Final bills", detail: "Review eligible admissions and record final payment", to: MODULES.billing.path, icon: FileText },
          ] : (isPharmacy || isLab) ? [
            { title: "Paid requests ready", detail: requests.isLoading ? "Loading department queue…" : requests.isError ? "Request queue unavailable" : `${readyRequests.filter((r) => r.request_type === department).length} paid ${department === "lab" ? "lab" : "medicine"} request(s)`, to: MODULES.inventory.path, icon: PackageCheck },
            { title: "Low stock", detail: inventory.isLoading ? "Loading stock levels…" : inventory.isError ? "Inventory unavailable" : `${lowStock.length} item(s) at or below threshold`, to: MODULES.inventory.path, icon: Boxes },
          ] : []).map(({ title, detail, to, icon: Icon }) => <Link key={title} to={to} className="flex items-center gap-3 px-5 py-4 transition hover:bg-muted/40"><span className="grid size-9 shrink-0 place-items-center rounded-xl border border-border bg-background"><Icon size={17}/></span><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{title}</span><span className="mt-1 block text-xs text-muted-foreground">{detail}</span></span><ArrowRight size={16} className="shrink-0 text-muted-foreground"/></Link>)}
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4"><h2 className="font-semibold">Quick actions</h2><p className="mt-1 text-xs text-muted-foreground">Shortcuts available to your staff role</p></div>
        <div className="space-y-2 p-3">
          {quickActions.map(({ label, description, to, icon: Icon }) => <Link key={label} to={to} className="flex items-center gap-3 rounded-xl p-3 transition hover:bg-muted/50"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted"><Icon size={18}/></span><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{label}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span></span><ArrowUpRight size={16} className="shrink-0 text-muted-foreground"/></Link>)}
        </div>
      </div>
    </section>
    <section><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Your modules</h2><span className="text-xs text-muted-foreground">{availableModules.length} available</span></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{availableModules.map((module) => { const Icon = iconByModule[module]; return <Link key={module} to={MODULES[module].path} className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition hover:border-primary/40"><span className="grid size-10 place-items-center rounded-xl bg-muted"><Icon size={18}/></span><span className="flex-1 text-sm font-medium">{MODULES[module].label}</span><ArrowUpRight size={16} className="text-muted-foreground group-hover:text-foreground"/></Link>; })}</div></section>
  </div>;
}
