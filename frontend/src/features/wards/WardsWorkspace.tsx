import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BedDouble, CheckCircle2, Plus, RefreshCw, ShieldAlert, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthProvider";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { useOpenEncounters, type EncounterRecord } from "../patients/data";
import { getSupabaseClient } from "../../lib/supabase";
import { requestError } from "../requests/data";

type BedRow = {
  ward_id: string;
  ward_name: string;
  public_daily_rate: number;
  private_daily_rate: number;
  bed_id: string | null;
  bed_code: string | null;
  bed_type: "public" | "private" | null;
  room_id: string | null;
  room_code: string | null;
  is_active: boolean | null;
  occupied: boolean;
  patient_id: string | null;
  patient_number: string | null;
  patient_name: string | null;
  encounter_id: string | null;
  admitted_at: string | null;
};
type WardCatalogRow = { id: string; name: string; public_daily_rate: number; private_daily_rate: number };
type RoomOption = {
  id: string;
  room_code: string;
  ward_id: string | null;
  is_private: boolean;
  is_active: boolean;
};
const field =
  "mt-1.5 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10";
const money = (v: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    Number(v ?? 0),
  );

function useWardBoard(canConfigure: boolean) {
  const client = useQueryClient();
  const board = useQuery({
    queryKey: ["wards", "bed-board"],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc(
        "staff_ward_bed_workspace",
      );
      if (error) throw error;
      return (data ?? []) as BedRow[];
    },
  });
  const rooms = useQuery({
    queryKey: ["wards", "rooms"],
    enabled: canConfigure,
    queryFn: async () => {
      const { data, error } =
        await getSupabaseClient().rpc("admin_room_options");
      if (error) throw error;
      return (data ?? []) as RoomOption[];
    },
  });
  const saveBed = useMutation({
    mutationFn: async (v: {
      code: string;
      wardId: string;
      type: "public" | "private";
      roomId: string | null;
    }) => {
      const { error } = await getSupabaseClient().rpc("admin_save_bed", {
        p_bed_code: v.code,
        p_ward_id: v.wardId,
        p_type: v.type,
        p_room_id: v.roomId,
        p_is_active: true,
        p_bed_id: null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["wards"] });
    },
  });
  return { board, rooms, saveBed };
}
function BedCard({
  bed,
  role,
  assignedWardId,
  encounters,
  onAction,
  busy,
}: {
  bed: BedRow;
  role: string;
  assignedWardId: string | null;
  encounters: EncounterRecord[];
  onAction: (encounterId: string, bedId: string) => Promise<void>;
  busy: boolean;
}) {
  const [encounterId, setEncounterId] = useState("");
  const canAssign =
    role === "emergency_nurse" ||
    (role === "nurse_station" && assignedWardId === bed.ward_id);
  const activeEncounters = encounters.filter(
    (e) =>
      e.encounter_status === "open" &&
      (role !== "nurse_station" ||
        (e.current_ward_id === assignedWardId && e.current_ward_id === bed.ward_id)),
  );
  return (
    <div
      className={
        "rounded-xl border p-4 " +
        (bed.occupied
          ? "border-amber-200 bg-amber-50/50"
          : "border-slate-200 bg-white")
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{bed.bed_code}</p>
          <p className="mt-1 text-xs text-slate-500">
            {bed.bed_type === "private" ? "Private room" : "Public bed"}
            {bed.room_code ? " · Room " + bed.room_code : ""}
          </p>
        </div>
        <Badge tone={bed.occupied ? "warning" : "success"}>
          {bed.occupied ? "Occupied" : "Available"}
        </Badge>
      </div>
      {bed.occupied && (
        <div className="mt-3 rounded-lg bg-white p-3">
          <p className="text-sm font-medium">{bed.patient_name}</p>
          <p className="text-xs text-slate-500">{bed.patient_number}</p>
          {bed.admitted_at && (
            <p className="mt-1 text-xs text-slate-500">
              Admitted{" "}
              {new Date(bed.admitted_at).toLocaleString("en-PH", {
                timeZone: "Asia/Manila",
              })}
            </p>
          )}
        </div>
      )}
      {canAssign && !bed.occupied && bed.bed_id && (
        <div className="mt-3 space-y-2">
          <label className="block text-xs font-medium text-slate-600">
            {role === "nurse_station"
              ? "Admitted patient to transfer"
              : "Open encounter to admit"}
            <select
              className={field}
              value={encounterId}
              onChange={(e) => setEncounterId(e.target.value)}
            >
              <option value="">Select patient / encounter</option>
              {activeEncounters
                .filter((e) =>
                  role === "nurse_station"
                    ? e.patient_status === "admitted"
                    : e.patient_status !== "discharged",
                )
                .map((e) => (
                  <option key={e.encounter_id} value={e.encounter_id}>
                    {e.patient_name} · {e.patient_number}
                  </option>
                ))}
            </select>
          </label>
          <Button
            className="w-full"
            disabled={!encounterId || busy}
            onClick={() => void onAction(encounterId, bed.bed_id!)}
          >
            {role === "nurse_station" ? "Transfer to bed" : "Admit to bed"}
          </Button>
        </div>
      )}
    </div>
  );
}
export function WardsWorkspace() {
  const { profile } = useAuth();
  const role = profile?.role ?? "";
  const assignedWardId = profile?.wardId ?? null;
  const { board, rooms, saveBed } = useWardBoard(role === "admin");
  const encounters = useOpenEncounters(
    role === "emergency_nurse" || role === "nurse_station",
  );
  const client = useQueryClient();
  const [roomCode, setRoomCode] = useState("");
  const [roomWard, setRoomWard] = useState("");
  const [roomPrivate, setRoomPrivate] = useState(false);
  const [bedCode, setBedCode] = useState("");
  const [bedWard, setBedWard] = useState("");
  const [bedType, setBedType] = useState<"public" | "private">("public");
  const [roomId, setRoomId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [configOpen, setConfigOpen] = useState(false);
  const [configTab, setConfigTab] = useState<"room" | "bed">("bed");
  const [selectedWardId, setSelectedWardId] = useState("");
  const [boardView, setBoardView] = useState<"beds" | "rooms">("beds");
  const [editingRatesWard, setEditingRatesWard] = useState<string | null>(null);
  const [publicRate, setPublicRate] = useState("");
  const [privateRate, setPrivateRate] = useState("");
  const saveRates = useMutation({
    mutationFn: async (v: { wardId: string; publicRate: number; privateRate: number }) => {
      const { error } = await getSupabaseClient().rpc("admin_update_ward_rates", {
        p_ward_id: v.wardId,
        p_public_daily_rate: v.publicRate,
        p_private_daily_rate: v.privateRate,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["wards"] });
      await board.refetch();
      setMessage("Ward prices updated successfully.");
    },
  });
  useEffect(() => {
    if (!message && !error) return;
    const timeout = window.setTimeout(() => { setMessage(""); setError(""); }, 3500);
    return () => window.clearTimeout(timeout);
  }, [message, error]);
  const saveRoom = useMutation({
    mutationFn: async (v: { code: string; wardId: string; isPrivate: boolean }) => {
      const { error } = await getSupabaseClient().rpc("admin_save_room", {
        p_room_code: v.code,
        p_ward_id: v.wardId,
        p_is_private: v.isPrivate,
        p_is_active: true,
        p_room_id: null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["wards"] });
    },
  });
  const action = useMutation({
    mutationFn: async (v: { encounterId: string; bedId: string }) => {
      const fn =
        role === "nurse_station"
          ? "nurse_station_transfer_patient"
          : "emergency_nurse_admit_patient";
      const { error } = await getSupabaseClient().rpc(fn, {
        p_encounter_id: v.encounterId,
        p_bed_id: v.bedId,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["wards"] }),
        client.invalidateQueries({ queryKey: ["encounters"] }),
        client.invalidateQueries({ queryKey: ["patients"] }),
      ]);
    },
  });
  // Read the ward catalog independently of the bed board. A ward must remain
  // selectable even before its first room or bed has been configured.
  const wardCatalog = useQuery({
    queryKey: ["wards", "catalog"],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from("wards")
        .select("id,name,public_daily_rate,private_daily_rate")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as WardCatalogRow[];
    },
  });
  const wards = useMemo(() => wardCatalog.data ?? [], [wardCatalog.data]);
  const doAction = async (encounterId: string, bedId: string) => {
    setError("");
    setMessage("");
    try {
      await action.mutateAsync({ encounterId, bedId });
      setMessage(
        role === "nurse_station"
          ? "Patient transferred to the selected bed in your ward."
          : "Patient admitted; the selected ward now owns the patient record.",
      );
    } catch (e) {
      setError(requestError(e));
    }
  };
  const submitRoom = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      await saveRoom.mutateAsync({
        code: roomCode.trim(),
        wardId: roomWard,
        isPrivate: roomPrivate,
      });
      setRoomCode("");
      setRoomId("");
      setMessage("Room saved. It is now available when adding a matching bed in this ward.");
    } catch (err) {
      setError(requestError(err));
    }
  };
  const submitBed = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      await saveBed.mutateAsync({
        code: bedCode.trim(),
        wardId: bedWard,
        type: bedType,
        roomId: roomId || null,
      });
      setBedCode("");
      setMessage("Bed configuration saved.");
    } catch (err) {
      setError(requestError(err));
    }
  };
  const wardList = wards.map((w) => ({ id: w.id, name: w.name, public_daily_rate: Number(w.public_daily_rate), private_daily_rate: Number(w.private_daily_rate) }));
  // Ward nurses must never fall back to the all-wards view when their profile
  // is missing a ward assignment. Admin and Emergency Nurse can coordinate
  // across wards; each Nurse Station sees only its assigned ward.
  const visibleWardList =
    role === "nurse_station"
      ? assignedWardId
        ? wardList.filter((ward) => ward.id === assignedWardId)
        : []
      : wardList;
  useEffect(() => {
    if (role === "nurse_station") {
      setSelectedWardId(assignedWardId && visibleWardList.some((ward) => ward.id === assignedWardId) ? assignedWardId : "");
      return;
    }
    if (visibleWardList.length > 0 && !visibleWardList.some((ward) => ward.id === selectedWardId)) {
      setSelectedWardId(visibleWardList[0].id);
    }
  }, [role, assignedWardId, visibleWardList, selectedWardId]);
  const roomsForWard = (wardId: string, privateOnly = false) =>
    (rooms.data ?? []).filter(
      (r) =>
        r.ward_id === wardId && (privateOnly ? r.is_private : !r.is_private),
    );
  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      {(message || error) && (
        <div className="pointer-events-none fixed bottom-5 right-5 z-[70] w-[min(360px,calc(100vw-2.5rem))]" aria-live="polite">
          <div role={error ? "alert" : "status"} className={"pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-xl " + (error ? "border-rose-200 bg-white text-rose-800" : "border-emerald-200 bg-white text-emerald-800")}>
            <span className={"mt-0.5 grid size-6 shrink-0 place-items-center rounded-full " + (error ? "bg-rose-50" : "bg-emerald-50")}>{error ? <ShieldAlert size={15}/> : <CheckCircle2 size={15}/>}</span>
            <p className="min-w-0 flex-1 leading-5">{error || message}</p>
            <button type="button" aria-label="Dismiss notification" onClick={() => { setMessage(""); setError(""); }} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={15}/></button>
          </div>
        </div>
      )}
      {configOpen && role === "admin" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setConfigOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="ward-config-title" className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 id="ward-config-title" className="font-semibold">Configure rooms and beds</h2><p className="mt-1 text-sm text-slate-500">Add a room first for private beds.</p></div><button type="button" aria-label="Close" onClick={() => setConfigOpen(false)} className="rounded-lg p-2 hover:bg-slate-100"><X size={20} /></button></header>
            <div className="flex gap-2 border-b border-slate-200 px-5 py-3"><Button type="button" variant={configTab === "bed" ? "primary" : "secondary"} onClick={() => setConfigTab("bed")}>Add bed</Button><Button type="button" variant={configTab === "room" ? "primary" : "secondary"} onClick={() => setConfigTab("room")}>Add room</Button></div>
            <div className="overflow-y-auto p-5">
              {configTab === "room" ? (
                <form onSubmit={async (e) => { await submitRoom(e); if (!saveRoom.isError) setConfigOpen(false); }} className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-medium">Room code<input required value={roomCode} onChange={(e) => setRoomCode(e.target.value)} className={field} maxLength={60} placeholder="e.g. ER-Private-01" /></label>
                  <label className="block text-sm font-medium">Ward<select required value={roomWard} onChange={(e) => setRoomWard(e.target.value)} className={field}><option value="">Select ward</option>{wardList.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
                  <label className="block text-sm font-medium sm:col-span-2">Room type<select value={roomPrivate ? "private" : "public"} onChange={(e) => setRoomPrivate(e.target.value === "private")} className={field}><option value="public">Public / shared</option><option value="private">Private</option></select></label>
                  <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="secondary" onClick={() => setConfigOpen(false)}>Cancel</Button><Button type="submit" disabled={saveRoom.isPending || !roomCode.trim() || !roomWard}>{saveRoom.isPending ? "Saving room…" : "Save room"}</Button></div>
                </form>
              ) : (
                <form onSubmit={async (e) => { await submitBed(e); if (!saveBed.isError) setConfigOpen(false); }} className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-medium">Bed code<input required value={bedCode} onChange={(e) => setBedCode(e.target.value)} className={field} maxLength={60} placeholder="e.g. ER-01" /></label>
                  <label className="block text-sm font-medium">Ward<select required value={bedWard} onChange={(e) => { setBedWard(e.target.value); setRoomId(""); }} className={field}><option value="">Select ward</option>{wardList.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
                  <label className="block text-sm font-medium">Bed type<select value={bedType} onChange={(e) => { setBedType(e.target.value as "public" | "private"); setRoomId(""); }} className={field}><option value="public">Public</option><option value="private">Private room</option></select></label>
                  {bedType === "private" && <label className="block text-sm font-medium">Private room<select value={roomId} onChange={(e) => setRoomId(e.target.value)} className={field} required><option value="">Select private room</option>{roomsForWard(bedWard, true).map((r) => <option key={r.id} value={r.id}>{r.room_code}</option>)}</select>{bedWard && roomsForWard(bedWard, true).length === 0 && <span className="mt-1 block text-xs font-normal text-amber-700">No active private rooms in this ward. Add a private room first.</span>}</label>}
                  <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="secondary" onClick={() => setConfigOpen(false)}>Cancel</Button><Button type="submit" disabled={saveBed.isPending || !bedCode.trim() || !bedWard || (bedType === "private" && !roomId)}>{saveBed.isPending ? "Adding bed…" : "Add bed"}</Button></div>
                </form>
              )}
            </div>
          </section>
        </div>
      )}
      {role === "nurse_station" && !assignedWardId && (
        <Card>
          <CardContent>
            <div className="flex items-start gap-3 py-2">
              <ShieldAlert className="mt-0.5 shrink-0 text-amber-600" size={20} />
              <div>
                <h2 className="font-semibold text-slate-900">Ward assignment required</h2>
                <p className="mt-1 text-sm text-slate-600">Your staff profile is not assigned to a ward. Ask the HMS administrator to assign your Nurse Station account to Emergency Room, Female Ward, Male Ward, or Pedia Ward. No ward patient board is shown until the assignment is configured.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div>
                <div className="flex items-center gap-2 font-semibold">
                  <BedDouble size={18} className="text-sky-700" /> Bed board
                </div>
                <p className="mt-1 max-w-2xl text-sm text-slate-500">Receiving wards should review the ER handover, confirm acceptance and bed availability, then assess the patient on arrival. Keep the ER triage and doctor documentation linked to the patient; record ward observations and treatment as new clinical entries.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {role === "admin" && <>
                <Button variant="secondary" onClick={() => { setConfigTab("room"); setConfigOpen(true); }}><Plus size={15}/> Add room</Button>
                <Button onClick={() => { setConfigTab("bed"); setConfigOpen(true); }}><Plus size={15}/> Add bed</Button>
              </>}
              <Button variant="secondary" className="!size-10 !min-h-10 !p-0" aria-label="Refresh ward board" title="Refresh" onClick={() => { void board.refetch(); void wardCatalog.refetch(); if (role === "admin") void rooms.refetch(); }} disabled={board.isFetching || wardCatalog.isFetching || rooms.isFetching}>
                <RefreshCw size={16} className={board.isFetching ? "animate-spin" : ""} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {role === "nurse_station" && !assignedWardId ? (
            <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
              Your staff profile has no ward assignment. Ask an administrator to assign this account to Emergency Room, Female Ward, Male Ward, or Pedia Ward. Patient and bed details are hidden until the assignment is configured.
            </div>
          ) : board.isLoading || wardCatalog.isLoading ? (
            <p className="py-8 text-sm text-slate-500">Loading ward board…</p>
          ) : board.isError || wardCatalog.isError ? (
            <div className="py-8 text-center">
              <ShieldAlert className="mx-auto text-rose-500" size={25} />
              <p role="alert" className="mt-2 text-sm text-rose-700">
                Could not load ward board.
              </p>
              <Button
                className="mt-3"
                variant="secondary"
                onClick={() => void board.refetch()}
              >
                Retry
              </Button>
            </div>
          ) : wardList.length === 0 ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="mx-auto text-slate-300" size={28} />
              <p className="mt-2 font-medium">No active wards found</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="tablist" aria-label="Select ward">
                {visibleWardList.map((w) => { const count = (board.data ?? []).filter((b) => b.ward_id === w.id && b.bed_id).length; const active = (selectedWardId || visibleWardList[0]?.id) === w.id; return <button key={w.id} type="button" role="tab" aria-selected={active} onClick={() => setSelectedWardId(w.id)} className={"min-w-0 rounded-xl border px-2 py-3 text-center text-xs font-semibold sm:px-3 sm:text-sm " + (active ? "border-sky-600 bg-sky-50 text-sky-800" : "border-slate-200 bg-white text-slate-600")}><span className="block truncate">{w.name}</span><span className="mt-1 block text-[11px] font-normal opacity-75">{count} beds</span></button>; })}
              </div>
              <div className="max-h-[60vh] overflow-y-auto overscroll-contain pr-1">
              {visibleWardList.filter((w) => w.id === (selectedWardId || visibleWardList[0]?.id)).map((w) => {
                const rows = (board.data ?? []).filter(
                  (b) => b.ward_id === w.id,
                );
                const first = rows[0];
                return (
                  <section key={w.id}>
                    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                      <div>
                        <h2 className="font-semibold">{w.name}</h2>
                        <p className="text-xs text-slate-500">
                          Public {money(Number(first?.public_daily_rate ?? w.public_daily_rate))}{" "}
                          / 24 hours · Private{" "}
                          {money(Number(first?.private_daily_rate ?? w.private_daily_rate))} / 24
                          hours
                        </p>
                      </div>
                      <Badge tone="neutral">
                        {
                          rows
                            .filter((b) => b.bed_id)
                            .filter((b) => !b.occupied).length
                        }{" "}
                        available / {rows.filter((b) => b.bed_id).length}{" "}
                        configured
                      </Badge>
                    </div>
                    {role === "admin" && (
                      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
                        {editingRatesWard === w.id ? (
                          <form onSubmit={async (e) => {
                            e.preventDefault(); setError(""); setMessage("");
                            const pub = Number(publicRate); const priv = Number(privateRate);
                            if (!Number.isFinite(pub) || !Number.isFinite(priv) || pub < 0 || priv < 0) { setError("Enter valid prices of zero or greater."); return; }
                            try { await saveRates.mutateAsync({ wardId: w.id, publicRate: pub, privateRate: priv }); setEditingRatesWard(null); }
                            catch (err) { setError(requestError(err)); }
                          }}>
                            <div className="mb-3 flex items-center justify-between gap-2"><h3 className="text-sm font-semibold text-slate-800">Edit ward prices</h3><span className="text-xs text-slate-500">Per 24 hours</span></div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <label className="block text-sm font-medium text-slate-700">Public bed price (₱)<input className={field} type="number" min="0" step="0.01" required value={publicRate} onChange={(e) => setPublicRate(e.target.value)} /></label>
                              <label className="block text-sm font-medium text-slate-700">Private room price (₱)<input className={field} type="number" min="0" step="0.01" required value={privateRate} onChange={(e) => setPrivateRate(e.target.value)} /></label>
                            </div>
                            <div className="mt-3 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setEditingRatesWard(null)}>Cancel</Button><Button type="submit" disabled={saveRates.isPending}>{saveRates.isPending ? "Saving…" : "Save prices"}</Button></div>
                          </form>
                        ) : (
                          <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-semibold text-slate-800">Ward prices</h3><p className="mt-1 text-xs text-slate-500">Public {money(Number(first?.public_daily_rate ?? 0))} / 24 hours · Private {money(Number(first?.private_daily_rate ?? 0))} / 24 hours</p></div><Button type="button" variant="secondary" onClick={() => { setPublicRate(String(first?.public_daily_rate ?? 0)); setPrivateRate(String(first?.private_daily_rate ?? 0)); setEditingRatesWard(w.id); }}>Edit prices</Button></div>
                        )}
                      </div>
                    )}
                    <div className="mb-4 flex gap-2" role="tablist" aria-label="Choose rooms or beds">
                      <button type="button" role="tab" aria-selected={boardView === "beds"} onClick={() => setBoardView("beds")} className={"rounded-lg border px-4 py-2 text-sm font-semibold " + (boardView === "beds" ? "border-sky-600 bg-sky-50 text-sky-800" : "border-slate-200 bg-white text-slate-600")}>Beds ({rows.filter((b) => b.bed_id).length})</button>
                      <button type="button" role="tab" aria-selected={boardView === "rooms"} onClick={() => setBoardView("rooms")} className={"rounded-lg border px-4 py-2 text-sm font-semibold " + (boardView === "rooms" ? "border-sky-600 bg-sky-50 text-sky-800" : "border-slate-200 bg-white text-slate-600")}>Rooms ({(rooms.data ?? []).filter((r) => r.ward_id === w.id).length})</button>
                    </div>
                    {boardView === "rooms" ? (
                      <>
                        {role === "admin" && (
                              <div className="mb-4">
                                <div className="mb-2 flex items-center justify-between gap-2">
                                  <h3 className="text-sm font-semibold text-slate-700">Rooms</h3>
                                  <span className="text-xs text-slate-500">{(rooms.data ?? []).filter((r) => r.ward_id === w.id).length} configured</span>
                                </div>
                                {(rooms.data ?? []).some((r) => r.ward_id === w.id) ? (
                                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                    {(rooms.data ?? []).filter((r) => r.ward_id === w.id).map((room) => {
                                      const roomBeds = rows.filter((b) => b.room_id === room.id || b.room_code === room.room_code);
                                      const occupied = roomBeds.filter((b) => b.bed_id && b.occupied).length;
                                      const total = roomBeds.filter((b) => b.bed_id).length;
                                      return (
                                        <div key={room.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                          <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                              <p className="truncate text-sm font-semibold text-slate-800">{room.room_code}</p>
                                              <p className="mt-1 text-xs text-slate-500">{room.is_private ? "Private room" : "Public / shared room"}</p>
                                            </div>
                                            <Badge tone={room.is_active ? "success" : "neutral"}>{room.is_active ? "Active" : "Inactive"}</Badge>
                                          </div>
                                          <p className="mt-3 text-xs text-slate-600">{total} beds · {occupied} occupied · {Math.max(0, total - occupied)} available</p>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <p className="rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-500">No rooms configured in this ward yet.</p>
                                )}
                              </div>
                            )}
                      </>
                    ) : (
                      <>
                        {rows.some((b) => b.bed_id) ? (
                              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                {rows
                                  .filter((b) => b.bed_id)
                                  .map((b) => (
                                    <BedCard
                                      key={b.bed_id}
                                      bed={b}
                                      role={role}
                                      assignedWardId={assignedWardId}
                                      encounters={encounters.data ?? []}
                                      onAction={doAction}
                                      busy={action.isPending}
                                    />
                                  ))}
                              </div>
                            ) : (
                              <p className="rounded-lg border border-dashed border-slate-300 p-5 text-sm text-slate-500">
                                No beds configured in this ward yet.
                              </p>
                            )}
                      </>
                    )}
                  </section>
                );
              })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      {role === "nurse_station" && (
        <p className="text-xs leading-5 text-slate-500">
          This view is restricted to your assigned ward. Patient transfers
          between wards must be initiated by authorized Emergency Nurse staff;
          Nurse Station can reassign beds within its own ward.
        </p>
      )}
    </div>
  );
}
