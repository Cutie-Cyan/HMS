import { Activity, BedDouble, ClipboardList, LayoutDashboard, Stethoscope } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

const links = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/patients", label: "Patients", icon: Activity },
  { to: "/encounters", label: "Encounters", icon: Stethoscope },
  { to: "/requests", label: "Requests", icon: ClipboardList },
  { to: "/wards", label: "Wards & beds", icon: BedDouble },
];

export function AppShell() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 md:grid md:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="border-b border-slate-200 bg-white p-5 md:min-h-screen md:border-b-0 md:border-r">
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="grid size-10 place-items-center rounded-xl bg-teal-700 text-sm font-bold text-white">H+</div>
          <div><p className="font-semibold tracking-tight">HMS</p><p className="text-xs text-slate-500">Hospital Management</p></div>
        </div>
        <nav aria-label="Main navigation" className="mt-7 flex gap-2 overflow-x-auto md:flex-col">
          {links.map(({ to, label, icon: Icon, ...rest }) => (
            <NavLink key={to} to={to} end={"end" in rest ? rest.end : false} className={({ isActive }) => `flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? "bg-teal-50 text-teal-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}>
              <Icon aria-hidden="true" size={18} />{label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-8 hidden rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-500 md:block">Secure staff workspace. Access depends on your assigned role.</div>
      </aside>
      <div className="min-w-0">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-5 md:px-8">
          <div><p className="text-sm font-semibold">Hospital operations</p><p className="text-xs text-slate-500">Staff workspace</p></div>
          <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600">Setup in progress</span>
        </header>
        <main className="p-5 md:p-8"><Outlet /></main>
      </div>
    </div>
  );
}
