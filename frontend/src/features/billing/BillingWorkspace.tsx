import { useState } from "react";
import {
  Banknote,
  CheckCircle2,
  ClipboardCheck,
  RefreshCw,
  ShieldAlert,
  QrCode,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthProvider";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { getSupabaseClient } from "../../lib/supabase";
import { requestError } from "../requests/data";

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
  const { queue, earnings, discount, prepare, pay, discharge, recordDischargeOrder } = useBillingQueue();
  const [dischargeOrderNotes, setDischargeOrderNotes] = useState<Record<string, string>>({});
  const [discountByBill, setDiscountByBill] = useState<Record<string, "none" | "philhealth" | "senior" | "pwd">>({});
  const [discountNotes, setDiscountNotes] = useState<Record<string, string>>({});
  const [discountAmounts, setDiscountAmounts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const busy = prepare.isPending || pay.isPending || discharge.isPending || recordDischargeOrder.isPending || discount.isPending;
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
  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      {(message || error) && (
        <div
          role={error ? "alert" : "status"}
          className={`rounded-xl border p-3 text-sm ${error ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}
        >
          {error || message}
        </div>
      )}
      {(role === "cashier" || role === "admin") && <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Collected revenue", earnings.data ? money(Number(earnings.data.paid_revenue)) : "—"],
          ["Outstanding bills", earnings.data ? money(Number(earnings.data.outstanding_bills)) : "—"],
          ["Inventory profit", earnings.data ? money(Number(earnings.data.inventory_profit)) : "—"],
          ["Bills paid", earnings.data ? `${earnings.data.paid_bill_count} / ${earnings.data.bill_count}` : "—"],
        ].map(([label, value]) => <Card key={label}><CardContent><div className="flex items-center gap-2 text-sm text-slate-500"><Banknote size={16}/>{label}</div><p className="mt-2 text-xl font-semibold text-slate-900">{value}</p></CardContent></Card>)}
        {earnings.isError && <p role="alert" className="text-sm text-rose-700 sm:col-span-2 xl:col-span-4">Could not load earnings summary. Check cashier/admin access to billing earnings.</p>}
      </section>}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-semibold">
              <Banknote size={18} className="text-teal-700" /> Billing &amp; inpatient closeout
            </div>
            <Button
              variant="secondary"
              onClick={() => void queue.refetch()}
              disabled={queue.isFetching}
            >
              <RefreshCw size={15} /> Refresh
            </Button>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Room rates use rolling 24-hour blocks. A partial block is charged as
            one day.
          </p>
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
          ) : queue.data?.length ? (
            <div className="space-y-4">
              {queue.data.map((row) => {
                const canPrepare =
                  isCashier && row.requests_cleared && !row.final_bill_id;
                const canPay = isCashier && row.final_bill_id && !row.paid_at;
                const canDischarge = role === "nurse_station" && !!row.paid_at;
                return (
                  <article
                    key={row.encounter_id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
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
                    <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-teal-100 bg-teal-50/60 p-3">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(patientPortalUrl(row.encounter_id))}`}
                        alt="QR code to open the patient billing portal"
                        width={120}
                        height={120}
                        loading="lazy"
                        className="rounded-lg border border-slate-200 bg-white p-1"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 text-sm font-semibold text-teal-950"><QrCode size={16}/> Patient live-bill portal</p>
                        <p className="mt-1 text-xs leading-5 text-slate-600">Print or share this QR code. The patient must verify their patient number and date of birth before viewing the bill. The portal refreshes bill data automatically.</p>
                        <a className="mt-2 inline-block text-sm font-semibold text-teal-800 underline" href={patientPortalUrl(row.encounter_id)} target="_blank" rel="noreferrer">Open portal link</a>
                      </div>
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
                    {!row.requests_cleared && (
                      <p className="mt-3 text-sm text-amber-800">
                        Clear all requests first: each must be released or
                        cancelled, and every request bill must be paid.
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
                                <select className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" value={discountByBill[row.final_bill_id] ?? "none"} onChange={e => setDiscountByBill(current => ({...current, [row.final_bill_id!]: e.target.value as "none" | "philhealth" | "senior" | "pwd"}))}>
                                  <option value="none">No discount</option><option value="philhealth">PhilHealth</option><option value="senior">Senior citizen</option><option value="pwd">PWD</option>
                                </select>
                              </label>
                              <label className="block text-sm font-medium text-slate-700">Approved discount amount (₱)
                                <input type="number" min="0" step="0.01" required className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" value={discountAmounts[row.final_bill_id] ?? ""} onChange={e => setDiscountAmounts(current => ({...current, [row.final_bill_id!]: e.target.value}))} placeholder="Enter verified amount" />
                              </label>
                              <label className="block text-sm font-medium text-slate-700">Verification / reference notes
                                <input className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" value={discountNotes[row.final_bill_id] ?? ""} onChange={e => setDiscountNotes(current => ({...current, [row.final_bill_id!]: e.target.value}))} placeholder="ID checked / PhilHealth reference" />
                              </label>
                            </div>
                            <p className="text-xs leading-5 text-amber-800">Verify eligibility, covered charges, and the approved amount before applying. Enter the amount approved under current hospital and statutory rules. Only one discount category can be applied at a time.</p>
                            <Button variant="secondary" disabled={busy || discountAmounts[row.final_bill_id] === undefined || discountAmounts[row.final_bill_id].trim() === "" || !Number.isFinite(Number(discountAmounts[row.final_bill_id])) || Number(discountAmounts[row.final_bill_id]) < 0 || (["senior","pwd"].includes(discountByBill[row.final_bill_id] ?? "none") && !row.pwd_or_senior)} onClick={() => void act(() => discount.mutateAsync({billId: row.final_bill_id!, category: discountByBill[row.final_bill_id] ?? "none", amount: Number(discountAmounts[row.final_bill_id]), notes: discountNotes[row.final_bill_id] ?? ""}), "Discount updated. Review the revised bill before recording payment.")}>Save discount</Button>
                            {["senior","pwd"].includes(discountByBill[row.final_bill_id] ?? "none") && !row.pwd_or_senior && <p className="text-xs text-rose-700">The patient record is not marked PWD/Senior eligible. Verify/update the patient record first.</p>}
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
                        <p className="text-sm text-slate-600">Prepare the bill first, then choose the applicable discount category and enter the verified approved amount.</p>
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
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="py-10 text-center">
              <CheckCircle2 className="mx-auto text-slate-300" size={30} />
              <p className="mt-3 font-medium">No patients awaiting closeout</p>
              <p className="mt-1 text-sm text-slate-500">
                Admitted encounters will appear here.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
