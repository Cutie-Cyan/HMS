import { useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Navigate } from "react-router-dom";
import { getSupabaseClient } from "../../lib/supabase";
import { useAuth } from "./AuthProvider";
import { Button } from "../../components/ui/Button";
import { homePathForRole } from "../../lib/permissions";

export function LoginPage() {
  const { session, profile, loading, configured, refreshProfile } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  if (!loading && session && profile)
    return <Navigate to={homePathForRole(profile.role)} replace />;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const { error } = await getSupabaseClient().auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      await refreshProfile();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Unable to sign in. Check your credentials and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3f5f8] px-4 py-8 text-slate-900">
      <section className="w-full max-w-[380px] rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_36px_rgba(15,23,42,0.08)] sm:p-8">
        <div className="mb-7 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">HMS</h1>
          <p className="mt-1 text-sm text-slate-500">Hospital Management</p>
        </div>

        {!configured && <p role="alert" className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.</p>}
        {message && <p role="alert" className="mb-5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-700">{message}</p>}

        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">Email address
            <input autoComplete="username" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@hospital.com" className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-slate-200 focus:ring-0"/>
          </label>
          <label className="block text-sm font-medium text-slate-700">Password
            <span className="relative mt-2 block">
              <input autoComplete="current-password" type={showPassword ? "text" : "password"} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 pr-11 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-slate-200 focus:ring-0"/>
              <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-slate-400 transition hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500">{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button>
            </span>
          </label>
          <Button type="submit" disabled={!configured || submitting} className="mt-2 h-11 w-full rounded-lg bg-[#17191d] text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? "Signing in…" : "Sign in"}</Button>
        </form>
      </section>
    </main>
  );
}
