import {
  Activity, BedDouble, Boxes, ClipboardList, LayoutDashboard,
  UserRoundCheck, ScrollText, Stethoscope, Users, Wallet, Menu, X,
  ShieldCheck, PanelLeftClose, PanelLeftOpen, Search, XCircle, UserRound, Mail, LogOut,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../features/auth/AuthProvider";
import { MODULES, canAccessModule, type HmsModule } from "../../lib/permissions";

const icons: Record<HmsModule, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard, patients: Activity, "patient-registration": ClipboardList,
  encounters: Stethoscope, requests: ClipboardList, "available-doctors": UserRoundCheck,
  wards: BedDouble, billing: Wallet, inventory: Boxes, "medicine-stock": Boxes, "profit-inventory": Wallet, "medicine-requests": ClipboardList, staff: Users, audit: ScrollText,
};
const navOrder: HmsModule[] = ["dashboard", "patients", "patient-registration", "encounters", "available-doctors", "requests", "billing", "medicine-stock", "medicine-requests", "profit-inventory", "inventory", "wards", "staff", "audit"];
const groups: { title: string; modules: HmsModule[] }[] = [
  { title: "Workspace", modules: ["dashboard"] },
  { title: "Clinical", modules: ["patients", "patient-registration", "encounters", "available-doctors", "requests", "wards"] },
  { title: "Operations", modules: ["billing", "medicine-stock", "medicine-requests", "profit-inventory", "inventory"] },
  { title: "Administration", modules: ["staff", "audit"] },
];

