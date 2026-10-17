import { ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";

export function AccessDeniedPage({ title = "Access restricted", description = "Your staff role does not have permission to open this page." }: { title?: string; description?: string }) {
  return (
    <section className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-white p-8 shadow-sm">
      <div className="grid size-12 place-items-center rounded-xl bg-amber-50 text-amber-700"><ShieldAlert aria-hidden="true" size={24} /></div>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-950">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      <Link to="/" className="mt-6 inline-flex rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800">Return to overview</Link>
    </section>
  );
}
