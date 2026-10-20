import { useMemo, useState, type FormEvent } from "react";
import { Activity, Pencil, Plus, Stethoscope, UserRound, X } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { Button } from "../../components/ui/Button";
import { Card, CardContent } from "../../components/ui/Card";
import { ListEmpty, ListError, ListToolbar, Metric, MetricDivider, MetricStrip, PageToast, RefreshButton, SearchField, StatusPill, TableSkeleton, ToolbarActions } from "../../components/ui/ListTable";
import { rowClass, tbodyClass, theadClass, thClass, thFirstClass } from "../../components/ui/listTableStyles";
import { humanizeError, useDoctors, useSaveDoctor, type DoctorRecord } from "../patients/data";

const money = (value: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(Number(value ?? 0));
const fieldClass = "mt-1.5 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/10";
const specialtySuggestions = ["General Practice", "Family Medicine", "Internal Medicine", "Pediatrics", "Obstetrics and Gynecology", "General Surgery", "Orthopedic Surgery", "Cardiology", "Dermatology", "Neurology", "Ophthalmology", "Otolaryngology (ENT)", "Psychiatry", "Pulmonology", "Urology", "Anesthesiology", "Radiology", "Pathology", "Emergency Medicine", "Infectious Disease", "Nephrology", "Oncology", "Endocrinology", "Gastroenterology", "Rheumatology", "Rehabilitation Medicine"];
const capitalizeName = (value: string) => value.trim().split(" ").filter(Boolean).map((part) => part.toLocaleLowerCase().charAt(0).toLocaleUpperCase() + part.toLocaleLowerCase().slice(1)).join(" ");
const splitDoctorName = (value: string) => { const parts = value.trim().split(" ").filter(Boolean); return { first: parts[0] ?? "", middle: parts.length > 2 ? parts.slice(1, -1).join(" ") : "", last: parts.length > 1 ? parts[parts.length - 1] : "" }; };

export function AvailableDoctorsWorkspace() {
  const { profile } = useAuth();
  const canManage = profile?.role === "admin";
  const doctors = useDoctors();
  const saveDoctor = useSaveDoctor();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<DoctorRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [specialtyOpen, setSpecialtyOpen] = useState(false);
  const [isActive, setIsActive] = useState(true);
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
    const nameParts = splitDoctorName(doctor?.full_name ?? "");
    setFirstName(nameParts.first);
    setMiddleName(nameParts.middle);
    setLastName(nameParts.last);
    setSpecialty(doctor?.specialty ?? "");
    setIsActive(doctor?.is_active ?? true);
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
      const fullName = [firstName, middleName, lastName].map(capitalizeName).filter(Boolean).join(" ");
      if (!capitalizeName(firstName) || !capitalizeName(lastName)) throw new Error("Enter the doctor’s first and last name.");
      await saveDoctor.mutateAsync({ fullName, specialty: capitalizeName(specialty), isOnDuty, fixedFee: Number(fixedFee), doctorId: editing?.id });
      setMessage(editing ? "Doctor record updated." : "Doctor record added.");
      setFormOpen(false);
      await doctors.refetch();
    } catch (cause) {
      setError(humanizeError(cause));
    }
  };

  return (
    <div className="mx-auto max-w-[1440px] space-y-3 pb-5">
      <PageToast message={message} error={error} />
      <Card><CardContent className="px-4 pb-4 pt-6 sm:px-5 sm:pb-5 sm:pt-7">
        <ListToolbar>
          <SearchField label="Search doctors" placeholder="Search by doctor or specialty…" value={search} onChange={setSearch} />
          <ToolbarActions>
            <MetricStrip>
              <Metric icon={<Activity size={16} className="text-emerald-700"/>} label="On duty" value={doctors.isLoading ? "—" : availableCount} />
              <MetricDivider />
              <Metric icon={<UserRound size={16} className="text-sky-700"/>} label="Active doctors" value={doctors.isLoading ? "—" : orderedDoctors.length} />
            </MetricStrip>
            {canManage && <Button type="button" onClick={() => openForm()}><Plus size={15}/> Add doctor</Button>}
            <RefreshButton label="Refresh doctor list" onClick={() => void doctors.refetch()} spinning={doctors.isFetching} />
          </ToolbarActions>
        </ListToolbar>
        {doctors.isLoading ? <TableSkeleton label="Loading doctor availability" /> : doctors.isError ? <ListError message="Could not load doctors." onRetry={() => void doctors.refetch()} /> : filteredDoctors.length === 0 ? <ListEmpty icon={<Stethoscope className="mx-auto text-slate-300" size={30}/>} title={search ? "No doctors match your search" : "No active doctors found"} hint={canManage ? "Add a doctor record to make it available for patient consultations." : "Ask the administrator to add doctor records."} /> : <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-[13px]"><thead className={theadClass}><tr><th className={thFirstClass}>Doctor</th><th className={thClass}>Specialty</th><th className={thClass}>Consultation fee</th><th className={thClass}>Status</th>{canManage && <th className="py-3.5 pr-2 text-base font-bold">Action</th>}</tr></thead><tbody className={tbodyClass}>{filteredDoctors.map(doctor => <tr key={doctor.id} className={rowClass}><td className="py-3 pr-4 pl-2 font-medium text-slate-900">{doctor.full_name}</td><td className="py-3 pr-4">{doctor.specialty || "General practice"}</td><td className="py-3 pr-4 tabular-nums">{money(doctor.fixed_fee)}</td><td className="py-3 pr-4"><StatusPill tone={doctor.is_on_duty ? "success" : "neutral"}>{doctor.is_on_duty ? "On duty" : "Off duty"}</StatusPill></td>{canManage && <td className="py-3"><Button type="button" variant="secondary" size="sm" onClick={() => openForm(doctor)}><Pencil size={14}/> Edit</Button></td>}</tr>)}</tbody></table></div>}
      </CardContent></Card>

      {formOpen && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget&&!saveDoctor.isPending)setFormOpen(false);}}><section role="dialog" aria-modal="true" aria-labelledby="doctor-form-title" className="my-auto w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"><div className="mb-5 flex items-start justify-between gap-3"><div><h2 id="doctor-form-title" className="text-lg font-semibold">{editing ? "Edit doctor record" : "Add doctor record"}</h2></div><button type="button" aria-label="Close doctor form" onClick={()=>setFormOpen(false)} disabled={saveDoctor.isPending} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18}/></button></div><form onSubmit={submit} className="space-y-4"><div className="grid gap-3 sm:grid-cols-3"><label className="block text-sm font-medium text-slate-700">First name<input required maxLength={60} autoComplete="given-name" value={firstName} onChange={event=>setFirstName(event.target.value)} className={fieldClass}/></label><label className="block text-sm font-medium text-slate-700">Middle name<input maxLength={60} autoComplete="additional-name" value={middleName} onChange={event=>setMiddleName(event.target.value)} className={fieldClass}/></label><label className="block text-sm font-medium text-slate-700">Last name<input required maxLength={60} autoComplete="family-name" value={lastName} onChange={event=>setLastName(event.target.value)} className={fieldClass}/></label></div><label className="relative block text-sm font-medium text-slate-700">Specialty (optional)<input maxLength={120} autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={specialtyOpen} value={specialty} onFocus={()=>setSpecialtyOpen(true)} onBlur={()=>window.setTimeout(()=>setSpecialtyOpen(false),120)} onChange={event=>{setSpecialty(event.target.value);setSpecialtyOpen(true);}} className={fieldClass+" pr-3"} placeholder="Start typing a specialty…"/>{specialtyOpen && specialty.trim() && specialtySuggestions.some(item=>item.toLowerCase().includes(specialty.trim().toLowerCase())) && <div role="listbox" className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg [scrollbar-color:#94a3b8_#f1f5f9] [scrollbar-width:thin]">{specialtySuggestions.filter(item=>item.toLowerCase().includes(specialty.trim().toLowerCase())).map(item=><button type="button" role="option" key={item} onMouseDown={event=>event.preventDefault()} onClick={()=>{setSpecialty(item);setSpecialtyOpen(false);}} className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-sky-50 focus:bg-sky-50 focus:outline-none">{item}</button>)}</div>}</label><label className="block text-sm font-medium text-slate-700">Consultation fee (₱)<input required type="number" min="0" step="0.01" value={fixedFee} onChange={event=>setFixedFee(event.target.value)} className={fieldClass}/></label><div className="grid grid-cols-2 gap-3"><label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm"><input type="checkbox" checked={isActive} onChange={event=>setIsActive(event.target.checked)} className="size-4 accent-sky-700"/> Active</label><label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm"><input type="checkbox" checked={isOnDuty} onChange={event=>setIsOnDuty(event.target.checked)} className="size-4 accent-sky-700"/> On Duty</label></div><div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="secondary" onClick={()=>setFormOpen(false)} disabled={saveDoctor.isPending}>Cancel</Button><Button type="submit" disabled={saveDoctor.isPending||!firstName.trim()||!lastName.trim()||!Number.isFinite(Number(fixedFee))||Number(fixedFee)<0}>{saveDoctor.isPending?"Saving…":editing?"Save":"Add doctor"}</Button></div></form></section></div>}
    </div>
  );
}
