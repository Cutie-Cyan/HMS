import { useState } from "react";
import {
  Banknote,
  CheckCircle2,
  ClipboardCheck,
  RefreshCw,
  ShieldAlert,
  Printer,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthProvider";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { getSupabaseClient } from "../../lib/supabase";
import { requestError, useRequestWorkspace, usePayRequest } from "../requests/data";

type BillingRow = {
  encounter_id: string;
  patient_id: string;
  patient_number: string;
  patient_name: string;
  ward_name: string | null;
  bed_code: string | null;
  bed_type: "public" | "private" | null;
  admitted_at: string | null;
  lodging_days: number;
  lodging_amount: number;
  doctor_name: string | null;
  doctor_fee: number;
  pwd_or_senior: boolean;
  requests_cleared: boolean;
  final_bill_id: string | null;
  subtotal: number;
  philhealth_discount: number;
  pwd_senior_discount: number;
  total_bill: number;
  paid_at: string | null;
};
type Earnings = { paid_revenue: number; outstanding_bills: number; bill_count: number; paid_bill_count: number; inventory_revenue: number; inventory_cost: number; inventory_profit: number };
function patientPortalUrl(encounterId: string) {
  const url = new URL(`${import.meta.env.BASE_URL}patient-portal`, window.location.origin);
  url.searchParams.set("encounterId", encounterId);
  return url.toString();
}
const TEST_DISCOUNT_IDS = {
  philhealth: [
    { id: "TEST-PH-000001", amount: 100 },
    { id: "TEST-PH-000002", amount: 250 },
    { id: "TEST-PH-000003", amount: 500 },
  ],
  senior: [
    { id: "TEST-SC-000001", amount: 150 },
    { id: "TEST-SC-000002", amount: 300 },
    { id: "TEST-SC-000003", amount: 450 },
  ],
  pwd: [
    { id: "TEST-PWD-000001", amount: 200 },
    { id: "TEST-PWD-000002", amount: 350 },
    { id: "TEST-PWD-000003", amount: 600 },
  ],
} as const;

const money = (v: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    Number(v ?? 0),
  );

function useBillingQueue() {
  const client = useQueryClient();
  const queue = useQuery({
    queryKey: ["billing", "final-queue"],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc(
        "staff_final_billing_queue",
      );
      if (error) throw error;
      return (data ?? []) as BillingRow[];
    },
  });
  const earnings = useQuery({
    queryKey: ["billing", "earnings"],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc("cashier_billing_earnings");
      if (error) throw error;
      return ((data ?? [])[0] ?? null) as Earnings | null;
    },
  });
  const discount = useMutation({
    mutationFn: async (v: { billId: string; category: "none" | "philhealth" | "senior" | "pwd"; amount: number; notes: string }) => {
      const { error } = await getSupabaseClient().rpc("cashier_set_bill_discount", {
        p_bill_id: v.billId, p_discount_label: v.category, p_discount_amount: v.amount, p_notes: v.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ["billing"] }); },
  });
  const prepare = useMutation({
    mutationFn: async (v: { encounterId: string; philhealth: boolean }) => {
      const { data, error } = await getSupabaseClient().rpc(
        "cashier_prepare_final_bill",
        {
          p_encounter_id: v.encounterId,
          p_use_philhealth: v.philhealth,
        },
      );
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["billing"] }),
  });
  const pay = useMutation({
    mutationFn: async (billId: string) => {
      const { error } = await getSupabaseClient().rpc(
        "cashier_pay_final_bill",
        { p_bill_id: billId },
      );
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["billing"] }),
  });
  const recordDischargeOrder = useMutation({
    mutationFn: async (v: { encounterId: string; note: string }) => {
      const { error } = await getSupabaseClient().rpc("nurse_station_record_discharge_order", {
        p_encounter_id: v.encounterId,
        p_order_note: v.note,
      });
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["billing"] }),
  });
  const discharge = useMutation({
    mutationFn: async (encounterId: string) => {
      const { error } = await getSupabaseClient().rpc(
        "nurse_station_discharge_patient",
        { p_encounter_id: encounterId },
      );
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["billing"] }),
        client.invalidateQueries({ queryKey: ["wards"] }),
        client.invalidateQueries({ queryKey: ["encounters"] }),
        client.invalidateQueries({ queryKey: ["patients"] }),
      ]);
    },
  });
  return { queue, earnings, discount, prepare, pay, discharge, recordDischargeOrder };
}

