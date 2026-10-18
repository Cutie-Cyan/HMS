import { useState, type FormEvent, type ReactNode } from "react";
import { CheckCircle2, ClipboardList, ShieldCheck } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { getSupabaseClient } from "../../lib/supabase";

const inputClass = "mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10";
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-sm font-medium text-slate-700">{label}{children}</label>;
}

export function PublicPatientRegistrationPage() {
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [sex, setSex] = useState("unknown");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [pwdOrSenior, setPwdOrSenior] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { error: submitError } = await getSupabaseClient()
        .from("patient_registration_submissions")
        .insert({
          first_name: firstName.trim(),
          middle_name: middleName.trim() || null,
          last_name: lastName.trim(),
          date_of_birth: dateOfBirth,
          sex,
          phone: phone.trim() || null,
          address: address.trim() || null,
          pwd_or_senior: pwdOrSenior,
        });
      if (submitError) throw submitError;
      setSubmitted(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to send your form. Please try again or ask hospital staff for help.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-teal-700 text-white"><ClipboardList size={24}/></div>
          <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">HMS · Patient intake</p><h1 className="text-2xl font-semibold tracking-tight text-slate-900">Patient registration form</h1></div>
        </div>
        <p className="mb-6 text-sm leading-6 text-slate-600">Fill in your details before registration. An Information Officer will review your submission before it becomes an official hospital record.</p>
        {submitted ? (
          <Card><CardContent><div className="py-8 text-center"><CheckCircle2 className="mx-auto text-emerald-600" size={42}/><h2 className="mt-4 text-xl font-semibold text-slate-900">Form submitted</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">Your details have been sent to the Information Officer for verification. This is not yet an official patient number or confirmation of registration.</p></div></CardContent></Card>
        ) : (
          <Card>
            <CardHeader><h2 className="font-semibold text-slate-900">Personal information</h2><p className="mt-1 text-sm text-slate-500">Fields marked required must be completed.</p></CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="First name *"><input required maxLength={100} autoComplete="given-name" value={firstName} onChange={e=>setFirstName(e.target.value)} className={inputClass}/></Field>
                  <Field label="Middle name"><input maxLength={100} autoComplete="additional-name" value={middleName} onChange={e=>setMiddleName(e.target.value)} className={inputClass}/></Field>
                  <Field label="Last name *"><input required maxLength={100} autoComplete="family-name" value={lastName} onChange={e=>setLastName(e.target.value)} className={inputClass}/></Field>
                  <Field label="Date of birth *"><input required type="date" max={new Date().toISOString().slice(0,10)} autoComplete="bday" value={dateOfBirth} onChange={e=>setDateOfBirth(e.target.value)} className={inputClass}/></Field>
                  <Field label="Sex"><select value={sex} onChange={e=>setSex(e.target.value)} className={inputClass}><option value="unknown">Prefer not to specify</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option></select></Field>
                  <Field label="Phone number"><input type="tel" maxLength={40} autoComplete="tel" value={phone} onChange={e=>setPhone(e.target.value)} className={inputClass}/></Field>
                </div>
                <Field label="Address"><textarea rows={3} maxLength={500} autoComplete="street-address" value={address} onChange={e=>setAddress(e.target.value)} className={inputClass}/></Field>
                <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"><input type="checkbox" checked={pwdOrSenior} onChange={e=>setPwdOrSenior(e.target.checked)} className="mt-0.5 size-4 accent-teal-700"/><span>I am a PWD or senior citizen (discount eligibility will be verified by hospital staff).</span></label>
                {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
                <div className="rounded-xl bg-sky-50 p-3 text-sm leading-5 text-sky-900"><ShieldCheck size={17} className="mr-2 inline"/>Only submit information needed for patient registration. Staff will verify it before creating the official record.</div>
                <Button type="submit" disabled={busy} className="w-full">{busy ? "Submitting…" : "Submit registration form"}</Button>
              </form>
            </CardContent>
          </Card>
        )}
        <p className="mt-5 text-center text-xs text-slate-500">If you need assistance, please ask the hospital Information Officer.</p>
      </div>
    </main>
  );
}
