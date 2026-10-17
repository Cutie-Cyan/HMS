import { ArrowUpRight, ClipboardCheck, BedDouble, Users } from "lucide-react";

const cards = [
  { label: "Patient registration", description: "Patient records and demographic details", icon: Users },
  { label: "Clinical encounters", description: "Findings, recommendations, and admission", icon: ClipboardCheck },
  { label: "Ward capacity", description: "Beds, rooms, and ward occupancy", icon: BedDouble },
];

export function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-sm font-medium text-teal-700">Hospital operations</p><h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">Welcome to HMS</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">The application foundation is ready. Workflow modules will be enabled as their role permissions and database operations are implemented.</p></div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600"><span className="size-2 rounded-full bg-amber-500" /> Foundation stage</span>
      </div>
      <section aria-labelledby="modules-heading" className="mt-8">
        <div className="mb-4"><h2 id="modules-heading" className="text-base font-semibold">Core modules</h2><p className="mt-1 text-sm text-slate-500">Structured feature areas for the HMS workflow.</p></div>
        <div className="grid gap-4 lg:grid-cols-3">
          {cards.map(({ label, description, icon: Icon }) => <article key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div className="grid size-10 place-items-center rounded-lg bg-teal-50 text-teal-800"><Icon size={19} aria-hidden="true" /></div><ArrowUpRight size={17} className="text-slate-400" aria-hidden="true" /></div><h3 className="mt-5 font-semibold">{label}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{description}</p></article>)}
        </div>
      </section>
      <section className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-5"><h2 className="font-semibold">Next implementation milestone</h2><p className="mt-2 text-sm leading-6 text-slate-500">Role-based navigation, route protection, reusable UI components, and real Supabase data hooks are added in the next steps. No patient or staff sample records are loaded.</p></section>
    </div>
  );
}
