import { isRouteErrorResponse, Link, useRouteError } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Home, RefreshCw } from "lucide-react";

export function RouteErrorPage() {
  const error = useRouteError();
  const title = isRouteErrorResponse(error)
    ? error.status === 404 ? "Page not found" : `Request failed (${error.status})`
    : "Something went wrong";
  const description = isRouteErrorResponse(error)
    ? (typeof error.data === "string" ? error.data : error.statusText || "The requested page could not be loaded.")
    : error instanceof Error
      ? error.message
      : "An unexpected error occurred while loading this page. Please try again.";

  return (
    <main className="grid min-h-[60vh] place-items-center px-4 py-12">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-10">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-rose-50 text-rose-600">
          <AlertTriangle size={26} aria-hidden="true" />
        </div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">HMS · Error</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{title}</h1>
        <p className="mx-auto mt-3 max-w-sm break-words text-sm leading-6 text-slate-600">{description}</p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <button type="button" onClick={() => window.location.reload()} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2">
            <RefreshCw size={16} /> Try again
          </button>
          <Link to="/overview" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2">
            <Home size={16} /> Overview
          </Link>
          <button type="button" onClick={() => window.history.back()} className="inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">
            <ArrowLeft size={16} /> Go back
          </button>
        </div>
      </section>
    </main>
  );
}
