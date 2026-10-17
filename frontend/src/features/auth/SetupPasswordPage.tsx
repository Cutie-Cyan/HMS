import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { getSupabaseClient } from "../../lib/supabase";
import { useAuth } from "./AuthProvider";

export function SetupPasswordPage() {
  const { session, profile, loading, configured, refreshProfile } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);

  if (!loading && complete && session && profile) {
    return <Navigate to="/" replace />;
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    if (password.length < 8) {
      setMessage("Use a password with at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("The passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await getSupabaseClient().auth.updateUser({ password });
      if (error) throw error;
      await refreshProfile();
      setComplete(true);
      setMessage("Password saved. Your staff workspace is ready.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Unable to set your password. Reopen the latest invitation link and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-5">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 grid size-12 place-items-center rounded-xl bg-teal-700 font-bold text-white">H+</div>
        <p className="text-sm font-semibold text-teal-700">HMS staff portal</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Set up your password</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">Use this page after opening the invitation email sent by your HMS administrator.</p>
        {!configured && <p role="alert" className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Supabase is not configured. Set the required frontend environment variables.</p>}
        {!loading && configured && !session && <p role="alert" className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">No valid invitation session was found. Open the latest invitation link from your email. If it has expired, contact the HMS administrator for a new invitation.</p>}
        {message && <p role={complete ? "status" : "alert"} className={`mt-5 rounded-lg p-3 text-sm ${complete ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"}`}>{message}</p>}
        {session && !complete && <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-slate-700">New password
            <input autoComplete="new-password" type="password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"/>
          </label>
          <label className="block text-sm font-medium text-slate-700">Confirm password
            <input autoComplete="new-password" type="password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"/>
          </label>
          <button type="submit" disabled={submitting || !configured} className="min-h-11 w-full rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60">{submitting ? "Saving password…" : "Save password"}</button>
        </form>}
        {complete && <Link to="/" className="mt-5 inline-flex text-sm font-semibold text-teal-700 hover:text-teal-900">Continue to workspace →</Link>}
        <Link to="/login" className="mt-5 inline-flex text-sm font-semibold text-teal-700 hover:text-teal-900">Back to sign in</Link>
      </section>
    </main>
  );
}
