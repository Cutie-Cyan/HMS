import {
  Activity, BedDouble, Boxes, ClipboardList, LayoutDashboard, LogOut, UserRoundCheck,
  ScrollText, Stethoscope, Users, Wallet, Menu, X, ShieldCheck, Search,
  PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../features/auth/AuthProvider";
import { MODULES, canAccessModule, type HmsModule } from "../../lib/permissions";

const icons: Record<HmsModule, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard, patients: Activity, "patient-registration": ClipboardList, encounters: Stethoscope,
  requests: ClipboardList, "available-doctors": UserRoundCheck, wards: BedDouble, billing: Wallet, inventory: Boxes,
  staff: Users, audit: ScrollText,
};
const navOrder: HmsModule[] = ["dashboard", "patients", "patient-registration", "encounters", "available-doctors", "requests", "billing", "inventory", "wards", "staff", "audit"];
const groups: { title: string; modules: HmsModule[] }[] = [
  { title: "Workspace", modules: ["dashboard"] },
  { title: "Clinical", modules: ["patients", "patient-registration", "encounters", "available-doctors", "requests", "wards"] },
  { title: "Operations", modules: ["billing", "inventory"] },
  { title: "Administration", modules: ["staff", "audit"] },
];

export function AppShell() {
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const location = useLocation();

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!mobileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen]);

  const allowed = navOrder.filter((module) => profile && canAccessModule(profile.role, module));
  const visible = allowed.filter((module) => MODULES[module].label.toLowerCase().includes(search.toLowerCase()));
  const current = allowed.find((module) => MODULES[module].path === location.pathname);
  const currentLabel = current ? MODULES[current].label : "Overview";
  const initials = (profile?.displayName ?? "Staff").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  const sidebar = (isMobile = false) => (
    <>
      <div className={`flex h-[76px] shrink-0 items-center border-b border-slate-200/80 px-4 dark:border-white/10 ${collapsed && !isMobile ? "justify-center" : "justify-between"}`}>
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-900 text-sm font-bold text-white shadow-sm dark:bg-white dark:text-slate-900" aria-label="HMS logo">H<span className="text-sky-400">+</span></div>
          {(!collapsed || isMobile) && <div className="min-w-0"><p className="truncate text-base font-bold tracking-tight text-slate-900 dark:text-white">HMS</p><p className="truncate text-[11px] text-slate-500 dark:text-slate-400">Hospital Management</p></div>}
        </div>
        {isMobile
          ? <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation" className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-200/70"><X size={18}/></button>
          : <button type="button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} className={`hidden size-9 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-white hover:text-slate-900 md:grid dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white ${collapsed ? "absolute right-3 top-[18px]" : ""}`}>{collapsed ? <PanelLeftOpen size={18}/> : <PanelLeftClose size={18}/>}</button>}
      </div>
      {(!collapsed || isMobile) && <div className="px-3 pb-3 pt-4"><label className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-500 focus-within:border-sky-300 focus-within:ring-2 focus-within:ring-sky-100 dark:border-white/10 dark:bg-white/5 dark:focus-within:ring-sky-900/30"><Search size={15}/><input aria-label="Search navigation" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search menu" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"/></label></div>}
      <nav aria-label="Main navigation" className={`min-h-0 flex-1 space-y-5 overflow-y-auto pb-4 ${collapsed && !isMobile ? "px-2 pt-4" : "px-3"}`}>
        {groups.map((group) => {
          const items = group.modules.filter((module) => visible.includes(module));
          if (!items.length) return null;
          return <section key={group.title}>
            {(!collapsed || isMobile) && <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">{group.title}</p>}
            <div className="space-y-1">{items.map((module) => {
              const Icon = icons[module];
              const item = MODULES[module];
              return <NavLink key={module} to={item.path} aria-label={item.label} title={collapsed && !isMobile ? item.label : undefined} className={({ isActive }) => `group flex h-11 items-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${collapsed && !isMobile ? "justify-center px-0" : "gap-3 px-3"} ${isActive ? "bg-white font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200/80 dark:bg-white/10 dark:text-white dark:ring-white/10" : "text-slate-600 hover:bg-white/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"}`}>
                <Icon size={19} strokeWidth={1.8} className={`shrink-0 ${location.pathname === item.path ? "text-sky-600 dark:text-sky-400" : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300"}`} aria-hidden="true"/>
                {(!collapsed || isMobile) && <><span className="min-w-0 flex-1 truncate text-[13px]">{item.label}</span>{location.pathname === item.path && <span className="size-1.5 rounded-full bg-sky-600 dark:bg-sky-400"/>}</>}
              </NavLink>;
            })}</div>
          </section>;
        })}
        {visible.length === 0 && (!collapsed || isMobile) && <p className="px-2 py-4 text-xs text-slate-500">No matching modules.</p>}
      </nav>
      <div className="mt-auto shrink-0 border-t border-slate-200/80 p-3 dark:border-white/10">
        <div className={`flex items-center rounded-xl bg-white/75 p-2 ring-1 ring-slate-200/70 dark:bg-white/5 dark:ring-white/10 ${collapsed && !isMobile ? "flex-col gap-2" : "gap-3"}`}>
          <div className="grid size-9 shrink-0 place-items-center rounded-full bg-sky-100 text-xs font-bold text-sky-800 dark:bg-sky-900/50 dark:text-sky-200">{initials || <ShieldCheck size={16}/>}</div>
          {(!collapsed || isMobile) && <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{profile?.displayName ?? "Staff account"}</p><p className="truncate text-[11px] capitalize text-slate-500">{profile?.role.replaceAll("_", " ") ?? "Role not assigned"}</p></div>}
          <button type="button" title="Log out" aria-label="Log out" onClick={() => void signOut()} className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-rose-50 hover:text-rose-700 dark:text-slate-300 dark:hover:bg-rose-950/30 dark:hover:text-rose-300"><LogOut size={17}/></button>
        </div>
        {(!collapsed || isMobile) && <p className="mt-3 px-1 text-[10px] text-slate-400">Secure staff access</p>}
      </div>
    </>
  );

  return <div className="min-h-screen bg-[#f4f6f8] text-slate-900 dark:bg-[#111318] dark:text-slate-100">
    <aside aria-label="Application sidebar" className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-slate-200/80 bg-[#eaf0f3] transition-[width] duration-200 md:flex dark:border-white/10 dark:bg-[#1b1d23] ${collapsed ? "w-[76px]" : "w-[260px]"}`}>{sidebar(false)}</aside>
    {mobileOpen && <button type="button" aria-label="Close navigation overlay" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[2px] md:hidden"/>}
    <aside aria-label="Mobile navigation" className={`fixed inset-y-0 left-0 z-50 flex w-[min(86vw,320px)] flex-col border-r border-slate-200 bg-[#eaf0f3] shadow-2xl transition-transform md:hidden dark:border-white/10 dark:bg-[#1b1d23] ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>{sidebar(true)}</aside>
    <div className={`min-h-screen min-w-0 transition-[padding] duration-200 ${collapsed ? "md:pl-[76px]" : "md:pl-[260px]"}`}>
      <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between gap-3 border-b border-slate-200/80 bg-white/95 px-5 sm:px-8 dark:border-white/10 dark:bg-[#15171c]/95">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation" aria-expanded={mobileOpen} className="grid size-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm md:hidden dark:border-white/10 dark:bg-white/5 dark:text-slate-200"><Menu size={18}/></button>
          <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-2xl">{currentLabel}</h1>
        </div>
        <div className="hidden items-center gap-2 sm:flex"><span className="size-2 rounded-full bg-emerald-500"/><span className="text-xs font-medium text-slate-500">System online</span></div>
      </header>
      <main className="mx-auto min-w-0 max-w-[1680px] p-4 sm:p-6 lg:p-8"><Outlet/></main>
    </div>
  </div>;
}
