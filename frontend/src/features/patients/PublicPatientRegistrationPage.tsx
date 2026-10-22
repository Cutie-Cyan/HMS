import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { CheckCircle2, ClipboardList, ImagePlus, ScanLine, Trash2 } from "lucide-react";
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
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idPreview, setIdPreview] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [idScanStatus, setIdScanStatus] = useState("");
  useEffect(() => { if (!idFile) { setIdPreview(""); return; } const url = URL.createObjectURL(idFile); setIdPreview(url); return () => URL.revokeObjectURL(url); }, [idFile]);
  async function chooseIdFile(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) { setError("Choose a JPG, PNG, or WEBP image under 10 MB."); return; }
    setError(""); setIdFile(file); setIdNumber(""); setIdScanStatus("Scanning ID number…");
    try {
      const w = window as Window & { Tesseract?: { recognize: (image: File, lang: string) => Promise<{ data: { text: string } }> } };
      if (!w.Tesseract) await new Promise<void>((resolve, reject) => { const script = document.createElement("script"); script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"; script.onload = () => resolve(); script.onerror = () => reject(new Error("Could not load text scanner")); document.head.appendChild(script); });
      const result = await w.Tesseract!.recognize(file, "eng");
      const text = result.data.text;
      const lines = text.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
      const candidate = lines.find(value => /\d{4,}/.test(value) && /^[A-Z0-9\s-]{4,30}$/i.test(value))?.replace(/\s+/g, " ").trim() ?? text.match(/[A-Z0-9][A-Z0-9 -]{3,24}\d[A-Z0-9 -]*/i)?.[0]?.replace(/\s+/g, " ").trim() ?? "";
      if (candidate) { setIdNumber(candidate); setIdScanStatus("ID number detected. Check it against the number printed on your ID."); }
      else setIdScanStatus("No clear ID number detected. Enter it manually or take a clearer photo.");
    } catch { setIdScanStatus("Automatic scanning failed. Enter the ID number manually."); }
  }
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
          id_number: pwdOrSenior ? (idNumber.trim() || null) : null,
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
          <div><h1 className="text-2xl font-semibold tracking-tight text-slate-900">Patient registration form</h1></div>
        </div>
        {submitted ? (
          <Card><CardContent><div className="py-8 text-center"><CheckCircle2 className="mx-auto text-emerald-600" size={42}/><h2 className="mt-4 text-xl font-semibold text-slate-900">Form submitted</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">Your details have been sent to the Information Officer for verification. This is not yet an official patient number or confirmation of registration.</p></div></CardContent></Card>
        ) : (
          <Card>
            <CardHeader><h2 className="font-semibold text-slate-900">Personal information</h2></CardHeader>
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
<div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={pwdOrSenior} onChange={e=>{setPwdOrSenior(e.target.checked); if (!e.target.checked) setIdFile(null);}} className="size-4 accent-teal-700"/><span className="font-medium">PWD / Senior citizen</span></label>
                  {pwdOrSenior && <div className="space-y-3">
                    {idFile && <div className="relative flex min-h-44 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-2"><img src={idPreview} alt="ID preview" className="max-h-64 w-full object-contain"/><button type="button" aria-label="Remove ID image" title="Remove ID image" onClick={()=>{setIdFile(null);setIdNumber("");setIdScanStatus("");}} className="absolute right-2 top-2 grid size-8 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15}/></button></div>}
                    <label className="block text-sm font-medium text-slate-700">ID number<input value={idNumber} onChange={e=>setIdNumber(e.target.value)} maxLength={100} autoComplete="off" placeholder="Scan an ID or enter the number" className={inputClass}/></label>
                    {idScanStatus && <p role="status" className="text-xs text-slate-500">{idScanStatus}</p>}
                    <div className="flex flex-wrap gap-2">
                      <label className="inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"><ImagePlus size={16}/> Upload file<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={e=>chooseIdFile(e.target.files?.[0])}/></label>
                      <label className="inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"><ScanLine size={16}/> Scan ID<input type="file" accept="image/*" capture="environment" className="sr-only" onChange={e=>chooseIdFile(e.target.files?.[0])}/></label>
                    </div>
                  </div>}
                </div>
                {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
                <Button type="submit" disabled={busy} className="w-full">{busy ? "Submitting…" : "Submit registration form"}</Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
