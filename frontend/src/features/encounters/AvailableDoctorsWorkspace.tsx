import { useMemo, useState, type FormEvent } from "react";
import { Activity, Pencil, Plus, RefreshCw, Search, Stethoscope, UserRound, X } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { humanizeError, useDoctors, useSaveDoctor, type DoctorRecord } from "../patients/data";

const money = (value: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(Number(value ?? 0));
const fieldClass = "mt-1.5 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/10";

export function AvailableDoctorsWorkspace() {
  const { profile } = useAuth();
  const canManage = profile?.role === "admin";
  const doctors = useDoctors();
  const saveDoctor = useSaveDoctor();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<DoctorRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [isOnDuty, setIsOnDuty] = useState(true);
  const [fixedFee, setFixedFee] = useState("0");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const orderedDoctors = useMemo(
    () => [...(doctors.data ?? [])].sort((a, b) => Number(b.is_on_duty) - Number(a.is_on_duty) || a.full_name.localeCompare(b.full_name)),
    [doctors.data],
  );
  const availableCount = orderedDoctors.filter((doctor) => doctor.is_on_duty).length;
  const filteredDoctors = orderedDoctors.filter((doctor) => `${doctor.full_name} ${doctor.specialty ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()));

  const openForm = (doctor?: DoctorRecord) => {
    setEditing(doctor ?? null);
    setFullName(doctor?.full_name ?? "");
    setSpecialty(doctor?.specialty ?? "");
    setIsOnDuty(doctor?.is_on_duty ?? true);
    setFixedFee(String(doctor?.fixed_fee ?? 0));
    setError("");
    setMessage("");
    setFormOpen(true);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await saveDoctor.mutateAsync({ fullName, specialty, isOnDuty, fixedFee: Number(fixedFee), doctorId: editing?.id });
      setMessage(editing ? "Doctor record updated." : "Doctor record added.");
      setFormOpen(false);
      await doctors.refetch();
    } catch (cause) {
      setError(humanizeError(cause));
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {(message || error) && <div role={error ? "alert" : "status"} className={`hms-toast rounded-xl border p-3 text-sm shadow-xl ${error ? "border-rose-200 bg-white text-rose-800" : "border-emerald-200 bg-white text-emerald-800"}`}>{error || message}</div>}


      {doctors.isError && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          Could not load doctor availability. Refresh to try again.
        </div>
      )}

      <Card>
        <CardHeader><div className="flex flex-wrap items-center justify-between gap-4">
          <label className="flex min-h-10 w-full items-center gap-3 rounded-xl border border-transparent bg-transparent px-1 text-slate-400 focus-within:ring-0 sm:max-w-md"><Search size={17}/><input aria-label="Search doctors" placeholder="Search by doctor or specialty…" value={search} onChange={event=>setSearch(event.target.value)} className="min-w-0 w-full bg-transparent text-sm text-slate-800 outline-none ring-0 focus:outline-none focus:ring-0 placeholder:text-slate-400"/></label>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="flex h-10 items-center divide-x divide-slate-200 rounded-xl border border-slate-200 bg-slate-50/70">
              <div className="flex items-center gap-2 px-3 text-sm text-slate-600"><Activity size={16} className="text-emerald-700"/><span>On duty</span><strong className="font-semibold text-slate-900">{doctors.isLoading ? "—" : availableCount}</strong></div>
              <div className="flex items-center gap-2 px-3 text-sm text-slate-600"><UserRound size={16} className="text-slate-600"/><span>Active doctors</span><strong className="font-semibold text-slate-900">{doctors.isLoading ? "—" : orderedDoctors.length}</strong></div>
            </div>
            {canManage && <Button type="button" onClick={() => openForm()}><Plus size={15}/> Add doctor</Button>}
            <Button type="button" variant="secondary" className="!size-9 !min-h-9 !p-0" aria-label="Refresh doctor list" title="Refresh" onClick={() => void doctors.refetch()} disabled={doctors.isFetching}><RefreshCw size={15} className={doctors.isFetching ? "animate-spin" : ""} /></Button>
          </div>
        </div></CardHeader>
        <CardContent>
          {doctors.isLoading ? <p className="py-8 text-center text-sm text-slate-500">Loading doctor availability…</p> : filteredDoctors.length === 0 ? <div className="py-10 text-center"><Stethoscope className="mx-auto mb-3 text-slate-400" size={28}/><p className="font-medium">{search ? "No doctors match your search" : "No active doctors found"}</p><p className="mt-1 text-sm text-slate-500">{canManage ? "Add a doctor record to make it available for patient consultations." : "Ask the administrator to add doctor records."}</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th className="py-3 pr-4">Doctor</th><th className="py-3 pr-4">Specialty</th><th className="py-3 pr-4">Consultation fee</th><th className="py-3 pr-4">Status</th>{canManage&&<th className="py-3">Action</th>}</tr></thead><tbody className="divide-y divide-slate-100">{filteredDoctors.map(doctor=><tr key={doctor.id} className="transition-colors hover:bg-slate-50"><td className="py-3 pr-4 font-medium text-slate-900">{doctor.full_name}</td><td className="py-3 pr-4 text-slate-600">{doctor.specialty||"General practice"}</td><td className="py-3 pr-4 tabular-nums">{money(doctor.fixed_fee)}</td><td className="py-3 pr-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${doctor.is_on_duty?"bg-emerald-50 text-emerald-700 ring-emerald-200":"bg-slate-100 text-slate-600 ring-slate-200"}`}>{doctor.is_on_duty?"On duty":"Off duty"}</span></td>{canManage&&<td className="py-3"><Button type="button" variant="secondary" size="sm" onClick={()=>openForm(doctor)}><Pencil size={14}/> Edit</Button></td>}</tr>)}</tbody></table></div>}
        </CardContent>
      </Card>

      {formOpen && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget&&!saveDoctor.isPending)setFormOpen(false);}}><section role="dialog" aria-modal="true" aria-labelledby="doctor-form-title" className="my-auto w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"><div className="mb-5 flex items-start justify-between gap-3"><div><h2 id="doctor-form-title" className="text-lg font-semibold">{editing ? "Edit doctor record" : "Add doctor record"}</h2></div><button type="button" aria-label="Close doctor form" onClick={()=>setFormOpen(false)} disabled={saveDoctor.isPending} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18}/></button></div><form onSubmit={submit} className="space-y-4"><label className="block text-sm font-medium text-slate-700">Doctor full name<input required maxLength={150} value={fullName} onChange={event=>setFullName(event.target.value)} className={fieldClass}/></label><label className="block text-sm font-medium text-slate-700">Specialty (optional)<input maxLength={120} value={specialty} onChange={event=>setSpecialty(event.target.value)} className={fieldClass}/></label><label className="block text-sm font-medium text-slate-700">Consultation fee (₱)<input required type="number" min="0" step="0.01" value={fixedFee} onChange={event=>setFixedFee(event.target.value)} className={fieldClass}/></label><label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm"><input type="checkbox" checked={isOnDuty} onChange={event=>setIsOnDuty(event.target.checked)} className="size-4 accent-sky-700"/> Doctor is currently on duty</label><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={()=>setFormOpen(false)} disabled={saveDoctor.isPending}>Cancel</Button><Button type="submit" disabled={saveDoctor.isPending||!fullName.trim()||!Number.isFinite(Number(fixedFee))||Number(fixedFee)<0}>{saveDoctor.isPending?"Saving…":editing?"Save changes":"Add doctor"}</Button></div></form></section></div>}
    </div>
  );
}
