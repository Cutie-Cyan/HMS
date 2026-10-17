import {
  Activity, BedDouble, Boxes, ClipboardList, LayoutDashboard, LogOut,
  ScrollText, ShieldCheck, Stethoscope, Users, Wallet, Menu, X,
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
const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-10 shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"}`;

export function AppShell() {
  const { profile, signOut } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const links = navOrder
    .filter((module) => profile && canAccessModule(profile.role, module) && module !== "dashboard")
    .map((module) => ({ ...MODULES[module], icon: icons[module] }));

  return (
    <div className={`min-h-screen bg-background text-foreground md:grid ${expanded ? "md:grid-cols-[248px_minmax(0,1fr)]" : "md:grid-cols-[76px_minmax(0,1fr)]"} transition-[grid-template-columns] duration-200`}>
      <aside
        onMouseEnter={() => { if (window.matchMedia("(min-width: 768px)").matches) setExpanded(true); }}
        onMouseLeave={() => { if (window.matchMedia("(min-width: 768px)").matches) setExpanded(false); }}
        onFocusCapture={() => setExpanded(true)}
        onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setExpanded(false); }}
        className="border-b border-border bg-card p-3 md:sticky md:top-0 md:flex md:h-screen md:flex-col md:border-b-0 md:border-r md:overflow-x-hidden md:p-3"
      >
        <div className={`flex items-center gap-3 py-3 ${expanded ? "px-2" : "justify-center"}`}>
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">H+</div>
          {expanded && <div className="min-w-0"><p className="font-semibold tracking-tight">HMS</p><p className="text-xs text-muted-foreground">Hospital Management</p></div>}
        </div>

        <div className="mt-2 flex justify-end md:hidden">
          <button type="button" onClick={() => setExpanded((value) => !value)} aria-label={expanded ? "Collapse navigation" : "Expand navigation"} aria-expanded={expanded} className="inline-flex size-10 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {expanded ? <X size={18}/> : <Menu size={18}/>}
          </button>
        </div>

        <nav aria-label="Main navigation" className={`mt-3 flex gap-1.5 pb-1 md:flex-1 md:flex-col md:overflow-y-auto ${expanded ? "flex-col overflow-x-visible" : "overflow-x-auto md:overflow-x-visible"}`}>
          <NavLink to="/overview" end title="Overview" aria-label="Overview" className={({ isActive }) => `${navLinkClass({ isActive })} ${expanded ? "" : "md:justify-center md:px-0"}`}>
            <LayoutDashboard aria-hidden="true" size={18}/>{expanded && <span>Overview</span>}
          </NavLink>
          {links.map(({ path, label, icon: Icon }) => <NavLink key={path} to={path} title={label} aria-label={label} className={({ isActive }) => `${navLinkClass({ isActive })} ${expanded ? "" : "md:justify-center md:px-0"}`}>
            <Icon aria-hidden="true" size={18}/>{expanded && <span>{label}</span>}
          </NavLink>)}
        </nav>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-10 flex min-h-16 items-center justify-end gap-3 border-b border-border bg-background/95 px-5 py-3 backdrop-blur md:px-8">
          <Button variant="secondary" size="sm" onClick={() => void signOut()}><LogOut aria-hidden="true"/> Sign out</Button>
        </header>
        <main className="min-w-0 p-4 sm:p-5 md:p-8"><Outlet/></main>
      </div>
    </div>
  );
}
