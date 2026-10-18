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
    <Card><CardHeader><div className="flex items-center gap-2 font-semibold"><ScrollText size={18} className="text-teal-700"/> Recent events <Badge>{logs.data?.length ?? 0}</Badge></div></CardHeader><CardContent>
      {logs.isLoading ? <p className="py-8 text-sm text-muted-foreground">Loading audit events…</p> : logs.isError ? <div className="py-8 text-center"><p role="alert" className="text-sm text-rose-700">Could not load audit events. Confirm the latest database migration is applied and retry.</p><Button variant="secondary" className="mt-3" onClick={() => void logs.refetch()}>Retry</Button></div> : logs.data?.length ? <div className="space-y-3">{logs.data.map((entry) => <article key={entry.id} className="rounded-xl border border-border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="font-medium">{entry.action.replaceAll(".", " · ")}</p><p className="mt-1 text-xs text-muted-foreground">{entry.actor_name}{entry.actor_email ? ` · ${entry.actor_email}` : ""} · {when(entry.created_at)}</p></div><Badge tone="info">{entry.entity_type}</Badge></div><p className="mt-2 break-all text-xs text-muted-foreground">Record: {entry.entity_id ?? "—"}</p><details className="mt-3"><summary className="cursor-pointer text-xs font-medium text-teal-800">Event details</summary><pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-muted p-3 text-xs">{JSON.stringify(entry.details, null, 2)}</pre></details></article>)}</div> : <div className="py-10 text-center"><ScrollText className="mx-auto text-slate-300" size={28}/><p className="mt-3 font-medium">No audit events yet</p><p className="mt-1 text-sm text-muted-foreground">Important system actions will appear here as they occur.</p></div>}
    </CardContent></Card>
  </div>;
}
