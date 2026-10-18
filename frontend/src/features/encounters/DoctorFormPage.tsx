import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, ClipboardPen, Eye, Printer, RefreshCw, Stethoscope, X } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import {
  humanizeError,
  useDoctors,
  useOpenEncounters,
  usePatientDirectory,
  useSaveEncounterPhase1,
  useMarkDoctorFormReturned,
  useRecordDoctorFindings,
  type EncounterRecord,
  type PatientRecord,
} from "../patients/data";

const inputClass = "mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100";

function age(date: string | null) {
  if (!date) return "—";
  const born = new Date(date);
  const now = new Date();
  let years = now.getFullYear() - born.getFullYear();
  if (now.getMonth() < born.getMonth() || (now.getMonth() === born.getMonth() && now.getDate() < born.getDate())) years--;
  return String(years);
}
function nameOf(patient?: PatientRecord) {
  return patient ? [patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(" ") : "Patient";
}
function stageLabel(stage: EncounterRecord["workflow_stage"]) {
  if (stage === "pending_doctor") return "Pending doctor assessment";
  if (stage === "for_encoding") return "Doctor form returned · for encoding";
  return "Doctor findings recorded";
}

export function DoctorFormPage() {
  const patients = usePatientDirectory("");
  const doctors = useDoctors();
  const encounters = useOpenEncounters();
  const savePhase1 = useSaveEncounterPhase1();
  const markReturned = useMarkDoctorFormReturned();
  const recordFindings = useRecordDoctorFindings();
  const [patientId, setPatientId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [nurseAssessment, setNurseAssessment] = useState("");
  const [selectedEncounter, setSelectedEncounter] = useState<EncounterRecord | null>(null);
  const [findings, setFindings] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [recommendationType, setRecommendationType] = useState("");
  const [printTarget, setPrintTarget] = useState<EncounterRecord | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const patient = patients.data?.find((item) => item.patient_id === patientId);
  const selectablePatients = useMemo(
    () => (patients.data ?? []).filter((item) => item.status === "registered" || item.status === "in_emergency"),
    [patients.data],
  );
  const activeEncounters = (encounters.data ?? []).filter((item) => item.encounter_status === "open");
  const printPatient = patients.data?.find((item) => item.patient_id === printTarget?.patient_id);

  useEffect(() => {
    if (printTarget) {
      const timer = window.setTimeout(() => window.print(), 100);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [printTarget]);

  const refresh = async () => {
    await Promise.all([patients.refetch(), encounters.refetch()]);
  };

  const saveInitialForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!patientId) {
      setError("Select a patient before saving the encounter form.");
      return;
    }
    try {
      const id = await savePhase1.mutateAsync({ patientId, doctorId: doctorId || null, nurseAssessment });
      await refresh();
      const created = encounters.data?.find((item) => item.encounter_id === id);
      setSuccess("Initial encounter saved to the queue. Print the form from the queue and give it to the doctor.");
      setPatientId("");
      setDoctorId("");
      setNurseAssessment("");
      if (!created) await encounters.refetch();
    } catch (cause) {
      setError(humanizeError(cause));
    }
  };

  const startEncoding = (item: EncounterRecord) => {
    setSelectedEncounter(item);
    setFindings(item.findings ?? "");
    setRecommendations(item.recommendations ?? "");
    setRecommendationType(item.recommendation_type ?? "");
    setError("");
    setSuccess("");
  };

  const submitFindings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedEncounter) return;
    setError("");
    setSuccess("");
    try {
      await recordFindings.mutateAsync({
        encounterId: selectedEncounter.encounter_id,
        findings,
        recommendations,
        recommendationType,
      });
      setSuccess("Doctor's findings and recommendations were recorded. The encounter is now saved.");
      setSelectedEncounter(null);
      await refresh();
    } catch (cause) {
      setError(humanizeError(cause));
    }
  };

  const handleReturned = async (item: EncounterRecord) => {
    setError("");
    setSuccess("");
    try {
      await markReturned.mutateAsync(item.encounter_id);
      await encounters.refetch();
      setSuccess("Paper form marked as returned. You can now enter the doctor's findings and recommendations.");
    } catch (cause) {
      setError(humanizeError(cause));
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-8">
      {(error || success) && <div role={error ? "alert" : "status"} className={`fixed right-4 top-4 z-[120] max-w-[min(30rem,calc(100vw-2rem))] rounded-xl border p-3 text-sm shadow-lg ${error ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{error || success}</div>}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 font-semibold"><Stethoscope size={18} className="text-teal-700" /> Start encounter</div>
          <p className="mt-1 text-sm text-slate-500">Complete the patient details, save, then print for the doctor.</p>
        </CardHeader>
        <CardContent>
          {patients.isError || doctors.isError || encounters.isError ? <div role="alert" className="mb-4 text-sm text-rose-700">Unable to load encounter information. Refresh and try again.</div> : null}
          <form onSubmit={saveInitialForm} className="space-y-5">
            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h2 className="mb-3 text-base font-semibold tracking-tight text-slate-900">Patient Information</h2>
              <label className="block text-sm font-medium text-slate-700">Select patient
                <select required value={patientId} onChange={(event) => setPatientId(event.target.value)} className={inputClass}>
                  <option value="">Select registered or emergency patient…</option>
                  {selectablePatients.map((item) => <option key={item.patient_id} value={item.patient_id}>{item.patient_number} — {nameOf(item)}</option>)}
                </select>
              </label>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Info label="Full name" value={nameOf(patient)} />
                <Info label="Age" value={age(patient?.date_of_birth ?? null)} />
                <Info label="Sex" value={patient?.sex ?? "—"} />
                <Info label="Patient number" value={patient?.patient_number ?? "—"} />
              </div>
              <label className="mt-4 block text-sm font-medium text-slate-700">Assigned doctor
                <select value={doctorId} onChange={(event) => setDoctorId(event.target.value)} className={inputClass}>
                  <option value="">Select doctor (optional)</option>
                  {(doctors.data ?? []).map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.full_name}{doctor.is_on_duty ? " — on duty" : ""}</option>)}
                </select>
              </label>
            </section>
            <label className="block text-sm font-medium text-slate-700">Nurse assessment<textarea rows={3} maxLength={4000} value={nurseAssessment} onChange={(event) => setNurseAssessment(event.target.value)} placeholder="Initial observations (optional)" className={inputClass}/></label>
            <Button type="submit" disabled={savePhase1.isPending || patients.isLoading || doctors.isLoading || encounters.isLoading || !patientId}>
              {savePhase1.isPending ? "Saving…" : "Save Encounter"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-base font-semibold tracking-tight text-slate-900">Saved Encounters</h2><p className="mt-1 text-sm text-slate-500">Print a saved form, then update it when the doctor returns it.</p></div><Button variant="secondary" onClick={() => void refresh()} disabled={encounters.isFetching}><RefreshCw size={15} /> Refresh</Button></div>
        </CardHeader>
        <CardContent>
          {encounters.isLoading ? <p className="py-8 text-center text-sm text-slate-500">Loading encounter queue…</p> : encounters.isError ? <div className="py-6 text-center"><p className="text-sm text-rose-700">Could not load the queue.</p><Button className="mt-3" onClick={() => void encounters.refetch()}>Retry</Button></div> : activeEncounters.length === 0 ? <div className="py-10 text-center"><CheckCircle2 className="mx-auto text-slate-300" size={30}/><p className="mt-3 font-medium">No active encounters</p><p className="mt-1 text-sm text-slate-500">Saved forms will appear here.</p></div> : <div className="space-y-3">{activeEncounters.map((item) => <article key={item.encounter_id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-900">{item.patient_name}</h3><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{item.patient_number}</span><StagePill stage={item.workflow_stage}/></div><p className="mt-1 text-sm text-slate-500">Doctor: {item.doctor_name ?? "Not assigned"} · Saved {new Date(item.created_at).toLocaleString()}</p>{item.findings_recorded_at && <p className="mt-1 text-xs text-slate-500">Doctor form encoded {new Date(item.findings_recorded_at).toLocaleString()}</p>}</div><div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => setPrintTarget(item)}><Printer size={14}/> Print form</Button>
            {item.workflow_stage === "pending_doctor" && <Button size="sm" onClick={() => void handleReturned(item)} disabled={markReturned.isPending}>Mark form returned</Button>}
            {item.workflow_stage === "for_encoding" && <Button size="sm" onClick={() => startEncoding(item)}><ClipboardPen size={14}/> Enter findings</Button>}
            {item.workflow_stage === "recorded" && <Button size="sm" variant="secondary" onClick={() => startEncoding(item)}><Eye size={14}/> View</Button>}
          </div></div></article>)}</div>}
        </CardContent>
      </Card>

      {selectedEncounter && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !recordFindings.isPending) setSelectedEncounter(null); }}><section role="dialog" aria-modal="true" aria-labelledby="doctor-findings-title" className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"><div className="mb-5 flex items-start justify-between gap-3"><div><h2 id="doctor-findings-title" className="text-lg font-semibold tracking-tight text-slate-900">{selectedEncounter.workflow_stage === "recorded" ? "Doctor Record" : "Record Doctor Findings"}</h2><p className="mt-2 text-sm font-semibold text-slate-800">{selectedEncounter.patient_name}</p><p className="text-xs text-slate-500">{selectedEncounter.patient_number} · {selectedEncounter.doctor_name ?? "No doctor assigned"}</p></div><button type="button" aria-label="Close" onClick={() => setSelectedEncounter(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18}/></button></div><form onSubmit={submitFindings} className="space-y-4"><label className="block text-sm font-medium text-slate-700">Recommendation type<select value={recommendationType} onChange={(event) => setRecommendationType(event.target.value)} disabled={selectedEncounter.workflow_stage === "recorded"} className={inputClass}><option value="">Not specified</option><option value="consult">Consult / follow-up</option><option value="lab">Laboratory</option><option value="medicine">Medicine</option><option value="mixed">Mixed</option></select></label><div className="grid gap-4 md:grid-cols-2"><label className="block text-sm font-medium text-slate-700">Findings<textarea required rows={7} value={findings} onChange={(event) => setFindings(event.target.value)} disabled={selectedEncounter.workflow_stage === "recorded"} placeholder="Doctor's findings" className={inputClass}/></label><label className="block text-sm font-medium text-slate-700">Recommendations<textarea required rows={7} value={recommendations} onChange={(event) => setRecommendations(event.target.value)} disabled={selectedEncounter.workflow_stage === "recorded"} placeholder="Doctor's recommendations" className={inputClass}/></label></div><div className="flex justify-end">{selectedEncounter.workflow_stage !== "recorded" && <Button type="submit" disabled={recordFindings.isPending}>{recordFindings.isPending ? "Saving…" : "Save"}</Button>}</div></form></section></div>}

      {printTarget && <section className="print-sheet print-active">
        <div className="border-b-2 border-black pb-4 text-center"><p className="text-xs font-semibold uppercase tracking-widest">Hospital Management System</p><h2 className="mt-2 text-2xl font-bold">Emergency Encounter Form</h2><p className="mt-1 text-xs">Phase 1 · For doctor assessment</p></div>
        <div className="mt-5 grid grid-cols-2 gap-4 border-b border-slate-300 pb-5 md:grid-cols-4"><Info label="Patient name" value={printTarget.patient_name}/><Info label="Patient number" value={printTarget.patient_number}/><Info label="Age" value={age(printPatient?.date_of_birth ?? null)}/><Info label="Sex" value={printPatient?.sex ?? "—"}/><Info label="Assigned doctor" value={printTarget.doctor_name ?? "Not assigned"}/><Info label="Date" value={new Date(printTarget.created_at).toLocaleString()}/></div>
        <div className="mt-5"><h3 className="font-bold">Initial nurse assessment / observations</h3><div className="mt-2 min-h-24 whitespace-pre-wrap border border-slate-400 p-3 text-sm">{printTarget.nurse_assessment || "No initial assessment recorded."}</div></div>
        <div className="mt-5 grid gap-5 md:grid-cols-2"><section className="min-h-[18rem] border border-slate-400 p-4"><h3 className="border-b border-slate-300 pb-2 text-sm font-bold uppercase tracking-wide">Findings</h3><div className="mt-3 min-h-[14rem] whitespace-pre-wrap text-sm">{printTarget.workflow_stage === "recorded" ? printTarget.findings : ""}</div></section><section className="min-h-[18rem] border border-slate-400 p-4"><h3 className="border-b border-slate-300 pb-2 text-sm font-bold uppercase tracking-wide">Recommendations</h3><div className="mt-3 min-h-[14rem] whitespace-pre-wrap text-sm">{printTarget.workflow_stage === "recorded" ? printTarget.recommendations : ""}</div></section></div>
        <div className="mt-12 grid grid-cols-2 gap-12 text-center text-xs"><div className="border-t border-slate-500 pt-2">Emergency Nurse</div><div className="border-t border-slate-500 pt-2">Doctor</div></div>
        <p className="mt-6 text-center text-xs">After the doctor completes this paper form, return it to the Emergency Nurse for encoding in Phase 2.</p>
      </section>}
    </div>
  );
}

function StagePill({ stage }: { stage: EncounterRecord["workflow_stage"] }) {
  const styles = stage === "recorded" ? "bg-emerald-50 text-emerald-700" : stage === "for_encoding" ? "bg-sky-50 text-sky-700" : "bg-amber-50 text-amber-800";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${styles}`}>{stageLabel(stage)}</span>;
}
function Info({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-lg bg-white p-3 ring-1 ring-slate-200"><p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</p></div>;
}
