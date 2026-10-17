import {
  Activity, BedDouble, Boxes, ClipboardList, LayoutDashboard, LogOut,
  ScrollText, Stethoscope, Users, Wallet, Menu, X, ShieldCheck, Search,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../features/auth/AuthProvider";
import { MODULES, canAccessModule, type HmsModule } from "../../lib/permissions";
import { Button } from "../ui/Button";

const icons: Record<HmsModule, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard, patients: Activity, encounters: Stethoscope,
  requests: ClipboardList, wards: BedDouble, billing: Wallet, inventory: Boxes,
  staff: Users, audit: ScrollText,
};
const navOrder: HmsModule[] = ["dashboard", "patients", "encounters", "requests", "billing", "inventory", "wards", "staff", "audit"];

export function AppShell() {
  const { profile, signOut } = useAuth();
  const [hovered, setHovered] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const expanded = hovered || mobileOpen;
  const links = navOrder.filter((module) => profile && canAccessModule(profile.role, module))
    .map((module) => ({ ...MODULES[module], module, icon: icons[module] }))
    .filter(({ label }) => label.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside onMouseEnter={() => { if (window.matchMedia("(min-width: 768px)").matches) setHovered(true); }} onMouseLeave={() => setHovered(false)}
        className={`fixed inset-y-2 left-2 z-40 flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-[#f3f4f6] text-[#25282d] shadow-[0_8px_30px_rgba(0,0,0,0.10)] transition-[width] duration-200 ease-out dark:bg-[#202226] dark:text-foreground ${expanded ? "w-[264px]" : "w-[60px]"}`}>
        <div className={`flex h-[58px] shrink-0 items-center border-b border-black/[0.06] dark:border-white/[0.08] ${expanded ? "gap-3 px-3" : "justify-center"}`}>
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#173c42] text-xs font-bold text-white">H+</span>
          {expanded && <div className="min-w-0"><p className="text-sm font-semibold tracking-tight">HMS</p><p className="text-[11px] text-black/55 dark:text-white/55">Hospital Management</p></div>}
          <button type="button" onClick={() => setMobileOpen((v) => !v)} aria-label="Toggle navigation" className="ml-auto grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-black/5 md:hidden">{expanded ? <X size={17}/> : <Menu size={17}/>}</button>
        </div>
        {expanded && <div className="px-2.5 pt-3"><label className="flex h-10 items-center gap-2.5 rounded-xl border border-black/[0.06] bg-white/65 px-3 text-sm text-muted-foreground dark:border-white/10 dark:bg-black/10"><Search size={16}/><input value={search} onChange={(e) => setSearch(e)} placeholder="Search modules..." className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"/><span className="rounded bg-black/[0.04] px-1.5 py-0.5 text-[10px] dark:bg-white/10">⌕</span></label></div>}
        <nav aria-label="Main navigation" className="flex-1 space-y-3 overflow-x-hidden overflow-y-auto px-2 py-3">
          {links.map(({ path, label, module, icon: Icon }, index) => <section key={module}>
            {expanded && (index === 0 || module === "patients" || module === "billing" || module === "staff") && <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-black/45 dark:text-white/45">{module === "dashboard" ? "Workspace" : module === "patients" ? "Care & records" : module === "billing" ? "Operations" : "Administration"}</p>}
            <NavLink to={path} title={!expanded ? label : undefined} aria-label={label} onClick={() => setMobileOpen(false)} className={({ isActive }) => `flex h-10 items-center gap-3 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${expanded ? "px-3" : "justify-center px-0"} ${isActive ? "bg-black/[0.07] font-semibold text-foreground" : "text-muted-foreground hover:bg-black/[0.045] hover:text-foreground"}`}>
              <Icon size={18} className="shrink-0" aria-hidden="true"/>{expanded && <span className="min-w-0 flex-1 truncate text-sm">{label}</span>}
            </NavLink>
          </section>)}
          {expanded && links.length === 0 && <p className="px-3 py-5 text-sm text-muted-foreground">No matching modules.</p>}
        </nav>
        <div className="border-t border-black/[0.06] p-2 dark:border-white/[0.08]"><div className={`flex min-h-10 items-center rounded-xl py-1 ${expanded ? "gap-2.5 px-1.5" : "justify-center"}`}>
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-white/80 text-[#40464d] dark:bg-white/10 dark:text-foreground"><ShieldCheck size={16}/></div>
          {expanded && <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{profile?.displayName ?? "Staff account"}</p><p className="truncate text-[11px] capitalize text-black/50 dark:text-white/50">{profile?.role.replaceAll("_", " ") ?? "Role not assigned"}</p></div>}
          {expanded && <button type="button" title="Sign out" onClick={() => void signOut()} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10"><LogOut size={16}/></button>}
        </div></div>
      </aside>
      {mobileOpen && <button aria-label="Close navigation overlay" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-30 bg-black/20 md:hidden"/>}
      <div className="ml-[76px] min-h-screen min-w-0">
        <header className="sticky top-0 z-20 flex min-h-[62px] items-center justify-between gap-4 border-b border-border/70 bg-background/90 px-4 backdrop-blur sm:px-6">
          <div className="min-w-0"><p className="truncate text-sm font-semibold">Hospital Management System</p><p className="hidden text-xs text-muted-foreground sm:block">Hospital operations workspace</p></div>
          <Button variant="secondary" size="sm" onClick={() => void signOut()}><LogOut aria-hidden="true"/> <span className="hidden sm:inline">Sign out</span></Button>
        </header>
        <main className="mx-auto min-w-0 max-w-[1600px] p-4 sm:p-6 lg:p-8"><Outlet/></main>
      </div>
    </div>
  );
}
