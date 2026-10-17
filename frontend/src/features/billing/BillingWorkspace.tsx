import { useState } from "react";
import { Banknote, CheckCircle2, ClipboardCheck, RefreshCw, ShieldAlert } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthProvider";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { getSupabaseClient } from "../../lib/supabase";
import { requestError } from "../requests/data";

type BillingRow = {
  encounter_id: string; patient_id: string; patient_number: string; patient_name: string;
  ward_name: string | null; bed_code: string | null; bed_type: "public" | "private" | null;
  admitted_at: string | null; lodging_days: number; lodging_amount: number; doctor_name: string | null;
  doctor_fee: number; pwd_or_senior: boolean; requests_cleared: boolean; final_bill_id: string | null;
  subtotal: number; philhealth_discount: number; pwd_senior_discount: number; total_bill: number; paid_at: string | null;
};
const money = (v: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(Number(v ?? 0));

function useBillingQueue() {
  const client = useQueryClient();
  const queue = useQuery({
    queryKey: ["billing", "final-queue"],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc("staff_final_billing_queue");
      if (error) throw error;
      return (data ?? []) as BillingRow[];
    },
  });
  const prepare = useMutation({
    mutationFn: async (v: { encounterId: string; philhealth: boolean }) => {
      const { data, error } = await getSupabaseClient().rpc("cashier_prepare_final_bill", {
        p_encounter_id: v.encounterId, p_use_philhealth: v.philhealth,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["billing"] }),
  });
  const pay = useMutation({
    mutationFn: async (billId: string) => {
      const { error } = await getSupabaseClient().rpc("cashier_pay_final_bill", { p_bill_id: billId });
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["billing"] }),
  });
  const discharge = useMutation({
    mutationFn: async (encounterId: string) => {
      const { error } = await getSupabaseClient().rpc("nurse_station_discharge_patient", { p_encounter_id: encounterId });
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["billing"] }),
        client.invalidateQueries({ queryKey: ["wards"] }),
        client.invalidateQueries({ queryKey: ["encounters"] }),
        client.invalidateQueries({ queryKey: ["patients"] }),
      ]);
    },
  });
  return { queue, prepare, pay, discharge };
}

