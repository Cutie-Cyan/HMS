import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ClipboardList, ShieldCheck, UserRoundSearch } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { getSupabaseClient } from "../../lib/supabase";

type PortalBill = { patient_number: string; patient_name: string; encounter_id: string; encounter_status: string; bill_id: string | null; subtotal: number; discount_label: string; discount_amount: number; total_bill: number; paid_at: string | null; last_updated: string };
type PortalRecord = {
  patient_number: string; first_name: string; middle_name: string | null;
  last_name: string; date_of_birth: string; sex: string; status: string;
  created_at: string; last_visit_at: string | null;
};
const fieldClass = "mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm outline-none focus:border-teal-600";
export function PatientPortalPage() {
  const params = new URLSearchParams(window.location.search);
  const initialNumber = params.get("patientNumber") ?? "";
  const encounterId = params.get("encounterId");
  const [patientNumber, setPatientNumber] = useState(initialNumber);
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [record, setRecord] = useState<PortalRecord | null>(null);
  const [bill, setBill] = useState<PortalBill | null>(null);
  const [billError, setBillError] = useState("");
  const [billLoading, setBillLoading] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setRecord(null); setBill(null); setBillError("");
    try {
      const { data, error: rpcError } = await getSupabaseClient().rpc("public_patient_portal_lookup", {
        p_patient_number: patientNumber.trim().toUpperCase(), p_date_of_birth: dateOfBirth,
      });
      if (rpcError) throw rpcError;
      const rows = data as PortalRecord[] | null;
      if (!rows?.length) { setError("We could not verify those details. Check your patient number and date of birth, or ask the Information Officer for help."); return; }
      setRecord(rows[0]);
    } catch {
      setError("Patient lookup is temporarily unavailable. Please try again later or ask the Information Officer for help.");
    } finally { setBusy(false); }
  }

  useEffect(() => {
    if (!record || !encounterId || !dateOfBirth || !patientNumber.trim()) return;
    let active = true;
    const refreshBill = async () => {
      try {
        const { data, error: billRpcError } = await getSupabaseClient().rpc("public_patient_portal_bill_lookup", {
          p_patient_number: patientNumber.trim().toUpperCase(),
          p_date_of_birth: dateOfBirth,
          p_encounter_id: encounterId,
        });
        if (billRpcError) throw billRpcError;
        const rows = data as PortalBill[] | null;
        if (!active) return;
        setBill(rows?.[0] ?? null);
        setBillError(rows?.length ? "" : "No bill is available for this encounter yet. Please ask the cashier if you believe this is incorrect.");
      } catch {
        if (active) setBillError("Could not refresh your bill right now. The portal will try again automatically.");
      } finally {
        if (active) setBillLoading(false);
      }
    };
    setBillLoading(true);
    void refreshBill();
    const interval = window.setInterval(() => void refreshBill(), 15000);
    return () => { active = false; window.clearInterval(interval); };
  }, [record, encounterId, dateOfBirth, patientNumber]);

  const money = (value: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(Number(value ?? 0));

  return <main className="min-h-screen bg-slate-50 px-4 py-8 sm:py-12">
    <div className="mx-auto max-w-xl">
      <Link to="/patient-registration" className="mb-6 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"><ArrowLeft size={16}/> Patient registration</Link>
      <div className="mb-6 flex items-center gap-3"><div className="grid size-12 place-items-center rounded-2xl bg-teal-700 text-white"><ClipboardList size={24}/></div><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">HMS · Patient portal</p><h1 className="text-2xl font-semibold tracking-tight text-slate-900">Returning patient</h1></div></div>
      <p className="mb-6 text-sm leading-6 text-slate-600">Verify your identity with your patient number and date of birth. When you open this page from your billing QR code, the portal also shows only the bill for that QR code’s encounter. Your medical findings and test results are not shown here.</p>
      {!record ? <Card><CardHeader><h2 className="font-semibold">Find your patient record</h2><p className="mt-1 text-sm text-slate-500">Use the patient number on your hospital card and your date of birth.</p></CardHeader><CardContent><form onSubmit={lookup} className="space-y-4"><label className="block text-sm font-medium text-slate-700">Patient number<input required autoComplete="off" value={patientNumber} onChange={e=>setPatientNumber(e.target.value)} placeholder="HMS-YYYYMMDD-000001" className={fieldClass}/></label><label className="block text-sm font-medium text-slate-700">Date of birth<input required type="date" max={new Date().toISOString().slice(0,10)} value={dateOfBirth} onChange={e=>setDateOfBirth(e.target.value)} className={fieldClass}/></label>{error&&<p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}<div className="rounded-xl bg-sky-50 p-3 text-sm leading-5 text-sky-900"><ShieldCheck size={17} className="mr-2 inline"/>For your privacy, only your registration summary is available here.</div><Button type="submit" disabled={busy} className="w-full">{busy?"Checking record…":"View my record"}</Button></form></CardContent></Card> : <Card><CardHeader><div className="flex items-center gap-2"><UserRoundSearch className="text-teal-700"/><h2 className="font-semibold">Your registration record</h2></div></CardHeader><CardContent><dl className="grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Patient name</dt><dd className="mt-1 font-semibold text-slate-900">{record.first_name} {record.middle_name ? record.middle_name+" " : ""}{record.last_name}</dd></div><div><dt className="text-slate-500">Patient number</dt><dd className="mt-1 font-mono font-semibold text-slate-900">{record.patient_number}</dd></div><div><dt className="text-slate-500">Date of birth</dt><dd className="mt-1 text-slate-900">{record.date_of_birth}</dd></div><div><dt className="text-slate-500">Sex</dt><dd className="mt-1 capitalize text-slate-900">{record.sex}</dd></div><div><dt className="text-slate-500">Record status</dt><dd className="mt-1 capitalize text-slate-900">{record.status.replaceAll("_"," ")}</dd></div><div><dt className="text-slate-500">Registered on</dt><dd className="mt-1 text-slate-900">{new Date(record.created_at).toLocaleDateString()}</dd></div>{record.last_visit_at&&<div><dt className="text-slate-500">Most recent visit</dt><dd className="mt-1 text-slate-900">{new Date(record.last_visit_at).toLocaleDateString()}</dd></div>}</dl><p className="mt-5 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">For updates, clinical records, or assistance, please contact the hospital Information Officer in person.</p><Button variant="secondary" className="mt-4 w-full" onClick={()=>setRecord(null)}>Check another record</Button></CardContent></Card>}
      {record && encounterId && (
        <Card className="mt-5">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div><h2 className="font-semibold">Live billing statement</h2><p className="mt-1 text-sm text-slate-500">Automatically refreshes every 15 seconds while this page is open.</p></div>
              <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">Live</span>
            </div>
          </CardHeader>
          <CardContent>
            {billLoading && !bill ? <p className="text-sm text-slate-500">Loading your bill…</p> : bill ? (
              <>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div><dt className="text-sm text-slate-500">Encounter status</dt><dd className="mt-1 font-medium capitalize">{bill.encounter_status.replaceAll("_", " ")}</dd></div>
                  <div><dt className="text-sm text-slate-500">Payment status</dt><dd className="mt-1 font-semibold">{bill.paid_at ? "Paid" : bill.bill_id ? "Payment pending" : "Bill not yet prepared"}</dd></div>
                  <div><dt className="text-sm text-slate-500">Subtotal</dt><dd className="mt-1 font-medium">{money(Number(bill.subtotal))}</dd></div>
                  <div><dt className="text-sm text-slate-500">Discount ({bill.discount_label.replaceAll("_", " ")})</dt><dd className="mt-1 font-medium text-emerald-700">−{money(Number(bill.discount_amount))}</dd></div>
                </dl>
                <div className="mt-5 rounded-xl bg-teal-50 p-4"><p className="text-sm text-teal-900">Current bill total</p><p className="mt-1 text-2xl font-bold text-teal-950">{money(Number(bill.total_bill))}</p></div>
                {bill.paid_at && <p className="mt-3 text-sm text-emerald-700">Payment recorded {new Date(bill.paid_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}.</p>}
                <p className="mt-3 text-xs text-slate-500">Last updated: {new Date(bill.last_updated).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}. This is a billing summary, not an official receipt.</p>
              </>
            ) : <p className="text-sm text-slate-600">No billing data is available for this encounter yet.</p>}
            {billError && <p role="status" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{billError}</p>}
          </CardContent>
        </Card>
      )}
      <p className="mt-5 text-center text-xs text-slate-500">HMS · Patient information is handled by the hospital system.</p>
    </div>
  </main>;
}
