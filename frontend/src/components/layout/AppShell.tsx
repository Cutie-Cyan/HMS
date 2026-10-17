import {
  Activity, BedDouble, Boxes, ClipboardList, LayoutDashboard, LogOut,
  ScrollText, Stethoscope, Users, Wallet, Menu, X, ShieldCheck,
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
  `flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"}`;

export function AppShell() {
  const { profile, signOut } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const links = navOrder
    .filter((module) => profile && canAccessModule(profile.role, module))
    .map((module) => ({ ...MODULES[module], icon: icons[module] }));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="flex min-h-[60px] items-center gap-4 px-4 md:px-6">
          <NavLink to="/overview" className="flex shrink-0 items-center gap-2.5 rounded-md">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">H+</span>
            <span className="hidden sm:block"><span className="block text-sm font-semibold tracking-tight">HMS</span><span className="block text-[11px] text-muted-foreground">Hospital Management</span></span>
          </NavLink>
          <div className="hidden h-7 w-px bg-border md:block"/>
          <nav aria-label="Main navigation" className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto md:flex">
            {links.map(({ path, label, icon: Icon }) => (
              <NavLink key={path} to={path} title={label} className={navLinkClass}>
                <Icon size={15} aria-hidden="true"/><span>{label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground lg:flex">
              <ShieldCheck size={15}/><span>{profile?.displayName ?? "Staff account"}</span>
            </div>
            <Button variant="secondary" size="sm" onClick={() => void signOut()}><LogOut aria-hidden="true"/> <span className="hidden sm:inline">Sign out</span></Button>
            <button type="button" onClick={() => setMobileNavOpen((value) => !value)} aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileNavOpen} className="inline-flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent md:hidden">
              {mobileNavOpen ? <X size={18}/> : <Menu size={18}/>}
            </button>
          </div>
        </div>
        {mobileNavOpen && (
          <nav aria-label="Mobile navigation" className="grid gap-1 border-t border-border p-3 md:hidden">
            {links.map(({ path, label, icon: Icon }) => (
              <NavLink key={path} to={path} onClick={() => setMobileNavOpen(false)} className={navLinkClass}>
                <Icon size={17}/><span>{label}</span>
              </NavLink>
            ))}
          </nav>
        )}
      </header>
      <main className="mx-auto min-w-0 max-w-[1600px] p-4 sm:p-6 lg:p-8"><Outlet/></main>
    </div>
  );
}
