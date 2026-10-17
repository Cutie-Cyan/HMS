import {
  Activity, BedDouble, Boxes, ClipboardList, LayoutDashboard, LogOut,
  ScrollText, Stethoscope, Users, Wallet, Menu, X, ShieldCheck, Search,
  ChevronRight, Command,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../features/auth/AuthProvider";
import { MODULES, canAccessModule, type HmsModule } from "../../lib/permissions";

const icons: Record<HmsModule, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard, patients: Activity, encounters: Stethoscope,
  requests: ClipboardList, wards: BedDouble, billing: Wallet, inventory: Boxes,
  staff: Users, audit: ScrollText,
};
const navOrder: HmsModule[] = ["dashboard", "patients", "encounters", "requests", "billing", "inventory", "wards", "staff", "audit"];
const groups: { title: string; modules: HmsModule[] }[] = [
  { title: "Workspace", modules: ["dashboard"] },
  { title: "Clinical", modules: ["patients", "encounters", "requests", "wards"] },
  { title: "Operations", modules: ["billing", "inventory"] },
  { title: "Administration", modules: ["staff", "audit"] },
];

export function AppShell() {
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);
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
  const currentLabel = current ? MODULES[current].label : "Workspace";
  const initials = (profile?.displayName ?? "Staff").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  const sidebar = (
    <>
      <div className="flex h-[62px] shrink-0 items-center gap-3 border-b border-slate-200/80 px-4 dark:border-white/10">
        <div className="flex items-center gap-1.5" aria-hidden="true">
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
        </div>
        <div className="ml-1 flex size-8 items-center justify-center rounded-[11px] bg-gradient-to-br from-sky-500 to-indigo-600 text-xs font-bold text-white shadow-sm">H+</div>
        <div className="min-w-0"><p className="truncate text-[13px] font-semibold tracking-tight">HMS</p><p className="truncate text-[10px] text-slate-500 dark:text-slate-400">Hospital workspace</p></div>
        <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation" className="ml-auto grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-200/70 md:hidden"><X size={17}/></button>
      </div>
      <div className="px-3 pb-3 pt-4">
        <label className="flex h-9 items-center gap-2 rounded-xl border border-slate-200/90 bg-white/75 px-2.5 text-slate-500 shadow-[0_1px_1px_rgba(15,23,42,.02)] focus-within:border-sky-300 focus-within:ring-2 focus-within:ring-sky-100 dark:border-white/10 dark:bg-white/5 dark:focus-within:ring-sky-900/30">
          <Search size={14}/><input aria-label="Search navigation" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search navigation" className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-slate-400"/>
          <kbd className="rounded-md border border-slate-200 bg-slate-50 px-1 py-0.5 text-[9px] text-slate-400 dark:border-white/10 dark:bg-white/5">⌘ K</kbd>
        </label>
      </div>
      <nav aria-label="Main navigation" className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {groups.map((group) => {
          const items = group.modules.filter((module) => visible.includes(module));
          if (!items.length) return null;
          return <section key={group.title}>
            <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">{group.title}</p>
            <div className="space-y-0.5">{items.map((module) => {
              const Icon = icons[module];
              const item = MODULES[module];
              return <NavLink key={module} to={item.path} aria-label={item.label} className={({ isActive }) => `group flex h-9 items-center gap-2.5 rounded-[10px] px-2.5 text-[12px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${isActive ? "bg-white font-semibold text-slate-900 shadow-[0_1px_3px_rgba(15,23,42,.08)] ring-1 ring-slate-200/80 dark:bg-white/10 dark:text-white dark:ring-white/10" : "text-slate-600 hover:bg-white/65 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"}`}>
                <Icon size={16} strokeWidth={1.8} className={`shrink-0 ${location.pathname === item.path ? "text-sky-600 dark:text-sky-400" : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300"}`} aria-hidden="true"/>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {location.pathname === item.path && <ChevronRight size={13} className="text-slate-400"/>}
              </NavLink>;
            })}</div>
          </section>;
        })}
        {visible.length === 0 && <p className="px-2 py-4 text-xs text-slate-500">No matching modules.</p>}
      </nav>
      <div className="shrink-0 border-t border-slate-200/80 p-3 dark:border-white/10">
        <div className="flex items-center gap-2.5 rounded-xl bg-white/70 p-2 ring-1 ring-slate-200/70 dark:bg-white/5 dark:ring-white/10">
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-[10px] font-semibold text-slate-700 dark:from-slate-700 dark:to-slate-800 dark:text-slate-100">{initials || <ShieldCheck size={15}/>}</div>
          <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-semibold text-slate-800 dark:text-slate-100">{profile?.displayName ?? "Staff account"}</p><p className="truncate text-[10px] capitalize text-slate-500">{profile?.role.replaceAll("_", " ") ?? "Role not assigned"}</p></div>
          <button type="button" title="Sign out" aria-label="Sign out" onClick={() => void signOut()} className="grid size-7 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-200/70 hover:text-slate-800 dark:hover:bg-white/10 dark:hover:text-white"><LogOut size={15}/></button>
        </div>
      </div>
    </>
  );

  return <div className="min-h-screen bg-[#f3f5f8] text-slate-900 dark:bg-[#111318] dark:text-slate-100">
    <aside aria-label="Application sidebar" className="fixed inset-y-3 left-3 z-30 hidden w-[244px] flex-col overflow-hidden rounded-[20px] border border-white/80 bg-[#e9edf3]/95 shadow-[0_12px_40px_rgba(30,41,59,.08)] backdrop-blur-2xl md:flex dark:border-white/10 dark:bg-[#1b1d23]/95">{sidebar}</aside>
    {mobileOpen && <button type="button" aria-label="Close navigation overlay" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-[2px] md:hidden"/>}
    <aside aria-label="Mobile navigation" className={`fixed inset-y-2 left-2 z-50 flex w-[min(84vw,300px)] flex-col overflow-hidden rounded-[20px] border border-white/80 bg-[#e9edf3]/95 shadow-2xl backdrop-blur-2xl transition-transform md:hidden dark:border-white/10 dark:bg-[#1b1d23]/95 ${mobileOpen ? "translate-x-0" : "-translate-x-[110%]"}`}>{sidebar}</aside>
    <div className="min-h-screen min-w-0 md:pl-[268px]">
      <header className="sticky top-0 z-20 flex h-[62px] items-center justify-between gap-3 border-b border-slate-200/70 bg-[#f3f5f8]/85 px-4 backdrop-blur-xl sm:px-6 dark:border-white/10 dark:bg-[#111318]/85">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation" aria-expanded={mobileOpen} className="grid size-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white/80 text-slate-600 shadow-sm md:hidden dark:border-white/10 dark:bg-white/5 dark:text-slate-200"><Menu size={17}/></button>
          <div className="min-w-0"><div className="flex items-center gap-2 text-[11px] text-slate-400"><span className="hidden sm:inline">HMS</span><ChevronRight size={12} className="hidden sm:block"/><span className="truncate text-slate-600 dark:text-slate-300">{currentLabel}</span></div><h1 className="mt-0.5 truncate text-sm font-semibold tracking-tight">{currentLabel}</h1></div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden items-center gap-2 rounded-full border border-slate-200/80 bg-white/70 px-3 py-1.5 text-[10px] text-slate-500 sm:flex dark:border-white/10 dark:bg-white/5"><span className="size-1.5 rounded-full bg-emerald-500"/><span>Workspace ready</span></div>
          <button type="button" title="Sign out" aria-label="Sign out" onClick={() => void signOut()} className="grid size-9 place-items-center rounded-xl border border-slate-200/80 bg-white/75 text-slate-500 transition hover:bg-white hover:text-slate-900 sm:hidden dark:border-white/10 dark:bg-white/5 dark:text-slate-300"><LogOut size={16}/></button>
        </div>
      </header>
      <main className="mx-auto min-w-0 max-w-[1680px] p-4 sm:p-6 lg:p-8"><Outlet/></main>
      <footer className="px-6 pb-5 text-center text-[10px] text-slate-400">HMS · Secure hospital operations workspace</footer>
    </div>
  </div>;
}
