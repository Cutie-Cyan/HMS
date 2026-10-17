import { useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle2, ClipboardList, RefreshCw, Send } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { useOpenEncounters, usePatientDirectory } from "../patients/data";
import { requestError, useCreateRequest, usePayRequest, useRequestWorkspace, useRequestableItems, type HmsRequest, type RequestType } from "./data";

const fieldClass = "mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100";
const money = (value: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(Number(value ?? 0));
const statusTone = (status: string) => status === "released" ? "success" as const : status === "pending_payment" ? "warning" as const : status === "paid" ? "info" as const : "neutral" as const;

function RequestCard({ request, canPay, onPay, paying }: { request: HmsRequest; canPay: boolean; onPay: (request: HmsRequest) => void; paying: boolean }) {
  return <article className="rounded-xl border border-slate-200 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><p className="font-semibold">{request.patient_name}</p><p className="mt-1 text-xs text-slate-500">{request.patient_number} · {request.ward_name ?? "Emergency / outpatient"} · {new Date(request.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</p></div>
      <Badge tone={statusTone(request.status)}>{request.status.replaceAll("_", " ")}</Badge>
    </div>
    <div className="mt-3 space-y-2">{request.items.map(item => <div key={item.id} className="flex items-start justify-between gap-3 text-sm"><div><p>{item.description}</p><p className="text-xs text-slate-500">Qty {item.quantity} × {money(Number(item.unit_price))}</p></div><p className="font-medium">{money(Number(item.unit_price) * item.quantity)}</p></div>)}</div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3"><div><p className="text-xs text-slate-500">Request amount</p><p className="font-semibold">{money(Number(request.total))}</p>{request.request_type === "lab" && request.lab_result && <p className="mt-1 text-sm text-teal-800">Lab result: {request.lab_result}</p>}</div>
      {canPay && request.status === "pending_payment" && <Button disabled={paying} onClick={() => onPay(request)}>{paying ? "Recording…" : "Record payment"}</Button>}
    </div>
  </article>;
}

export function RequestsWorkspace({ mode = "requests" }: { mode?: "requests" | "billing" }) {
  const { profile } = useAuth();
  const role = profile?.role;
  const canCreate = mode === "requests" && (role === "emergency_nurse" || role === "nurse_station");
  const canPay = role === "cashier";
  const patients = usePatientDirectory();
  const encounters = useOpenEncounters();
  const requests = useRequestWorkspace();
  const create = useCreateRequest();
  const pay = usePayRequest();
  const [patientId, setPatientId] = useState("");
  const [encounterId, setEncounterId] = useState("");
  const [type, setType] = useState<RequestType>("medicine");
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const items = useRequestableItems(type);
  const patientEncounters = (encounters.data ?? []).filter(e => e.patient_id === patientId && e.encounter_status === "open");
  const selectedItem = (items.data ?? []).find(item => item.id === itemId);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(""); setMessage("");
    try {
      const id = await create.mutateAsync({ patientId, encounterId, type, itemId, quantity: Number(quantity) });
      setMessage("Request created and sent to Cashier for payment.");
      setItemId(""); setQuantity("1");
      await requests.refetch();
      void id;
    } catch (cause) { setError(requestError(cause)); }
  };
  const recordPayment = async (request: HmsRequest) => {
    if (!window.confirm(`Record payment of ${money(Number(request.total))} for ${request.patient_name}'s ${request.request_type} request? This sends it to the assigned department after payment.`)) return;
    setError(""); setMessage("");
    try { await pay.mutateAsync(request.request_id); setMessage("Payment recorded. The request is now available to its department."); }
    catch (cause) { setError(requestError(cause)); }
  };

  return <div className="mx-auto max-w-6xl space-y-6">
    <header><p className="text-sm font-medium text-teal-700">Clinical operations</p><h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">{mode === "billing" ? "Cashier billing" : "Requests"}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{mode === "billing" ? "Review request charges and record payment. A request cannot be released to Pharmacy or Lab until payment is recorded." : "Medicine and laboratory requests move through Cashier payment before department fulfillment. Stock and bill amounts are controlled by the database."}</p></header>
    {(message || error) && <div role={error ? "alert" : "status"} className={`rounded-lg p-3 text-sm ${error ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-800"}`}>{error || message}</div>}
    {canCreate && <Card><CardHeader><div className="flex items-center gap-2 font-semibold"><Send size={18} className="text-teal-700"/> Create request</div><p className="mt-1 text-sm text-slate-500">Select an open encounter and a real item from the correct department's inventory.</p></CardHeader><CardContent>
      {patients.isError || encounters.isError ? <p role="alert" className="text-sm text-rose-700">Patient or encounter records could not be loaded. Refresh and try again.</p> :
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">Patient<select required value={patientId} onChange={e=>{setPatientId(e.target.value);setEncounterId("");}} className={fieldClass}><option value="">Select patient</option>{(patients.data ?? []).filter(p=>p.status !== "discharged").map(p=><option key={p.patient_id} value={p.patient_id}>{`${p.first_name} ${p.last_name}`} — {p.patient_number}</option>)}</select></label>
        <label className="text-sm font-medium text-slate-700">Open encounter<select required value={encounterId} onChange={e=>setEncounterId(e.target.value)} className={fieldClass}><option value="">Select encounter</option>{patientEncounters.map(e=><option key={e.encounter_id} value={e.encounter_id}>{e.doctor_name ? `Dr. ${e.doctor_name} · ` : ""}{new Date(e.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</option>)}</select></label>
        <label className="text-sm font-medium text-slate-700">Request type<select value={type} onChange={e=>{setType(e.target.value as RequestType);setItemId("");}} className={fieldClass}><option value="medicine">Medicine · Pharmacy</option><option value="lab">Laboratory · Lab</option></select></label>
        <label className="text-sm font-medium text-slate-700">Inventory item<select required value={itemId} onChange={e=>setItemId(e.target.value)} className={fieldClass}><option value="">Select item</option>{(items.data ?? []).map(item=><option key={item.id} value={item.id} disabled={item.quantity_on_hand < 1}>{item.item_name} · {money(Number(item.unit_price))}/{item.unit} · stock {item.quantity_on_hand}</option>)}</select>{selectedItem && <span className="mt-1 block text-xs text-slate-500">Available: {selectedItem.quantity_on_hand} {selectedItem.unit}(s). Price is set from the database.</span>}</label>
        <label className="text-sm font-medium text-slate-700">Quantity<input required type="number" min="1" max={selectedItem?.quantity_on_hand ?? undefined} step="1" value={quantity} onChange={e=>setQuantity(e.target.value)} className={fieldClass}/></label>
        {items.isError && <p role="alert" className="text-sm text-rose-700 md:col-span-2">Could not load department items. Check inventory setup and retry.</p>}
        {!items.isLoading && !items.isError && (items.data?.length ?? 0) === 0 && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 md:col-span-2">No active {type === "medicine" ? "medicine" : "laboratory"} inventory items exist yet. Ask the department to configure real stock first.</p>}
        <div className="md:col-span-2"><Button type="submit" disabled={create.isPending || patients.isLoading || encounters.isLoading || items.isLoading || !patientId || !encounterId || !itemId || Number(quantity)<1 || Number(quantity)>Number(selectedItem?.quantity_on_hand ?? 0)}>{create.isPending ? "Creating request…" : "Send to Cashier"}</Button></div>
      </form>}
    </CardContent></Card>}
    <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2 font-semibold"><ClipboardList size={18} className="text-teal-700"/> Request queue</div><p className="mt-1 text-sm text-slate-500">Requests appear here with their current payment and fulfillment status.</p></div><Button variant="secondary" onClick={()=>void requests.refetch()} disabled={requests.isFetching}><RefreshCw size={15}/> Refresh</Button></div></CardHeader><CardContent>
      {requests.isLoading ? <p className="py-8 text-center text-sm text-slate-500">Loading requests…</p> : requests.isError ? <div className="py-8 text-center"><AlertCircle className="mx-auto text-rose-500" size={24}/><p role="alert" className="mt-2 text-sm text-rose-700">Could not load the request queue.</p><Button className="mt-3" variant="secondary" onClick={()=>void requests.refetch()}>Retry</Button></div> : requests.data?.length ? <div className="space-y-3">{requests.data.map(request=><RequestCard key={request.request_id} request={request} canPay={canPay} onPay={recordPayment} paying={pay.isPending}/>)}</div> : <div className="py-10 text-center"><CheckCircle2 className="mx-auto text-slate-300" size={30}/><p className="mt-3 font-medium">No requests yet</p><p className="mt-1 text-sm text-slate-500">Requests will appear here after an authorized staff member creates one.</p></div>}
    </CardContent></Card>
  </div>;
}
