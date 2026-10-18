import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("HMS application render error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="grid min-h-screen place-items-center bg-[#f3f5f8] p-6">
          <section role="alert" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto grid size-12 place-items-center rounded-xl bg-rose-50 text-rose-600"><AlertTriangle size={24} /></div>
            <h1 className="mt-5 text-xl font-bold tracking-tight text-slate-950">HMS encountered an error</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">An unexpected interface error occurred. Reload the application to try again.</p>
            <button type="button" onClick={() => window.location.reload()} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"><RefreshCw size={16}/> Reload application</button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
