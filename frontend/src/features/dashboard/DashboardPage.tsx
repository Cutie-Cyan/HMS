import { Activity, BedDouble, ClipboardCheck, Wallet, Boxes, ShieldCheck } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { MODULES, canAccessModule, type HmsModule } from "../../lib/permissions";
import { Card, CardContent } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Link } from "react-router-dom";

const moduleMeta: Record<HmsModule, { description: string; icon: typeof Activity }> = {
  dashboard: { description: "Role-specific overview", icon: ShieldCheck },
  patients: { description: "Patient records and demographics", icon: Activity },
  encounters: { description: "Findings, recommendations, and admissions", icon: ClipboardCheck },
  requests: { description: "Medicine and laboratory requests", icon: ClipboardCheck },
  wards: { description: "Four wards, rooms, and bed setup", icon: BedDouble },
  billing: { description: "Payments and final bill review", icon: Wallet },
  inventory: { description: "Stock, fulfillment, and results", icon: Boxes },
  staff: { description: "Staff profiles and role assignments", icon: ShieldCheck },
  audit: { description: "Administrative audit events", icon: ShieldCheck },
};
const greetings = {
  admin: "Administration overview", info_officer: "Patient registration workspace",
  emergency_nurse: "Emergency care workspace", cashier: "Cashier workspace",
  pharmacy: "Pharmacy workspace", lab: "Laboratory workspace", nurse_station: "Ward care workspace",
} as const;

export function DashboardPage() {
  const { profile } = useAuth();
  const role = profile?.role;
  const available = (Object.keys(MODULES) as HmsModule[]).filter((module) => module !== "dashboard" && role && canAccessModule(role, module));
  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-teal-700">Hospital operations</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">{role ? greetings[role] : "Welcome to HMS"}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Welcome{profile?.displayName ? `, ${profile.displayName}` : ""}. Your workspace shows only modules assigned to your staff role.</p>
        </div>
        <Badge tone="warning">Implementation in progress</Badge>
      </div>
      <section aria-labelledby="modules-heading" className="mt-8">
        <div className="mb-4"><h2 id="modules-heading" className="text-base font-semibold">Your modules</h2><p className="mt-1 text-sm text-slate-500">Only role-authorized destinations appear here.</p></div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {available.map((module) => {
            const meta = moduleMeta[module];
            const Icon = meta.icon;
            return <Link key={module} to={MODULES[module].path} className="group rounded-xl focus-visible:outline-teal-700">
              <Card className="h-full transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-md">
                <CardContent>
                  <div className="grid size-10 place-items-center rounded-lg bg-teal-50 text-teal-800"><Icon size={19} aria-hidden="true" /></div>
                  <h3 className="mt-4 font-semibold group-hover:text-teal-800">{MODULES[module].label}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{meta.description}</p>
                  <p className="mt-4 text-xs font-semibold text-teal-700">Open module →</p>
                </CardContent>
              </Card>
            </Link>;
          })}
        </div>
      </section>
      <section className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-5">
        <h2 className="font-semibold">No sample records loaded</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">Patient, billing, inventory, and staffing metrics will appear when their workflows are connected to real database operations.</p>
      </section>
    </div>
  );
}
