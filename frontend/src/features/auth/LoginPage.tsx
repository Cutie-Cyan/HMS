import { useState, type FormEvent } from "react";
import { Activity, ArrowRight, Eye, EyeOff, ShieldCheck, LockKeyhole, HeartPulse } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { getSupabaseClient } from "../../lib/supabase";
import { useAuth } from "./AuthProvider";
import { Button } from "../../components/ui/Button";
import { homePathForRole } from "../../lib/permissions";

function HmsMark({ className = "size-10" }: { className?: string }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-2xl bg-black text-white shadow-sm ring-1 ring-black/10 ${className}`}>
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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f3f5f8] px-4 py-6 text-slate-900 sm:px-8 sm:py-10">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -right-28 -top-32 size-[440px] rounded-full bg-sky-200/35 blur-[100px]"/>
        <div className="absolute -bottom-36 -left-28 size-[420px] rounded-full bg-slate-300/30 blur-[100px]"/>
      </div>

      <div className="relative grid min-h-[min(690px,calc(100vh-3rem))] w-full max-w-[1080px] overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-[0_28px_90px_rgba(15,23,42,.12)] md:grid-cols-[0.86fr_1.14fr]">
        <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#17191d] p-9 text-white md:flex lg:p-11">
          <div aria-hidden="true" className="absolute -right-24 top-28 size-72 rounded-full border border-white/[0.08]"/>
          <div aria-hidden="true" className="absolute -right-10 top-44 size-44 rounded-full border border-white/[0.08]"/>
          <div aria-hidden="true" className="absolute -bottom-24 -left-20 size-72 rounded-full bg-sky-500/10 blur-3xl"/>
          <div className="relative flex items-center gap-3">
            <HmsMark className="size-12 rounded-2xl bg-[#fff9e7] text-black ring-0"/>
            <div><p className="text-base font-bold tracking-wide">HMS</p><p className="mt-0.5 text-[11px] text-slate-400">Hospital Management</p></div>
          </div>

          <div className="relative max-w-sm py-12">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">
              <span className="size-1.5 rounded-full bg-emerald-400"/> Secure staff access
            </div>
            <h1 className="text-4xl font-semibold leading-[1.12] tracking-[-0.045em] lg:text-[42px]">Better care starts with a connected team.</h1>
            <p className="mt-5 max-w-xs text-sm leading-6 text-slate-400">One workspace for patient records, clinical services, wards, inventory, and billing.</p>
            <div className="mt-9 flex items-center gap-3 border-t border-white/10 pt-6">
              <span className="grid size-10 place-items-center rounded-xl bg-white/[0.07] text-slate-200"><HeartPulse size={19}/></span>
              <div><p className="text-xs font-semibold text-slate-200">Hospital operations</p><p className="mt-1 text-[11px] text-slate-500">Simple. Organized. Secure.</p></div>
            </div>
          </div>
          <div className="relative flex items-center justify-between border-t border-white/10 pt-4 text-[10px] text-slate-500">
            <span>Designed for hospital teams</span><span>© HMS</span>
          </div>
        </aside>

        <section className="flex min-w-0 flex-col justify-center px-6 py-8 sm:px-10 sm:py-10 lg:px-16">
          <div className="mb-9 flex items-center justify-between md:hidden">
            <div className="flex items-center gap-3"><HmsMark className="size-11"/><div><p className="text-sm font-bold">HMS</p><p className="text-[11px] text-slate-500">Hospital Management</p></div></div>
            <span className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500"><ShieldCheck size={14}/> Secure access</span>
          </div>

          <div className="mx-auto w-full max-w-[390px]">
            <div className="mb-7 hidden size-11 place-items-center rounded-2xl bg-slate-100 text-slate-800 ring-1 ring-slate-200 md:grid"><LockKeyhole size={20}/></div>
            <p className="text-[11px] font-bold uppercase tracking-[0.17em] text-sky-700">Staff portal</p>
            <h2 className="mt-2 text-[30px] font-bold tracking-[-0.045em] text-slate-950 sm:text-[34px]">Welcome back</h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">Sign in with the staff account issued by your HMS administrator.</p>

            {!configured && <p role="alert" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs leading-5 text-amber-900">Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.</p>}
            {message && <p role="alert" className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs leading-5 text-rose-700">{message}</p>}

            <form onSubmit={submit} className="mt-7 space-y-5">
              <label className="block text-xs font-semibold text-slate-700">Email address
                <input autoComplete="username" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@hospital.com" className="mt-2.5 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-sky-500 focus:ring-4 focus:ring-sky-100"/>
              </label>
              <label className="block text-xs font-semibold text-slate-700">Password
                <span className="relative mt-2.5 block">
                  <input autoComplete="current-password" type={showPassword ? "text" : "password"} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 pr-12 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-sky-500 focus:ring-4 focus:ring-sky-100"/>
                  <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-xl text-slate-400 transition hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500">{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button>
                </span>
              </label>
              <Button type="submit" disabled={!configured || submitting} className="mt-2 h-12 w-full rounded-xl bg-[#17191d] text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? "Signing in…" : <>Sign in securely <ArrowRight size={16}/></>}</Button>
            </form>

            <div className="mt-6 flex items-start gap-2.5 rounded-xl bg-slate-50 p-3.5 text-[11px] leading-5 text-slate-500 ring-1 ring-slate-100">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-slate-600"/>
              <p>Access is limited to active staff accounts. If you need access, contact your HMS administrator.</p>
            </div>
            <div className="mt-7 flex items-center justify-between border-t border-slate-200 pt-5 text-[10px] text-slate-400">
              <span className="inline-flex items-center gap-1.5"><Activity size={13}/> Protected staff access</span>
              <Link to="/" className="font-semibold text-slate-600 transition hover:text-sky-700">Return to workspace</Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
