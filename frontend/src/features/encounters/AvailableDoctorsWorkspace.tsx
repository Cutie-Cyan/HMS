import { useMemo, useState, type FormEvent } from "react";
import { Activity, Pencil, Plus, RefreshCw, Stethoscope, UserRound, X } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { Badge } from "../../components/ui/Badge";
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
      <div className="flex flex-wrap justify-end gap-2">
        {canManage && <Button type="button" onClick={() => openForm()}><Plus size={15}/> Add doctor</Button>}
        <Button type="button" variant="secondary" className="!size-9 !min-h-9 !p-0" aria-label="Refresh doctor list" title="Refresh" onClick={() => void doctors.refetch()} disabled={doctors.isFetching}>
          <RefreshCw size={15} className={doctors.isFetching ? "animate-spin" : ""} />
        </Button>
      </div>

      {doctors.isError && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          Could not load doctor availability. Refresh to try again.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card><CardContent><div className="flex items-center gap-3 p-1"><div className="grid size-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Activity size={20} /></div><div><p className="text-sm text-slate-500">On duty</p><p className="text-2xl font-semibold">{doctors.isLoading ? "—" : availableCount}</p></div></div></CardContent></Card>
        <Card><CardContent><div className="flex items-center gap-3 p-1"><div className="grid size-11 place-items-center rounded-xl bg-slate-100 text-slate-600"><UserRound size={20} /></div><div><p className="text-sm text-slate-500">Active doctors</p><p className="text-2xl font-semibold">{doctors.isLoading ? "—" : orderedDoctors.length}</p></div></div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><h3 className="font-semibold">Doctors</h3></CardHeader>
        <CardContent>
          {doctors.isLoading ? <p className="py-8 text-center text-sm text-slate-500">Loading doctor availability…</p> : orderedDoctors.length === 0 ? (
            <div className="py-10 text-center"><Stethoscope className="mx-auto mb-3 text-slate-400" size={28}/><p className="font-medium">No active doctors found</p><p className="mt-1 text-sm text-slate-500">{canManage ? "Add a doctor record to make it available for patient consultations." : "Ask the administrator to add doctor records."}</p></div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {orderedDoctors.map((doctor) => <article key={doctor.id} className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 items-start gap-3"><div className={`grid size-11 shrink-0 place-items-center rounded-full ${doctor.is_on_duty ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}><Stethoscope size={19}/></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h4 className="font-semibold text-slate-900">{doctor.full_name}</h4><Badge tone={doctor.is_on_duty ? "success" : "neutral"}>{doctor.is_on_duty ? "On duty" : "Off duty"}</Badge></div><p className="mt-1 text-sm text-slate-500">{doctor.specialty || "General practice"}</p><p className="mt-2 text-xs text-slate-500">Consultation fee: {money(doctor.fixed_fee)}</p></div></div>
                {canManage && <Button type="button" variant="secondary" size="sm" onClick={() => openForm(doctor)}><Pencil size={14}/> Edit</Button>}
              </article>)}
            </div>
          )}
        </CardContent>
      </Card>

      {formOpen && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget&&!saveDoctor.isPending)setFormOpen(false);}}><section role="dialog" aria-modal="true" aria-labelledby="doctor-form-title" className="my-auto w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"><div className="mb-5 flex items-start justify-between gap-3"><div><h2 id="doctor-form-title" className="text-lg font-semibold">{editing ? "Edit doctor record" : "Add doctor record"}</h2><p className="mt-1 text-sm text-slate-500">Doctor records do not have system logins. Only administrators can add or edit this catalog.</p></div><button type="button" aria-label="Close doctor form" onClick={()=>setFormOpen(false)} disabled={saveDoctor.isPending} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18}/></button></div><form onSubmit={submit} className="space-y-4"><label className="block text-sm font-medium text-slate-700">Doctor full name<input required maxLength={150} value={fullName} onChange={event=>setFullName(event.target.value)} className={fieldClass}/></label><label className="block text-sm font-medium text-slate-700">Specialty (optional)<input maxLength={120} value={specialty} onChange={event=>setSpecialty(event.target.value)} className={fieldClass}/></label><label className="block text-sm font-medium text-slate-700">Consultation fee (₱)<input required type="number" min="0" step="0.01" value={fixedFee} onChange={event=>setFixedFee(event.target.value)} className={fieldClass}/></label><label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm"><input type="checkbox" checked={isOnDuty} onChange={event=>setIsOnDuty(event.target.checked)} className="size-4 accent-sky-700"/> Doctor is currently on duty</label><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={()=>setFormOpen(false)} disabled={saveDoctor.isPending}>Cancel</Button><Button type="submit" disabled={saveDoctor.isPending||!fullName.trim()||!Number.isFinite(Number(fixedFee))||Number(fixedFee)<0}>{saveDoctor.isPending?"Saving…":editing?"Save changes":"Add doctor"}</Button></div></form></section></div>}
    </div>
  );
}
