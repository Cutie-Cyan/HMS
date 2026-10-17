import {
  Activity,
  ArrowUpRight,
  BedDouble,
  ClipboardList,
  ScrollText,
  ShieldCheck,
  Users,
  Wallet,
  Boxes,
  Stethoscope,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { MODULES, canAccessModule, type HmsModule } from "../../lib/permissions";

const moduleMeta: Record<HmsModule, { description: string; icon: typeof ShieldCheck }> = {
  dashboard: { description: "Workspace overview", icon: ShieldCheck },
  patients: { description: "Patient records and demographics", icon: Activity },
  encounters: { description: "Clinical encounters and admissions", icon: Stethoscope },
  requests: { description: "Medicine and laboratory requests", icon: ClipboardList },
  wards: { description: "Ward, room, and bed configuration", icon: BedDouble },
  billing: { description: "Payments and discharge processing", icon: Wallet },
  inventory: { description: "Stock and fulfillment", icon: Boxes },
  staff: { description: "Staff accounts and role assignments", icon: Users },
  audit: { description: "Administrative activity and access history", icon: ScrollText },
};

const greetings = {
  admin: "Overview",
  info_officer: "Patient registration",
  emergency_nurse: "Emergency care",
  cashier: "Billing",
  pharmacy: "Pharmacy",
  lab: "Laboratory",
  nurse_station: "Ward care",
} as const;

export function DashboardPage() {
  const { profile } = useAuth();
  const role = profile?.role;
  const available = (Object.keys(MODULES) as HmsModule[]).filter(
    (module) => module !== "dashboard" && role && canAccessModule(role, module),
  );
  const featured = available.slice(0, 3);
  const quickLinks = available.slice(0, 4);

  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span>HMS</span><span className="text-border">/</span><span>Workspace</span>
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{role ? greetings[role] : "Overview"}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {profile?.displayName ? `Welcome back, ${profile.displayName}. ` : ""}
            Here are the tools available for your role.
          </p>
        </div>
        {profile && (
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground">
            <span className="size-2 rounded-full bg-emerald-500" />
            {profile.role === "admin" ? "Administrator" : "Staff workspace"}
          </div>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(290px,0.85fr)]">
        <section className="min-w-0 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {featured.map((module) => {
              const Icon = moduleMeta[module].icon;
              return (
                <Link key={module} to={MODULES[module].path} className="group rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-accent/20">
                  <div className="flex items-center justify-between">
                    <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary"><Icon size={18}/></div>
                    <ArrowUpRight size={16} className="text-muted-foreground group-hover:text-primary"/>
                  </div>
                  <p className="mt-4 text-sm font-semibold">{MODULES[module].label}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{moduleMeta[module].description}</p>
                </Link>
              );
            })}
          </div>

          <div className="rounded-xl border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold">Your modules</h2>
                <p className="mt-1 text-xs text-muted-foreground">Only destinations authorized for your role are shown.</p>
              </div>
              <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">{available.length} modules</span>
            </div>
            <div className="divide-y divide-border">
              {available.map((module) => {
                const Icon = moduleMeta[module].icon;
                return (
                  <Link key={module} to={MODULES[module].path} className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-accent/40">
                    <div className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-background text-muted-foreground group-hover:text-primary"><Icon size={17}/></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{MODULES[module].label}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{moduleMeta[module].description}</p>
                    </div>
                    <ArrowUpRight size={16} className="text-muted-foreground group-hover:text-primary"/>
                  </Link>
                );
              })}
              {!available.length && <p className="px-5 py-8 text-sm text-muted-foreground">No modules are assigned to this account.</p>}
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quick access</p>
            <h2 className="mt-2 text-lg font-semibold">Administration tools</h2>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">Open a workspace to manage the hospital system.</p>
            <div className="mt-4 space-y-1">
              {quickLinks.map((module) => {
                const Icon = moduleMeta[module].icon;
                return (
                  <Link key={module} to={MODULES[module].path} className="flex items-center gap-3 rounded-lg px-2.5 py-3 hover:bg-accent/50">
                    <Icon size={17} className="text-muted-foreground"/>
                    <span className="flex-1 text-sm font-medium">{MODULES[module].label}</span>
                    <ArrowUpRight size={15} className="text-muted-foreground"/>
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-primary"/>
              <h2 className="text-sm font-semibold">Access overview</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Your navigation is filtered by your active staff role. Database policies remain the final access control.
            </p>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm">
              <span className="text-muted-foreground">Role</span>
              <span className="font-medium">{profile?.role.replaceAll("_", " ") ?? "Not assigned"}</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Available modules</span>
              <span className="font-medium tabular-nums">{available.length}</span>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
