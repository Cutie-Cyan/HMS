import { Link } from "react-router-dom";

export function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-5">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 grid size-12 place-items-center rounded-xl bg-teal-700 font-bold text-white">H+</div>
        <p className="text-sm font-semibold text-teal-700">HMS staff portal</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Sign in to your workspace</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">Authentication will be connected to Supabase in the authentication step. Staff access will be granted from an assigned staff profile.</p>
        <div className="mt-6 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Sign-in is not enabled yet. No demo credentials are provided.</div>
        <Link to="/" className="mt-6 inline-flex text-sm font-semibold text-teal-700 hover:text-teal-900">Return to workspace →</Link>
      </section>
    </main>
  );
}
