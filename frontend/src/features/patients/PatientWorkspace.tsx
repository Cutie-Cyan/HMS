import { useState } from "react";
import { CheckCircle2, RefreshCw, Search } from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { usePatientDirectory } from "./data";

function ageLabel(date: string | null) {
  if (!date) return "—";
  const birth = new Date(date);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
  return `${age} yrs`;
}

export function PatientWorkspace() {
  const [search, setSearch] = useState("");
  const patients = usePatientDirectory(search);

  return <div className="mx-auto max-w-6xl space-y-6 pb-8">
    <div><h1 className="text-2xl font-semibold tracking-tight text-slate-900">Patient Records</h1><p className="mt-1 text-sm text-slate-500">Search registered patient records by patient number or name.</p></div>
    <Card><CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">Patient directory</h2><p className="mt-1 text-sm text-slate-500">Search by patient number or patient name.</p></div><div className="flex flex-wrap gap-2"><label className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-400 focus-within:border-sky-400"><Search size={16}/><input aria-label="Search patients" placeholder="Search patients…" value={search} onChange={e=>setSearch(e.target.value)} className="min-w-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 sm:w-56"/></label><Button variant="secondary" onClick={()=>void patients.refetch()} disabled={patients.isFetching} aria-label="Refresh patient records"><RefreshCw size={15}/></Button></div></div></CardHeader><CardContent>
      {patients.isLoading?<p className="py-8 text-center text-sm text-slate-500">Loading patient records…</p>:patients.isError?<div className="py-6 text-center"><p role="alert" className="text-sm text-rose-700">Could not load patient records. Check your access and try again.</p><Button className="mt-3" onClick={()=>void patients.refetch()}>Retry</Button></div>:patients.data?.length?<div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th className="py-3 pr-4">Patient</th><th className="py-3 pr-4">Age</th><th className="py-3 pr-4">Sex</th><th className="py-3 pr-4">Status</th><th className="py-3">Patient number</th></tr></thead><tbody className="divide-y divide-slate-100">{patients.data.map(p=><tr key={p.patient_id} className="transition-colors hover:bg-slate-50/80"><td className="py-3 pr-4 font-medium text-slate-900">{p.first_name} {p.middle_name?p.middle_name+" ":""}{p.last_name}</td><td className="py-3 pr-4">{ageLabel(p.date_of_birth)}</td><td className="py-3 pr-4 capitalize">{p.sex}</td><td className="py-3 pr-4"><Badge tone={p.status==="registered"?"info":"neutral"}>{p.status.replaceAll("_"," ")}</Badge></td><td className="py-3 font-mono text-xs">{p.patient_number}</td></tr>)}</tbody></table></div>:<div className="py-10 text-center"><CheckCircle2 className="mx-auto text-slate-300" size={30}/><p className="mt-3 font-medium">No patient records found</p><p className="mt-1 text-sm text-slate-500">{search?"No patient matched that search. Try the patient number or check the spelling.":"Registered patients will appear here."}</p></div>}
    </CardContent></Card>
  </div>;
}
