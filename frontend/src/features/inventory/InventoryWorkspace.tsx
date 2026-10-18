import { useState, type FormEvent } from "react";
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
}: {
  request: HmsRequest;
  isLab: boolean;
  busy: boolean;
  onFulfill: (id: string, result: string) => Promise<void>;
}) {
  const [result, setResult] = useState("");
  const canRelease =
    request.status === "paid" && (!isLab || result.trim().length > 0);
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
      {isLab && request.status === "paid" && (
        <label className="mt-4 block text-sm font-medium text-slate-700">
          Lab result (required before release)
          <textarea
            rows={3}
            value={result}
            onChange={(e) => setResult(e.target.value)}
            className={fieldClass}
            placeholder="Enter the verified result for the Nurse Station…"
          />
        </label>
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
        {request.status === "paid" && (
          <Button
            disabled={busy || !canRelease}
            onClick={() => {
              if (
                window.confirm(
                  `Release this ${isLab ? "laboratory result" : "medicine request"} for ${request.patient_name}?`,
                )
              )
                void onFulfill(request.request_id, result);
            }}
          >
            <ClipboardCheck size={16} />
            {busy
              ? "Releasing…"
              : isLab
                ? "Save result & release"
                : "Release medicine"}
          </Button>
        )}
      </div>
    </article>
  );
}

export function InventoryWorkspace() {
  const { profile } = useAuth();
  const type: RequestType = profile?.role === "lab" ? "lab" : "medicine";
  const departmentName = type === "lab" ? "Laboratory" : "Pharmacy";
  const inventory = useInventoryItems(type);
  const requests = useRequestWorkspace();
  const save = useSaveInventoryItem();
  const fulfill = useFulfillRequest();
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [view, setView] = useState<"stock" | "profit" | "requests" | "add" | "results">("stock");
  const profit = useQuery({
    queryKey: ["profit-inventory", type],
    enabled: profile?.role === "pharmacy" && view === "profit",
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().from("profit_inventory").select("id, request_id, department, quantity, revenue, cost, profit, created_at").eq("department", "medicine").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as { id: string; request_id: string; department: string; quantity: number; revenue: number; cost: number; profit: number; created_at: string }[];
    },
  });
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [unit, setUnit] = useState("unit");
  const [stock, setStock] = useState("0");
  const [price, setPrice] = useState("0");
  const [cost, setCost] = useState("0");
  const [lowStock, setLowStock] = useState("5");
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
        expectedStock: editing?.quantity_on_hand ?? null,
        id: editing?.id,
      });
      setMessage(editing ? "Inventory item updated." : "Inventory item added.");
      reset();
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
  const queue = (requests.data ?? []).filter((r) => r.request_type === type);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      {(profile?.role === "pharmacy" || profile?.role === "lab") && <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2">
        {(profile.role === "pharmacy" ? ([{id:"stock",label:"Medicine stock"},{id:"profit",label:"Profit records"},{id:"requests",label:"Medicine requests"},{id:"add",label:"Add medicine"}] as const) : ([{id:"stock",label:"Lab inventory"},{id:"requests",label:"Lab requests"},{id:"results",label:"Lab results"},{id:"add",label:"Add lab item"}] as const)).map((tab) => <Button key={tab.id} variant={view === tab.id ? "primary" : "secondary"} onClick={() => setView(tab.id)}>{tab.label}</Button>)}
      </div>}
      {(message || error) && (
        <div
          role={error ? "alert" : "status"}
          className={`rounded-xl border p-3 text-sm ${error ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}
        >
          {error || message}
        </div>
      )}
      {((profile?.role !== "pharmacy" && profile?.role !== "lab") || view === "add") && <Card>
        <CardHeader>
          <div className="flex items-center gap-2 font-semibold">
            <PackagePlus size={18} className="text-sky-700" />
            {editing ? (type === "lab" ? "Edit lab item" : "Edit medicine") : (type === "lab" ? "Add lab item" : "Add medicine")}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            
          </p>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={submit}
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            <label className="text-sm font-medium text-slate-700">
              Item name
              <input
                required
                maxLength={150}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Item code
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
              Opening / current stock
              <input
                required
                type="number"
                min="0"
                step="1"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Selling price (₱)
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Unit cost (₱)
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
            <div className="flex items-end gap-2">
              <Button type="submit" disabled={save.isPending}>
                {save.isPending
                  ? "Saving…"
                  : editing
                    ? "Save changes"
                    : "Add item"}
              </Button>
              {editing && (
                <Button type="button" variant="secondary" onClick={reset}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>}
      {((profile?.role !== "pharmacy" && profile?.role !== "lab") || view === "stock") && <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-semibold">
              <Boxes size={18} className="text-sky-700" /> Stock list
            </div>
            <Button
              variant="secondary"
              onClick={() => void inventory.refetch()}
              disabled={inventory.isFetching}
            >
              <RefreshCw size={15} /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {inventory.isLoading ? (
            <p className="py-6 text-sm text-slate-500">Loading inventory…</p>
          ) : inventory.isError ? (
            <p role="alert" className="py-6 text-sm text-rose-700">
              Could not load department inventory.
            </p>
          ) : inventory.data?.length ? (
            <div className="space-y-3">
              {inventory.data.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e3e3e8] bg-[#fafafd] p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {item.item_name}{" "}
                      <span className="font-mono text-xs text-slate-400">
                        {item.item_code}
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {money(Number(item.unit_price))}/{item.unit} · cost{" "}
                      {money(Number(item.unit_cost))} · threshold{" "}
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
                  <Button variant="secondary" onClick={() => edit(item)}>
                    Edit item
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <CheckCircle2 className="mx-auto text-slate-300" size={28} />
              <p className="mt-2 font-medium">No inventory items configured</p>
              <p className="mt-1 text-sm text-slate-500">
                Add real {departmentName.toLowerCase()} stock above before
                accepting requests.
              </p>
            </div>
          )}
        </CardContent>
      </Card>}
      {profile?.role === "lab" && view === "results" && <Card><CardHeader><div className="font-semibold">Released laboratory results</div><p className="mt-1 text-sm text-slate-500">Verified results released to the Nurse Station.</p></CardHeader><CardContent>{requests.isLoading ? <p className="py-6 text-sm text-slate-500">Loading lab results…</p> : requests.isError ? <p role="alert" className="py-6 text-sm text-rose-700">Could not load lab results.</p> : (requests.data ?? []).filter((r) => r.request_type === "lab" && r.status === "released" && r.lab_result).length ? <div className="space-y-3">{(requests.data ?? []).filter((r) => r.request_type === "lab" && r.status === "released" && r.lab_result).map((r) => <article key={r.request_id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold">{r.patient_name}</p><p className="mt-1 text-xs text-slate-500">{r.patient_number} · {r.ward_name ?? "Emergency / outpatient"}</p></div><Badge tone="success">Released</Badge></div><p className="mt-3 text-sm font-medium">Requested tests</p><p className="text-sm text-slate-600">{r.items.map((item) => item.description).join(", ")}</p><p className="mt-3 text-sm font-medium">Result</p><p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm">{r.lab_result}</p></article>)}</div> : <p className="py-8 text-center text-sm text-slate-500">No released lab results yet.</p>}</CardContent></Card>}\n      {profile?.role === "pharmacy" && view === "profit" && <Card>
        <CardHeader><div className="font-semibold">Medicine profit records</div><p className="mt-1 text-sm text-slate-500">Revenue, cost, and profit recorded when paid medicine requests are released.</p></CardHeader>
        <CardContent>{profit.isLoading ? <p className="py-6 text-sm text-slate-500">Loading profit records…</p> : profit.isError ? <p role="alert" className="py-6 text-sm text-rose-700">Could not load profit records. Check pharmacy read access to profit records.</p> : profit.data?.length ? <div className="space-y-3">{profit.data.map((row) => <div key={row.id} className="grid gap-2 rounded-xl border border-slate-200 p-4 sm:grid-cols-4"><div><p className="text-xs text-slate-500">Date</p><p className="text-sm font-medium">{new Date(row.created_at).toLocaleDateString()}</p></div><div><p className="text-xs text-slate-500">Revenue</p><p className="font-medium">{money(Number(row.revenue))}</p></div><div><p className="text-xs text-slate-500">Cost</p><p className="font-medium">{money(Number(row.cost))}</p></div><div><p className="text-xs text-slate-500">Profit</p><p className="font-semibold">{money(Number(row.profit))}</p></div></div>)}</div> : <p className="py-8 text-center text-sm text-slate-500">No profit records yet. Records appear after paid medicine requests are released.</p>}</CardContent>
      </Card>}
      {((profile?.role !== "pharmacy" && profile?.role !== "lab") || view === "requests") && <Card>
        <CardHeader>
          <div className="flex items-center gap-2 font-semibold">
            <ClipboardCheck size={18} className="text-sky-700" /> Paid{" "}
            {type === "lab" ? "laboratory" : "medicine"} requests
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Only paid requests can be fulfilled. Lab results are required before
            release.
          </p>
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
          ) : queue.length ? (
            <div className="space-y-3">
              {queue.map((request) => (
                <FulfillmentCard
                  key={request.request_id}
                  request={request}
                  isLab={type === "lab"}
                  busy={fulfill.isPending}
                  onFulfill={release}
                />
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">
              No department requests yet.
            </p>
          )}
        </CardContent>
      </Card>}
    </div>
  );
}
