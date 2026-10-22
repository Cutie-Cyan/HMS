import { useEffect, useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  PackagePlus,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { getSupabaseClient } from "../../lib/supabase";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import {
  requestError,
  useAcceptLabRequest,
  useFulfillRequest,
  useInventoryItems,
  useRequestWorkspace,
  useSaveInventoryItem,
  type HmsRequest,
  type InventoryItem,
  type RequestType,
} from "../requests/data";

const fieldClass =
  "mt-1.5 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10";
const money = (value: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    Number(value ?? 0),
  );
const tone = (status: string) =>
  status === "released"
    ? ("success" as const)
    : status === "paid"
      ? ("info" as const)
      : status === "pending_payment"
        ? ("warning" as const)
        : ("neutral" as const);

function FulfillmentCard({
  request,
  isLab,
  busy,
  onFulfill,
  onAccept,
  accepting,
}: {
  request: HmsRequest;
  isLab: boolean;
  busy: boolean;
  accepting: boolean;
  onFulfill: (id: string, result: string) => Promise<void>;
  onAccept: (id: string) => Promise<void>;
}) {
  const [result, setResult] = useState("");
  const [specimenType, setSpecimenType] = useState("");
  const [specimenStatus, setSpecimenStatus] = useState("received_acceptable");
  const [conductedAt, setConductedAt] = useState("");
  const [cbcValues, setCbcValues] = useState({
    wbc: "", rbc: "", hemoglobin: "", hematocrit: "",
    platelets: "", mcv: "", mch: "", mchc: "",
  });
  const [commonValues, setCommonValues] = useState<Record<string, string>>({});
  const requestedTest = request.items.map((item) => item.description).join(" ").toLowerCase();
  const isCBC = isLab && (requestedTest.includes("cbc") || requestedTest.includes("complete blood count"));
  const isUrinalysis = isLab && (requestedTest.includes("urinalysis") || requestedTest.includes("urine"));
  const isPregnancy = isLab && requestedTest.includes("pregnancy");
  const isBloodTyping = isLab && (requestedTest.includes("blood typing") || requestedTest.includes("blood type"));
  const testFields = isUrinalysis ? [
    { key: "color", label: "Color" }, { key: "appearance", label: "Appearance / clarity" },
    { key: "specific_gravity", label: "Specific gravity" }, { key: "ph", label: "pH" },
    { key: "protein", label: "Protein" }, { key: "glucose", label: "Glucose" },
    { key: "ketones", label: "Ketones" }, { key: "blood", label: "Blood" },
    { key: "nitrite", label: "Nitrite" }, { key: "leukocyte_esterase", label: "Leukocyte esterase" },
    { key: "microscopy", label: "Microscopy / other findings" },
  ] : isPregnancy ? [
    { key: "result", label: "Observed result (as per kit/procedure)" },
    { key: "method", label: "Method / kit" },
  ] : isBloodTyping ? [
    { key: "abo_group", label: "ABO group" }, { key: "rh_type", label: "Rh(D) type" },
    { key: "method", label: "Method / other findings" },
  ] : isLab && !isCBC ? [
    { key: "analyte", label: "Test / analyte(s) performed" },
    { key: "measured_value", label: "Measured result(s), units, and approved reference intervals" },
    { key: "additional_findings", label: "Additional findings / notes" },
  ] : [];
  const cbcFields = [
    { key: "wbc", label: "WBC", unit: "×10⁹/L" },
    { key: "rbc", label: "RBC", unit: "×10¹²/L" },
    { key: "hemoglobin", label: "Hemoglobin", unit: "g/dL" },
    { key: "hematocrit", label: "Hematocrit", unit: "%" },
    { key: "platelets", label: "Platelets", unit: "×10⁹/L" },
    { key: "mcv", label: "MCV", unit: "fL" },
    { key: "mch", label: "MCH", unit: "pg" },
    { key: "mchc", label: "MCHC", unit: "g/dL" },
  ] as const;
  const cbcResult = cbcFields
    .filter((field) => cbcValues[field.key].trim())
    .map((field) => `${field.label}: ${cbcValues[field.key].trim()} ${field.unit}`)
    .join("\n");
  const structuredResult = testFields
    .filter((field) => commonValues[field.key]?.trim())
    .map((field) => `${field.label}: ${commonValues[field.key].trim()}`)
    .join("\n");
  const resultBody = isCBC ? `CBC — Complete Blood Count\n${cbcResult}` : testFields.length ? structuredResult : result;
  const resultToSave = isLab
    ? [`Specimen: ${specimenType.trim() || "Not specified"}`, `Specimen status: ${specimenStatus.replaceAll("_", " ")}`, conductedAt.trim() ? `Conducted at: ${conductedAt.trim()}` : "", resultBody.trim()]
        .filter(Boolean).join("\n")
    : result;
  const structuredRequired = isUrinalysis
    ? ["color", "appearance"].every((key) => commonValues[key]?.trim())
    : isPregnancy || isBloodTyping
      ? commonValues[isPregnancy ? "result" : "abo_group"]?.trim().length > 0
      : isLab && !isCBC && !isUrinalysis && !isPregnancy && !isBloodTyping
        ? ["analyte", "measured_value"].every((key) => commonValues[key]?.trim())
        : true;
  const canRelease =
    (isLab ? request.status === "in_progress" : request.status === "paid") && (!isLab || resultBody.trim().length > 0) &&
    (!isCBC || cbcFields.every((field) => cbcValues[field.key].trim().length > 0)) &&
    (!isLab || (specimenType.trim().length > 0 && specimenStatus === "received_acceptable" && structuredRequired));
  return (
    <article className="rounded-2xl border border-[#e3e3e8] bg-white p-4 shadow-[0_1px_2px_rgb(20_20_35/3%),0_4px_16px_rgb(20_20_35/3%)] sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{request.patient_name}</p>
          <p className="mt-1 text-xs text-slate-500">
            {request.patient_number} ·{" "}
            {request.ward_name ?? "Emergency / outpatient"}
          </p>
        </div>
        <Badge tone={tone(request.status)}>
          {request.status.replaceAll("_", " ")}
        </Badge>
      </div>
      <div className="mt-3 space-y-2">
        {request.items.map((item) => (
          <div key={item.id} className="flex justify-between gap-3 text-sm">
            <span>
              {item.description} × {item.quantity}
            </span>
            <span>{money(Number(item.unit_price) * item.quantity)}</span>
          </div>
        ))}
      </div>
      {isLab && request.status === "in_progress" && (
        <section className="mt-4 space-y-4 rounded-xl border border-sky-100 bg-sky-50/60 p-4">
          <div>
            <p className="font-semibold text-slate-900">Laboratory work record</p>
            <p className="mt-1 text-xs text-slate-600">Record specimen handling and measured findings from the actual procedure. Use the laboratory's approved procedure and reference intervals; do not estimate results.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm font-medium text-slate-700">Specimen type
              <input required value={specimenType} onChange={(event) => setSpecimenType(event.target.value)} className={fieldClass} placeholder={isUrinalysis ? "e.g. urine" : isCBC ? "e.g. EDTA whole blood" : "Actual specimen type"} />
            </label>
            <label className="text-sm font-medium text-slate-700">Specimen condition
              <select required value={specimenStatus} onChange={(event) => setSpecimenStatus(event.target.value)} className={fieldClass}>
                <option value="received_acceptable">Received — acceptable</option>
                <option value="rejected">Rejected — do not release result</option>
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">Conducted date/time
              <input type="datetime-local" value={conductedAt} onChange={(event) => setConductedAt(event.target.value)} className={fieldClass} />
            </label>
          </div>
          {isCBC ? (
            <>
              <p className="text-sm font-semibold text-slate-800">CBC measurements</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {cbcFields.map((field) => (
                  <label key={field.key} className="text-sm font-medium text-slate-700">
                    {field.label} <span className="font-normal text-slate-500">({field.unit})</span>
                    <input required type="number" min="0" step="any" value={cbcValues[field.key]} onChange={(event) => setCbcValues((current) => ({ ...current, [field.key]: event.target.value }))} className={fieldClass} placeholder="Measured value" />
                  </label>
                ))}
              </div>
            </>
          ) : testFields.length ? (
            <>
              <p className="text-sm font-semibold text-slate-800">{isUrinalysis ? "Urinalysis findings" : isPregnancy ? "Pregnancy test findings" : isBloodTyping ? "Blood typing findings" : "Test measurements and findings"}</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {testFields.map((field) => (
                  <label key={field.key} className="text-sm font-medium text-slate-700">
                    {field.label}
                    {field.key === "microscopy" || field.key === "additional_findings" || field.key === "method" || field.key === "measured_value" ? (
                      <textarea rows={field.key === "measured_value" ? 4 : 2} required={field.key === "measured_value"} value={commonValues[field.key] ?? ""} onChange={(event) => setCommonValues((current) => ({ ...current, [field.key]: event.target.value }))} className={fieldClass} placeholder={field.key === "measured_value" ? "Enter each measured result, unit, and lab-approved reference interval" : "Enter actual finding"} />
                    ) : (
                      <input required={["color", "appearance", "result", "abo_group", "analyte"].includes(field.key)} value={commonValues[field.key] ?? ""} onChange={(event) => setCommonValues((current) => ({ ...current, [field.key]: event.target.value }))} className={fieldClass} placeholder="Enter measured / observed result" />
                    )}
                  </label>
                ))}
              </div>
            </>
          ) : null}
          {!isCBC && !testFields.length && (
            <label className="block text-sm font-medium text-slate-700">Conducted test and verified result
              <textarea rows={4} required value={result} onChange={(event) => setResult(event.target.value)} className={fieldClass} placeholder="Record the test actually performed, findings, units, and lab-approved reference interval where applicable." />
            </label>
          )}
          {specimenStatus === "rejected" && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">This specimen is rejected. Do not release a result; request a suitable replacement specimen.</p>}
        </section>
      )}
      {isLab && request.lab_result && (
        <p className="mt-3 rounded-xl border border-sky-100 bg-sky-50 p-3 text-sm text-sky-900">
          Saved result: {request.lab_result}
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <p className="text-sm text-slate-500">
          {request.status === "pending_payment"
            ? "Awaiting Cashier payment."
            : request.status === "paid"
              ? "Paid — ready for fulfillment."
              : request.status === "released"
                ? "Released successfully."
                : request.status.replaceAll("_", " ")}
        </p>
        {isLab && request.status === "paid" && (
          <Button disabled={accepting || busy} onClick={() => void onAccept(request.request_id)}>
            <ClipboardCheck size={16} />
            {accepting ? "Accepting…" : "Accept request"}
          </Button>
        )}
        {((isLab && request.status === "in_progress") || (!isLab && request.status === "paid")) && (
          <Button
            disabled={busy || !canRelease}
            onClick={() => {
              if (isLab) {
                void onFulfill(request.request_id, resultToSave);
                return;
              }
              if (window.confirm(`Release this medicine request for ${request.patient_name}?`)) {
                void onFulfill(request.request_id, resultToSave);
              }
            }}
          >
            <ClipboardCheck size={16} />
            {busy
              ? "Releasing…"
              : isLab
                ? "Save & submit result"
                : "Release medicine"}
          </Button>
        )}
      </div>
    </article>
  );
}

export function InventoryWorkspace() {
  const { profile } = useAuth();
  const location = useLocation();
  const type: RequestType = profile?.role === "lab" ? "lab" : "medicine";
  const inventory = useInventoryItems(type);
  const requests = useRequestWorkspace();
  const save = useSaveInventoryItem();
  const fulfill = useFulfillRequest();
  const acceptLab = useAcceptLabRequest();
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [view, setView] = useState<"stock" | "supplies" | "profit" | "requests" | "add" | "results">(() => location.pathname === "/profit-inventory" || location.pathname === "/lab-profit-inventory" ? "profit" : location.pathname === "/medicine-requests" || location.pathname === "/lab-requests" || location.pathname === "/cbc" ? "requests" : location.pathname === "/lab-results" ? "results" : location.pathname === "/lab-supplies" ? "supplies" : "stock");
  useEffect(() => {
    if (location.pathname === "/profit-inventory" || location.pathname === "/lab-profit-inventory") setView("profit");
    else if (location.pathname === "/medicine-requests" || location.pathname === "/lab-requests" || location.pathname === "/cbc") setView("requests");
    else if (location.pathname === "/lab-results") setView("results");
    else if (location.pathname === "/lab-supplies") setView("supplies");
    else if (location.pathname === "/medicine-stock" || location.pathname === "/lab-inventory" || location.pathname === "/inventory") setView("stock");
  }, [location.pathname]);
  const profit = useQuery({
    queryKey: ["profit-inventory", type],
    enabled: (profile?.role === "pharmacy" || profile?.role === "lab") && view === "profit",
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().from("profit_inventory").select("id, request_id, department, quantity, revenue, cost, profit, recorded_at").eq("department", type).order("recorded_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as { id: string; request_id: string; department: string; quantity: number; revenue: number; cost: number; profit: number; recorded_at: string }[];
    },
  });
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [unit, setUnit] = useState("unit");
  const [stock, setStock] = useState("0");
  const [price, setPrice] = useState("0");
  const [cost, setCost] = useState("0");
  const [lowStock, setLowStock] = useState("5");
  const [catalogType, setCatalogType] = useState<"requestable" | "supply">("requestable");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const reset = () => {
    setEditing(null);
    setName("");
    setCode("");
    setUnit("unit");
    setStock("0");
    setPrice("0");
    setCost("0");
    setLowStock("5");
    setCatalogType("requestable");
  };
  const edit = (item: InventoryItem) => {
    setEditing(item);
    setName(item.item_name);
    setCode(item.item_code);
    setUnit(item.unit);
    setStock(String(item.quantity_on_hand));
    setPrice(String(item.unit_price));
    setCost(String(item.unit_cost));
    setLowStock(String(item.low_stock_threshold));
    setCatalogType(item.catalog_type ?? "requestable");
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await save.mutateAsync({
        type,
        name,
        code,
        unit,
        stock: Number(stock),
        price: Number(price),
        cost: Number(cost),
        lowStock: Number(lowStock),
        catalogType,
        expectedStock: editing?.quantity_on_hand ?? null,
        id: editing?.id,
      });
      setMessage(editing ? "Inventory item updated." : "Inventory item added.");
      reset();
      if (type === "lab") setView(catalogType === "supply" ? "supplies" : "stock");
    } catch (cause) {
      setError(requestError(cause));
    }
  };
  const acceptLabRequest = async (requestId: string) => {
    setError("");
    setMessage("");
    try {
      await acceptLab.mutateAsync(requestId);
      setMessage("Request accepted into the laboratory queue. Complete the test, then open the request again to enter and submit results.");
    } catch (cause) {
      setError(requestError(cause));
    }
  };

  const release = async (requestId: string, result: string) => {
    setError("");
    setMessage("");
    try {
      await fulfill.mutateAsync({ requestId, labResult: result });
      setMessage(
        type === "lab"
          ? "Lab result saved and request released to the Nurse Station."
          : "Medicine request released; inventory and profit records are handled by database safeguards.",
      );
    } catch (cause) {
      setError(requestError(cause));
    }
  };
  const queue = (requests.data ?? []).filter((r) => r.request_type === type && (location.pathname !== "/cbc" || r.items.some((item) => item.description.toLowerCase().includes("cbc") || item.description.toLowerCase().includes("complete blood count"))));
  const incomingQueue = type === "lab" ? queue.filter((request) => request.status === "paid") : queue;
  const acceptedLabQueue = queue.filter((request) => request.status === "in_progress");

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      {(message || error) && (
        <div
          role={error ? "alert" : "status"}
          className={`hms-toast rounded-xl border p-3 text-sm shadow-xl ${error ? "border-rose-200 bg-white text-rose-800" : "border-emerald-200 bg-white text-emerald-800"}`}
        >
          {error || message}
        </div>
      )}
      {((profile?.role !== "pharmacy" && profile?.role !== "lab") || view === "add") && <Card>
        <CardHeader>
          <div className="flex items-center gap-2 font-semibold">
            <PackagePlus size={18} className="text-sky-700" />
            {editing ? (type === "lab" ? "Edit laboratory record" : "Edit medicine") : (type === "lab" ? "Add test or consumable" : "Add medicine")}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {type === "lab" ? "Configure diagnostic services for patient requests, or track supplies used internally by the laboratory. Consumables are never sold to patients." : editing ? "Update medicine details and pricing. Stock quantity is controlled by request fulfillment." : "Add medicine. Opening stock is set once; later stock changes happen through approved requests and fulfillment."}
          </p>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={submit}
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            <label className="text-sm font-medium text-slate-700">
              {type === "lab" ? (catalogType === "supply" ? "Consumable supply name" : "Diagnostic test / service name") : "Medicine name"}
              <input
                required
                maxLength={150}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              {type === "lab" ? (catalogType === "supply" ? "Supply code" : "Test / service code") : "Medicine code"}
              <input
                required
                maxLength={80}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Unit
              <input
                required
                maxLength={30}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Catalog type
              <select
                value={catalogType}
                onChange={(e) => { const nextType = e.target.value as "requestable" | "supply"; setCatalogType(nextType); if (type === "lab" && nextType === "supply") setPrice("0"); }}
                className={fieldClass}
              >
                <option value="requestable">{type === "lab" ? "Diagnostic test / service" : "Medicine / requestable"}</option>
                <option value="supply">Internal supply (not requestable)</option>
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              {editing ? "Current stock (managed by requests)" : "Opening stock"}
              <input
                required
                type="number"
                min="0"
                step="1"
                value={stock}
                readOnly={Boolean(editing)}
                onChange={(e) => setStock(e.target.value)}
                className={`${fieldClass} ${editing ? "cursor-not-allowed bg-slate-100 text-slate-500" : ""}`}
              />
            </label>
            {(type !== "lab" || catalogType !== "supply") && <label className="text-sm font-medium text-slate-700">
              {type === "lab" ? "Test / service fee (₱)" : "Selling price (₱)"}
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className={fieldClass}
              />
            </label>}
            <label className="text-sm font-medium text-slate-700">
              {type === "lab" ? "Internal cost (₱)" : "Unit cost (₱)"}
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Low-stock threshold
              <input
                required
                type="number"
                min="0"
                step="1"
                value={lowStock}
                onChange={(e) => setLowStock(e.target.value)}
                className={fieldClass}
              />
            </label>
            <div className="flex w-full items-end justify-end gap-2">
              {editing && (
                <Button type="button" variant="secondary" onClick={reset}>
                  Cancel
                </Button>
              )}
              <Button type="submit" disabled={save.isPending}>
                {save.isPending
                  ? "Saving…"
                  : editing
                    ? "Save changes"
                    : "Add item"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>}

      {((profile?.role !== "pharmacy" && profile?.role !== "lab") || view === "stock") && <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 font-semibold">
              <Boxes size={18} className="text-sky-700" /> {type === "lab" ? "Laboratory inventory" : "Medicine stock"}
            </div>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              {profile?.role === "lab" && <Button onClick={() => { reset(); setCatalogType("requestable"); setView("add"); }}>
                <PackagePlus size={15} /> Add Test
              </Button>}
              {profile?.role === "pharmacy" && <Button onClick={() => { reset(); setView("add"); }}>
                <PackagePlus size={15} /> Add medicine
              </Button>}
              <Button
                variant="secondary"
                className="!size-9 !min-h-9 !p-0"
                aria-label="Refresh inventory"
                title="Refresh"
                onClick={() => void inventory.refetch()}
                disabled={inventory.isFetching}
              >
                <RefreshCw size={15} className={inventory.isFetching ? "animate-spin" : ""} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {inventory.isLoading ? (
            <p className="py-6 text-sm text-slate-500">Loading inventory…</p>
          ) : inventory.isError ? (
            <p role="alert" className="py-6 text-sm text-rose-700">
              Could not load department inventory.
            </p>
          ) : inventory.data?.filter((item) => type !== "lab" || (item.catalog_type ?? "requestable") === "requestable").length ? (
            <div className="space-y-3">
              {inventory.data.filter((item) => type !== "lab" || (item.catalog_type ?? "requestable") === "requestable").map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e3e3e8] bg-[#fafafd] p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {item.item_name}{" "}{item.catalog_type === "supply" && <Badge tone="neutral">Supply</Badge>}
                      <span className="font-mono text-xs text-slate-400">
                        {item.item_code}
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {item.catalog_type === "supply" ? `Internal cost ${money(Number(item.unit_cost))} / ${item.unit} · ` : `Service fee ${money(Number(item.unit_price))} · `}threshold{" "}
                      {item.low_stock_threshold}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge
                        tone={
                          item.quantity_on_hand <= item.low_stock_threshold
                            ? "warning"
                            : "success"
                        }
                      >
                        {item.quantity_on_hand} {item.unit}(s) in stock
                      </Badge>
                      {!item.is_active && (
                        <Badge tone="neutral">Inactive</Badge>
                      )}
                      {item.quantity_on_hand <= item.low_stock_threshold && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-800">
                          <AlertTriangle size={13} /> Low stock
                        </span>
                      )}
                    </div>
                  </div>
                  <Button variant="secondary" onClick={() => { edit(item); setView("add"); }}>
                    Update details
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <CheckCircle2 className="mx-auto text-slate-300" size={28} />
              <p className="mt-2 font-medium">{type === "lab" ? "No diagnostic tests configured" : "No medicines configured"}</p>
              <p className="mt-1 text-sm text-slate-500">
                {type === "lab" ? "Add a diagnostic test or service using Add Test." : "Add real pharmacy stock above before accepting requests."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>}
      {profile?.role === "lab" && view === "supplies" && <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-semibold"><Boxes size={18} className="text-sky-700" /> Laboratory Supplies & Equipment</div>
            <Button onClick={() => { reset(); setCatalogType("supply"); setPrice("0"); setView("add"); }}><PackagePlus size={15} /> Add Supply</Button>
          </div>
        </CardHeader>
        <CardContent>
          {inventory.isLoading ? <p className="py-4 text-sm text-slate-500">Loading supplies and equipment…</p> : inventory.isError ? <p role="alert" className="py-4 text-sm text-rose-700">Could not load supplies and equipment.</p> : (inventory.data ?? []).filter((item) => item.catalog_type === "supply").length ? <div className="space-y-3">
            {(inventory.data ?? []).filter((item) => item.catalog_type === "supply").map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e3e3e8] bg-[#fafafd] p-3">
              <div className="min-w-0">
                <p className="font-medium">{item.item_name} <Badge tone="neutral">Internal stock</Badge> <span className="font-mono text-xs text-slate-400">{item.item_code}</span></p>
                <p className="mt-1 text-sm text-slate-500">Internal cost {money(Number(item.unit_cost))} / {item.unit} · low-stock threshold {item.low_stock_threshold}</p>
                <div className="mt-2 flex flex-wrap gap-2"><Badge tone={item.quantity_on_hand <= item.low_stock_threshold ? "warning" : "success"}>{item.quantity_on_hand} {item.unit}(s) in stock</Badge>{!item.is_active && <Badge tone="neutral">Inactive</Badge>}{item.quantity_on_hand <= item.low_stock_threshold && <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-800"><AlertTriangle size={13} /> Low stock</span>}</div>
              </div>
              <Button variant="secondary" onClick={() => { edit(item); setView("add"); }}>Update details</Button>
            </div>)}
          </div> : <p className="py-6 text-center text-sm text-slate-500">No supplies or equipment added yet. Add internal stock here, separately from diagnostic tests.</p>}
        </CardContent>
      </Card>}
      {profile?.role === "lab" && view === "results" && <Card><CardHeader><div className="font-semibold">Released laboratory results</div><p className="mt-1 text-sm text-slate-500">Verified results released to the Nurse Station.</p></CardHeader><CardContent>{requests.isLoading ? <p className="py-6 text-sm text-slate-500">Loading lab results…</p> : requests.isError ? <p role="alert" className="py-6 text-sm text-rose-700">Could not load lab results.</p> : (requests.data ?? []).filter((r) => r.request_type === "lab" && r.status === "released" && r.lab_result).length ? <div className="space-y-3">{(requests.data ?? []).filter((r) => r.request_type === "lab" && r.status === "released" && r.lab_result).map((r) => <article key={r.request_id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold">{r.patient_name}</p><p className="mt-1 text-xs text-slate-500">{r.patient_number} · {r.ward_name ?? "Emergency / outpatient"}</p></div><Badge tone="success">Released</Badge></div><p className="mt-3 text-sm font-medium">Requested tests</p><p className="text-sm text-slate-600">{r.items.map((item) => item.description).join(", ")}</p><p className="mt-3 text-sm font-medium">Result</p><p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm">{r.lab_result}</p></article>)}</div> : <p className="py-8 text-center text-sm text-slate-500">No released lab results yet.</p>}</CardContent></Card>}
      {(profile?.role === "pharmacy" || profile?.role === "lab") && view === "profit" && <Card>
        <CardHeader><div className="font-semibold">{type === "lab" ? "Laboratory service financial records" : "Medicine profit records"}</div><p className="mt-1 text-sm text-slate-500">Revenue, cost, and profit recorded when paid {type === "lab" ? "diagnostic services" : "medicine requests"} are released.</p></CardHeader>
        <CardContent>{profit.isLoading ? <p className="py-6 text-sm text-slate-500">Loading profit records…</p> : profit.isError ? <p role="alert" className="py-6 text-sm text-rose-700">Could not load profit records. Check {type === "lab" ? "laboratory" : "pharmacy"} read access to profit records.</p> : profit.data?.length ? <div className="space-y-3">{profit.data.map((row) => <div key={row.id} className="grid gap-2 rounded-xl border border-slate-200 p-4 sm:grid-cols-4"><div><p className="text-xs text-slate-500">Date</p><p className="text-sm font-medium">{new Date(row.recorded_at).toLocaleDateString()}</p></div><div><p className="text-xs text-slate-500">Revenue</p><p className="font-medium">{money(Number(row.revenue))}</p></div><div><p className="text-xs text-slate-500">Cost</p><p className="font-medium">{money(Number(row.cost))}</p></div><div><p className="text-xs text-slate-500">Profit</p><p className="font-semibold">{money(Number(row.profit))}</p></div></div>)}</div> : <p className="py-8 text-center text-sm text-slate-500">No profit records yet. Records appear after paid {location.pathname === "/cbc" ? "CBC" : type === "lab" ? "laboratory" : "medicine"} requests are released.</p>}</CardContent>
      </Card>}
      {((profile?.role !== "pharmacy" && profile?.role !== "lab") || view === "requests") && <Card>
        <CardHeader>
          <div className="flex items-center gap-2 font-semibold">
            <ClipboardCheck size={18} className="text-sky-700" /> {type === "lab" ? "Laboratory request queue" : "Paid medicine requests"}
          </div>
        </CardHeader>
        <CardContent>
          {requests.isLoading ? (
            <p className="py-6 text-sm text-slate-500">
              Loading department queue…
            </p>
          ) : requests.isError ? (
            <div>
              <p role="alert" className="text-sm text-rose-700">
                Could not load requests.
              </p>
              <Button
                className="mt-3"
                variant="secondary"
                onClick={() => void requests.refetch()}
              >
                Retry
              </Button>
            </div>
          ) : incomingQueue.length ? (
            <div className="space-y-3">
              {incomingQueue.map((request) => (
                <FulfillmentCard
                  key={request.request_id}
                  request={request}
                  isLab={type === "lab"}
                  busy={fulfill.isPending}
                  accepting={acceptLab.isPending}
                  onAccept={acceptLabRequest}
                  onFulfill={release}
                />
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">
              {type === "lab" ? "No paid laboratory requests waiting for acceptance." : `No ${location.pathname === "/cbc" ? "CBC" : "department"} requests yet.`}
            </p>
          )}
        </CardContent>
      </Card>}
      {profile?.role === "lab" && view === "requests" && <Card>
        <CardHeader>
          <div className="flex items-center gap-2 font-semibold">
            <ClipboardCheck size={18} className="text-sky-700" /> Laboratory Work Queue
          </div>
          <p className="mt-1 text-sm text-slate-500">Requests appear here after you accept them. Complete the test and submit the results from this queue.</p>
        </CardHeader>
        <CardContent>
          {requests.isLoading ? <p className="py-6 text-sm text-slate-500">Loading laboratory work queue…</p> : requests.isError ? <p role="alert" className="py-6 text-sm text-rose-700">Could not load the laboratory work queue.</p> : acceptedLabQueue.length ? (
            <div className="space-y-3">
              {acceptedLabQueue.map((request) => (
                <FulfillmentCard key={request.request_id} request={request} isLab busy={fulfill.isPending} accepting={acceptLab.isPending} onAccept={acceptLabRequest} onFulfill={release} />
              ))}
            </div>
          ) : <p className="py-8 text-center text-sm text-slate-500">No accepted tests in the laboratory queue.</p>}
        </CardContent>
      </Card>}
    </div>
  );
}
