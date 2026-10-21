import { useState, type FormEvent } from "react";
import { AlertCircle, ClipboardList, CreditCard, Send } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { useOpenEncounters, usePatientDirectory } from "../patients/data";
import { requestError, useCreateRequest, usePayRequest, useRequestableItems, useRequestWorkspace, type RequestType } from "./data";

const fieldClass = "mt-1.5 min-h-11 w-full rounded-xl border border-[#dedee4] bg-white px-3 text-sm outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10";
const money = (value: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(Number(value ?? 0));
const statusTone = (status: string) => status === "released" || status === "completed" ? "success" as const : status === "paid" || status === "in_progress" ? "info" as const : status === "pending_payment" ? "warning" as const : "neutral" as const;

export function RequestsWorkspace({ mode = "requests" }: { mode?: "requests" | "billing" | "cbc" }) {
  const { profile } = useAuth();
  const role = profile?.role;
  const canCreate = (mode === "requests" || mode === "cbc") && (role === "emergency_nurse" || role === "nurse_station");
  const isCashier = role === "cashier";
  const patients = usePatientDirectory("", canCreate);
  const encounters = useOpenEncounters(canCreate);
  const create = useCreateRequest();
  const requestQueue = useRequestWorkspace();
  const payRequest = usePayRequest();
  const [patientId, setPatientId] = useState("");
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const [type, setType] = useState<RequestType>(mode === "cbc" ? "lab" : "medicine");
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const items = useRequestableItems(type, canCreate);
  const isCBCItem = (item: { item_code: string; item_name: string }) => item.item_code.toLowerCase().includes("cbc") || item.item_name.toLowerCase().includes("cbc") || item.item_name.toLowerCase().includes("complete blood count");
  const displayedItems = mode === "cbc"
    ? (items.data ?? []).filter(isCBCItem)
    : type === "lab"
      ? (items.data ?? []).filter((item) => !isCBCItem(item))
      : (items.data ?? []);
  const selectedItem = displayedItems.find((item) => item.id === itemId);
  const patientEncounter = (encounters.data ?? []).find((encounter) => encounter.patient_id === patientId && encounter.encounter_status === "open");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!patientEncounter) {
      setError("This patient has no open encounter. Create or open a consultation before submitting a request.");
      return;
    }
    try {
      if (mode === "cbc" && type !== "lab") throw new Error("CBC must be submitted as a laboratory request.");
      await create.mutateAsync({ patientId, encounterId: patientEncounter.encounter_id, type, itemId, quantity: Number(quantity) });
      setMessage("Request created and sent to Cashier for payment.");
      setItemId("");
      setQuantity("1");
    } catch (cause) {
      setError(requestError(cause));
    }
  };

  const recordPayment = async (requestId: string, patientName: string) => {
    setError("");
    setMessage("");
    if (!window.confirm(`Record payment for this request for ${patientName}?`)) return;
    try {
      await payRequest.mutateAsync(requestId);
      setMessage("Request payment recorded. The department can now fulfill the request.");
    } catch (cause) {
      setError(requestError(cause));
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      {(message || error) && <div role={error ? "alert" : "status"} className={`rounded-xl border p-3 text-sm ${error ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{error || message}</div>}
      {canCreate && <Card>
        <CardHeader>
          <div className="flex items-center gap-2 font-semibold"><Send size={18} className="text-sky-700" /> {mode === "cbc" ? "Request CBC test" : "Create request"}</div>
        </CardHeader>
        <CardContent>
          {patients.isError || encounters.isError ? <p role="alert" className="text-sm text-rose-700">Patient or consultation records could not be loaded. Refresh and try again.</p> : <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">Patient
              <select required value={patientId} onChange={(event) => setPatientId(event.target.value)} className={fieldClass}>
                <option value="" disabled>Select patient</option>
                {(patients.data ?? []).filter((patient) => patient.status !== "discharged").map((patient) => <option key={patient.patient_id} value={patient.patient_id}>{patient.first_name} {patient.last_name} — {patient.patient_number}</option>)}
              </select>
              {patientId && <span role="status" className={`mt-2 block rounded-lg border px-3 py-2 text-sm ${patientEncounter ? "border-sky-200 bg-sky-50 font-medium text-sky-800" : "border-amber-300 bg-amber-50 font-semibold text-amber-900"}`}>{patientEncounter ? "Open consultation linked" : "No open consultation — create or open a consultation before submitting a request."}</span>}
            </label>
{mode !== "cbc" && <label className="text-sm font-medium text-slate-700">Request type
              <select value={type} onChange={(event) => { setType(event.target.value as RequestType); setItemId(""); }} className={fieldClass}>
                <option value="medicine">Medicine · Pharmacy</option><option value="lab">Laboratory · Lab</option>
              </select>
            </label>}
            {mode === "cbc" && <div className="text-sm font-medium text-slate-700">Test type<div className="mt-1.5 flex min-h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-3">CBC · Complete Blood Count</div></div>}
            <label className="text-sm font-medium text-slate-700">{type === "lab" ? "Diagnostic test / service" : "Medicine"}
              <select required value={itemId} onChange={(event) => setItemId(event.target.value)} className={fieldClass}>
                <option value="">Select item</option>
                {displayedItems.map((item) => <option key={item.id} value={item.id} disabled={item.quantity_on_hand < 1}>{type === "lab" ? `${item.item_name} · test fee ${money(Number(item.unit_price))}` : `${item.item_name} · ${money(Number(item.unit_price))}/${item.unit} · stock ${item.quantity_on_hand}`}</option>)}
              </select>
              {selectedItem && <span className="mt-1 block text-xs text-slate-500">{type === "lab" ? "Diagnostic service fee is set by the laboratory catalog." : `Available: ${selectedItem.quantity_on_hand} ${selectedItem.unit}(s). Price is set from the database.`}</span>}
            </label>
            <label className="text-sm font-medium text-slate-700">{type === "lab" ? "Number of tests" : "Quantity"}
              <input required type="number" min="1" max={selectedItem?.quantity_on_hand ?? undefined} step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} className={fieldClass} />
            </label>
            {items.isError && <p role="alert" className="text-sm text-rose-700 md:col-span-2">Could not load department items. Check inventory setup and retry.</p>}
            {!items.isLoading && !items.isError && displayedItems.length === 0 && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 md:col-span-2">{mode === "cbc" ? "CBC is not configured in Lab inventory yet. Ask Lab staff to add the CBC Test (Complete Blood Count) item first." : `No active ${type === "medicine" ? "medicine" : "laboratory"} items are available here. CBC requests use the dedicated CBC sidebar; ask the department to configure other items if needed.`}</p>}
            <div className="flex justify-end md:col-span-2"><Button type="submit" disabled={create.isPending || patients.isLoading || encounters.isLoading || items.isLoading || !patientId || !patientEncounter || !itemId || Number(quantity) < 1 || Number(quantity) > Number(selectedItem?.quantity_on_hand ?? 0)}>{create.isPending ? "Creating request…" : "Send to Cashier"}</Button></div>
          </form>}
        </CardContent>
      </Card>}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 font-semibold"><ClipboardList size={18} className="text-sky-700" /> {mode === "cbc" ? "CBC request status" : isCashier ? "Requests awaiting payment" : "Request status"}</div>
        </CardHeader>
        <CardContent>
          {requestQueue.isLoading ? <p className="py-6 text-sm text-slate-500">Loading requests…</p> : requestQueue.isError ? <div className="py-6"><p role="alert" className="text-sm text-rose-700">Could not load requests.</p><Button className="mt-3" variant="secondary" onClick={() => void requestQueue.refetch()}>Retry</Button></div> : (requestQueue.data ?? []).filter((request) => (mode !== "cbc" || (request.request_type === "lab" && request.items.some((item) => item.description.toLowerCase().includes("cbc") || item.description.toLowerCase().includes("complete blood count")))) && (!isCashier || request.status === "pending_payment")).length ? <div className="space-y-3">
            {(requestQueue.data ?? []).filter((request) => (mode !== "cbc" || (request.request_type === "lab" && request.items.some((item) => item.description.toLowerCase().includes("cbc") || item.description.toLowerCase().includes("complete blood count")))) && (!isCashier || request.status === "pending_payment")).map((request) => {
              const expanded = expandedRequestId === request.request_id;
              return <article key={request.request_id} className="overflow-hidden rounded-xl border border-slate-200">
                <button type="button" aria-expanded={expanded} onClick={() => setExpandedRequestId(expanded ? null : request.request_id)} className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left transition hover:bg-slate-50">
                  <span className="min-w-0"><span className="block font-semibold text-slate-900">{request.patient_name}</span><span className="mt-1 block text-xs text-slate-500">{request.patient_number} · {request.ward_name ?? "Emergency / outpatient"}</span></span>
                  <span className="flex items-center gap-3"><Badge tone={statusTone(request.status)}>{request.status.replaceAll("_", " ")}</Badge><span className="text-xs text-slate-400">{expanded ? "−" : "+"}</span></span>
                </button>
                {expanded && <div className="border-t border-slate-100 p-4">
                  <p className="text-sm capitalize text-slate-600">{request.request_type === "lab" ? "Laboratory" : "Medicine"} request</p>
                  <div className="mt-3 space-y-2">{request.items.map((item) => <div key={item.id} className="flex flex-wrap justify-between gap-3 text-sm"><span>{item.description} × {item.quantity}</span><span>{money(Number(item.unit_price) * item.quantity)}</span></div>)}</div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3"><p className="text-sm font-semibold">Total {money(Number(request.total))}{request.bill_paid ? " · Paid" : ""}</p>{isCashier && request.status === "pending_payment" && <Button disabled={payRequest.isPending} onClick={() => void recordPayment(request.request_id, request.patient_name)}><CreditCard size={16}/>{payRequest.isPending ? "Recording…" : "Record payment"}</Button>}</div>
                  {request.lab_result && <div className="mt-3 rounded-lg bg-sky-50 p-3"><p className="text-xs font-semibold text-sky-800">Laboratory result</p><p className="mt-1 whitespace-pre-wrap text-sm text-sky-950">{request.lab_result}</p></div>}
                </div>}
              </article>;
            })}
          </div> : <div className="py-8 text-center"><AlertCircle className="mx-auto text-slate-300" size={26}/><p className="mt-2 font-medium">{mode === "cbc" ? "No CBC requests yet" : isCashier ? "No requests awaiting payment" : "No requests yet"}</p><p className="mt-1 text-sm text-slate-500">{mode === "cbc" ? "CBC requests created for patients will appear here." : isCashier ? "New medicine and laboratory requests will appear here." : "Requests created for this encounter will appear here."}</p></div>}
        </CardContent>
      </Card>
    </div>
  );
}
