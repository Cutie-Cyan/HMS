import { useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  PackagePlus,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
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
  "mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100";
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
    <article className="rounded-xl border border-slate-200 p-4">
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
        <p className="mt-3 rounded-lg bg-teal-50 p-3 text-sm text-teal-900">
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
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="text-sm font-medium text-teal-700">
          Department operations
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
          {departmentName} inventory
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          {type === "lab"
            ? "Manage laboratory supplies and record results before release."
            : "Manage medicine stock and release only requests already paid by Cashier."}{" "}
          All stock changes are validated by the database.
        </p>
      </header>
      {(message || error) && (
        <div
          role={error ? "alert" : "status"}
          className={`rounded-lg p-3 text-sm ${error ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-800"}`}
        >
          {error || message}
        </div>
      )}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 font-semibold">
            <PackagePlus size={18} className="text-teal-700" />
            {editing ? "Edit inventory item" : "Add inventory item"}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Enter actual stock and pricing supplied by the hospital; no sample
            items are created.
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
      </Card>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-semibold">
              <Boxes size={18} className="text-teal-700" /> Stock list
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
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"
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
      </Card>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 font-semibold">
            <ClipboardCheck size={18} className="text-teal-700" /> Paid{" "}
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
      </Card>
    </div>
  );
}
