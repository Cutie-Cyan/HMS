import {
  Activity,
  BedDouble,
  Boxes,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  ScrollText,
  ShieldCheck,
  Stethoscope,
  Users,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../features/auth/AuthProvider";
import {
  MODULES,
  canAccessModule,
  type HmsModule,
} from "../../lib/permissions";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

const icons: Record<HmsModule, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  patients: Activity,
  encounters: Stethoscope,
  requests: ClipboardList,
  wards: BedDouble,
  billing: Wallet,
  inventory: Boxes,
  staff: Users,
  audit: ScrollText,
};

const navOrder: HmsModule[] = [
  "dashboard",
  "patients",
  "encounters",
  "requests",
  "billing",
  "inventory",
  "wards",
  "staff",
  "audit",
];

const roleLabels = {
  admin: "Administrator",
  info_officer: "Information Officer",
  emergency_nurse: "Emergency Nurse",
  cashier: "Cashier",
  pharmacy: "Pharmacy",
  lab: "Laboratory",
  nurse_station: "Nurse Station",
} as const;

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
    isActive
      ? "bg-accent text-accent-foreground"
      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
  }`;

export function AppShell() {
  const { profile, signOut } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const links = navOrder
    .filter(
      (module) =>
        profile &&
        canAccessModule(profile.role, module) &&
        module !== "dashboard",
    )
    .map((module) => ({ ...MODULES[module], icon: icons[module] }));

  return (
    <div className={`min-h-screen bg-background text-foreground md:grid ${expanded ? "md:grid-cols-[248px_minmax(0,1fr)]" : "md:grid-cols-[76px_minmax(0,1fr)]"} transition-[grid-template-columns] duration-200`}>
      <aside onMouseEnter={() => setExpanded(true)} onMouseLeave={() => setExpanded(false)} onFocusCapture={() => setExpanded(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setExpanded(false); }} className={`border-b border-input bg-background p-3 md:sticky md:top-0 md:flex md:h-screen md:flex-col md:border-b-0 md:border-r md:overflow-x-hidden md:p-3 ${expanded ? "md:px-4" : "md:px-3"}`}>
        <div className={`flex items-center gap-3 py-3 ${expanded ? "px-2" : "justify-center"}`}>
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-sm">
            H+
          </div>
          <div className="min-w-0">
            <p className="font-semibold tracking-tight">HMS</p>
            <p className="text-xs text-muted-foreground">Hospital Management</p>
          </div>
        </div>

        {expanded && <div className="mx-1 mt-5 rounded-xl border border-input bg-secondary/50 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck aria-hidden="true" size={16} className="text-primary" />
            Staff workspace
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {profile?.displayName}
          </p>
          {profile && (
            <Badge tone="info" className="mt-2">
              {roleLabels[profile.role]}
            </Badge>
          )}
        </div>

        <nav
          aria-label="Main navigation"
          className="mt-5 flex gap-1.5 overflow-x-auto pb-1 md:flex-1 md:flex-col md:overflow-x-visible md:overflow-y-auto"
        >
          <NavLink to="/overview" end className={navLinkClass}>
            <LayoutDashboard aria-hidden="true" size={18} />
            Overview
          </NavLink>
          {links.map(({ path, label, icon: Icon }) => (
            <NavLink key={path} to={path} className={navLinkClass}>
              <Icon aria-hidden="true" size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {expanded && <div className="mt-4 hidden rounded-xl border border-input bg-secondary/40 p-3 text-xs leading-5 text-muted-foreground md:block">
          Navigation is filtered by your active staff role. Database permissions
          remain the final access control.
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-10 flex min-h-16 items-center justify-between gap-3 border-b border-input bg-background/95 px-5 py-3 backdrop-blur md:px-8">
          <div>
            <p className="text-sm font-semibold">Hospital operations</p>
            <p className="text-xs text-muted-foreground">
              Secure staff workspace
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void signOut()}
          >
            <LogOut aria-hidden="true" /> Sign out
          </Button>
        </header>
        <main className="min-w-0 p-4 sm:p-5 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
