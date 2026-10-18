import { useState, type FormEvent } from "react";
import { AlertCircle, Send } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { useOpenEncounters, usePatientDirectory } from "../patients/data";
import { requestError, useCreateRequest, useRequestableItems, type RequestType } from "./data";

const fieldClass = "mt-1.5 min-h-11 w-full rounded-xl border border-[#dedee4] bg-white px-3 text-sm outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10";
const money = (value: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(Number(value ?? 0));

export function RequestsWorkspace({ mode = "requests" }: { mode?: "requests" | "billing" }) {
  const { profile } = useAuth();
  const role = profile?.role;
  const canCreate = mode === "requests" && (role === "emergency_nurse" || role === "nurse_station");
  const patients = usePatientDirectory("", canCreate);
  const encounters = useOpenEncounters(canCreate);
  const create = useCreateRequest();
  const [patientId, setPatientId] = useState("");
  const [type, setType] = useState<RequestType>("medicine");
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const items = useRequestableItems(type);
  const selectedItem = (items.data ?? []).find((item) => item.id === itemId);
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
      await create.mutateAsync({ patientId, encounterId: patientEncounter.encounter_id, type, itemId, quantity: Number(quantity) });
      setMessage("Request created and sent to Cashier for payment.");
      setItemId("");
      setQuantity("1");
    } catch (cause) {
      setError(requestError(cause));
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      {(message || error) && <div role={error ? "alert" : "status"} className={`rounded-xl border p-3 text-sm ${error ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{error || message}</div>}
      {canCreate && <Card>
        <CardHeader>
          <div className="flex items-center gap-2 font-semibold"><Send size={18} className="text-sky-700" /> Create request</div>
          
        </CardHeader>
        <CardContent>
          {patients.isError || encounters.isError ? <p role="alert" className="text-sm text-rose-700">Patient or consultation records could not be loaded. Refresh and try again.</p> : <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">Patient
              <select required value={patientId} onChange={(event) => setPatientId(event.target.value)} className={fieldClass}>
                <option value="">Select patient</option>
                {(patients.data ?? []).filter((patient) => patient.status !== "discharged").map((patient) => <option key={patient.patient_id} value={patient.patient_id}>{patient.first_name} {patient.last_name} — {patient.patient_number}</option>)}
              </select>
              {patientId && <span className="mt-1 block text-xs text-slate-500">{patientEncounter ? "Open consultation linked automatically." : "No open consultation found for this patient."}</span>}
            </label>
            <label className="text-sm font-medium text-slate-700">Request type
              <select value={type} onChange={(event) => { setType(event.target.value as RequestType); setItemId(""); }} className={fieldClass}>
                <option value="medicine">Medicine · Pharmacy</option><option value="lab">Laboratory · Lab</option>
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">Inventory item
              <select required value={itemId} onChange={(event) => setItemId(event.target.value)} className={fieldClass}>
                <option value="">Select item</option>
                {(items.data ?? []).map((item) => <option key={item.id} value={item.id} disabled={item.quantity_on_hand < 1}>{item.item_name} · {money(Number(item.unit_price))}/{item.unit} · stock {item.quantity_on_hand}</option>)}
              </select>
              {selectedItem && <span className="mt-1 block text-xs text-slate-500">Available: {selectedItem.quantity_on_hand} {selectedItem.unit}(s). Price is set from the database.</span>}
            </label>
            <label className="text-sm font-medium text-slate-700">Quantity
              <input required type="number" min="1" max={selectedItem?.quantity_on_hand ?? undefined} step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} className={fieldClass} />
            </label>
            {items.isError && <p role="alert" className="text-sm text-rose-700 md:col-span-2">Could not load department items. Check inventory setup and retry.</p>}
            {!items.isLoading && !items.isError && (items.data?.length ?? 0) === 0 && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 md:col-span-2">No active {type === "medicine" ? "medicine" : "laboratory"} inventory items exist yet. Ask the department to configure stock first.</p>}
            <div className="md:col-span-2"><Button type="submit" disabled={create.isPending || patients.isLoading || encounters.isLoading || items.isLoading || !patientId || !patientEncounter || !itemId || Number(quantity) < 1 || Number(quantity) > Number(selectedItem?.quantity_on_hand ?? 0)}>{create.isPending ? "Creating request…" : "Send to Cashier"}</Button></div>
          </form>}
        </CardContent>
      </Card>}
      {!canCreate && <Card><CardContent><div className="flex items-start gap-3 py-4"><AlertCircle size={20} className="mt-0.5 text-slate-500" /><div><p className="font-medium">Request creation is limited to clinical staff.</p><p className="mt-1 text-sm text-slate-500">Use your assigned department workspace to process requests and payments.</p></div></div></CardContent></Card>}
    </div>
  );
}
