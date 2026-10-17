import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { getSupabaseClient } from "../../lib/supabase";
import { useAuth } from "./AuthProvider";
import { Button } from "../../components/ui/Button";

export function LoginPage() {
  const { session, profile, loading, configured, refreshProfile } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  if (!loading && session && profile)
    return (
      <Navigate
        to={(location.state as { from?: string } | null)?.from ?? "/"}
        replace
      />
    );
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const { error } = await getSupabaseClient().auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      await refreshProfile();
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? cause.message
          : "Unable to sign in. Check your credentials and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-5">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 grid size-12 place-items-center rounded-xl bg-teal-700 font-bold text-white">
          H+
        </div>
        <p className="text-sm font-semibold text-teal-700">HMS staff portal</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Sign in to your workspace
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Use the account issued to you by the HMS administrator. An active
          staff profile is required.
        </p>
        {!configured && (
          <p
            role="alert"
            className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
          >
            Supabase is not configured. Set VITE_SUPABASE_URL and
            VITE_SUPABASE_ANON_KEY.
          </p>
        )}
        {message && (
          <p
            role="alert"
            className="mt-5 rounded-lg bg-rose-50 p-3 text-sm text-rose-700"
          >
            {message}
          </p>
        )}
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input
              autoComplete="username"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Password
            <input
              autoComplete="current-password"
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            />
          </label>
          <Button
            type="submit"
            disabled={!configured || submitting}
            className="w-full"
          >
            {submitting ? "Signing in…" : "Sign in securely"}
          </Button>
        </form>
        <p className="mt-5 text-xs leading-5 text-slate-500">
          No demo credentials are provided. Accounts must be created and
          assigned a role through the approved staff setup process.
        </p>
        <Link
          to="/"
          className="mt-5 inline-flex text-sm font-semibold text-teal-700 hover:text-teal-900"
        >
          Return to workspace →
        </Link>
      </section>
    </main>
  );
}
