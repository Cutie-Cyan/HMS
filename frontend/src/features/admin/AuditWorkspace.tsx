import { useQuery } from "@tanstack/react-query";
import { RefreshCw, ScrollText } from "lucide-react";
import { getSupabaseClient } from "../../lib/supabase";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";

type AuditRow = { id: number; actor_name: string; actor_email: string | null; action: string; entity_type: string; entity_id: string | null; details: Record<string, unknown>; created_at: string };
const when = (value: string) => new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila" });
export function AuditWorkspace() {
  const logs = useQuery({
    queryKey: ["admin", "audit-log"],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc("admin_audit_log", { p_limit: 150 });
      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
  });
  return <div className="mx-auto max-w-6xl space-y-5">
    <header className="flex justify-end"><Button variant="secondary" onClick={() => void logs.refetch()} disabled={logs.isFetching}><RefreshCw size={15}/> Refresh</Button></header>
    <Card className="min-w-0"><CardHeader><div className="flex items-center gap-2 font-semibold"><ScrollText size={18} className="text-teal-700"/> Audit log <Badge>{logs.data?.length ?? 0}</Badge></div><p className="text-sm text-muted-foreground">See who made a change, when it happened, and what they did.</p></CardHeader><CardContent className="min-w-0">
      {logs.isLoading ? <p className="py-8 text-sm text-muted-foreground">Loading audit events…</p> : logs.isError ? <div className="py-8 text-center"><p role="alert" className="text-sm text-rose-700">Could not load audit events. Confirm the latest database migration is applied and retry.</p><Button variant="secondary" className="mt-3" onClick={() => void logs.refetch()}>Retry</Button></div> : logs.data?.length ? <div className="max-h-[560px] min-w-0 space-y-2 overflow-y-auto overscroll-contain pr-2">{logs.data.map((entry) => <article key={entry.id} className="min-w-0 rounded-xl border border-border p-3 sm:p-4"><div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"><div className="min-w-0"><p className="break-words text-sm font-semibold">{entry.actor_name || "Unknown staff"} <span className="font-normal text-muted-foreground">· {entry.action.replaceAll(".", " ").replaceAll("_", " ")}</span></p><p className="mt-1 text-xs text-muted-foreground">{when(entry.created_at)}{entry.actor_email ? ` · ${entry.actor_email}` : ""}</p><p className="mt-2 break-words text-sm text-foreground">Changed: {entry.entity_type.replaceAll("_", " ")}{entry.entity_id ? ` · Reference ${entry.entity_id.slice(0, 8)}` : ""}</p></div><Badge tone="info">{entry.action.split(".").pop()?.replaceAll("_", " ") ?? "Activity"}</Badge></div></article>)}</div> : <div className="py-10 text-center"><ScrollText className="mx-auto text-slate-300" size={28}/><p className="mt-3 font-medium">No audit events yet</p><p className="mt-1 text-sm text-muted-foreground">Important system actions will appear here as they occur.</p></div>}
    </CardContent></Card>
  </div>;
}
