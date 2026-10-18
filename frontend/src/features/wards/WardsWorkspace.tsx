import { useMemo, useState, type FormEvent } from "react";
import { BedDouble, CheckCircle2, RefreshCw, ShieldAlert } from "lucide-react";
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
  const [bedCode, setBedCode] = useState("");
  const [bedWard, setBedWard] = useState("");
  const [bedType, setBedType] = useState<"public" | "private">("public");
  const [roomId, setRoomId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
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
  const wards = useMemo(() => {
    const map = new Map<string, BedRow>();
    for (const row of board.data ?? [])
      if (!map.has(row.ward_id)) map.set(row.ward_id, row);
    return [...map.values()];
  }, [board.data]);
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
  const wardList = wards.map((w) => ({ id: w.ward_id, name: w.ward_name }));
  const roomsForWard = (wardId: string, privateOnly = false) =>
    (rooms.data ?? []).filter(
      (r) =>
        r.ward_id === wardId && (privateOnly ? r.is_private : !r.is_private),
    );
  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      {(message || error) && (
        <div
          role={error ? "alert" : "status"}
          className={
            "rounded-lg p-3 text-sm " +
            (error
              ? "bg-rose-50 text-rose-800"
              : "bg-emerald-50 text-emerald-800")
          }
        >
          {error || message}
        </div>
      )}
      {role === "admin" && (
        <Card>
          <CardHeader><h2 className="font-semibold">Add bed</h2></CardHeader>
          <CardContent>
            <form onSubmit={submitBed} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <label className="block text-sm font-medium">Bed code<input required value={bedCode} onChange={(e) => setBedCode(e.target.value)} className={field} maxLength={60}/></label>
              <label className="block text-sm font-medium">Ward<select required value={bedWard} onChange={(e) => { setBedWard(e.target.value); setRoomId(""); }} className={field}><option value="">Select ward</option>{wardList.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
              <label className="block text-sm font-medium">Bed type<select value={bedType} onChange={(e) => { setBedType(e.target.value as "public" | "private"); setRoomId(""); }} className={field}><option value="public">Public</option><option value="private">Private room</option></select></label>
              <label className="block text-sm font-medium">Room<select value={roomId} onChange={(e) => setRoomId(e.target.value)} className={field} required={bedType === "private"}><option value="">No room / select private room</option>{roomsForWard(bedWard, bedType === "private").map((r) => <option key={r.id} value={r.id}>{r.room_code}</option>)}</select></label>
              <div className="sm:col-span-2 xl:col-span-4"><Button type="submit" disabled={saveBed.isPending || !bedCode.trim() || !bedWard || (bedType === "private" && !roomId)}>{saveBed.isPending ? "Adding bed…" : "Add bed"}</Button></div>
            </form>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 font-semibold">
                <BedDouble size={18} className="text-sky-700" /> Bed board
              </div>
            </div>
            <Button
              variant="secondary"
              onClick={() => void board.refetch()}
              disabled={board.isFetching}
            >
              <RefreshCw size={15} /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {board.isLoading ? (
            <p className="py-8 text-sm text-slate-500">Loading ward board…</p>
          ) : board.isError ? (
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
            <div className="space-y-6">
              {wardList.map((w) => {
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
                          Public {money(Number(first?.public_daily_rate ?? 0))}{" "}
                          / 24 hours · Private{" "}
                          {money(Number(first?.private_daily_rate ?? 0))} / 24
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
                  </section>
                );
              })}
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
