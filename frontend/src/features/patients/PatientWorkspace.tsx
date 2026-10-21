import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, BedDouble, CheckCircle2, FileText, Pencil, Printer, RefreshCw, Search, Users, X } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { getSupabaseClient } from "../../lib/supabase";
import { Button } from "../../components/ui/Button";
import { Card, CardContent } from "../../components/ui/Card";
import { humanizeError, usePatientDirectory, usePatientHistory, useUpdatePatientDetails, type PatientRecord } from "./data";

const fieldClass = "mt-1.5 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/10";

function patientStatus(status: string) {
  const normalized = status.toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
  if (["registered", "outpatient", "out_patient", "out_patients"].includes(normalized)) return { label: "Out patients", className: "bg-sky-50 text-sky-700 ring-sky-200" };
  if (["admitted", "inpatient", "in_patient"].includes(normalized)) return { label: "Admitted", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
  if (["emergency", "emergency_room", "in_emergency", "in_emergency_room", "er"].includes(normalized)) return { label: "In Emergency Room", className: "bg-red-50 text-red-700 ring-red-200" };
  if (["discharged", "discharge"].includes(normalized)) return { label: "Discharge", className: "bg-slate-100 text-slate-600 ring-slate-200" };
  return { label: status.replaceAll("_", " "), className: "bg-slate-100 text-slate-600 ring-slate-200" };
}
function ageLabel(date: string | null) {
  if (!date) return "—";
  const birth = new Date(date);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
  return `${age} yrs`;
}

export function PatientWorkspace() {
  const { profile } = useAuth();

    let cancelled = false;
    let channel: ReturnType<typeof client.channel> | undefined;

    void client.realtime.setAuth().then(() => {
      if (cancelled) return;
      channel = client
        .channel("hms:patient-records", { config: { private: true } })
        .on("broadcast", { event: "patient_registered" }, () => {
          void queryClient.invalidateQueries({ queryKey: ["patients", "directory"] });
        })
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) void client.removeChannel(channel);
    };
  const canEdit = profile?.role === "info_officer";
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<PatientRecord | null>(null);
  const [historyPatient, setHistoryPatient] = useState<PatientRecord | null>(null);
  const [viewPatient, setViewPatient] = useState<PatientRecord | null>(null);
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const patients = usePatientDirectory(search);
  const patientSummary = usePatientDirectory("");
  const summaryPatients = patientSummary.data ?? [];
  const admittedCount = summaryPatients.filter((p) => ["admitted", "inpatient", "in_patient"].includes(p.status.toLowerCase().replaceAll("-", "_").replaceAll(" ", "_"))).length;
  const emergencyCount = summaryPatients.filter((p) => ["emergency", "emergency_room", "in_emergency_room", "er"].includes(p.status.toLowerCase().replaceAll("-", "_").replaceAll(" ", "_"))).length;
  const history = usePatientHistory(historyPatient?.patient_id ?? null, canEdit && Boolean(historyPatient));
  const updatePatient = useUpdatePatientDetails();
  const patientLocation = useQuery({
    queryKey: ["patients", "location", viewPatient?.patient_id],
    enabled: canEdit && Boolean(viewPatient?.patient_id),
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc("info_officer_patient_location", { p_patient_id: viewPatient!.patient_id });
      if (error) throw error;
      return (data ?? [])[0] as { ward_name: string | null; room_code: string | null; bed_code: string | null } | undefined;
    },
  });

  const openEditor = (patient: PatientRecord) => {
    setEditing(patient);
    setPhone(patient.phone ?? "");
    setAddress(patient.address ?? "");
    setError("");
    setMessage("");
  };

  const savePatient = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    setError("");
    setMessage("");
    try {
      await updatePatient.mutateAsync({ patientId: editing.patient_id, dateOfBirth: editing.date_of_birth ?? "", phone, address });
      setMessage(`Patient ${editing.patient_number} updated.`);
      setEditing(null);
    } catch (cause) {
      setError(humanizeError(cause));
    }
  };

  return <div className="mx-auto max-w-[1440px] space-y-3 pb-5">
    {(message || error) && <div role={error ? "alert" : "status"} className={`hms-toast-auto fixed right-4 top-4 z-[120] flex max-w-[min(22rem,calc(100vw-2rem))] items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold shadow-xl ring-1 ring-black/10 ${error ? "bg-rose-700 text-white" : "bg-slate-900 text-white"}`} aria-label={error || message} title={error || message}><span className="min-w-0 truncate">{error ? "Error" : "Saved"}</span><button type="button" onClick={() => { setError(""); setMessage(""); }} className="grid size-5 shrink-0 place-items-center rounded hover:bg-white/15" aria-label="Dismiss notification" title="Dismiss">×</button></div>}
    <Card><CardContent className="px-4 pb-4 pt-6 sm:px-5 sm:pb-5 sm:pt-7"><div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"><label className="flex min-h-10 w-full min-w-0 items-center gap-2 rounded-lg bg-white px-3 text-slate-500 transition focus-within:outline-none focus-within:ring-0 xl:max-w-md"><Search size={17} className="shrink-0"/><input aria-label="Search patients" placeholder="Search by patient number or name…" value={search} onChange={e=>setSearch(e.target.value)} className="min-w-0 w-full border-0 bg-transparent text-sm text-slate-800 outline-none ring-0 shadow-none placeholder:text-slate-400 focus:!border-0 focus:!outline-none focus:!ring-0 focus:!shadow-none focus-visible:!outline-none focus-visible:!ring-0 focus-visible:!shadow-none"/></label><div className="flex shrink-0 flex-wrap items-center justify-start gap-3 xl:justify-end"><div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"><div className="flex items-center gap-2"><Users size={16} className="text-sky-700"/><span className="text-xs text-slate-500">Total</span><span className="text-sm font-semibold tabular-nums text-slate-900">{patientSummary.isLoading ? "—" : summaryPatients.length}</span></div><span className="hidden h-5 w-px bg-slate-200 sm:block"/><div className="flex items-center gap-2"><BedDouble size={16} className="text-emerald-700"/><span className="text-xs text-slate-500">Admitted</span><span className="text-sm font-semibold tabular-nums text-slate-900">{patientSummary.isLoading ? "—" : admittedCount}</span></div><span className="hidden h-5 w-px bg-slate-200 sm:block"/><div className="flex items-center gap-2"><Activity size={16} className="text-red-600"/><span className="text-xs text-slate-500">Emergency</span><span className="text-sm font-semibold tabular-nums text-red-700">{patientSummary.isLoading ? "—" : emergencyCount}</span></div></div><Button variant="secondary" className="!size-9 !min-h-9 !shrink-0 !p-0" onClick={()=>void patients.refetch()} disabled={patients.isFetching} aria-label="Refresh patient records" title="Refresh"><RefreshCw size={15} className={patients.isFetching ? "animate-spin" : ""}/></Button></div></div>
      {patients.isLoading?<div className="flex min-h-56 items-center justify-center py-8" role="status" aria-label="Loading patient records"><div className="w-full max-w-5xl animate-pulse space-y-5"><div className="grid grid-cols-3 gap-4 sm:grid-cols-6">{[0,1,2,3,4,5].map(cell=><div key={cell} className={cell>2?"hidden h-4 rounded bg-slate-200 sm:block":"h-4 rounded bg-slate-200"}/>)}</div>{[0,1,2,3,4,5].map(row=><div key={row} className="grid grid-cols-3 items-center gap-4 border-b border-slate-100 pb-4 sm:grid-cols-6">{[0,1,2,3,4,5].map(cell=><div key={cell} className={cell>2?"hidden h-5 rounded-md bg-slate-100 sm:block":"h-5 rounded-md bg-slate-100"}/>)}</div>)}</div></div>:patients.isError?<div className="py-6 text-center"><p role="alert" className="text-sm text-rose-700">Failed to load patient records.</p><div className="mt-3 flex justify-center"><Button type="button" variant="secondary" size="sm" onClick={()=>void patients.refetch()}>Retry</Button></div></div>:patients.data?.length?<div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-[13px]"><thead className="border-y-0 bg-transparent text-lg font-bold uppercase tracking-wider text-slate-800 [&_th]:border-y-0"><tr><th className="py-3.5 pr-4 pl-2 text-base font-bold">Patient</th><th className="py-3.5 pr-4 text-base font-bold">Age</th><th className="py-3.5 pr-4 text-base font-bold">Sex</th><th className="py-3.5 pr-4 text-base font-bold">Status</th><th className="py-3.5 pr-4 text-base font-bold">Patient number</th><th className="py-3.5 pr-2 text-base font-bold">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{patients.data.map(p=><tr key={p.patient_id} tabIndex={0} role="button" aria-label={`View ${p.first_name} ${p.last_name}`} onClick={()=>setViewPatient(p)} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();setViewPatient(p);}}} className="cursor-pointer transition-colors hover:bg-slate-50 focus-visible:bg-sky-50"><td className="py-3 pr-4 font-medium text-slate-900">{p.first_name} {p.middle_name?p.middle_name+" ":""}{p.last_name}</td><td className="py-3 pr-4">{ageLabel(p.date_of_birth)}</td><td className="py-3 pr-4 capitalize">{p.sex}</td><td className="py-3 pr-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${patientStatus(p.status).className}`}>{patientStatus(p.status).label}</span></td><td className="py-3 pr-4 font-mono text-xs">{p.patient_number}</td><td className="py-3"><div className="flex flex-wrap gap-2" onClick={event=>event.stopPropagation()}>{canEdit&&<><Button variant="secondary" size="sm" onClick={()=>setHistoryPatient(p)}><FileText size={14}/> History</Button><Button variant="secondary" size="sm" onClick={()=>openEditor(p)}><Pencil size={14}/> Edit</Button></>}</div></td></tr>)}</tbody></table></div>:<div className="py-10 text-center"><CheckCircle2 className="mx-auto text-slate-300" size={30}/><p className="mt-3 font-medium">No patient records found</p><p className="mt-1 text-sm text-slate-500">{search?"No patient matched that search. Try the patient number or check the spelling.":"Registered patients will appear here."}</p></div>}
    </CardContent></Card>

    {viewPatient&&<div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setViewPatient(null);}}><section role="dialog" aria-modal="true" aria-labelledby="patient-details-title" className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"><div className="mb-5 flex items-start justify-between gap-3"><div><h2 id="patient-details-title" className="text-lg font-semibold">Patient details</h2><p className="mt-1 text-sm text-slate-500">{viewPatient.patient_number}</p></div><button type="button" aria-label="Close patient details" onClick={()=>setViewPatient(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18}/></button></div><dl className="grid gap-4 sm:grid-cols-2">{[["Full name", [viewPatient.first_name,viewPatient.middle_name,viewPatient.last_name].filter(Boolean).join(" ")],["Patient number",viewPatient.patient_number],["Date of birth",viewPatient.date_of_birth||"—"],["Age",ageLabel(viewPatient.date_of_birth)],["Sex",viewPatient.sex],["Phone",viewPatient.phone||"—"],["Address",viewPatient.address||"—"],["PWD / Senior",viewPatient.pwd_or_senior?"Reported — verify eligibility":"No"],["Record status",viewPatient.status.replaceAll("_"," ")],["Current ward",patientLocation.isLoading?"Loading…":patientLocation.data?.ward_name||viewPatient.current_ward_name||"Not assigned"],["Room",patientLocation.isLoading?"Loading…":patientLocation.data?.room_code||"Not assigned"],["Bed",patientLocation.isLoading?"Loading…":patientLocation.data?.bed_code||"Not assigned"],["Registered on",new Date(viewPatient.created_at).toLocaleString()]].map(([label,value])=><div key={label}><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-slate-900">{value}</dd></div>)}</dl><div className="mt-6 flex flex-wrap justify-end gap-2">{canEdit&&<><Button variant="secondary" onClick={()=>{setViewPatient(null);setHistoryPatient(viewPatient);}}><FileText size={14}/> Medical history</Button><Button onClick={()=>{openEditor(viewPatient);setViewPatient(null);}}><Pencil size={14}/> Edit details</Button></>}</div></section></div>}
    {historyPatient&&<div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setHistoryPatient(null);}}><section role="dialog" aria-modal="true" aria-labelledby="patient-history-title" className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"><div className="mb-5 flex items-start justify-between gap-3"><div><h2 id="patient-history-title" className="text-lg font-semibold">Patient history</h2><p className="mt-1 text-sm text-slate-500">{historyPatient.patient_number} · {historyPatient.first_name} {historyPatient.middle_name ? historyPatient.middle_name+" " : ""}{historyPatient.last_name}</p></div><button type="button" aria-label="Close patient history" onClick={()=>setHistoryPatient(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18}/></button></div><div className="mb-4 flex justify-end"><Button type="button" onClick={()=>window.print()} disabled={history.isLoading||history.isError}><Printer size={15}/> Print history</Button></div>{history.isLoading?<p className="py-8 text-center text-sm text-slate-500">Loading patient history…</p>:history.isError?<div role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">Could not load patient history. Close this window and try again.</div>:history.data?.length?<div className="space-y-3">{history.data.map(item=><article key={item.encounter_id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold">{item.doctor_name || "Doctor not recorded"}</h3><p className="mt-1 text-xs text-slate-500">{new Date(item.created_at).toLocaleString()} · {item.encounter_status.replaceAll("_"," ")}</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs capitalize">{item.recommendation_type || "No recommendation type"}</span></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Findings</p><p className="mt-1 whitespace-pre-wrap text-sm">{item.findings || "No findings recorded."}</p></div><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recommendations</p><p className="mt-1 whitespace-pre-wrap text-sm">{item.recommendations || "No recommendations recorded."}</p></div></div><p className="mt-3 text-xs text-slate-500">Admitted: {item.admitted_at ? new Date(item.admitted_at).toLocaleString() : "—"} · Discharged: {item.discharged_at ? new Date(item.discharged_at).toLocaleString() : "—"}</p></article>)}</div>:<div className="rounded-xl border border-dashed border-slate-300 p-8 text-center"><FileText className="mx-auto text-slate-400" size={28}/><p className="mt-2 font-medium">No encounter history found</p><p className="mt-1 text-sm text-slate-500">Previous consultations will appear here when they exist.</p></div>}</section></div>}
    {historyPatient&&<div className="print-sheet print-active"><div className="border-b-2 border-slate-900 pb-4 text-center"><p className="text-xs font-semibold uppercase tracking-widest">Hospital Management System</p><h2 className="mt-2 text-2xl font-bold">Patient History</h2></div><div className="mt-4 grid grid-cols-2 gap-3 border-b border-slate-300 pb-4 text-sm"><p><strong>Patient:</strong> {historyPatient.first_name} {historyPatient.middle_name ? historyPatient.middle_name+" " : ""}{historyPatient.last_name}</p><p><strong>Patient number:</strong> {historyPatient.patient_number}</p><p><strong>Date of birth:</strong> {historyPatient.date_of_birth || "—"}</p><p><strong>Sex:</strong> {historyPatient.sex}</p></div><div className="mt-4 space-y-4">{(history.data ?? []).map(item=><section key={item.encounter_id} className="border-b border-slate-300 pb-4"><h3 className="font-bold">{item.doctor_name || "Doctor not recorded"} — {new Date(item.created_at).toLocaleString()}</h3><p className="mt-1 text-xs">Status: {item.encounter_status.replaceAll("_"," ")} · Type: {item.recommendation_type || "—"}</p><p className="mt-2 text-sm"><strong>Findings:</strong> {item.findings || "None recorded"}</p><p className="mt-1 text-sm"><strong>Recommendations:</strong> {item.recommendations || "None recorded"}</p><p className="mt-1 text-xs">Admitted: {item.admitted_at ? new Date(item.admitted_at).toLocaleString() : "—"} · Discharged: {item.discharged_at ? new Date(item.discharged_at).toLocaleString() : "—"}</p></section>)}</div></div>}
    {editing&&<div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget&&!updatePatient.isPending)setEditing(null);}}><section role="dialog" aria-modal="true" aria-labelledby="edit-patient-title" className="my-auto w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"><div className="mb-5 flex items-start justify-between gap-3"><div><h2 id="edit-patient-title" className="text-lg font-semibold">Edit patient details</h2><p className="mt-1 text-sm text-slate-500">{editing.patient_number} · {editing.first_name} {editing.last_name}</p></div><button type="button" aria-label="Close edit patient dialog" onClick={()=>setEditing(null)} disabled={updatePatient.isPending} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18}/></button></div><form onSubmit={savePatient} className="space-y-4"><label className="block text-sm font-medium text-slate-700">Contact number<input type="tel" maxLength={40} value={phone} onChange={event=>setPhone(event.target.value)} className={fieldClass} placeholder="Patient phone number (optional)"/></label><label className="block text-sm font-medium text-slate-700">Address<textarea rows={3} maxLength={500} value={address} onChange={event=>setAddress(event.target.value)} className={fieldClass} placeholder="Patient address (optional)"/></label><div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="secondary" onClick={()=>setEditing(null)} disabled={updatePatient.isPending}>Cancel</Button><Button type="submit" disabled={updatePatient.isPending}>{updatePatient.isPending?"Saving…":"Save changes"}</Button></div></form></section></div>}
  </div>;
}
