import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, CheckCircle2, RefreshCw, Search, X } from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { usePatientDirectory } from "./data";

function ageLabel(date: string | null) {
  if (!date) return "—";
  const birth = new Date(date);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
  return `${age} yrs`;
}

type QRDetector = { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> };
type QRWindow = Window & { BarcodeDetector?: new (options?: { formats: string[] }) => QRDetector };

function patientNumberFromQR(rawValue: string): string {
  try {
    const url = new URL(rawValue);
    return url.searchParams.get("patientNumber") || url.searchParams.get("patient_number") || url.searchParams.get("patient") || rawValue;
  } catch {
    return rawValue.trim();
  }
}

export function PatientWorkspace() {
  const [search, setSearch] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanError, setScanError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const patients = usePatientDirectory(search);

  useEffect(() => {
    if (!scannerOpen) return;
    let stopped = false;
    let frame = 0;
    let detector: QRDetector | null = null;
    const stopCamera = () => {
      stopped = true;
      if (frame) cancelAnimationFrame(frame);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
    const scan = async () => {
      if (stopped || !videoRef.current || !detector) return;
      try {
        if (videoRef.current.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          const codes = await detector.detect(videoRef.current);
          const value = codes[0]?.rawValue;
          if (value) {
            setSearch(patientNumberFromQR(value));
            setScannerOpen(false);
            return;
          }
        }
      } catch {
        // Continue scanning while the camera focuses.
      }
      if (!stopped) frame = requestAnimationFrame(() => void scan());
    };
    const start = async () => {
      try {
        const Detector = (window as QRWindow).BarcodeDetector;
        if (!Detector) {
          setScanError("QR scanning is not supported by this browser. Open HMS in the latest Chrome or search by patient number.");
          return;
        }
        detector = new Detector({ formats: ["qr_code"] });
        streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (stopped) return;
        if (videoRef.current) {
          videoRef.current.srcObject = streamRef.current;
          await videoRef.current.play();
          setScanError("");
          frame = requestAnimationFrame(() => void scan());
        }
      } catch {
        setScanError("Camera access was blocked or unavailable. Allow camera permission and try again.");
      }
    };
    void start();
    return stopCamera;
  }, [scannerOpen]);

  return <div className="mx-auto max-w-6xl space-y-6 pb-8">
    <div><h1 className="text-2xl font-semibold tracking-tight text-slate-900">Patient Records</h1><p className="mt-1 text-sm text-slate-500">Search registered records or scan a patient QR code.</p></div>
    {scannerOpen && <Card><CardHeader><div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">Scan patient QR code</h2><p className="mt-1 text-sm text-slate-500">Point the camera at a QR code containing the patient number.</p></div><Button variant="secondary" onClick={() => setScannerOpen(false)} aria-label="Close scanner"><X size={16}/></Button></div></CardHeader><CardContent><video ref={videoRef} muted playsInline className="mx-auto max-h-[420px] w-full rounded-xl bg-slate-950 object-contain"/>{scanError && <p role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{scanError}</p>}<div className="mt-3 flex items-center gap-2 text-xs text-slate-500"><Camera size={15}/> Camera permission is required. Use HTTPS or localhost.</div></CardContent></Card>}
    <Card><CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">Patient directory</h2><p className="mt-1 text-sm text-slate-500">Search by patient number or patient name.</p></div><div className="flex flex-wrap gap-2"><label className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-400 focus-within:border-sky-400"><Search size={16}/><input aria-label="Search patients" placeholder="Search patients…" value={search} onChange={e=>setSearch(e.target.value)} className="min-w-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 sm:w-56"/></label><Button variant="secondary" onClick={()=>void patients.refetch()} disabled={patients.isFetching} aria-label="Refresh patient records"><RefreshCw size={15}/></Button><Button onClick={()=>{setScanError("");setScannerOpen(true);}}><Camera size={15}/> Scan QR</Button></div></div></CardHeader><CardContent>
      {patients.isLoading?<p className="py-8 text-center text-sm text-slate-500">Loading patient records…</p>:patients.isError?<div className="py-6 text-center"><p role="alert" className="text-sm text-rose-700">Could not load patient records. Check your access and try again.</p><Button className="mt-3" onClick={()=>void patients.refetch()}>Retry</Button></div>:patients.data?.length?<div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th className="py-3 pr-4">Patient</th><th className="py-3 pr-4">Age</th><th className="py-3 pr-4">Sex</th><th className="py-3 pr-4">Status</th><th className="py-3">Patient number</th></tr></thead><tbody className="divide-y divide-slate-100">{patients.data.map(p=><tr key={p.patient_id} className="transition-colors hover:bg-slate-50/80"><td className="py-3 pr-4 font-medium text-slate-900">{p.first_name} {p.middle_name?p.middle_name+" ":""}{p.last_name}</td><td className="py-3 pr-4">{ageLabel(p.date_of_birth)}</td><td className="py-3 pr-4 capitalize">{p.sex}</td><td className="py-3 pr-4"><Badge tone={p.status==="registered"?"info":"neutral"}>{p.status.replaceAll("_"," ")}</Badge></td><td className="py-3 font-mono text-xs">{p.patient_number}</td></tr>)}</tbody></table></div>:<div className="py-10 text-center"><CheckCircle2 className="mx-auto text-slate-300" size={30}/><p className="mt-3 font-medium">No patient records found</p><p className="mt-1 text-sm text-slate-500">{search?"No patient matched the scanned code or search. Try the patient number printed on the card.":"Registered patients will appear here."}</p></div>}
    </CardContent></Card>
  </div>;
}
