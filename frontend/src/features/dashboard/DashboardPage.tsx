import {
  BedDouble,
  ScrollText,
  ShieldCheck,
  ArrowUpRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { MODULES, canAccessModule, type HmsModule } from "../../lib/permissions";

const moduleMeta: Record<HmsModule, { description: string; icon: typeof ShieldCheck }> = {
  dashboard: { description: "Your workspace overview", icon: ShieldCheck },
  patients: { description: "Patient records and demographics", icon: ShieldCheck },
  encounters: { description: "Clinical encounters and admissions", icon: ShieldCheck },
  requests: { description: "Medicine and laboratory requests", icon: ShieldCheck },
  wards: { description: "Manage wards, rooms, and bed availability", icon: BedDouble },
  billing: { description: "Payments and discharge processing", icon: ShieldCheck },
  inventory: { description: "Stock and fulfillment", icon: ShieldCheck },
  staff: { description: "Manage staff accounts and role assignments", icon: ShieldCheck },
  audit: { description: "Review administrative activity", icon: ScrollText },
};

const greetings = {
  admin: "Administration",
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

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <section className="border-b border-border pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
          Workspace
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {role ? greetings[role] : "Workspace"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {profile?.displayName ? `Welcome back, ${profile.displayName}.` : "Choose a module to get started."}
            </p>
          </div>
          {profile && (
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <span className="size-2 rounded-full bg-emerald-500" />
              {profile.role === "admin" ? "Administrator access" : "Staff access"}
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="modules-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="modules-heading" className="text-sm font-semibold">Available modules</h2>
          <span className="text-xs text-muted-foreground">{available.length} available</span>
        </div>
        {available.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {available.map((module) => {
              const meta = moduleMeta[module];
              const Icon = meta.icon;
              return (
                <Link
                  key={module}
                  to={MODULES[module].path}
                  className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/50 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid size-10 place-items-center rounded-lg border border-border bg-background text-primary">
                      <Icon size={19} aria-hidden="true" />
                    </div>
                    <ArrowUpRight size={17} className="text-muted-foreground transition-colors group-hover:text-primary" aria-hidden="true" />
                  </div>
                  <h3 className="mt-5 text-sm font-semibold">{MODULES[module].label}</h3>
                  <p className="mt-1.5 text-sm leading-5 text-muted-foreground">{meta.description}</p>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card px-5 py-10 text-center">
            <p className="text-sm font-medium">No modules assigned</p>
            <p className="mt-1 text-sm text-muted-foreground">Contact your HMS administrator to review your access.</p>
          </div>
        )}
      </section>
    </div>
  );
}
