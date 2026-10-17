import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowUpRight, BedDouble, ClipboardList, ScrollText, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { MODULES, canAccessModule, type HmsModule } from "../../lib/permissions";
import { getSupabaseClient } from "../../lib/supabase";

const iconByModule: Record<HmsModule, typeof Users> = {
  dashboard: Activity, patients: Users, encounters: ClipboardList, requests: ClipboardList,
  wards: BedDouble, billing: ClipboardList, inventory: ClipboardList, staff: Users, audit: ScrollText,
};

export function DashboardPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const staff = useQuery({
    queryKey: ["admin", "dashboard-staff-count"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc("admin_staff_directory");
      if (error) throw error;
      const rows = (data ?? []) as { is_active: boolean }[];
      return { total: rows.length, active: rows.filter((row) => row.is_active).length, inactive: rows.filter((row) => !row.is_active).length };
    },
  });
  const beds = useQuery({
    queryKey: ["admin", "dashboard-bed-board"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc("staff_ward_bed_workspace");
      if (error) throw error;
      const rows = (data ?? []) as { bed_id: string | null; occupied: boolean }[];
      const configured = rows.filter((row) => row.bed_id);
      return { total: configured.length, occupied: configured.filter((row) => row.occupied).length, available: configured.filter((row) => !row.occupied).length };
    },
  });
  const available = useMemo(() => (Object.keys(MODULES) as HmsModule[]).filter(
    (module) => module !== "dashboard" && profile && canAccessModule(profile.role, module),
  ), [profile]);
  const adminModules: HmsModule[] = ["staff", "wards", "audit"];
  const cards = isAdmin ? [
    { label: "Staff accounts", value: staff.data?.total, detail: staff.data ? `${staff.data.active} active · ${staff.data.inactive} inactive` : "—", icon: Users, to: MODULES.staff.path },
    { label: "Configured beds", value: beds.data?.total, detail: beds.data ? `${beds.data.occupied} occupied · ${beds.data.available} available` : "—", icon: BedDouble, to: MODULES.wards.path },
    { label: "Available beds", value: beds.data?.available, detail: beds.data ? `${beds.data.occupied} currently occupied` : "—", icon: BedDouble, to: MODULES.wards.path },
  ] : [];
  const roleName = profile?.role.replaceAll("_", " ") ?? "Staff";

  return <div className="mx-auto max-w-[1440px] space-y-7">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-3xl font-semibold tracking-tight">{isAdmin ? "System overview" : "Overview"}</h1><p className="mt-2 text-sm text-muted-foreground">{profile?.displayName ?? roleName}</p></div>
      <span className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium capitalize">{roleName}</span>
    </header>

    {isAdmin ? <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ label, value, detail, icon: Icon, to }) => <Link key={label} to={to} className="group rounded-2xl border border-border bg-card p-5 transition hover:border-primary/40 hover:shadow-sm">
          <div className="flex items-center justify-between"><span className="text-sm font-medium text-muted-foreground">{label}</span><span className="grid size-9 place-items-center rounded-xl bg-muted"><Icon size={18}/></span></div>
          <p className="mt-5 text-3xl font-semibold tabular-nums">{value ?? "—"}</p><div className="mt-2 flex items-center justify-between gap-3"><span className="text-xs text-muted-foreground">{detail}</span><ArrowUpRight size={16} className="text-muted-foreground group-hover:text-foreground"/></div>
        </Link>)}
      </section>
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,.8fr)]">
        <div className="rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4"><h2 className="font-semibold">System management</h2><span className="text-xs text-muted-foreground">Administrator</span></div>
          <div className="divide-y divide-border">
            {adminModules.filter((module) => profile && canAccessModule(profile.role, module)).map((module) => { const Icon = iconByModule[module]; return <Link key={module} to={MODULES[module].path} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/40"><span className="grid size-10 place-items-center rounded-xl border border-border bg-background"><Icon size={18}/></span><span className="flex-1 text-sm font-medium">{MODULES[module].label}</span><ArrowUpRight size={17} className="text-muted-foreground"/></Link>; })}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4"><h2 className="font-semibold">Bed availability</h2></div>
          <div className="space-y-5 p-5">
            <div><div className="mb-2 flex justify-between text-sm"><span>Available</span><strong className="tabular-nums">{beds.data?.available ?? "—"}</strong></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-500" style={{width: beds.data && beds.data.total ? `${beds.data.available / beds.data.total * 100}%` : "0%"}}/></div></div>
            <div><div className="mb-2 flex justify-between text-sm"><span>Occupied</span><strong className="tabular-nums">{beds.data?.occupied ?? "—"}</strong></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-amber-500" style={{width: beds.data && beds.data.total ? `${beds.data.occupied / beds.data.total * 100}%` : "0%"}}/></div></div>
            <Link to={MODULES.wards.path} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted">Open bed board <ArrowUpRight size={15}/></Link>
          </div>
        </div>
      </section>
    </> : <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{available.map((module) => { const Icon = iconByModule[module]; return <Link key={module} to={MODULES[module].path} className="group rounded-2xl border border-border bg-card p-5 hover:border-primary/40"><div className="flex items-center justify-between"><span className="grid size-10 place-items-center rounded-xl bg-muted"><Icon size={18}/></span><ArrowUpRight size={16} className="text-muted-foreground"/></div><h2 className="mt-4 font-semibold">{MODULES[module].label}</h2></Link>; })}</section>}
  </div>;
}
