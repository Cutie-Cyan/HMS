import { useEffect, useState, type ReactNode } from "react";
import { RefreshCw, Search } from "lucide-react";
import { Button } from "./Button";
import { statusTones } from "./listTableStyles";

/*
 * Shared list-table building blocks. They mirror the Patient Records page so
 * every list (staff, audit log, doctors…) has the same search bar, metrics
 * pill, refresh button, table header and status pills.
 */

export function StatusPill({ tone, children }: { tone: keyof typeof statusTones; children: ReactNode }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${statusTones[tone]}`}>{children}</span>;
}

export function ListToolbar({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">{children}</div>;
}

export function SearchField({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (value: string) => void }) {
  return <label className="flex min-h-10 w-full min-w-0 items-center gap-2 rounded-lg bg-white px-3 text-slate-500 transition focus-within:outline-none focus-within:ring-0 xl:max-w-md">
    <Search size={17} className="shrink-0" />
    <input aria-label={label} placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 w-full border-0 bg-transparent text-sm text-slate-800 outline-none ring-0 shadow-none placeholder:text-slate-400" />
  </label>;
}

export function ToolbarActions({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`flex shrink-0 flex-wrap items-center justify-start gap-3 xl:justify-end ${className}`}>{children}</div>;
}

export function MetricStrip({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">{children}</div>;
}

export function Metric({ icon, label, value, valueClassName = "text-slate-900" }: { icon: ReactNode; label: string; value: ReactNode; valueClassName?: string }) {
  return <div className="flex items-center gap-2">{icon}<span className="text-xs text-slate-500">{label}</span><span className={`text-sm font-semibold tabular-nums ${valueClassName}`}>{value}</span></div>;
}

export function MetricDivider() {
  return <span className="hidden h-5 w-px bg-slate-200 sm:block" />;
}

export function RefreshButton({ label, onClick, spinning }: { label: string; onClick: () => void; spinning: boolean }) {
  return <Button variant="secondary" className="!size-9 !min-h-9 !shrink-0 !p-0" onClick={onClick} disabled={spinning} aria-label={label} title="Refresh"><RefreshCw size={15} className={spinning ? "animate-spin" : ""} /></Button>;
}

export function TableSkeleton({ label }: { label: string }) {
  return <div className="flex min-h-56 items-center justify-center py-8" role="status" aria-label={label}>
    <div className="w-full max-w-5xl animate-pulse space-y-5">
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">{[0, 1, 2, 3, 4, 5].map((cell) => <div key={cell} className={cell > 2 ? "hidden h-4 rounded bg-slate-200 sm:block" : "h-4 rounded bg-slate-200"} />)}</div>
      {[0, 1, 2, 3, 4, 5].map((row) => <div key={row} className="grid grid-cols-3 items-center gap-4 border-b border-slate-100 pb-4 sm:grid-cols-6">{[0, 1, 2, 3, 4, 5].map((cell) => <div key={cell} className={cell > 2 ? "hidden h-5 rounded-md bg-slate-100 sm:block" : "h-5 rounded-md bg-slate-100"} />)}</div>)}
    </div>
  </div>;
}

export function ListError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="py-6 text-center">
    <p role="alert" className="text-sm text-rose-700">{message}</p>
    <div className="mt-3 flex justify-center"><Button type="button" variant="secondary" size="sm" onClick={onRetry}>Retry</Button></div>
  </div>;
}

export function ListEmpty({ icon, title, hint }: { icon: ReactNode; title: string; hint: string }) {
  return <div className="py-10 text-center">{icon}<p className="mt-3 font-medium">{title}</p><p className="mt-1 text-sm text-slate-500">{hint}</p></div>;
}

export function PageToast({ message, error }: { message: string; error: string }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!message && !error) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const timeout = window.setTimeout(() => setVisible(false), 2400);
    return () => window.clearTimeout(timeout);
  }, [message, error]);
  if ((!message && !error) || !visible) return null;
  const label = error ? "Error" : "Saved";
  return <div role={error ? "alert" : "status"} aria-label={error || message} title={error || message} className={`fixed right-4 top-4 z-[120] rounded-lg px-3 py-2 text-xs font-semibold shadow-lg transition-opacity ${error ? "bg-rose-700 text-white" : "bg-slate-900 text-white"}`}>{label}</div>;
}
