import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Activity, BedDouble, Boxes, ClipboardCheck, ClipboardList, Stethoscope, Search,
  FileText, PackageCheck, Users, Wallet, RefreshCw, AlertTriangle,
} from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { MODULES } from "../../lib/permissions";
import { getSupabaseClient } from "../../lib/supabase";

type Metric = { label: string; value: number | string; detail: string; icon: typeof Users; to: string };
type PatientRow = { patient_id: string; status: string };
type EncounterRow = { encounter_id: string; encounter_status: string; patient_status: string };
type RequestRow = { request_id: string; request_type: "medicine" | "lab"; status: string; total: number; bill_paid: boolean };
type InventoryRow = { id: string; item_name: string; quantity_on_hand: number; low_stock_threshold: number };
type AdminSummary = { patient_count: number; active_patient_count: number; open_encounter_count: number; request_count: number; pending_payment_count: number; paid_request_count: number; configured_bed_count: number; occupied_bed_count: number; available_bed_count: number; medicine_low_stock_count: number };



export function DashboardPage() {
  const { profile } = useAuth();
  const [metricSearch, setMetricSearch] = useState("");
  const role = profile?.role ?? "";
  const isAdmin = role === "admin";
  const isInfo = role === "info_officer";
  const isEmergency = role === "emergency_nurse";
  const isStation = role === "nurse_station";
  const isCashier = role === "cashier";
  const isPharmacy = role === "pharmacy";
  const isLab = role === "lab";
  const canSeePatients = isAdmin || isInfo || isEmergency || isStation;
  const canSeeEncounters = isAdmin || isEmergency || isStation;
  const canSeeRequests = isAdmin || isEmergency || isStation || isCashier || isPharmacy || isLab;
  const department = isLab ? "lab" : "medicine";

  const adminSummary = useQuery({
    queryKey: ["admin", "dashboard-summary"], enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc("admin_dashboard_summary");
      if (error) throw error;
      const row = (data ?? [])[0] as AdminSummary | undefined;
      if (!row) throw new Error("Dashboard summary returned no data.");
      return row;
    },
  });
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
    queryKey: ["dashboard", "bed-board"], enabled: !isAdmin && (isEmergency || isStation),
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc("staff_ward_bed_workspace");
      if (error) throw error;
      const rows = (data ?? []) as { bed_id: string | null; occupied: boolean; ward_name?: string }[];
      const configured = rows.filter((row) => row.bed_id);
      return { total: configured.length, occupied: configured.filter((row) => row.occupied).length, available: configured.filter((row) => !row.occupied).length };
    },
  });
  const patients = useQuery({
    queryKey: ["dashboard", "patient-count", role], enabled: canSeePatients && !isAdmin,
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc("staff_patient_directory", { p_search: null });
      if (error) throw error;
      return (data ?? []) as PatientRow[];
    },
  });
  const encounters = useQuery({
    queryKey: ["dashboard", "encounters", role], enabled: canSeeEncounters && !isAdmin,
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc("staff_encounter_queue", { p_status: "open" });
      if (error) throw error;
      return (data ?? []) as EncounterRow[];
    },
  });
  const requests = useQuery({
    queryKey: ["dashboard", "requests", role], enabled: canSeeRequests && !isAdmin,
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
    { label: "Patient records", value: adminSummary.data?.patient_count ?? "—", detail: adminSummary.data ? `${adminSummary.data.active_patient_count} active patients` : "Hospital-wide patient records", icon: Users, to: MODULES.patients.path },
    { label: "Active patients", value: adminSummary.data?.active_patient_count ?? "—", detail: "Patients not marked discharged", icon: Activity, to: MODULES.patients.path },
    { label: "Open encounters", value: adminSummary.data?.open_encounter_count ?? "—", detail: "Current encounter queue", icon: Stethoscope, to: MODULES["available-doctors"].path },
    { label: "Total requests", value: adminSummary.data?.request_count ?? "—", detail: "Medicine and laboratory requests", icon: ClipboardCheck, to: MODULES.staff.path },
    { label: "Awaiting payment", value: adminSummary.data?.pending_payment_count ?? "—", detail: "Outstanding medicine and lab payments", icon: Wallet, to: MODULES.billing.path },
    { label: "Paid requests", value: adminSummary.data?.paid_request_count ?? "—", detail: "Payments received for department requests", icon: FileText, to: MODULES.billing.path },
    { label: "Configured beds", value: adminSummary.data?.configured_bed_count ?? "—", detail: "Across hospital wards", icon: BedDouble, to: MODULES.wards.path },
    { label: "Available beds", value: adminSummary.data?.available_bed_count ?? "—", detail: adminSummary.data ? `${adminSummary.data.occupied_bed_count} currently occupied` : "Live bed board", icon: BedDouble, to: MODULES.wards.path },
    { label: "Occupied beds", value: adminSummary.data?.occupied_bed_count ?? "—", detail: "Beds currently assigned to patients", icon: BedDouble, to: MODULES.wards.path },

    { label: "Medicine low-stock items", value: adminSummary.data?.medicine_low_stock_count ?? "—", detail: "At or below reorder threshold", icon: Boxes, to: MODULES.staff.path },
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

  const queryList = [
    ...(isAdmin ? [adminSummary, staff] : []),
    ...(!isAdmin && (isEmergency || isStation) ? [beds] : []),
    ...(canSeePatients && !isAdmin ? [patients] : []),
    ...(canSeeEncounters && !isAdmin ? [encounters] : []),
    ...(canSeeRequests && !isAdmin ? [requests] : []),
    ...(isPharmacy || isLab ? [inventory] : []),
  ];
  const hasDataError = queryList.some((query) => query.isError);
  const isRefreshing = queryList.some((query) => query.isFetching);
  const refreshDashboard = async () => { await Promise.all(queryList.map((query) => query.refetch())); };

  return <div className="mx-auto w-full max-w-[1440px] pb-6">
    <section aria-label="Dashboard overview" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <label className="relative min-w-[220px] flex-1 sm:max-w-md">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input type="search" value={metricSearch} onChange={(event) => setMetricSearch(event.target.value)} placeholder="Search dashboard metrics..." aria-label="Search dashboard metrics" className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-500/10"/>
        </label>
        <button type="button" onClick={() => void refreshDashboard()} disabled={isRefreshing} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60" aria-label="Refresh dashboard data">
          <RefreshCw size={15} className={isRefreshing ? "animate-spin" : ""}/> Refresh
        </button>
      </div>
      {hasDataError && <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900"><AlertTriangle size={17} className="mt-0.5 shrink-0"/><span>Some dashboard data could not load. Refresh to try again.</span></div>}
      {(() => {
        const filteredMetrics = metrics.filter((metric) => (metric.label + " " + metric.detail).toLowerCase().includes(metricSearch.trim().toLowerCase()));
        const groupFor = (label: string) => {
          const name = label.toLowerCase();
          if (name.includes("patient") || name.includes("record")) return "Patients";
          if (name.includes("encounter") || name.includes("doctor")) return "Clinical activity";
          if (name.includes("bed") || name.includes("ward")) return "Beds & wards";
          if (name.includes("request") || name.includes("payment") || name.includes("billing") || name.includes("amount")) return "Billing & requests";
          if (name.includes("stock") || name.includes("medicine") || name.includes("inventory")) return "Inventory";
          if (name.includes("staff") || name.includes("account")) return "Staff & access";
          return "Operations";
        };
        const groups = [...new Set(filteredMetrics.map((metric) => groupFor(metric.label)))];
        return filteredMetrics.length ? <div className="space-y-6">{groups.map((group) => <section key={group} aria-label={group}>
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-800">{group}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredMetrics.filter((metric) => groupFor(metric.label) === group).map(({ label, value, detail, icon: Icon }) => {
              const query = isAdmin ? (label.toLowerCase().includes("staff") ? staff : adminSummary)
                : label.toLowerCase().includes("staff") ? staff
                : label.toLowerCase().includes("patient") || label.toLowerCase().includes("record") ? patients
                : label.toLowerCase().includes("encounter") ? encounters
                : label.toLowerCase().includes("request") || label.toLowerCase().includes("payment") || label.toLowerCase().includes("amount") || label.toLowerCase().includes("billing") ? requests
                : label.toLowerCase().includes("bed") ? beds
                : label.toLowerCase().includes("stock") || label.toLowerCase().includes("medicine") ? inventory : null;
              const failed = Boolean(query?.isError);
              const loading = Boolean(query?.isLoading);
              return <div key={label} className="flex min-h-[150px] min-w-0 flex-col rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0 text-sm font-semibold leading-5 text-slate-600">{label}</span>
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-slate-700 shadow-sm ring-1 ring-slate-200"><Icon size={19} strokeWidth={1.8}/></span>
                </div>
                <p className={`mt-4 text-3xl font-semibold leading-none tracking-tight tabular-nums ${failed ? "text-rose-700" : "text-slate-950"}`}>{failed ? "!" : loading ? "…" : value}</p>
                <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                  <p className={`min-w-0 whitespace-normal break-words text-xs leading-5 ${failed ? "text-rose-700" : "text-slate-500"}`}>{failed ? "Data unavailable · refresh to retry" : loading ? "Loading data…" : detail}</p>
                </div>
              </div>;
            })}
          </div>
        </section>)}</div> : <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">No matching metrics found.</p>;
      })()}
    </section>;
  </div>;
}