export function BillingWorkspace() {
  const { profile } = useAuth();
  const role = profile?.role ?? "";
  const { queue, prepare, pay, discharge } = useBillingQueue();
  const [philhealthByEncounter, setPhilhealthByEncounter] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const busy = prepare.isPending || pay.isPending || discharge.isPending;
  const act = async (operation: () => Promise<unknown>, success: string) => {
    setError(""); setMessage("");
    try { await operation(); setMessage(success); }
    catch (cause) { setError(requestError(cause)); }
  };
  const isCashier = role === "cashier";
  return <div className="mx-auto max-w-6xl space-y-6">
    <header>
      <p className="text-sm font-medium text-teal-700">Financial closeout</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">{isCashier ? "Final billing" : "Discharge queue"}</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
        {isCashier
          ? "Final inpatient charges are calculated in the database from admission time, ward rates, doctor fee, and eligible discounts. Request charges are paid separately."
          : "Discharge is available only after the final bill is paid and every medicine/lab request is fulfilled or cancelled and paid."}
      </p>
    </header>
    {(message || error) && <div role={error ? "alert" : "status"} className={`rounded-lg p-3 text-sm ${error ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-800"}`}>{error || message}</div>}
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-semibold"><Banknote size={18} className="text-teal-700" /> Inpatient closeout</div>
          <Button variant="secondary" onClick={() => void queue.refetch()} disabled={queue.isFetching}><RefreshCw size={15} /> Refresh</Button>
        </div>
        <p className="mt-1 text-sm text-slate-500">Room rates use rolling 24-hour blocks. A partial block is charged as one day.</p>
      </CardHeader>
      <CardContent>
        {queue.isLoading ? <p className="py-8 text-sm text-slate-500">Loading closeout queue…</p>
          : queue.isError ? <div className="py-8 text-center"><ShieldAlert className="mx-auto text-rose-500" size={25} /><p role="alert" className="mt-2 text-sm text-rose-700">Could not load the closeout queue.</p><Button className="mt-3" variant="secondary" onClick={() => void queue.refetch()}>Retry</Button></div>
          : queue.data?.length ? <div className="space-y-4">{queue.data.map(row => {
            const canPrepare = isCashier && row.requests_cleared && !row.final_bill_id;
            const canPay = isCashier && row.final_bill_id && !row.paid_at;
            const canDischarge = role === "nurse_station" && !!row.paid_at;
            return <article key={row.encounter_id} className="rounded-xl border border-slate-200 p-4 md:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h2 className="font-semibold">{row.patient_name}</h2><p className="mt-1 text-xs text-slate-500">{row.patient_number} · {row.ward_name ?? "Ward unavailable"} · {row.bed_code ?? "No bed"}</p><p className="mt-1 text-xs text-slate-500">{row.admitted_at ? `Admitted ${new Date(row.admitted_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}` : "Not admitted"}</p></div>
                <Badge tone={row.paid_at ? "success" : row.final_bill_id ? "warning" : row.requests_cleared ? "neutral" : "warning"}>{row.paid_at ? "Final bill paid" : row.final_bill_id ? "Payment pending" : row.requests_cleared ? "Ready for final bill" : "Requests not cleared"}</Badge>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Room charge · {row.lodging_days} day(s)</p><p className="mt-1 font-semibold">{money(Number(row.lodging_amount))}</p></div>
                <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Doctor · {row.doctor_name ?? "Not assigned"}</p><p className="mt-1 font-semibold">{money(Number(row.doctor_fee))}</p></div>
                <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">PhilHealth discount</p><p className="mt-1 font-semibold">−{money(Number(row.philhealth_discount))}</p></div>
                <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">PWD/Senior discount</p><p className="mt-1 font-semibold">−{money(Number(row.pwd_senior_discount))}</p></div>
              </div>
              {row.pwd_or_senior && <p className="mt-3 text-xs text-teal-800">Patient is marked PWD/Senior; eligible discount is applied during final bill preparation.</p>}
              {!row.requests_cleared && <p className="mt-3 text-sm text-amber-800">Clear all requests first: each must be released or cancelled, and every request bill must be paid.</p>}
              {row.final_bill_id && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-teal-100 bg-teal-50/50 p-3"><div><p className="text-xs text-slate-500">Final bill total</p><p className="text-xl font-semibold">{money(Number(row.total_bill))}</p>{row.paid_at && <p className="mt-1 text-xs text-emerald-700">Paid {new Date(row.paid_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</p>}</div>
                {canPay && <Button disabled={busy} onClick={() => void act(() => pay.mutateAsync(row.final_bill_id!), "Final bill payment recorded.")}>Record payment</Button>}
                {canDischarge && <Button disabled={busy} onClick={() => { if (window.confirm(`Discharge ${row.patient_name}? The bed will be released.`)) void act(() => discharge.mutateAsync(row.encounter_id), "Patient discharged and bed released."); }}><ClipboardCheck size={16} /> Discharge patient</Button>}
                {row.paid_at && role !== "nurse_station" && <span className="inline-flex items-center gap-1 text-sm text-emerald-700"><CheckCircle2 size={16} /> Paid</span>}
              </div>}
              {canPrepare && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!philhealthByEncounter[row.encounter_id]} onChange={e => setPhilhealthByEncounter(current => ({ ...current, [row.encounter_id]: e.target.checked }))} /> Apply PhilHealth ₱2,000 admission benefit</label><Button disabled={busy} onClick={() => void act(() => prepare.mutateAsync({ encounterId: row.encounter_id, philhealth: !!philhealthByEncounter[row.encounter_id] }), "Final bill prepared. Review the total and record payment when ready.")}>Prepare final bill</Button></div>}
              {row.final_bill_id && !row.paid_at && !row.requests_cleared && <p className="mt-3 text-xs text-rose-700">Payment is blocked until all requests are cleared.</p>}
            </article>;
          })}</div>
          : <div className="py-10 text-center"><CheckCircle2 className="mx-auto text-slate-300" size={30} /><p className="mt-3 font-medium">No patients awaiting closeout</p><p className="mt-1 text-sm text-slate-500">Admitted encounters will appear here.</p></div>}
      </CardContent>
    </Card>
  </div>;
}
