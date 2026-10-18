import { useMemo, useState, type FormEvent } from "react";
import { Printer, Stethoscope } from "lucide-react";
import { useSearchParams } from "react-router-dom";
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
  ) years--;
  return String(years);
}

export function DoctorFormPage() {
  const patients = usePatientDirectory("");
  const doctors = useDoctors();
  const encounters = useOpenEncounters();
  const save = useSaveEncounter();
  const [searchParams] = useSearchParams();
  const requestedDoctorId = searchParams.get("doctorId");
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
    () => (patients.data ?? []).filter(
      (p) => p.status === "registered" || p.status === "in_emergency",
    ),
    [patients.data],
  );

  const choosePatient = (id: string) => {
    const existing: EncounterRecord | undefined = encounters.data?.find(
      (encounter) => encounter.patient_id === id && encounter.encounter_status === "open",
    );
    setPatientId(id);
    setEncounterId(existing?.encounter_id ?? "");
    const requestedDoctor = doctors.data?.find(
      (doctor) => doctor.id === requestedDoctorId && doctor.is_on_duty,
    );
    setDoctorId(
      existing?.doctor_id ?? requestedDoctor?.id ?? doctors.data?.find((doctor) => doctor.is_on_duty)?.id ?? "",
    );
    setFindings(existing?.findings ?? "");
    setRecommendations(existing?.recommendations ?? "");
    setRecommendationType(existing?.recommendation_type ?? "");
    setError("");
    setSuccess("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!patientId) {
      setError("Select a patient before saving the consultation.");
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
      setSuccess("Consultation details saved successfully.");
      await Promise.all([patients.refetch(), encounters.refetch()]);
    } catch (cause) {
      setError(humanizeError(cause));
    }
  };

  const printablePatient: PatientRecord | undefined = patient;
  const fullName = printablePatient
    ? [printablePatient.first_name, printablePatient.middle_name, printablePatient.last_name]
        .filter(Boolean).join(" ")
    : "Select a patient";

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {(error || success) && (
        <div role={error ? "alert" : "status"} className={`rounded-xl border p-3 text-sm ${error ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
          {error || success}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 font-semibold">
            <Stethoscope size={18} className="text-teal-700" />
            Consultation details
          </div>
        </CardHeader>
        <CardContent>
          {patients.isError || doctors.isError || encounters.isError ? (
            <div role="alert" className="mb-4 text-sm text-rose-700">
              Unable to load consultation information. Check your connection and retry.
            </div>
          ) : null}

          <form onSubmit={submit} className="space-y-5">
            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900">Patient information</h2>
                {patient && <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-800">{patient.patient_number}</span>}
              </div>
              <label className="block text-sm font-medium text-slate-700">
                Select patient
                <select required value={patientId} onChange={(event) => choosePatient(event.target.value)} className={inputClass}>
                  <option value="">Select registered or emergency patient…</option>
                  {selectablePatients.map((item) => (
                    <option key={item.patient_id} value={item.patient_id}>
                      {item.patient_number} — {item.first_name} {item.last_name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Info label="Full name" value={fullName} />
                <Info label="Age" value={age(printablePatient?.date_of_birth ?? null)} />
                <Info label="Sex" value={printablePatient?.sex ?? "—"} />
                <Info label="Patient status" value={printablePatient?.status?.replaceAll("_", " ") ?? "—"} />
              </div>
              <label className="mt-4 block text-sm font-medium text-slate-700">
                Attending doctor
                <select value={doctorId} onChange={(event) => setDoctorId(event.target.value)} className={inputClass}>
                  <option value="">No doctor selected</option>
                  {(doctors.data ?? []).map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.full_name}{doctor.is_on_duty ? " — on duty" : ""}
                    </option>
                  ))}
                </select>
              </label>
            </section>

            <div className="grid items-start gap-5 lg:grid-cols-2">
              <section className="rounded-xl border border-slate-200 p-4">
                <h2 className="mb-3 text-sm font-semibold text-slate-900">Findings</h2>
                <textarea
                  rows={12}
                  value={findings}
                  onChange={(event) => setFindings(event.target.value)}
                  placeholder="Record assessment, symptoms, and clinical findings…"
                  className={inputClass}
                />
              </section>
              <section className="rounded-xl border border-slate-200 p-4">
                <h2 className="mb-3 text-sm font-semibold text-slate-900">Recommendation</h2>
                <label className="block text-sm font-medium text-slate-700">
                  Recommendation type
                  <select value={recommendationType} onChange={(event) => setRecommendationType(event.target.value)} className={inputClass}>
                    <option value="">Not specified</option>
                    <option value="consult">Consult</option>
                    <option value="lab">Lab</option>
                    <option value="medicine">Medicine</option>
                    <option value="mixed">Mixed</option>
                  </select>
                </label>
                <label className="mt-4 block text-sm font-medium text-slate-700">
                  Recommendation details
                  <textarea
                    rows={9}
                    value={recommendations}
                    onChange={(event) => setRecommendations(event.target.value)}
                    placeholder="Record treatment, tests, medicines, or next steps…"
                    className={inputClass}
                  />
                </label>
              </section>
            </div>

            <div className="no-print flex flex-wrap gap-2">
              <Button type="submit" disabled={save.isPending || patients.isLoading || doctors.isLoading || encounters.isLoading}>
                {save.isPending ? "Saving…" : encounterId ? "Update consultation" : "Save consultation"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => window.print()} disabled={!patient}>
                <Printer size={16} /> Print / Save PDF
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="print-sheet rounded-xl border border-slate-200 bg-white p-6 md:p-10">
        <div className="border-b-2 border-slate-900 pb-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em]">Hospital Management System</p>
          <h2 className="mt-2 text-2xl font-bold">Emergency Consultation Form</h2>
          <p className="mt-1 text-xs text-slate-500">Patient clinical record</p>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4 border-b border-slate-300 pb-5 md:grid-cols-4">
          <Info label="Patient name" value={fullName} />
          <Info label="Age" value={age(printablePatient?.date_of_birth ?? null)} />
          <Info label="Sex" value={printablePatient?.sex ?? "—"} />
          <Info label="Doctor" value={doctors.data?.find((doctor) => doctor.id === doctorId)?.full_name ?? selectedEncounter?.doctor_name ?? "—"} />
        </div>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <section className="min-h-52 border border-slate-300 p-4">
            <h3 className="border-b border-slate-200 pb-2 text-sm font-bold uppercase tracking-wide">Findings</h3>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{findings || "No findings entered."}</p>
          </section>
          <section className="min-h-52 border border-slate-300 p-4">
            <h3 className="border-b border-slate-200 pb-2 text-sm font-bold uppercase tracking-wide">Recommendation</h3>
            <p className="mt-2 text-xs font-semibold uppercase text-slate-500">{recommendationType || "Type not specified"}</p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{recommendations || "No recommendation entered."}</p>
          </section>
        </div>
        <div className="mt-12 grid grid-cols-2 gap-12 text-center text-xs">
          <div className="border-t border-slate-500 pt-2">Emergency Nurse signature</div>
          <div className="border-t border-slate-500 pt-2">Doctor / consultation reference</div>
        </div>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-white p-3 ring-1 ring-slate-200">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold capitalize text-slate-800">{value}</p>
    </div>
  );
}
