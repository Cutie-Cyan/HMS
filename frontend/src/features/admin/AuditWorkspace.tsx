import { useQuery } from "@tanstack/react-query";
import { RefreshCw, ScrollText } from "lucide-react";
import { getSupabaseClient } from "../../lib/supabase";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";

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
    <section className="min-w-0"><div className="mb-4"><div className="flex items-center gap-2 font-semibold"><ScrollText size={18} className="text-teal-700"/> Audit log <Badge>{logs.data?.length ?? 0}</Badge></div><p className="text-sm text-muted-foreground">See who made a change, what changed, where, and when.</p></div><div className="min-w-0">
      {logs.isLoading ? <p className="py-8 text-sm text-muted-foreground">Loading audit events…</p> : logs.isError ? <div className="py-8 text-center"><p role="alert" className="text-sm text-rose-700">Could not load audit events. Confirm the latest database migration is applied and retry.</p><Button variant="secondary" className="mt-3" onClick={() => void logs.refetch()}>Retry</Button></div> : logs.data?.length ? <div className="max-h-[560px] min-w-0 overflow-auto overscroll-contain"><table className="w-full min-w-[720px] border-collapse text-left text-sm"><thead className="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Staff member</th><th className="px-4 py-3 font-medium">Action performed</th><th className="px-4 py-3 font-medium">Affected record</th><th className="px-4 py-3 font-medium">Date and time</th></tr></thead><tbody>{logs.data.map((entry) => <tr key={entry.id} className="align-top hover:bg-muted/40"><td className="px-4 py-3"><p className="font-medium">{entry.actor_name || "Unknown staff"}</p><p className="mt-1 text-xs text-muted-foreground">{entry.actor_email || "Staff account"}</p></td><td className="px-4 py-3"><p className="font-medium capitalize">{entry.action.replaceAll(".", " ").replaceAll("_", " ")}</p><p className="mt-1 text-xs text-muted-foreground">{entry.action.split(".").pop()?.replaceAll("_", " ") ?? "Activity"}</p></td><td className="px-4 py-3"><p className="capitalize">{entry.entity_type.replaceAll("_", " ")}</p>{entry.entity_id && <p className="mt-1 text-xs text-muted-foreground">Ref. {entry.entity_id.slice(0, 8)}</p>}</td><td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{when(entry.created_at)}</td></tr>)}</tbody></table></div> : <div className="py-10 text-center"><ScrollText className="mx-auto text-slate-300" size={28}/><p className="mt-3 font-medium">No audit events yet</p><p className="mt-1 text-sm text-muted-foreground">Important system actions will appear here as they occur.</p></div>}
    </div></section>
  </div>;
}
