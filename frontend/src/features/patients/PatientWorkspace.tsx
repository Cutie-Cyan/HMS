import { useState, type FormEvent, type ReactNode } from "react";
import { CheckCircle2, RefreshCw, UserPlus, Stethoscope } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { humanizeError, useDoctors, usePatientDirectory, useRegisterPatient, useSaveDoctor, type DoctorRecord } from "./data";

const inputClass = "mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100";
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-sm font-medium text-slate-700">{label}{children}</label>;
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
  const isInfoOfficer = profile?.role === "info_officer";
  const [search, setSearch] = useState("");
  const patients = usePatientDirectory(search);
  const doctors = useDoctors(isInfoOfficer);
  const register = useRegisterPatient();
  const saveDoctor = useSaveDoctor();
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [sex, setSex] = useState("unknown");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [pwdOrSenior, setPwdOrSenior] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<DoctorRecord | null>(null);
  const [doctorName, setDoctorName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [fixedFee, setFixedFee] = useState("0");
  const [isOnDuty, setIsOnDuty] = useState(false);

  const resetDoctor = () => { setEditingDoctor(null); setDoctorName(""); setSpecialty(""); setFixedFee("0"); setIsOnDuty(false); };
  const editDoctor = (doctor: DoctorRecord) => { setEditingDoctor(doctor); setDoctorName(doctor.full_name); setSpecialty(doctor.specialty ?? ""); setFixedFee(String(doctor.fixed_fee)); setIsOnDuty(doctor.is_on_duty); };
  const submitPatient = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(""); setSuccess("");
    try {
      const result = await register.mutateAsync({ firstName, middleName, lastName, dateOfBirth, sex, phone, address, pwdOrSenior });
      setSuccess(`Patient registered: ${result.patient_number}`);
      setFirstName(""); setMiddleName(""); setLastName(""); setDateOfBirth(""); setSex("unknown"); setPhone(""); setAddress(""); setPwdOrSenior(false);
    } catch (cause) { setError(humanizeError(cause)); }
  };
  const submitDoctor = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(""); setSuccess("");
    try {
      await saveDoctor.mutateAsync({ fullName: doctorName, specialty, fixedFee: Number(fixedFee), isOnDuty, doctorId: editingDoctor?.id });
      setSuccess(editingDoctor ? "Doctor record updated." : "Doctor record added.");
      resetDoctor();
    } catch (cause) { setError(humanizeError(cause)); }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header><p className="text-sm font-medium text-teal-700">Patient services</p><h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">{isInfoOfficer ? "Patient registration" : "Patient directory"}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{isInfoOfficer ? "Register a patient and maintain doctor records. New registrations begin in Registered status." : "Search registered patients and continue to the Emergency Nurse encounter workflow."}</p></header>
      {(success || error) && <div role={error ? "alert" : "status"} className={`rounded-lg p-3 text-sm ${error ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-800"}`}>{error || success}</div>}
      {isInfoOfficer && <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
        <Card><CardHeader><div className="flex items-center gap-2 font-semibold"><UserPlus size={18} className="text-teal-700" /> Register patient</div><p className="mt-1 text-sm text-slate-500">Patient number is generated securely by the database.</p></CardHeader><CardContent>
          <form onSubmit={submitPatient} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name"><input required maxLength={100} value={firstName} onChange={e=>setFirstName(e.target.value)} className={inputClass} /></Field>
              <Field label="Middle name (optional)"><input maxLength={100} value={middleName} onChange={e=>setMiddleName(e.target.value)} className={inputClass} /></Field>
              <Field label="Last name"><input required maxLength={100} value={lastName} onChange={e=>setLastName(e.target.value)} className={inputClass} /></Field>
              <Field label="Date of birth"><input required type="date" max={new Date().toISOString().slice(0,10)} value={dateOfBirth} onChange={e=>setDateOfBirth(e.target.value)} className={inputClass} /></Field>
              <Field label="Sex"><select value={sex} onChange={e=>setSex(e.target.value)} className={inputClass}><option value="unknown">Prefer not to specify</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option></select></Field>
              <Field label="Phone (optional)"><input type="tel" maxLength={40} value={phone} onChange={e=>setPhone(e.target.value)} className={inputClass} /></Field>
            </div>
            <Field label="Address (optional)"><textarea rows={2} maxLength={500} value={address} onChange={e=>setAddress(e.target.value)} className={inputClass} /></Field>
            <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm text-slate-700"><input type="checkbox" checked={pwdOrSenior} onChange={e=>setPwdOrSenior(e.target.checked)} className="size-4 accent-teal-700" /> Patient is PWD or Senior (discount eligibility)</label>
            <Button type="submit" disabled={register.isPending}><UserPlus size={16}/>{register.isPending ? "Registering…" : "Register patient"}</Button>
          </form>
        </CardContent></Card>
        <Card><CardHeader><div className="flex items-center gap-2 font-semibold"><Stethoscope size={18} className="text-teal-700" /> Doctor records</div><p className="mt-1 text-sm text-slate-500">Doctors are records, not system accounts. Set the fixed fee and on-duty status.</p></CardHeader><CardContent>
          <form onSubmit={submitDoctor} className="space-y-3">
            <Field label="Doctor full name"><input required maxLength={150} value={doctorName} onChange={e=>setDoctorName(e.target.value)} className={inputClass}/></Field>
            <Field label="Specialty (optional)"><input maxLength={120} value={specialty} onChange={e=>setSpecialty(e.target.value)} className={inputClass}/></Field>
            <Field label="Fixed doctor fee (₱)"><input type="number" min="0" step="0.01" required value={fixedFee} onChange={e=>setFixedFee(e.target.value)} className={inputClass}/></Field>
            <label className="flex items-center gap-3 text-sm text-slate-700"><input type="checkbox" checked={isOnDuty} onChange={e=>setIsOnDuty(e.target.checked)} className="size-4 accent-teal-700"/> On duty</label>
            <div className="flex flex-wrap gap-2"><Button type="submit" disabled={saveDoctor.isPending}>{saveDoctor.isPending ? "Saving…" : editingDoctor ? "Save doctor changes" : "Add doctor"}</Button>{editingDoctor && <Button type="button" variant="secondary" onClick={resetDoctor}>Cancel edit</Button>}</div>
          </form>
          <div className="mt-5 border-t border-slate-100 pt-4">
            <h3 className="text-sm font-semibold">Active doctors</h3>
            {doctors.isLoading ? <p className="mt-3 text-sm text-slate-500">Loading doctor records…</p> : doctors.isError ? <p role="alert" className="mt-3 text-sm text-rose-700">Could not load doctors. Refresh and try again.</p> : doctors.data?.length ? <ul className="mt-2 divide-y divide-slate-100">{doctors.data.map(d=><li key={d.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{d.full_name}</p><p className="text-xs text-slate-500">{d.specialty || "Specialty not set"} · ₱{Number(d.fixed_fee).toLocaleString("en-PH",{minimumFractionDigits:2})}</p>{d.is_on_duty && <Badge tone="success" className="mt-1">On duty</Badge>}</div><Button type="button" variant="secondary" className="min-h-8 px-3" onClick={()=>editDoctor(d)}>Edit</Button></li>)}</ul> : <p className="mt-3 text-sm text-slate-500">No doctor records yet. Add real hospital doctor details above.</p>}
          </div>
        </CardContent></Card>
      </div>}
      <Card><CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">Patient directory</h2><p className="mt-1 text-sm text-slate-500">Search by patient number or name.</p></div><div className="flex gap-2"><input aria-label="Search patients" placeholder="Search patients…" value={search} onChange={e=>setSearch(e.target.value)} className="min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm sm:w-64"/><Button variant="secondary" onClick={()=>void patients.refetch()} disabled={patients.isFetching}><RefreshCw size={15}/></Button></div></div></CardHeader><CardContent>
        {patients.isLoading ? <p className="py-8 text-center text-sm text-slate-500">Loading patient directory…</p> : patients.isError ? <div className="py-6 text-center"><p role="alert" className="text-sm text-rose-700">Could not load patients. Check access and retry.</p><Button className="mt-3" onClick={()=>void patients.refetch()}>Retry</Button></div> : patients.data?.length ? <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th className="py-3 pr-4">Patient</th><th className="py-3 pr-4">Age</th><th className="py-3 pr-4">Sex</th><th className="py-3 pr-4">Status</th><th className="py-3">Patient number</th></tr></thead><tbody className="divide-y divide-slate-100">{patients.data.map(p=><tr key={p.patient_id}><td className="py-3 pr-4 font-medium">{p.first_name} {p.middle_name ? p.middle_name+" " : ""}{p.last_name}</td><td className="py-3 pr-4">{ageLabel(p.date_of_birth)}</td><td className="py-3 pr-4 capitalize">{p.sex}</td><td className="py-3 pr-4"><Badge tone={p.status==="registered"?"info":"neutral"}>{p.status.replaceAll("_"," ")}</Badge></td><td className="py-3 font-mono text-xs">{p.patient_number}</td></tr>)}</tbody></table></div> : <div className="py-10 text-center"><CheckCircle2 className="mx-auto text-slate-300" size={30}/><p className="mt-3 font-medium">No patients found</p><p className="mt-1 text-sm text-slate-500">{search ? "Try a different patient number or name." : "Registered patients will appear here. No sample patients are created."}</p></div>}
      </CardContent></Card>
    </div>
  );
}
