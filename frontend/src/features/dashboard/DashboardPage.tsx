import {
  Activity,
  BedDouble,
  Boxes,
  ClipboardCheck,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "../../components/ui/Badge";
import { Card, CardContent } from "../../components/ui/Card";
import { useAuth } from "../auth/AuthProvider";
import {
  MODULES,
  canAccessModule,
  type HmsModule,
} from "../../lib/permissions";

const moduleMeta: Record<
  HmsModule,
  { description: string; icon: typeof Activity }
> = {
  dashboard: { description: "Role-specific overview", icon: ShieldCheck },
  patients: { description: "Patient records and demographics", icon: Activity },
  encounters: {
    description: "Findings, recommendations, and admissions",
    icon: ClipboardCheck,
  },
  requests: {
    description: "Medicine and laboratory requests",
    icon: ClipboardCheck,
  },
  wards: { description: "Four wards, rooms, and bed setup", icon: BedDouble },
  billing: { description: "Payments and final bill review", icon: Wallet },
  inventory: { description: "Stock, fulfillment, and results", icon: Boxes },
  staff: {
    description: "Staff profiles and role assignments",
    icon: ShieldCheck,
  },
  audit: { description: "Administrative audit events", icon: ShieldCheck },
};

const greetings = {
  admin: "Administration overview",
  info_officer: "Patient registration workspace",
  emergency_nurse: "Emergency care workspace",
  cashier: "Cashier workspace",
  pharmacy: "Pharmacy workspace",
  lab: "Laboratory workspace",
  nurse_station: "Ward care workspace",
} as const;

export function DashboardPage() {
  const { profile } = useAuth();
  const role = profile?.role;
  const available = (Object.keys(MODULES) as HmsModule[]).filter(
    (module) => module !== "dashboard" && role && canAccessModule(role, module),
  );

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <section className="flex flex-col justify-between gap-4 rounded-2xl border border-input bg-card p-6 shadow-sm sm:flex-row sm:items-end md:p-8">
        <div>
          <p className="text-sm font-medium text-primary">Hospital operations</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
            {role ? greetings[role] : "Welcome to HMS"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Welcome{profile?.displayName ? `, ${profile.displayName}` : ""}.
            Your workspace shows only modules assigned to your staff role.
          </p>
        </div>
        <Badge tone="warning">Implementation in progress</Badge>
      </section>

      <section aria-labelledby="modules-heading">
        <div className="mb-4">
          <h2 id="modules-heading" className="text-base font-semibold">
            Your modules
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Only role-authorized destinations appear here.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {available.map((module) => {
            const meta = moduleMeta[module];
            const Icon = meta.icon;
            return (
              <Link
                key={module}
                to={MODULES[module].path}
                className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Card className="h-full transition-colors group-hover:border-primary/40 group-hover:bg-accent/30">
                  <CardContent className="pt-6">
                    <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Icon size={19} aria-hidden="true" />
                    </div>
                    <h3 className="mt-4 font-semibold group-hover:text-primary">
                      {MODULES[module].label}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {meta.description}
                    </p>
                    <p className="mt-4 text-xs font-semibold text-primary">
                      Open module <span aria-hidden="true">→</span>
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-dashed border-input bg-muted/30 p-5">
        <h2 className="font-semibold">No sample records loaded</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Patient, billing, inventory, and staffing metrics will appear when
          their workflows are connected to real database operations.
        </p>
      </section>
    </div>
  );
}
