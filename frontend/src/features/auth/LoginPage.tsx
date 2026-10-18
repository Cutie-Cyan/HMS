import { useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Navigate } from "react-router-dom";
import { getSupabaseClient } from "../../lib/supabase";
import { useAuth } from "./AuthProvider";
import { Button } from "../../components/ui/Button";
import { homePathForRole } from "../../lib/permissions";

function HmsMark({ className = "size-10 rounded-2xl bg-black text-white shadow-sm ring-1 ring-black/10" }: { className?: string }) {
  return (
    <span className={`grid shrink-0 place-items-center ${className}`}>
      <svg viewBox="0 0 48 48" className="size-[70%]" role="img" aria-label="HMS logo">
        <path d="M11 9 L20 14 L31 31 Q34 36 39 32 Q43 28 39 22 L34 14 Q31 10 27 13 L23 16 L28 21 L31 18 L35 25 Q37 29 34 30 Q32 31 30 28 L19 11 Q15 6 11 9Z" fill="currentColor"/>
        <path d="M37 39 L28 34 L17 17 Q14 12 9 16 Q5 20 9 26 L14 34 Q17 38 21 35 L25 32 L20 27 L17 30 L13 23 Q11 19 14 18 Q16 17 18 20 L29 37 Q33 42 37 39Z" fill="currentColor"/>
      </svg>
    </span>
  );
}

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
    <main className="flex min-h-screen items-center justify-center bg-slate-100/70 px-4 py-10 text-slate-900">
      <section className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
        <div className="mb-7 flex items-center gap-3">
          <HmsMark className="size-9 rounded-lg bg-slate-900 text-white ring-0" />
          <h1 className="text-xl font-semibold tracking-tight text-slate-950">Sign in</h1>
        </div>

        {!configured && <p role="alert" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs leading-5 text-amber-900">Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.</p>}
        {message && <p role="alert" className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs leading-5 text-rose-700">{message}</p>}

        <form onSubmit={submit} className="space-y-5">
          <label className="block text-sm font-medium text-slate-700">Email address
            <input autoComplete="username" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@hospital.com" className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-sky-500 focus:ring-4 focus:ring-sky-100"/>
          </label>
          <label className="block text-sm font-medium text-slate-700">Password
            <span className="relative mt-2 block">
              <input autoComplete="current-password" type={showPassword ? "text" : "password"} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 pr-12 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-sky-500 focus:ring-4 focus:ring-sky-100"/>
              <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-slate-400 transition hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500">{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button>
            </span>
          </label>
          <Button type="submit" disabled={!configured || submitting} className="h-11 w-full rounded-lg bg-[#17191d] text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? "Signing in…" : "Sign in"}</Button>
        </form>
      </section>
    </main>
  );
}
