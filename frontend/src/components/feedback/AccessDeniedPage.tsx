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
      <section className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-lg sm:p-6" aria-labelledby="access-status-title">
        <div className={`grid size-10 place-items-center rounded-xl ${needsApproval ? "bg-amber-50 text-amber-700 ring-1 ring-amber-100" : "bg-slate-100 text-slate-700 ring-1 ring-slate-200"}`}>
          {needsApproval ? <ShieldAlert size={21} aria-hidden="true" /> : <CheckCircle2 size={21} aria-hidden="true" />}
        </div>
        <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">HMS · Account status</p>
        <h1 id="access-status-title" className="mt-1.5 text-xl font-bold tracking-tight text-slate-950">{title}</h1>
        <p role={needsApproval ? "alert" : undefined} className="mt-2 text-sm leading-5 text-slate-600">{needsApproval ? `! ${description}` : description}</p>



        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          {needsApproval && session && (
            <button type="button" onClick={() => void retry()} disabled={retrying || profileLoading} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60">
              <RefreshCw size={16} className={retrying || profileLoading ? "animate-spin" : ""} />
              {retrying || profileLoading ? "Checking access…" : "Retry access check"}
            </button>
          )}
          {session ? (
            <button type="button" onClick={() => void leaveAccount()} disabled={signingOut} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">
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
