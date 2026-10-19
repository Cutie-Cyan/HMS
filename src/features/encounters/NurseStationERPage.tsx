import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Activity, BedDouble, CheckCircle2, ClipboardList, ClipboardPen, Eye, FileText, FlaskConical, LayoutDashboard, Printer, RefreshCw, Stethoscope, X } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { RequestsWorkspace } from "../requests/RequestsWorkspace";
import { WardsWorkspace } from "../wards/WardsWorkspace";
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

export function NurseStationERPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const patients = usePatientDirectory("");
  const doctors = useDoctors();
  const encounters = useOpenEncounters();
  const savePhase1 = useSaveEncounterPhase1();
  const markReturned = useMarkDoctorFormReturned();
  const recordFindings = useRecordDoctorFindings();
  const [patientId, setPatientId] = useState("");
  const [patientQuery, setPatientQuery] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [nurseAssessment, setNurseAssessment] = useState("");
  const [triagePriority, setTriagePriority] = useState("");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [bloodPressure, setBloodPressure] = useState("");
  const [heartRate, setHeartRate] = useState("");
  const [respiratoryRate, setRespiratoryRate] = useState("");
  const [temperatureC, setTemperatureC] = useState("");
  const [oxygenSaturation, setOxygenSaturation] = useState("");
  const [painScore, setPainScore] = useState("");
  const [allergies, setAllergies] = useState("");
  const [selectedEncounter, setSelectedEncounter] = useState<EncounterRecord | null>(null);
  const [findings, setFindings] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [recommendationType, setRecommendationType] = useState("");
  const [printTarget, setPrintTarget] = useState<EncounterRecord | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [encounterView, setEncounterView] = useState<"queue" | "saved">("queue");
  const activeTab = (["overview", "queue", "triage", "clinical", "requests", "beds"].includes(searchParams.get("tab") ?? "") ? searchParams.get("tab") : "overview") as "overview" | "queue" | "triage" | "clinical" | "requests" | "beds";

  const patient = patients.data?.find((item) => item.patient_id === patientId);
  const selectablePatients = useMemo(
    () => (patients.data ?? []).filter((item) => (item.status === "registered" || item.status === "in_emergency") && (!item.current_ward_id || item.current_ward_name === "Emergency Room")),
    [patients.data],
  );
  const activeEncounters = (encounters.data ?? []).filter((item) => item.encounter_status === "open");
  const existingEncounter = activeEncounters.find((item) => item.patient_id === patientId);
  const printPatient = patients.data?.find((item) => item.patient_id === printTarget?.patient_id);

  const selectTab = (tab: typeof activeTab) => {
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);
      if (tab === "overview") nextParams.delete("tab");
      else nextParams.set("tab", tab);
      return nextParams;
    }, { replace: true });
  };

  useEffect(() => {
    if (activeTab === "clinical") setEncounterView("saved");
    else if (activeTab === "queue") setEncounterView("queue");
  }, [activeTab]);

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
    if (existingEncounter) {
      setError("This patient already has an active encounter. Continue from the saved encounter queue instead of creating another one.");
      return;
    }
    try {
      const triageAssessment = [
        `Triage priority: ${triagePriority.replaceAll("_", " ")}`,
        `Chief complaint: ${chiefComplaint.trim()}`,
        bloodPressure.trim() ? `Blood pressure: ${bloodPressure.trim()} mmHg` : "",
        heartRate ? `Heart rate: ${heartRate} bpm` : "",
        respiratoryRate ? `Respiratory rate: ${respiratoryRate} /min` : "",
        temperatureC ? `Temperature: ${temperatureC} °C` : "",
        oxygenSaturation ? `Oxygen saturation: ${oxygenSaturation}%` : "",
        painScore !== "" ? `Pain score: ${painScore}/10` : "",
        `Known allergies: ${allergies.trim() || "Not recorded"}`,
        nurseAssessment.trim() ? `Initial observations: ${nurseAssessment.trim()}` : "",
      ].filter(Boolean).join("\n");
      const id = await savePhase1.mutateAsync({ patientId, doctorId: doctorId || null, nurseAssessment: triageAssessment });
      await refresh();
      const created = encounters.data?.find((item) => item.encounter_id === id);
      setEncounterView("queue");
      selectTab("queue");
      setSuccess("Initial encounter saved to the queue. Print the form from the queue and give it to the doctor.");
      window.setTimeout(() => document.getElementById("encounter-records-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      setPatientId("");
      setPatientQuery("");
      setDoctorId("");
      setNurseAssessment("");
      setTriagePriority("");
      setChiefComplaint("");
      setBloodPressure("");
      setHeartRate("");
      setRespiratoryRate("");
      setTemperatureC("");
      setOxygenSaturation("");
      setPainScore("");
      setAllergies("");
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
      setEncounterView("saved");
      selectTab("clinical");
      setSuccess("Doctor's findings and recommendations were recorded. The encounter is now saved.");
      setSelectedEncounter(null);
      await refresh();
      window.setTimeout(() => document.getElementById("encounter-records-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
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

      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">Emergency Services</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Emergency Room</h1>
          <p className="mt-1 text-sm text-slate-500">Receive ER referrals, record triage, coordinate doctor orders and results, then document discharge or ward admission.</p>
        </div>
        <nav className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-2" aria-label="Emergency Room sections">
          {([
            { id: "overview", label: "Overview", icon: LayoutDashboard },
            { id: "queue", label: "Patient Queue", icon: ClipboardList },
            { id: "triage", label: "Triage & Assessment", icon: Activity },
            { id: "clinical", label: "Clinical Records", icon: FileText },
            { id: "requests", label: "Requests & Results", icon: FlaskConical },
            { id: "beds", label: "Beds & Disposition", icon: BedDouble },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => selectTab(id)} aria-current={activeTab === id ? "page" : undefined}
              className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition ${activeTab === id ? "bg-teal-700 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}>
              <Icon size={16} />{label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === "overview" && <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card><CardContent><p className="text-sm text-slate-500">Open ER encounters</p><p className="mt-2 text-3xl font-semibold text-slate-950">{activeEncounters.length}</p></CardContent></Card>
          <Card><CardContent><p className="text-sm text-slate-500">Awaiting doctor / encoding</p><p className="mt-2 text-3xl font-semibold text-slate-950">{activeEncounters.filter((item) => item.workflow_stage !== "recorded").length}</p></CardContent></Card>
          <Card><CardContent><p className="text-sm text-slate-500">Clinical records saved</p><p className="mt-2 text-3xl font-semibold text-slate-950">{activeEncounters.filter((item) => item.workflow_stage === "recorded").length}</p></CardContent></Card>
          <Card><CardContent><p className="text-sm text-slate-500">Patients available for ER intake</p><p className="mt-2 text-3xl font-semibold text-slate-950">{selectablePatients.length}</p></CardContent></Card>
        </div>
        <Card><CardHeader><h2 className="font-semibold text-slate-900">ER workflow</h2><p className="mt-1 text-sm text-slate-500">The Emergency Nurse receives the patient, completes initial triage, coordinates the paper form with the doctor, sends authorized orders to Lab or Pharmacy, communicates results, and records the doctor's disposition. Doctors do not log in.</p></CardHeader><CardContent><ol className="grid gap-3 md:grid-cols-3">
          {[
            ["1", "Initial ER assessment", "Receive the patient referral, check urgency, and record chief complaint, vital signs, allergies, and initial nursing observations."],
            ["2", "Doctor + orders", "Print the assessment form for the doctor. Encode the returned findings and documented orders, then track Lab and Pharmacy responses."],
            ["3", "Exit or admission", "Communicate results to the doctor and record the documented plan: continue ER care, discharge through required billing, or request ward admission."],
          ].map(([number, title, detail]) => <li key={number} className="rounded-xl border border-slate-200 p-4"><span className="inline-grid size-7 place-items-center rounded-full bg-teal-50 text-sm font-semibold text-teal-800">{number}</span><h3 className="mt-3 font-semibold text-slate-900">{title}</h3><p className="mt-1 text-sm leading-5 text-slate-500">{detail}</p></li>)}
        </ol><div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => selectTab("triage")}><Activity size={15}/> Start triage</Button><Button variant="secondary" onClick={() => selectTab("queue")}>Open patient queue</Button></div></CardContent></Card>
      </div>}

      {activeTab === "triage" && (<Card>
        <CardHeader>
          <div className="flex items-center gap-2 font-semibold"><Stethoscope size={18} className="text-teal-700" /> Triage & Assessment</div>
          <p className="mt-1 text-sm text-slate-500">The Emergency Nurse receives the patient from the Emergency Nurse referral workflow, records ER triage and vital signs, then prints the form for the doctor. The doctor completes the paper form; authorized staff encode the documented findings, orders, and recommended disposition.</p>
        </CardHeader>
        <CardContent>
          {patients.isError || doctors.isError || encounters.isError ? <div role="alert" className="mb-4 text-sm text-rose-700">Unable to load encounter information. Refresh and try again.</div> : null}
          <form onSubmit={saveInitialForm} className="space-y-5">
            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h2 className="mb-3 text-base font-semibold tracking-tight text-slate-900">Patient Information</h2>
              <label className="block text-sm font-medium text-slate-700">Patient
                <input required list="er-patient-options" value={patientQuery} placeholder="Search patient name or number…" onChange={(event) => {
                  const value = event.target.value;
                  setPatientQuery(value);
                  const match = selectablePatients.find((item) => value.trim().startsWith(item.patient_number + " — " + nameOf(item)));
                  setPatientId(match?.patient_id ?? "");
                }} className={inputClass} autoComplete="off" />
                <datalist id="er-patient-options">
                  {selectablePatients.map((item) => {
                    const queued = activeEncounters.some((encounter) => encounter.patient_id === item.patient_id);
                    return <option key={item.patient_id} value={item.patient_number + " — " + nameOf(item) + (queued ? " · IN QUEUE" : " · No active encounter")} />;
                  })}
                </datalist>
              </label>
              {patientQuery && !patientId && <p className="mt-2 text-xs text-slate-500">Choose a matching patient from the suggestions to continue.</p>}
              {patient && <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">{patient.patient_number}</span>
                <span className={`rounded-full px-2.5 py-1 font-medium ${existingEncounter ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{existingEncounter ? "Already in queue" : "No active encounter"}</span>
              </div>}
              {existingEncounter && (
                <div role="alert" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                  <div className="flex items-start gap-3">
                    <span aria-hidden="true" className="mt-0.5 text-amber-700">⚠</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">Encounter already in queue</p>
                      <p className="mt-1 leading-5">This patient already has an active encounter ({stageLabel(existingEncounter.workflow_stage).toLowerCase()}). Continue the existing record to avoid duplicates.</p>
                      <Button type="button" size="sm" variant="secondary" className="mt-3" onClick={() => { selectTab("queue"); window.setTimeout(() => document.getElementById("encounter-records-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); }}>
                        Go to existing encounter
                      </Button>
                    </div>
                  </div>
                </div>
              )}
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
            <section className="space-y-4 rounded-xl border border-slate-200 p-4">
              <div><h2 className="font-semibold text-slate-900">Triage and initial nurse assessment</h2><p className="mt-1 text-sm text-slate-500">Record the presenting concern, urgency, and available observations. Reassess as needed.</p></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">Triage priority<select required value={triagePriority} onChange={(event) => setTriagePriority(event.target.value)} className={inputClass}><option value="">Select priority</option><option value="immediate">Immediate</option><option value="very_urgent">Very urgent</option><option value="urgent">Urgent</option><option value="standard">Standard</option><option value="non_urgent">Non-urgent</option></select></label>
                <label className="block text-sm font-medium text-slate-700">Chief complaint<input required maxLength={500} value={chiefComplaint} onChange={(event) => setChiefComplaint(event.target.value)} placeholder="Reason for the ER visit" className={inputClass}/></label>
                <label className="block text-sm font-medium text-slate-700">Blood pressure (mmHg)<input value={bloodPressure} onChange={(event) => setBloodPressure(event.target.value)} maxLength={20} placeholder="e.g. 120/80" className={inputClass}/></label>
                <label className="block text-sm font-medium text-slate-700">Heart rate (bpm)<input type="number" min={0} max={300} value={heartRate} onChange={(event) => setHeartRate(event.target.value)} placeholder="Beats per minute" className={inputClass}/></label>
                <label className="block text-sm font-medium text-slate-700">Respiratory rate (/min)<input type="number" min={0} max={100} value={respiratoryRate} onChange={(event) => setRespiratoryRate(event.target.value)} placeholder="Breaths per minute" className={inputClass}/></label>
                <label className="block text-sm font-medium text-slate-700">Temperature (°C)<input type="number" min={25} max={45} step={0.1} value={temperatureC} onChange={(event) => setTemperatureC(event.target.value)} placeholder="Body temperature" className={inputClass}/></label>
                <label className="block text-sm font-medium text-slate-700">Oxygen saturation (%)<input type="number" min={0} max={100} value={oxygenSaturation} onChange={(event) => setOxygenSaturation(event.target.value)} placeholder="SpO₂" className={inputClass}/></label>
                <label className="block text-sm font-medium text-slate-700">Pain score (0–10)<input type="number" min={0} max={10} value={painScore} onChange={(event) => setPainScore(event.target.value)} placeholder="Patient-reported pain" className={inputClass}/></label>
              </div>
              <label className="block text-sm font-medium text-slate-700">Known allergies<textarea rows={2} maxLength={1000} value={allergies} onChange={(event) => setAllergies(event.target.value)} placeholder="Known allergies or enter none reported" className={inputClass}/></label>
              <label className="block text-sm font-medium text-slate-700">Additional nurse observations<textarea rows={3} maxLength={3000} value={nurseAssessment} onChange={(event) => setNurseAssessment(event.target.value)} placeholder="Relevant observations and assessment notes" className={inputClass}/></label>
              <p className="text-xs leading-5 text-slate-500">These details are saved with the encounter and included on the printable doctor form. Enter only observations that have actually been assessed.</p>
            </section>
            <Button type="submit" disabled={savePhase1.isPending || patients.isLoading || doctors.isLoading || encounters.isLoading || !patientId || Boolean(existingEncounter)}>
              {savePhase1.isPending ? "Saving…" : "Save Encounter"}
            </Button>
          </form>
        </CardContent>
      </Card>

      )}

      {(activeTab === "queue" || activeTab === "clinical") && (<Card id="encounter-records-panel">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-base font-semibold tracking-tight text-slate-900">ER Encounter Queue</h2><p className="mt-1 text-sm text-slate-500">Only encounters assigned to the Emergency Room appear here. Other ward patients remain visible in Patient Records but cannot be processed from this queue.</p></div>
            <Button variant="secondary" onClick={() => void refresh()} disabled={encounters.isFetching}><RefreshCw size={15} /> Refresh</Button>
          </div>
          <div className="flex flex-wrap gap-2 pt-3" role="group" aria-label="Encounter record views">
            <Button type="button" variant={encounterView === "queue" ? "primary" : "secondary"} onClick={() => setEncounterView("queue")}>Queue <span className="ml-1 rounded-full bg-black/10 px-2 py-0.5 text-xs">{activeEncounters.filter((item) => item.workflow_stage !== "recorded").length}</span></Button>
            <Button type="button" variant={encounterView === "saved" ? "primary" : "secondary"} onClick={() => setEncounterView("saved")}>Saved Encounters <span className="ml-1 rounded-full bg-black/10 px-2 py-0.5 text-xs">{activeEncounters.filter((item) => item.workflow_stage === "recorded").length}</span></Button>
          </div>
        </CardHeader>
        <CardContent>
          {encounters.isLoading ? <p className="py-8 text-center text-sm text-slate-500">Loading encounter records…</p> : encounters.isError ? <div className="py-6 text-center"><p className="text-sm text-rose-700">Could not load encounter records.</p><Button className="mt-3" onClick={() => void encounters.refetch()}>Retry</Button></div> : (() => {
            const visibleEncounters = activeEncounters.filter((item) => encounterView === "queue" ? item.workflow_stage !== "recorded" : item.workflow_stage === "recorded");
            if (visibleEncounters.length === 0) return <div className="py-10 text-center"><CheckCircle2 className="mx-auto text-slate-300" size={30}/><p className="mt-3 font-medium">{encounterView === "queue" ? "Queue is empty" : "No saved encounters yet"}</p><p className="mt-1 text-sm text-slate-500">{encounterView === "queue" ? "New ER encounters waiting for doctor assessment or returned forms awaiting encoding appear here." : "Doctor findings recorded for active encounters appear here. The encounter may remain open while tests, treatment, or disposition are pending."}</p></div>;
            return <div className="space-y-3">{visibleEncounters.map((item) => <article key={item.encounter_id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-900">{item.patient_name}</h3><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{item.patient_number}</span><StagePill stage={item.workflow_stage}/></div><p className="mt-1 text-sm text-slate-500">Doctor: {item.doctor_name ?? "Not assigned"} · Saved {new Date(item.created_at).toLocaleString()}</p>{item.findings_recorded_at && <p className="mt-1 text-xs text-slate-500">Doctor form encoded {new Date(item.findings_recorded_at).toLocaleString()}</p>}</div><div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => setPrintTarget(item)}><Printer size={14}/> Print form</Button>
              {item.workflow_stage === "pending_doctor" && <Button size="sm" onClick={() => void handleReturned(item)} disabled={markReturned.isPending}>Mark form returned</Button>}
              {item.workflow_stage === "for_encoding" && <Button size="sm" onClick={() => startEncoding(item)}><ClipboardPen size={14}/> Enter findings</Button>}
              {item.workflow_stage === "recorded" && <Button size="sm" variant="secondary" onClick={() => startEncoding(item)}><Eye size={14}/> View</Button>}
            </div></div></article>)}</div>;
          })()}
        </CardContent>
      </Card>

      )}

      {activeTab === "requests" && <div className="space-y-3"><Card><CardHeader><h2 className="font-semibold text-slate-900">ER Requests & Results</h2><p className="text-sm text-slate-500">Use this area for initial and additional laboratory or medicine requests linked to the active ER encounter. Lab and Pharmacy record their own results and fulfillment status; the Emergency Nurse communicates relevant results to the doctor.</p></CardHeader><CardContent><RequestsWorkspace mode="requests" /></CardContent></Card></div>}
      {activeTab === "beds" && <div className="space-y-3"><Card><CardHeader><h2 className="font-semibold text-slate-900">ER Disposition & Ward Coordination</h2><p className="text-sm text-slate-500">Use this area after the doctor documents a disposition. For admission, select the intended ward and coordinate acceptance, bed assignment, handover, and transfer confirmation. For discharge, complete required discharge steps, route through Billing/Cashier when policy requires it, record actual departure, and then close the encounter. Billing clearance alone does not discharge a patient.</p></CardHeader><CardContent><WardsWorkspace /></CardContent></Card></div>}

      {selectedEncounter && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !recordFindings.isPending) setSelectedEncounter(null); }}><section role="dialog" aria-modal="true" aria-labelledby="doctor-findings-title" className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"><div className="mb-5 flex items-start justify-between gap-3"><div><h2 id="doctor-findings-title" className="text-lg font-semibold tracking-tight text-slate-900">{selectedEncounter.workflow_stage === "recorded" ? "Doctor Record" : "Record Doctor Findings"}</h2><p className="mt-2 text-sm font-semibold text-slate-800">{selectedEncounter.patient_name}</p><p className="text-xs text-slate-500">{selectedEncounter.patient_number} · {selectedEncounter.doctor_name ?? "No doctor assigned"}</p></div><button type="button" aria-label="Close" onClick={() => setSelectedEncounter(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18}/></button></div><form onSubmit={submitFindings} className="space-y-4"><label className="block text-sm font-medium text-slate-700">Recommendation type<select value={recommendationType} onChange={(event) => setRecommendationType(event.target.value)} disabled={selectedEncounter.workflow_stage === "recorded"} className={inputClass}><option value="">Not specified</option><option value="consult">Consult / follow-up</option><option value="lab">Laboratory</option><option value="medicine">Medicine</option><option value="mixed">Mixed</option></select></label><div className="grid gap-4 md:grid-cols-2"><label className="block text-sm font-medium text-slate-700">Findings<textarea required rows={7} value={findings} onChange={(event) => setFindings(event.target.value)} disabled={selectedEncounter.workflow_stage === "recorded"} placeholder="Doctor's findings" className={inputClass}/></label><label className="block text-sm font-medium text-slate-700">Recommendations<textarea required rows={7} value={recommendations} onChange={(event) => setRecommendations(event.target.value)} disabled={selectedEncounter.workflow_stage === "recorded"} placeholder="Doctor's recommendations" className={inputClass}/></label></div><div className="flex justify-end">{selectedEncounter.workflow_stage !== "recorded" && <Button type="submit" disabled={recordFindings.isPending}>{recordFindings.isPending ? "Saving…" : "Save"}</Button>}</div></form></section></div>}

      {printTarget && <section className="print-sheet print-active">
        <div className="border-b-2 border-black pb-4 text-center"><p className="text-xs font-semibold uppercase tracking-widest">Hospital Management System</p><h2 className="mt-2 text-2xl font-bold tracking-tight">Emergency Encounter Form</h2><p className="mt-1 text-xs">Phase 1 · For doctor assessment</p></div>
        <div className="mt-5 grid grid-cols-2 gap-4 border-b border-slate-300 pb-5 md:grid-cols-4"><Info label="Patient name" value={printTarget.patient_name}/><Info label="Patient number" value={printTarget.patient_number}/><Info label="Age" value={age(printPatient?.date_of_birth ?? null)}/><Info label="Sex" value={printPatient?.sex ?? "—"}/><Info label="Assigned doctor" value={printTarget.doctor_name ?? "Not assigned"}/><Info label="Date" value={new Date(printTarget.created_at).toLocaleString()}/></div>
        <div className="mt-5"><h3 className="font-bold">Initial nurse assessment / observations</h3><div className="mt-2 min-h-24 whitespace-pre-wrap border border-slate-400 p-3 text-sm">{printTarget.nurse_assessment || "No initial assessment recorded."}</div></div>
        <div className="mt-5 grid grid-cols-2 items-stretch gap-3 print:grid-cols-2"><section className="min-w-0 min-h-[18rem] border border-slate-400 p-3 sm:p-4"><h3 className="border-b border-slate-300 pb-2 text-sm font-bold uppercase tracking-wide">Findings</h3><div className="mt-3 min-h-[14rem] whitespace-pre-wrap text-sm">{printTarget.workflow_stage === "recorded" ? printTarget.findings : ""}</div></section><section className="min-w-0 min-h-[18rem] border border-slate-400 p-3 sm:p-4"><h3 className="border-b border-slate-300 pb-2 text-sm font-bold uppercase tracking-wide">Recommendations</h3><div className="mt-3 min-h-[14rem] whitespace-pre-wrap text-sm">{printTarget.workflow_stage === "recorded" ? printTarget.recommendations : ""}</div></section></div>
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
  return <div className="min-w-0 rounded-lg bg-white px-3.5 py-3 ring-1 ring-slate-200"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1.5 break-words text-sm font-semibold leading-5 text-slate-900">{value}</p></div>;
}
