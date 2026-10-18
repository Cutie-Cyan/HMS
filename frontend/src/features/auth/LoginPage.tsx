import { useState, type FormEvent } from "react";
import { Activity, ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
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

  return <main className="relative grid min-h-screen overflow-hidden bg-[#eef2f8] px-4 py-8 text-slate-900 sm:px-8 dark:bg-[#10131a] dark:text-slate-100">
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-24 -top-24 size-[420px] rounded-full bg-sky-300/25 blur-[100px]"/>
      <div className="absolute -bottom-36 -right-24 size-[480px] rounded-full bg-indigo-300/25 blur-[110px]"/>
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.28)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.28)_1px,transparent_1px)] bg-[size:36px_36px] opacity-50 dark:opacity-[.06]"/>
    </div>
    <div className="relative m-auto grid w-full max-w-[980px] overflow-hidden rounded-[28px] border border-white/80 bg-white/75 shadow-[0_32px_100px_rgba(30,41,59,.16)] backdrop-blur-2xl md:min-h-[590px] md:grid-cols-[1.02fr_.98fr] dark:border-white/10 dark:bg-[#1a1d25]/90">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[#152b4a] via-[#193d67] to-[#3269a5] p-9 text-white md:flex">
        <div aria-hidden="true" className="absolute -right-24 top-24 size-72 rounded-full border border-white/10"/><div aria-hidden="true" className="absolute -right-12 top-36 size-48 rounded-full border border-white/10"/><div aria-hidden="true" className="absolute -bottom-24 -left-16 size-72 rounded-full bg-sky-300/10 blur-2xl"/>
        <div className="relative flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-[15px] border border-white/20 bg-white/15 shadow-lg backdrop-blur"><Activity size={22}/></div>
          <div><p className="text-sm font-semibold tracking-wide">HMS</p><p className="text-[11px] text-blue-100/75">Hospital Management System</p></div>
        </div>
        <div className="relative max-w-sm">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[.16em] text-blue-50"><span className="size-1.5 rounded-full bg-emerald-300"/> Staff workspace</p>
          <h1 className="text-[34px] font-semibold leading-[1.12] tracking-[-.04em]">Care teams,<br/>connected.</h1>
          <p className="mt-4 max-w-xs text-sm leading-6 text-blue-100/80">A secure workspace for patient services, clinical operations, inventory, and billing.</p>
        </div>
        <div className="relative flex items-center justify-between border-t border-white/15 pt-4 text-[10px] text-blue-100/65"><span>Designed for hospital operations</span><span>© HMS</span></div>
      </section>
      <section className="flex min-w-0 flex-col justify-center p-6 sm:p-10 md:p-11">
        <div className="mb-8 flex items-center justify-between md:hidden">
          <div className="flex items-center gap-2.5"><div className="grid size-10 place-items-center rounded-[14px] bg-gradient-to-br from-sky-500 to-indigo-600 text-xs font-bold text-white shadow-sm">H+</div><div><p className="text-sm font-semibold">HMS</p><p className="text-[10px] text-slate-500">Staff workspace</p></div></div>
          <span className="flex items-center gap-1.5 text-[10px] text-slate-500"><ShieldCheck size={13}/> Secure access</span>
        </div>
        <div className="mb-7">
          <div className="mb-5 hidden size-10 place-items-center rounded-[14px] bg-sky-50 text-sky-700 ring-1 ring-sky-100 md:grid dark:bg-sky-400/10 dark:text-sky-300 dark:ring-sky-300/15"><ShieldCheck size={20}/></div>
          <p className="text-[11px] font-semibold uppercase tracking-[.15em] text-sky-700 dark:text-sky-300">Staff sign in</p>
          <h2 className="mt-2 text-[27px] font-semibold tracking-[-.035em]">Welcome back</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">Sign in with the staff account issued by your HMS administrator.</p>
        </div>
        {!configured && <p role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.</p>}
        {message && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">{message}</p>}
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">Email address
            <input autoComplete="username" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@hospital.com" className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3.5 text-sm font-normal outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100/80 dark:border-white/10 dark:bg-white/5 dark:focus:ring-sky-900/30"/>
          </label>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">Password
            <span className="relative mt-2 block"><input autoComplete="current-password" type={showPassword ? "text" : "password"} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" className="h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3.5 pr-11 text-sm font-normal outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100/80 dark:border-white/10 dark:bg-white/5 dark:focus:ring-sky-900/30"/><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">{showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button></span>
          </label>
          <Button type="submit" disabled={!configured || submitting} className="mt-2 h-11 w-full rounded-xl bg-sky-600 text-sm shadow-[0_5px_12px_rgba(37,99,235,.2)] hover:bg-sky-700">{submitting ? "Signing in…" : <>Sign in securely <ArrowRight size={16}/></>}</Button>
        </form>
        <p className="mt-5 text-[11px] leading-5 text-slate-500 dark:text-slate-400">Access is limited to active staff accounts. If you need access, contact your HMS administrator.</p>
        <div className="mt-7 flex items-center justify-between border-t border-slate-200/80 pt-4 text-[10px] text-slate-400 dark:border-white/10"><span>Protected staff access</span><Link to="/" className="font-medium text-slate-500 transition hover:text-sky-700 dark:hover:text-sky-300">Return to workspace</Link></div>
      </section>
    </div>
  </main>;
}