export function BillingWorkspace() {
  const { profile } = useAuth();
  const role = profile?.role ?? "";
  const { queue, discount, prepare, pay, discharge, recordDischargeOrder } = useBillingQueue();
  const requestWorkspace = useRequestWorkspace();
  const payRequest = usePayRequest();
  const pendingRequests = (requestWorkspace.data ?? []).filter((request) => request.status === "pending_payment");
  const [dischargeOrderNotes, setDischargeOrderNotes] = useState<Record<string, string>>({});
  const [discountByBill, setDiscountByBill] = useState<Record<string, "none" | "philhealth" | "senior" | "pwd">>({});
  const [discountNotes, setDiscountNotes] = useState<Record<string, string>>({});
  const [discountIdByBill, setDiscountIdByBill] = useState<Record<string, string>>({});
  const [discountAmounts, setDiscountAmounts] = useState<Record<string, string>>({});
  const [billingView, setBillingView] = useState<"queue" | "history">("queue");
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const busy = prepare.isPending || pay.isPending || payRequest.isPending || discharge.isPending || recordDischargeOrder.isPending || discount.isPending;
  const act = async (operation: () => Promise<unknown>, success: string) => {
    setError("");
    setMessage("");
    try {
      await operation();
      setMessage(success);
    } catch (cause) {
      setError(requestError(cause));
    }
  };
  const isCashier = role === "cashier";
  const canViewHistory = role === "cashier" || role === "admin";
  const visibleRows = (queue.data ?? []).filter((row) => {
    if (!canViewHistory) return true;
    return billingView === "history" ? !!row.paid_at : !row.paid_at;
  });
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
      {(isCashier || role === "admin") && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 font-semibold">
              <Banknote size={18} className="text-teal-700" /> Request payments
            </div>
            <p className="mt-1 text-sm text-slate-500">Review and record payment for medicine and laboratory requests before they are processed.</p>
          </CardHeader>
          <CardContent>
            {requestWorkspace.isLoading ? (
              <p className="py-5 text-sm text-slate-500">Loading requests awaiting payment…</p>
            ) : requestWorkspace.isError ? (
              <div className="py-5 text-sm text-rose-700">
                Could not load requests awaiting payment.
                <Button className="ml-2" variant="secondary" onClick={() => void requestWorkspace.refetch()}>Retry</Button>
              </div>
            ) : pendingRequests.length ? (
              <div className="space-y-3">
                {pendingRequests.map((request) => (
                  <article key={request.request_id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-slate-900">{request.patient_name}</h3>
                        <Badge tone="warning">Payment pending</Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{request.patient_number} · {request.ward_name ?? "Ward unavailable"} · {request.request_type === "lab" ? "Laboratory" : "Medicine"} request</p>
                      <p className="mt-2 text-sm text-slate-700">{request.items.map((item) => `${item.description} × ${item.quantity}`).join(", ")}</p>
                      <p className="mt-1 text-lg font-semibold">{money(Number(request.total))}</p>
                    </div>
                    <Button disabled={busy} onClick={() => void act(() => payRequest.mutateAsync(request.request_id), "Request payment recorded. The request is now available for department processing.")}>
                      {payRequest.isPending ? "Recording…" : "Record request payment"}
                    </Button>
                  </article>
                ))}
              </div>
            ) : (
              <p className="py-5 text-center text-sm text-slate-500">No medicine or laboratory requests awaiting payment.</p>
            )}
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 font-semibold">
              <Banknote size={18} className="text-teal-700" /> Billing &amp; inpatient closeout
            </div>
          </div>
          <div className="mt-4 flex items-center justify-end gap-2">
            {canViewHistory && (
              <div className="inline-flex rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Billing views">
                <button type="button" role="tab" aria-selected={billingView === "queue"} onClick={() => setBillingView("queue")} className={"rounded-lg px-4 py-2 text-sm font-semibold transition " + (billingView === "queue" ? "bg-white text-sky-800 shadow-sm ring-1 ring-black/5" : "text-slate-500 hover:text-slate-800")}>Billing Queue</button>
                <button type="button" role="tab" aria-selected={billingView === "history"} onClick={() => setBillingView("history")} className={"rounded-lg px-4 py-2 text-sm font-semibold transition " + (billingView === "history" ? "bg-white text-sky-800 shadow-sm ring-1 ring-black/5" : "text-slate-500 hover:text-slate-800")}>Transaction history</button>
              </div>
            )}
            <Button
              variant="secondary"
              className="!size-9 !min-h-9 !p-0"
              aria-label="Refresh billing records"
              title="Refresh"
              onClick={() => void queue.refetch()}
              disabled={queue.isFetching}
            >
              <RefreshCw size={15} className={queue.isFetching ? "animate-spin" : ""} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {queue.isLoading ? (
            <p className="py-8 text-sm text-slate-500">
              Loading closeout queue…
            </p>
          ) : queue.isError ? (
            <div className="py-8 text-center">
              <ShieldAlert className="mx-auto text-rose-500" size={25} />
              <p role="alert" className="mt-2 text-sm text-rose-700">
                Could not load the closeout queue.
              </p>
              <Button
                className="mt-3"
                variant="secondary"
                onClick={() => void queue.refetch()}
              >
                Retry
              </Button>
            </div>
          ) : visibleRows.length ? (
            <div className="space-y-4">
              {visibleRows.map((row) => {
                const canPrepare =
                  isCashier && row.requests_cleared && !row.final_bill_id;
                const canPay = isCashier && row.final_bill_id && !row.paid_at;
                const canDischarge = role === "nurse_station" && !!row.paid_at;
                return (
                  <article
                    key={row.encounter_id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5"
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      aria-expanded={!!expandedRows[row.encounter_id]}
                      aria-label={`${expandedRows[row.encounter_id] ? "Hide" : "Show"} billing details for ${row.patient_name}`}
                      onClick={() => setExpandedRows((current) => ({ ...current, [row.encounter_id]: !current[row.encounter_id] }))}
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget) return;
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setExpandedRows((current) => ({ ...current, [row.encounter_id]: !current[row.encounter_id] }));
                        }
                      }}
                      className="flex cursor-pointer flex-wrap items-start justify-between gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                    >
                      <div>
                        <h2 className="font-semibold">{row.patient_name}</h2>
                        <p className="mt-1 text-xs text-slate-500">
                          {row.patient_number} ·{" "}
                          {row.ward_name ?? "Ward unavailable"} ·{" "}
                          {row.bed_code ?? "No bed"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {row.admitted_at
                            ? `Admitted ${new Date(row.admitted_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}`
                            : "Not admitted"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                      <Badge
                        tone={
                          row.paid_at
                            ? "success"
                            : row.final_bill_id
                              ? "warning"
                              : row.requests_cleared
                                ? "neutral"
                                : "warning"
                        }
                      >
                        {row.paid_at
                          ? "Final bill paid"
                          : row.final_bill_id
                            ? "Payment pending"
                            : row.requests_cleared
                              ? "Ready for final bill"
                              : "Requests not cleared"}
                      </Badge>
                      </div>
                    </div>
                    {expandedRows[row.encounter_id] && <>
                    <div className="mt-4 flex flex-col items-start gap-2">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(patientPortalUrl(row.encounter_id))}`}
                        alt="Patient billing portal QR code"
                        width={144}
                        height={144}
                        loading="lazy"
                        className="rounded-lg border border-slate-200 bg-white p-1"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(patientPortalUrl(row.encounter_id))}`;
                          const printWindow = window.open("", "_blank", "width=480,height=560");
                          if (!printWindow) {
                            setError("Allow pop-ups to print the patient QR code.");
                            return;
                          }
                          printWindow.document.write(`<!doctype html><html><head><title>Patient Billing QR Code</title><style>body{font-family:Arial,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0}img{width:320px;height:320px;object-fit:contain}</style></head><body><img src="${qrUrl}" alt="Patient billing portal QR code" onload="window.print()" /></body></html>`);
                          printWindow.document.close();
                        }}
                      >
                        <Printer size={15} /> Print QR code
                      </Button>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-xl border border-[#e8e8ed] bg-[#f8f8fa] p-3">
                        <p className="text-xs text-slate-500">
                          Room charge · {row.lodging_days} day(s)
                        </p>
                        <p className="mt-1 font-semibold">
                          {money(Number(row.lodging_amount))}
                        </p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">
                          Doctor · {row.doctor_name ?? "Not assigned"}
                        </p>
                        <p className="mt-1 font-semibold">
                          {money(Number(row.doctor_fee))}
                        </p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">
                          PhilHealth discount
                        </p>
                        <p className="mt-1 font-semibold">
                          −{money(Number(row.philhealth_discount))}
                        </p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">
                          PWD/Senior discount
                        </p>
                        <p className="mt-1 font-semibold">
                          −{money(Number(row.pwd_senior_discount))}
                        </p>
                      </div>
                    </div>
                    {row.pwd_or_senior && (
                      <p className="mt-3 text-xs text-sky-800">
                        Patient is marked PWD/Senior; eligible discount is
                        applied during final bill preparation.
                      </p>
                    )}
                    {row.final_bill_id && (
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-100 bg-sky-50/50 p-3">
                        <div>
                          <p className="text-xs text-slate-500">
                            Final bill total
                          </p>
                          <p className="text-xl font-semibold">
                            {money(Number(row.total_bill))}
                          </p>
                          {row.paid_at && (
                            <p className="mt-1 text-xs text-emerald-700">
                              Paid{" "}
                              {new Date(row.paid_at).toLocaleString("en-PH", {
                                timeZone: "Asia/Manila",
                              })}
                            </p>
                          )}
                        </div>
                        {isCashier && row.final_bill_id && !row.paid_at && (
                          <div className="w-full space-y-3 border-t border-slate-200 pt-3">
                            <h3 className="text-sm font-semibold text-slate-800">Apply / update discount</h3>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <label className="block text-sm font-medium text-slate-700">Discount type
                                <select className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" value={discountByBill[row.final_bill_id!] ?? "none"} onChange={e => {
                                  const category = e.target.value as "none" | "philhealth" | "senior" | "pwd";
                                  setDiscountByBill(current => ({...current, [row.final_bill_id!]: category}));
                                  setDiscountIdByBill(current => ({...current, [row.final_bill_id!]: ""}));
                                  setDiscountAmounts(current => ({...current, [row.final_bill_id!]: ""}));
                                  setDiscountNotes(current => ({...current, [row.final_bill_id!]: ""}));
                                }}>
                                  <option value="none">No discount</option><option value="philhealth">PhilHealth</option><option value="senior">Senior citizen</option><option value="pwd">PWD</option>
                                </select>
                              </label>
                              {(discountByBill[row.final_bill_id!] ?? "none") !== "none" && <label className="block text-sm font-medium text-slate-700">Test ID (select to autofill discount)
                                <select className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" value={discountIdByBill[row.final_bill_id] ?? ""} onChange={e => {
                                  const selectedId = e.target.value;
                                  const category = discountByBill[row.final_bill_id!] as "philhealth" | "senior" | "pwd";
                                  const selected = TEST_DISCOUNT_IDS[category].find(item => item.id === selectedId);
                                  setDiscountIdByBill(current => ({...current, [row.final_bill_id!]: selectedId}));
                                  setDiscountAmounts(current => ({...current, [row.final_bill_id!]: selected ? String(selected.amount) : ""}));
                                  setDiscountNotes(current => ({...current, [row.final_bill_id!]: selected ? `TEST ONLY — ${selectedId}` : ""}));
                                }}>
                                  <option value="">Choose a test ID</option>
                                  {TEST_DISCOUNT_IDS[discountByBill[row.final_bill_id!] as "philhealth" | "senior" | "pwd"].map(item => <option key={item.id} value={item.id}>{item.id} — {money(item.amount)}</option>)}
                                </select>
                                <span className="mt-1 block text-xs font-normal text-amber-700">Fictional IDs for development/testing only.</span>
                              </label>}
                              <label className="block text-sm font-medium text-slate-700">Approved discount amount (₱)
                                <input type="number" min="0" step="0.01" required className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" value={discountAmounts[row.final_bill_id!] ?? ""} onChange={e => setDiscountAmounts(current => ({...current, [row.final_bill_id!]: e.target.value}))} placeholder="Choose a test ID or enter approved amount" />
                              </label>
                              <label className="block text-sm font-medium text-slate-700">Verification / reference notes
                                <input className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" value={discountNotes[row.final_bill_id!] ?? ""} onChange={e => setDiscountNotes(current => ({...current, [row.final_bill_id!]: e.target.value}))} placeholder="Test ID / verification reference" />
                              </label>
                            </div>
                            <p className="text-xs leading-5 text-amber-800">Verify eligibility, covered charges, and the approved amount before applying. Enter the amount approved under current hospital and statutory rules. Only one discount category can be applied at a time.</p>
                            <Button variant="secondary" disabled={busy || discountAmounts[row.final_bill_id!] === undefined || discountAmounts[row.final_bill_id!].trim() === "" || !Number.isFinite(Number(discountAmounts[row.final_bill_id!])) || Number(discountAmounts[row.final_bill_id!]) < 0 || (["senior","pwd"].includes(discountByBill[row.final_bill_id!] ?? "none") && !row.pwd_or_senior)} onClick={() => void act(() => discount.mutateAsync({billId: row.final_bill_id!, category: discountByBill[row.final_bill_id!] ?? "none", amount: Number(discountAmounts[row.final_bill_id!]), notes: discountNotes[row.final_bill_id!] ?? ""}), "Discount updated. Review the revised bill before recording payment.")}>Save discount</Button>
                            {["senior","pwd"].includes(discountByBill[row.final_bill_id!] ?? "none") && !row.pwd_or_senior && <p className="text-xs text-rose-700">The patient record is not marked PWD/Senior eligible. Verify/update the patient record first.</p>}
                          </div>
                        )}
                        {canPay && (
                          <Button
                            disabled={busy}
                            onClick={() =>
                              void act(
                                () => pay.mutateAsync(row.final_bill_id!),
                                "Final bill payment recorded.",
                              )
                            }
                          >
                            Record payment
                          </Button>
                        )}
                        {role === "nurse_station" && row.paid_at && (
                          <div className="w-full space-y-2 border-t border-slate-200 pt-3">
                            <label className="block text-sm font-medium text-slate-700">
                              Doctor discharge order (record the written order)
                              <textarea
                                rows={2}
                                value={dischargeOrderNotes[row.encounter_id] ?? ""}
                                onChange={(event) =>
                                  setDischargeOrderNotes((current) => ({
                                    ...current,
                                    [row.encounter_id]: event.target.value,
                                  }))
                                }
                                placeholder="Enter the doctor’s discharge order and relevant details"
                                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm"
                              />
                            </label>
                            <Button
                              variant="secondary"
                              disabled={busy || !(dischargeOrderNotes[row.encounter_id] ?? "").trim()}
                              onClick={() =>
                                void act(
                                  () => recordDischargeOrder.mutateAsync({
                                    encounterId: row.encounter_id,
                                    note: dischargeOrderNotes[row.encounter_id].trim(),
                                  }),
                                  "Doctor discharge order recorded. You can now discharge this patient.",
                                )
                              }
                            >
                              Record doctor order
                            </Button>
                            <p className="text-xs text-slate-500">
                              Only record an order that has actually been authorized by the doctor. The system will block discharge until an order is recorded.
                            </p>
                          </div>
                        )}
                        {canDischarge && (
                          <Button
                            disabled={busy}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Discharge ${row.patient_name}? The bed will be released.`,
                                )
                              )
                                void act(
                                  () => discharge.mutateAsync(row.encounter_id),
                                  "Patient discharged and bed released.",
                                );
                            }}
                          >
                            <ClipboardCheck size={16} /> Discharge patient
                          </Button>
                        )}
                        {row.paid_at && role !== "nurse_station" && (
                          <span className="inline-flex items-center gap-1 text-sm text-emerald-700">
                            <CheckCircle2 size={16} /> Paid
                          </span>
                        )}
                      </div>
                    )}
                    {canPrepare && (
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e3e3e8] bg-[#fafafd] p-3">
                        
                        <Button
                          disabled={busy}
                          onClick={() =>
                            void act(
                              () =>
                                prepare.mutateAsync({
                                  encounterId: row.encounter_id,
                                  philhealth: false,
                                }),
                              "Final bill prepared. Review the total and record payment when ready.",
                            )
                          }
                        >
                          Prepare final bill
                        </Button>
                      </div>
                    )}
                    {row.final_bill_id &&
                      !row.paid_at &&
                      !row.requests_cleared && (
                        <p className="mt-3 text-xs text-rose-700">
                          Payment is blocked until all requests are cleared.
                        </p>
                      )}
                    </>}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="py-10 text-center">
              <CheckCircle2 className="mx-auto text-slate-300" size={30} />
              <p className="mt-3 font-medium">{canViewHistory && billingView === "history" ? "No completed transactions yet" : "No patients awaiting closeout"}</p>
              <p className="mt-1 text-sm text-slate-500">
                {canViewHistory && billingView === "history" ? "Fully paid bills will appear here." : "Admitted encounters will appear here."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
