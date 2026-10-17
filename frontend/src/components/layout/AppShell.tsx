import {
  Activity, BedDouble, Boxes, ClipboardList, LayoutDashboard, LogOut,
  ScrollText, Stethoscope, Users, Wallet, Menu, X, ShieldCheck, ChevronRight,
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
  const links = navOrder
    .filter((module) => profile && canAccessModule(profile.role, module))
    .map((module) => ({ ...MODULES[module], module, icon: icons[module] }));

  const expanded = hovered || mobileOpen;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside
        onMouseEnter={() => { if (window.matchMedia("(min-width: 768px)").matches) setHovered(true); }}
        onMouseLeave={() => setHovered(false)}
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border bg-card shadow-sm transition-[width] duration-200 ease-out ${expanded ? "w-64" : "w-[68px]"}`}
      >
        <div className={`flex h-[60px] shrink-0 items-center border-b border-border ${expanded ? "gap-3 px-4" : "justify-center"}`}>
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">H+</span>
          {expanded && <div className="min-w-0"><p className="text-sm font-semibold tracking-tight">HMS</p><p className="text-[11px] text-muted-foreground">Hospital Management</p></div>}
          <button type="button" onClick={() => setMobileOpen((v) => !v)} aria-label={expanded ? "Collapse navigation" : "Expand navigation"} className="ml-auto grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-accent md:hidden">
            {expanded ? <X size={17}/> : <Menu size={17}/>}
          </button>
        </div>

        {expanded && <div className="px-3 pt-4"><div className="flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm text-muted-foreground"><Activity size={15}/><span>Hospital workspace</span><span className="ml-auto text-xs">HMS</span></div></div>}

        <div className={`px-2 pt-4 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground ${expanded ? "px-4" : "text-center"}`}>{expanded ? "Workspace" : "•••"}</div>
        <nav aria-label="Main navigation" className="flex-1 space-y-1 overflow-x-hidden overflow-y-auto px-2 pb-3">
          {links.map(({ path, label, module, icon: Icon }) => (
            <NavLink
              key={module}
              to={path}
              title={!expanded ? label : undefined}
              aria-label={label}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) => `relative flex h-10 items-center gap-3 rounded-lg text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${expanded ? "px-3" : "justify-center px-0"} ${isActive ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"}`}
            >
              <Icon size={18} className="shrink-0" aria-hidden="true"/>
              {expanded && <><span className="min-w-0 flex-1 truncate">{label}</span><ChevronRight size={14} className="opacity-50"/></>}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border p-2">
          <div className={`flex items-center rounded-lg py-2 ${expanded ? "gap-3 px-2" : "justify-center"}`}>
            <div className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"><ShieldCheck size={16}/></div>
            {expanded && <div className="min-w-0"><p className="truncate text-xs font-medium">{profile?.displayName ?? "Staff account"}</p><p className="truncate text-[11px] capitalize text-muted-foreground">{profile?.role.replaceAll("_", " ") ?? "Role not assigned"}</p></div>}
          </div>
        </div>
      </aside>

      {mobileOpen && <button aria-label="Close navigation overlay" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-30 bg-black/20 md:hidden"/>}

      <div className={`min-h-screen min-w-0 transition-[margin] duration-200 ${expanded ? "md:ml-[68px]" : "ml-[68px]"}`}>
        <header className="sticky top-0 z-20 flex min-h-[60px] items-center justify-between gap-4 border-b border-border bg-background/90 px-4 backdrop-blur sm:px-6">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Hospital Management System</p>
            <p className="hidden text-xs text-muted-foreground sm:block">Secure hospital workspace</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void signOut()}><LogOut aria-hidden="true"/> <span className="hidden sm:inline">Sign out</span></Button>
        </header>
        <main className="mx-auto min-w-0 max-w-[1600px] p-4 sm:p-6 lg:p-8"><Outlet/></main>
      </div>
    </div>
  );
}
