import { Activity, BedDouble, ClipboardList, LayoutDashboard, LogOut, ShieldCheck, Stethoscope, Wallet, Boxes, Users, ScrollText } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../features/auth/AuthProvider";
import { MODULES, canAccessModule, type HmsModule } from "../../lib/permissions";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";

const icons: Record<HmsModule, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard, patients: Activity, encounters: Stethoscope, requests: ClipboardList,
  wards: BedDouble, billing: Wallet, inventory: Boxes, staff: Users, audit: ScrollText,
};
const navOrder: HmsModule[] = ["dashboard", "patients", "encounters", "requests", "billing", "inventory", "wards", "staff", "audit"];
const roleLabels = {
  admin: "Administrator", info_officer: "Information Officer", emergency_nurse: "Emergency Nurse",
  cashier: "Cashier", pharmacy: "Pharmacy", lab: "Laboratory", nurse_station: "Nurse Station",
} as const;

export function AppShell() {
  const { profile, signOut } = useAuth();
  const links = navOrder.filter((module) => profile && canAccessModule(profile.role, module) && module !== "dashboard")
    .map((module) => ({ ...MODULES[module], icon: icons[module], end: false }));
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 md:grid md:grid-cols-[252px_minmax(0,1fr)]">
      <aside className="border-b border-slate-200 bg-white p-5 md:min-h-screen md:border-b-0 md:border-r">
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="grid size-10 place-items-center rounded-xl bg-teal-700 text-sm font-bold text-white">H+</div>
          <div><p className="font-semibold tracking-tight">HMS</p><p className="text-xs text-slate-500">Hospital Management</p></div>
        </div>
        <div className="mx-2 mt-5 rounded-xl bg-slate-50 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={16} className="text-teal-700" /> Staff workspace</div>
          <p className="mt-1 truncate text-xs text-slate-500">{profile?.displayName}</p>
          {profile && <Badge tone="info" className="mt-2">{roleLabels[profile.role]}</Badge>}
        </div>
        <nav aria-label="Main navigation" className="mt-5 flex gap-2 overflow-x-auto md:flex-col">
          <NavLink to="/overview" className={({ isActive }) => `flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? "bg-teal-50 text-teal-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}>
            <LayoutDashboard aria-hidden="true" size={18} /> Overview
          </NavLink>
          {links.map(({ path, label, icon: Icon }) => (
            <NavLink key={path} to={path} className={({ isActive }) => `flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? "bg-teal-50 text-teal-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}>
              <Icon aria-hidden="true" size={18} />{label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-8 hidden rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-500 md:block">Navigation is filtered by your active staff role. Database permissions remain the final access control.</div>
      </aside>
      <div className="min-w-0">
        <header className="flex min-h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3 md:px-8">
          <div><p className="text-sm font-semibold">Hospital operations</p><p className="text-xs text-slate-500">Secure staff workspace</p></div>
          <Button variant="secondary" className="min-h-9 px-3" onClick={() => void signOut()}><LogOut size={16} /> Sign out</Button>
        </header>
        <main className="p-5 md:p-8"><Outlet /></main>
      </div>
    </div>
  );
}
