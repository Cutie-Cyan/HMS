import { useMemo, useState, type FormEvent } from "react";
import { Printer, RefreshCw, Stethoscope } from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import {
  humanizeError,
  useDoctors,
  useOpenEncounters,
  usePatientDirectory,
  useSaveEncounter,
  type EncounterRecord,
  type PatientRecord,
} from "../patients/data";

const inputClass =
  "mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100";
function age(date: string | null) {
  if (!date) return "—";
  const born = new Date(date);
  const now = new Date();
  let years = now.getFullYear() - born.getFullYear();
  if (
    now.getMonth() < born.getMonth() ||
    (now.getMonth() === born.getMonth() && now.getDate() < born.getDate())
  )
    years--;
  return String(years);
}
export function DoctorFormPage() {
  const patients = usePatientDirectory("");
  const doctors = useDoctors();
  const encounters = useOpenEncounters();
  const save = useSaveEncounter();
  const [patientId, setPatientId] = useState("");
  const [encounterId, setEncounterId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [findings, setFindings] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [recommendationType, setRecommendationType] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const patient = patients.data?.find((p) => p.patient_id === patientId);
  const selectedEncounter = encounters.data?.find(
    (e) => e.encounter_id === encounterId,
  );
  const selectablePatients = useMemo(
    () =>
      (patients.data ?? []).filter(
        (p) => p.status === "registered" || p.status === "in_emergency",
      ),
    [patients.data],
  );
  const choosePatient = (id: string, encounter?: EncounterRecord) => {
    setPatientId(id);
    setEncounterId(encounter?.encounter_id ?? "");
    setDoctorId(
      encounter?.doctor_id ?? doctors.data?.find((d) => d.is_on_duty)?.id ?? "",
    );
    setFindings(encounter?.findings ?? "");
    setRecommendations(encounter?.recommendations ?? "");
    setRecommendationType(encounter?.recommendation_type ?? "");
    setError("");
    setSuccess("");
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!patientId) {
      setError("Select a patient before recording the form.");
      return;
    }
    try {
      await save.mutateAsync({
        patientId,
        encounterId: encounterId || undefined,
        doctorId: doctorId || null,
        findings,
        recommendations,
        recommendationType,
      });
      setSuccess("Doctor form saved to the patient encounter.");
      setEncounterId("");
      await Promise.all([patients.refetch(), encounters.refetch()]);
    } catch (cause) {
      setError(humanizeError(cause));
    }
  };
  const printablePatient: PatientRecord | undefined = patient;
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="no-print">
        <p className="text-sm font-medium text-teal-700">Emergency Nurse</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
          Doctor form & encounters
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Record the doctor’s findings and recommendation. Doctors do not sign
          in; the Emergency Nurse records the consultation.
        </p>
      </header>
      {(error || success) && (
        <div
          role={error ? "alert" : "status"}
          className={`no-print rounded-lg p-3 text-sm ${error ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-800"}`}
        >
          {error || success}
        </div>
      )}
      <div className="no-print grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(300px,.75fr)]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 font-semibold">
              <Stethoscope size={18} className="text-teal-700" /> Consultation
              details
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Choose a registered/emergency patient or reopen a form from the
              queue.
            </p>
          </CardHeader>
          <CardContent>
            {patients.isError || doctors.isError ? (
              <div role="alert" className="text-sm text-rose-700">
                Unable to load patients or doctors. Check your connection and
                retry.
              </div>
            ) : null}
            <form onSubmit={submit} className="space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                Patient
                <select
                  required
                  value={patientId}
                  onChange={(e) => choosePatient(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select patient…</option>
                  {selectablePatients.map((p) => (
                    <option key={p.patient_id} value={p.patient_id}>
                      {p.patient_number} — {p.first_name} {p.last_name} (
                      {p.status.replaceAll("_", " ")})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Doctor
                <select
                  value={doctorId}
                  onChange={(e) => setDoctorId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">No doctor selected</option>
                  {(doctors.data ?? []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name}
                      {d.is_on_duty ? " — on duty" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-xs text-slate-500">
                If no preferred doctor is selected, the first active on-duty
                doctor is suggested when available.
              </p>
              <label className="block text-sm font-medium text-slate-700">
                Findings
                <textarea
                  rows={5}
                  value={findings}
                  onChange={(e) => setFindings(e.target.value)}
                  placeholder="Enter the doctor’s findings…"
                  className={inputClass}
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
                <label className="block text-sm font-medium text-slate-700">
                  Recommendation type
                  <select
                    value={recommendationType}
                    onChange={(e) => setRecommendationType(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Not specified</option>
                    <option value="consult">Consult</option>
                    <option value="lab">Lab</option>
                    <option value="medicine">Medicine</option>
                    <option value="mixed">Mixed</option>
                  </select>
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Recommendation
                  <textarea
                    rows={3}
                    value={recommendations}
                    onChange={(e) => setRecommendations(e.target.value)}
                    placeholder="Recommended treatment or next step…"
                    className={inputClass}
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  disabled={
                    save.isPending || patients.isLoading || doctors.isLoading
                  }
                >
                  {save.isPending
                    ? "Saving…"
                    : encounterId
                      ? "Update encounter"
                      : "Save doctor form"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => window.print()}
                  disabled={!patient}
                >
                  {" "}
                  <Printer size={16} /> Print / Save PDF
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Open encounter queue</h2>
            <p className="mt-1 text-sm text-slate-500">
              Select a patient to review or update their current form.
            </p>
          </CardHeader>
          <CardContent>
            {encounters.isLoading ? (
              <p className="text-sm text-slate-500">Loading open encounters…</p>
            ) : encounters.isError ? (
              <div>
                <p role="alert" className="text-sm text-rose-700">
                  Could not load the encounter queue.
                </p>
                <Button
                  className="mt-3"
                  variant="secondary"
                  onClick={() => void encounters.refetch()}
                >
                  <RefreshCw size={15} /> Retry
                </Button>
              </div>
            ) : encounters.data?.length ? (
              <ul className="divide-y divide-slate-100">
                {encounters.data.map((e) => (
                  <li key={e.encounter_id} className="py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">
                          {e.patient_name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {e.patient_number} ·{" "}
                          {e.doctor_name ?? "Doctor not assigned"}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                          {e.findings || "No findings recorded yet"}
                        </p>
                      </div>
                      <Badge tone="info">Open</Badge>
                    </div>
                    <Button
                      className="mt-2 min-h-8 px-3"
                      variant="secondary"
                      onClick={() => choosePatient(e.patient_id, e)}
                    >
                      Open form
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="py-6 text-center">
                <p className="text-sm font-medium">No open encounters</p>
                <p className="mt-1 text-xs text-slate-500">
                  Choose a registered patient to start the first encounter.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <section className="print-sheet rounded-xl border border-slate-200 bg-white p-6 md:p-10">
        <div className="border-b-2 border-slate-900 pb-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em]">
            Hospital Management System
          </p>
          <h2 className="mt-2 text-2xl font-bold">Doctor Consultation Form</h2>
          <p className="mt-1 text-xs text-slate-500">Patient clinical record</p>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4 border-b border-slate-300 pb-5 md:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Patient name
            </p>
            <p className="mt-1 font-semibold">
              {printablePatient
                ? [
                    printablePatient.first_name,
                    printablePatient.middle_name,
                    printablePatient.last_name,
                  ]
                    .filter(Boolean)
                    .join(" ")
                : "Select a patient"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Age
            </p>
            <p className="mt-1 font-semibold">
              {age(printablePatient?.date_of_birth ?? null)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Sex
            </p>
            <p className="mt-1 font-semibold capitalize">
              {printablePatient?.sex ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Doctor
            </p>
            <p className="mt-1 font-semibold">
              {doctors.data?.find((d) => d.id === doctorId)?.full_name ??
                selectedEncounter?.doctor_name ??
                "—"}
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <section className="min-h-52 border border-slate-300 p-4">
            <h3 className="border-b border-slate-200 pb-2 text-sm font-bold uppercase tracking-wide">
              Findings
            </h3>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
              {findings || "No findings entered."}
            </p>
          </section>
          <section className="min-h-52 border border-slate-300 p-4">
            <h3 className="border-b border-slate-200 pb-2 text-sm font-bold uppercase tracking-wide">
              Recommendation
            </h3>
            <p className="mt-2 text-xs font-semibold uppercase text-slate-500">
              {recommendationType || "Type not specified"}
            </p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
              {recommendations || "No recommendation entered."}
            </p>
          </section>
        </div>
        <div className="mt-12 grid grid-cols-2 gap-12 text-center text-xs">
          <div className="border-t border-slate-500 pt-2">
            Emergency Nurse signature
          </div>
          <div className="border-t border-slate-500 pt-2">
            Doctor / consultation reference
          </div>
        </div>
        <p className="mt-8 text-center text-[10px] text-slate-400">
          Print or choose “Save as PDF” in the system print dialog. No doctor
          account is required.
        </p>
      </section>
    </div>
  );
}
