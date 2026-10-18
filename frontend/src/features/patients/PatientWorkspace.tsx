import { useState, type FormEvent } from "react";
import { CheckCircle2, Pencil, RefreshCw, Search, X } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { humanizeError, usePatientDirectory, useUpdatePatientDetails, type PatientRecord } from "./data";

const fieldClass = "mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10";

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
  const canEdit = profile?.role === "info_officer";
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<PatientRecord | null>(null);
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const patients = usePatientDirectory(search);
  const updatePatient = useUpdatePatientDetails();

  const openEditor = (patient: PatientRecord) => {
    setEditing(patient);
    setDateOfBirth(patient.date_of_birth ?? "");
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
      await updatePatient.mutateAsync({ patientId: editing.patient_id, dateOfBirth, phone, address });
      setMessage(`Patient ${editing.patient_number} updated. Age is calculated automatically from date of birth.`);
      setEditing(null);
    } catch (cause) {
      setError(humanizeError(cause));
    }
  };

  return <div className="mx-auto max-w-6xl space-y-5 pb-8">
    {(message || error) && <div role={error ? "alert" : "status"} className={`rounded-xl border p-3 text-sm ${error ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{error || message}</div>}
    <Card><CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex-1"><label className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-slate-400 shadow-sm transition focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-100 sm:max-w-xl"><Search size={17} className="shrink-0"/><input aria-label="Search patients" placeholder="Search by patient number or name…" value={search} onChange={e=>setSearch(e.target.value)} className="min-w-0 w-full border-0 bg-transparent text-sm text-slate-800 outline-none ring-0 placeholder:text-slate-400 focus:outline-none focus:ring-0"/></label></div><div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={()=>void patients.refetch()} disabled={patients.isFetching} aria-label="Refresh patient records"><RefreshCw size={15}/></Button></div></div></CardHeader><CardContent>
      {patients.isLoading?<p className="py-8 text-center text-sm text-slate-500">Loading patient records…</p>:patients.isError?<div className="py-6 text-center"><p role="alert" className="text-sm text-rose-700">Could not load patient records. Check your access and try again.</p><Button className="mt-3" onClick={()=>void patients.refetch()}>Retry</Button></div>:patients.data?.length?<div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th className="py-3 pr-4">Patient</th><th className="py-3 pr-4">Age</th><th className="py-3 pr-4">Sex</th><th className="py-3 pr-4">Status</th><th className="py-3 pr-4">Patient number</th>{canEdit&&<th className="py-3">Action</th>}</tr></thead><tbody className="divide-y divide-slate-100">{patients.data.map(p=><tr key={p.patient_id} className="transition-colors hover:bg-slate-50/80"><td className="py-3 pr-4 font-medium text-slate-900">{p.first_name} {p.middle_name?p.middle_name+" ":""}{p.last_name}</td><td className="py-3 pr-4">{ageLabel(p.date_of_birth)}</td><td className="py-3 pr-4 capitalize">{p.sex}</td><td className="py-3 pr-4"><Badge tone={p.status==="registered"?"info":"neutral"}>{p.status.replaceAll("_"," ")}</Badge></td><td className="py-3 pr-4 font-mono text-xs">{p.patient_number}</td>{canEdit&&<td className="py-3"><Button variant="secondary" size="sm" onClick={()=>openEditor(p)}><Pencil size={14}/> Edit</Button></td>}</tr>)}</tbody></table></div>:<div className="py-10 text-center"><CheckCircle2 className="mx-auto text-slate-300" size={30}/><p className="mt-3 font-medium">No patient records found</p><p className="mt-1 text-sm text-slate-500">{search?"No patient matched that search. Try the patient number or check the spelling.":"Registered patients will appear here."}</p></div>}
    </CardContent></Card>

    {editing&&<div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget&&!updatePatient.isPending)setEditing(null);}}><section role="dialog" aria-modal="true" aria-labelledby="edit-patient-title" className="my-auto w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"><div className="mb-5 flex items-start justify-between gap-3"><div><h2 id="edit-patient-title" className="text-lg font-semibold">Edit patient details</h2><p className="mt-1 text-sm text-slate-500">{editing.patient_number} · {editing.first_name} {editing.last_name}</p></div><button type="button" aria-label="Close edit patient dialog" onClick={()=>setEditing(null)} disabled={updatePatient.isPending} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18}/></button></div><form onSubmit={savePatient} className="space-y-4"><label className="block text-sm font-medium text-slate-700">Date of birth<input required type="date" max={new Date().toISOString().slice(0,10)} value={dateOfBirth} onChange={event=>setDateOfBirth(event.target.value)} className={fieldClass}/><span className="mt-1 block text-xs font-normal text-slate-500">Age is calculated from this date and is not stored separately.</span></label><label className="block text-sm font-medium text-slate-700">Contact number<input type="tel" maxLength={40} value={phone} onChange={event=>setPhone(event.target.value)} className={fieldClass} placeholder="Patient phone number (optional)"/></label><label className="block text-sm font-medium text-slate-700">Address<textarea rows={3} maxLength={500} value={address} onChange={event=>setAddress(event.target.value)} className={fieldClass} placeholder="Patient address (optional)"/></label><div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="secondary" onClick={()=>setEditing(null)} disabled={updatePatient.isPending}>Cancel</Button><Button type="submit" disabled={updatePatient.isPending||!dateOfBirth}>{updatePatient.isPending?"Saving…":"Save changes"}</Button></div></form></section></div>}
  </div>;
}