export function AppShell() {
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const [headerSearchOpen, setHeaderSearchOpen] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!mobileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setMobileOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen]);

  const allowed = navOrder.filter((module) => profile && canAccessModule(profile.role, module));
  const visible = allowed.filter((module) => MODULES[module].label.toLowerCase().includes(search.toLowerCase()));
  const current = allowed.find((module) => MODULES[module].path === location.pathname);
  const currentLabel = current ? MODULES[current].label : "Overview";
  const initials = (profile?.displayName ?? "Staff").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  const navigation = (mobile = false) => (
    <>
      <div className={`flex h-[88px] shrink-0 items-center border-b border-white/10 ${mobile || expanded ? "justify-between px-5" : "justify-center px-2"}`}>
        <NavLink to="/overview" aria-label="HMS home" title="HMS home" className="flex items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-black text-white shadow-lg ring-1 ring-white/15">
            <svg viewBox="0 0 48 48" className="size-8" role="img" aria-label="HMS logo">
              <path d="M11 9 L20 14 L31 31 Q34 36 39 32 Q43 28 39 22 L34 14 Q31 10 27 13 L23 16 L28 21 L31 18 L35 25 Q37 29 34 30 Q32 31 30 28 L19 11 Q15 6 11 9Z" fill="currentColor"/>
              <path d="M37 39 L28 34 L17 17 Q14 12 9 16 Q5 20 9 26 L14 34 Q17 38 21 35 L25 32 L20 27 L17 30 L13 23 Q11 19 14 18 Q16 17 18 20 L29 37 Q33 42 37 39Z" fill="currentColor"/>
            </svg>
          </span>
          {(mobile || expanded) && <span><span className="block text-base font-bold tracking-wide text-white">HMS</span><span className="block text-[11px] text-slate-400">Hospital Management</span></span>}
        </NavLink>
        {mobile && <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation" className="grid size-9 place-items-center rounded-xl text-slate-300 hover:bg-white/10"><X size={18}/></button>}
        {!mobile && <button type="button" onClick={() => setExpanded(v => !v)} aria-label={expanded ? "Collapse navigation" : "Expand navigation"} title={expanded ? "Collapse navigation" : "Expand navigation"} className={`grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white ${expanded ? "" : "hidden"}`}>{expanded ? <PanelLeftClose size={17}/> : <PanelLeftOpen size={17}/>}</button>}
      </div>
      <div className={`min-h-0 flex-1 overflow-y-auto py-5 ${mobile || expanded ? "px-3" : "px-2"}`}>
        {(mobile || expanded) && <label className="mb-5 flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-slate-400"><Search size={15}/><input aria-label="Search modules" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search modules" className="min-w-0 w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"/></label>}
        {groups.map(group => {
          const items = group.modules.filter(module => visible.includes(module));
          if (!items.length) return null;
          return <section key={group.title} className="mb-6">
            {(mobile || expanded) && <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{group.title}</p>}
            <div className="space-y-1">{items.map(module => {
              const Icon = icons[module]; const item = MODULES[module];
              return <NavLink key={module} to={item.path} aria-label={item.label} title={item.label} className={() => `relative flex h-12 items-center rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${mobile || expanded ? "gap-3 px-3" : "justify-center px-0"} ${location.pathname === item.path ? "bg-white text-slate-950 shadow-md" : "text-slate-400 hover:bg-white/10 hover:text-white"}`}>
                <Icon size={20} strokeWidth={1.8} className={`shrink-0 ${location.pathname === item.path ? "text-sky-700" : ""}`}/>
                {(mobile || expanded) && <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{item.label}</span>}
                {location.pathname === item.path && <span className={`absolute right-1.5 top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-sky-600 ${mobile || expanded ? "" : "hidden"}`}/>}
              </NavLink>;
            })}</div>
          </section>;
        })}
      </div>
      <div className="shrink-0 border-t border-white/10 p-3">
        <button type="button" onClick={() => { void signOut(); }} title="Sign out" aria-label="Sign out" className={`flex h-10 items-center justify-center rounded-xl text-slate-300 transition hover:bg-red-500/15 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 ${mobile || expanded ? "w-full gap-2 px-3 text-xs font-medium" : "w-full"}`}>
          <LogOut size={18}/>{(mobile || expanded) && <span>Sign out</span>}
        </button>
      </div>
    </>
  );

  return <div className="min-h-screen bg-[#f3f5f8] text-slate-900">
    <aside aria-label="Application navigation" className={`fixed inset-y-0 left-0 z-30 hidden flex-col bg-[#17191d] text-white shadow-xl transition-[width] duration-200 md:flex ${expanded ? "w-[252px]" : "w-[84px]"}`}>{navigation(false)}</aside>
    {mobileOpen && <button type="button" aria-label="Close navigation overlay" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm md:hidden"/>}
    <aside aria-label="Mobile navigation" className={`fixed inset-y-0 left-0 z-50 flex w-[min(86vw,300px)] flex-col bg-[#17191d] text-white shadow-2xl transition-transform md:hidden ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>{navigation(true)}</aside>
    <div className={`min-h-screen min-w-0 transition-[padding] duration-200 ${expanded ? "md:pl-[252px]" : "md:pl-[84px]"}`}>
      <header className="sticky top-0 z-20 flex h-[82px] items-center justify-between gap-4 border-b border-slate-200/80 bg-white/95 px-5 backdrop-blur-xl sm:px-8 lg:px-10">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation" aria-expanded={mobileOpen} className="grid size-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm md:hidden"><Menu size={18}/></button>
          <div className="min-w-0"><p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.17em] text-slate-400">Hospital Management</p><h1 className="truncate text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">{currentLabel}</h1></div>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          
          {headerSearchOpen ? <div className="relative flex items-center gap-2">
            <label className="flex h-9 w-[min(42vw,300px)] items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-3 transition-colors focus-within:border-slate-300"><Search size={16} className="shrink-0 text-slate-400"/><input autoFocus aria-label="Search modules" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search modules…" className="min-w-0 w-full border-0 bg-transparent text-sm outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0 focus-visible:outline-none"/><button type="button" aria-label="Close search" onClick={()=>{setHeaderSearchOpen(false);setSearch("");}} className="text-slate-400 hover:text-slate-700"><XCircle size={17}/></button></label>
            {search.trim()&&<div className="absolute right-0 top-12 z-50 w-[min(82vw,320px)] rounded-xl border border-slate-200 bg-white p-2 shadow-xl">{allowed.filter(module=>MODULES[module].label.toLowerCase().includes(search.toLowerCase())).length ? allowed.filter(module=>MODULES[module].label.toLowerCase().includes(search.toLowerCase())).map(module=><NavLink key={module} to={MODULES[module].path} onClick={()=>{setHeaderSearchOpen(false);setSearch("");}} className="flex items-center rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">{MODULES[module].label}</NavLink>) : <p className="px-3 py-2 text-sm text-slate-500">No matching modules</p>}</div>}
          </div> : <button type="button" aria-label="Search modules" title="Search modules" onClick={() => setHeaderSearchOpen(true)} className="hidden size-10 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100"><Search size={19}/></button>}
          <button type="button" onClick={()=>setProfileOpen(true)} aria-haspopup="dialog" aria-label="Open staff profile" className="flex items-center gap-2 rounded-full bg-slate-50 py-1.5 pl-1.5 pr-3 ring-1 ring-slate-200/80 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400">
            <span className="grid size-8 place-items-center rounded-full bg-sky-100 text-xs font-bold text-sky-900">{initials || "H"}</span>
            <span className="hidden max-w-28 truncate text-xs font-semibold text-slate-700 sm:block">{profile?.displayName ?? "Staff"}</span>
          </button>
        </div>
      </header>
      {profileOpen&&<><button type="button" aria-label="Close staff profile popup" className="fixed inset-0 z-[90] cursor-default bg-transparent" onClick={()=>setProfileOpen(false)}/><section role="dialog" aria-modal="false" aria-labelledby="staff-profile-title" className="fixed right-4 top-[4.5rem] z-[100] w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"><div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-sky-700">Account</p><h2 id="staff-profile-title" className="mt-0.5 text-base font-bold text-slate-900">Staff profile</h2></div><button type="button" aria-label="Close profile" onClick={()=>setProfileOpen(false)} className="grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><X size={17}/></button></div><div className="p-4"><div className="flex items-center gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-sky-100 text-sm font-bold text-sky-900">{initials||"H"}</span><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{profile?.displayName??"Staff account"}</p><p className="mt-0.5 text-xs capitalize text-slate-500">{profile?.role.replaceAll("_"," ")??"Role not assigned"}</p></div></div><dl className="mt-4 space-y-3"><div className="flex items-start gap-2.5"><Mail size={15} className="mt-0.5 shrink-0 text-slate-400"/><div className="min-w-0"><dt className="text-[11px] text-slate-500">Email address</dt><dd className="break-all text-xs font-medium text-slate-800">{profile?.email??"Not available"}</dd></div></div><div className="flex items-start gap-2.5"><UserRound size={15} className="mt-0.5 shrink-0 text-slate-400"/><div><dt className="text-[11px] text-slate-500">Role</dt><dd className="text-xs font-medium capitalize text-slate-800">{profile?.role.replaceAll("_"," ")??"Not assigned"}</dd></div></div><div className="flex items-start gap-2.5"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-slate-400"/><div><dt className="text-[11px] text-slate-500">Account status</dt><dd className="text-xs font-medium text-emerald-700">{profile?.isActive?"Active":"Unknown"}</dd></div></div>{profile?.wardId&&<div><dt className="text-[11px] text-slate-500">Assigned ward</dt><dd className="text-xs font-medium text-slate-800">{profile.wardId}</dd></div>}</dl></div></section></>}
      <main className="mx-auto min-w-0 max-w-[1680px] p-4 sm:p-6 lg:p-8"><Outlet/></main>
    </div>
  </div>;
}
