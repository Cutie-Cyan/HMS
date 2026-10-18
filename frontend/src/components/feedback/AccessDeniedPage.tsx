import { useState } from "react";
import { ArrowLeft, CheckCircle2, LogOut, RefreshCw, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../features/auth/AuthProvider";

export function AccessDeniedPage({
  title = "Access restricted",
  description = "Your staff role does not have permission to open this page.",
}: {
  title?: string;
  description?: string;
}) {
  const { session, profileLoading, refreshProfile, signOut } = useAuth();
  const [retrying, setRetrying] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const retry = async () => {
    setRetrying(true);
    try {
      await refreshProfile();
    } finally {
      setRetrying(false);
    }
  };

  const leaveAccount = async () => {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
  };

  const needsApproval = title.toLowerCase().includes("staff access not approved");

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-slate-50 px-4 py-10 text-slate-900">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-24 -top-24 size-80 rounded-full bg-sky-100/80 blur-3xl" />
        <div className="absolute -bottom-28 -left-20 size-80 rounded-full bg-amber-100/60 blur-3xl" />
      </div>
      <section className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,.09)] sm:p-9" aria-labelledby="access-status-title">
        <div className={`grid size-14 place-items-center rounded-2xl ${needsApproval ? "bg-amber-50 text-amber-700 ring-1 ring-amber-100" : "bg-slate-100 text-slate-700 ring-1 ring-slate-200"}`}>
          {needsApproval ? <ShieldAlert size={26} aria-hidden="true" /> : <CheckCircle2 size={26} aria-hidden="true" />}
        </div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">HMS · Account status</p>
        <h1 id="access-status-title" className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>

        {needsApproval && (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-800">What you can do next</p>
            <ol className="mt-3 space-y-2.5 text-sm leading-5 text-slate-600">
              <li className="flex gap-2.5"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-white text-xs font-semibold ring-1 ring-slate-200">1</span><span>Retry the access check in case your staff profile was just created or activated.</span></li>
              <li className="flex gap-2.5"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-white text-xs font-semibold ring-1 ring-slate-200">2</span><span>If access is still unavailable, ask your HMS administrator to verify your account and assigned role.</span></li>
            </ol>
          </div>
        )}

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          {needsApproval && session && (
            <button type="button" onClick={() => void retry()} disabled={retrying || profileLoading} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60">
              <RefreshCw size={16} className={retrying || profileLoading ? "animate-spin" : ""} />
              {retrying || profileLoading ? "Checking access…" : "Retry access check"}
            </button>
          )}
          {session ? (
            <button type="button" onClick={() => void leaveAccount()} disabled={signingOut} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">
              <LogOut size={16} /> {signingOut ? "Signing out…" : "Sign out"}
            </button>
          ) : (
            <Link to="/login" className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700">
              <ArrowLeft size={16} /> Back to sign in
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}
