import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, ScrollText, Users } from "lucide-react";
import { getSupabaseClient } from "../../lib/supabase";
import { Card, CardContent } from "../../components/ui/Card";
import { ListEmpty, ListError, ListToolbar, Metric, MetricDivider, MetricStrip, RefreshButton, SearchField, TableSkeleton, ToolbarActions } from "../../components/ui/ListTable";
import { rowClass, tbodyClass, theadClass, thClass, thFirstClass } from "../../components/ui/listTableStyles";

type AuditRow = { id: number; actor_name: string; actor_email: string | null; action: string; entity_type: string; entity_id: string | null; details: Record<string, unknown>; created_at: string };
const when = (value: string) => new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila" });
const readable = (value: string) => value.replaceAll(".", " ").replaceAll("_", " ");

export function AuditWorkspace() {
  const [search, setSearch] = useState("");
  const logs = useQuery({
    queryKey: ["admin", "audit-log"],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc("admin_audit_log", { p_limit: 150 });
      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
  });
  const entries = logs.data ?? [];
  const term = search.trim().toLowerCase();
  const visible = term ? entries.filter((entry) => `${entry.actor_name} ${readable(entry.action)} ${readable(entry.entity_type)}`.toLowerCase().includes(term)) : entries;
  return <div className="mx-auto max-w-[1440px] space-y-3 pb-5">
    <Card><CardContent className="px-4 pb-4 pt-6 sm:px-5 sm:pb-5 sm:pt-7">
      <ListToolbar>
        <SearchField label="Search audit log" placeholder="Search by staff, action or record…" value={search} onChange={setSearch} />
        <ToolbarActions>
          <MetricStrip>
            <Metric icon={<Activity size={16} className="text-sky-700"/>} label="Events" value={logs.isLoading ? "—" : entries.length} />
            <MetricDivider />
            <Metric icon={<Users size={16} className="text-emerald-700"/>} label="Staff members" value={logs.isLoading ? "—" : new Set(entries.map((entry) => entry.actor_email ?? entry.actor_name)).size} />
          </MetricStrip>
          <RefreshButton label="Refresh audit log" onClick={() => void logs.refetch()} spinning={logs.isFetching} />
        </ToolbarActions>
      </ListToolbar>
      {logs.isLoading ? <TableSkeleton label="Loading audit log" /> : logs.isError ? <ListError message="Could not load audit log." onRetry={() => void logs.refetch()} /> : visible.length ? <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-[13px]"><thead className={theadClass}><tr><th className={thFirstClass}>Staff member</th><th className={thClass}>Action</th><th className={thClass}>Record</th><th className="py-3.5 pr-2 text-base font-bold">Date and time</th></tr></thead><tbody className={tbodyClass}>{visible.map((entry) => <tr key={entry.id} className={rowClass}><td className="py-3 pr-4 pl-2 font-medium text-slate-900">{entry.actor_name || "Unknown staff"}</td><td className="py-3 pr-4 capitalize">{readable(entry.action)}</td><td className="py-3 pr-4 capitalize">{readable(entry.entity_type)}</td><td className="whitespace-nowrap py-3 pr-2 text-slate-500">{when(entry.created_at)}</td></tr>)}</tbody></table></div> : <ListEmpty icon={<ScrollText className="mx-auto text-slate-300" size={30}/>} title={term ? "No audit events found" : "No audit events yet"} hint={term ? "Try a different name, action or record." : "Important system actions will appear here as they occur."} />}
    </CardContent></Card>
  </div>;
}
