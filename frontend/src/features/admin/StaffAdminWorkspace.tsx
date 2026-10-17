import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { getSupabaseClient } from "../../lib/supabase";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import type { StaffRole } from "../../lib/roles";

type StaffRow = {
  user_id: string;
  email: string;
  display_name: string;
  role: StaffRole;
  ward_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
type Ward = { id: string; name: string };
const roles: { value: StaffRole; label: string }[] = [
  { value: "admin", label: "Administrator" },
  { value: "info_officer", label: "Information Officer" },
  { value: "emergency_nurse", label: "Emergency Nurse" },
  { value: "cashier", label: "Cashier" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "lab", label: "Laboratory" },
  { value: "nurse_station", label: "Nurse Station" },
];
const fieldClass = "mt-1.5 min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10";
const roleLabel = (role: StaffRole) => roles.find((item) => item.value === role)?.label ?? role;

export function StaffAdminWorkspace() {
  const client = useQueryClient();
  const [selected, setSelected] = useState<StaffRow | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<StaffRole>("info_officer");
  const [wardId, setWardId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<StaffRole>("info_officer");
  const [inviteWardId, setInviteWardId] = useState("");
  const staff = useQuery({
    queryKey: ["admin", "staff-directory"],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc("admin_staff_directory");
      if (error) throw error;
      return (data ?? []) as StaffRow[];
    },
  });
  const wards = useQuery({
    queryKey: ["admin", "active-wards"],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().from("wards").select("id,name").eq("is_active", true).order("name");
      if (error) throw error;
      return (data ?? []) as Ward[];
    },
  });
  const save = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Select a staff profile first.");
      const { error } = await getSupabaseClient().rpc("admin_update_staff_profile", {
        p_user_id: selected.user_id,
        p_display_name: displayName,
        p_role: role,
        p_ward_id: role === "nurse_station" ? wardId : null,
        p_is_active: isActive,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["admin", "staff-directory"] });
      setMessage("Staff profile updated. The change was recorded in the audit log.");
      setErrorMessage("");
      setSelected(null);
    },
    onError: (cause) => {
      setErrorMessage(cause instanceof Error ? cause.message : "Unable to update staff profile.");
      setMessage("");
    },
  });
  const invite = useMutation({
    mutationFn: async () => {
      const { data, error } = await getSupabaseClient().functions.invoke("admin-invite-staff", {
        body: { email: inviteEmail, displayName: inviteName, role: inviteRole, wardId: inviteRole === "nurse_station" ? inviteWardId : null },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: async () => {
      setMessage("Invitation sent to " + inviteEmail.trim() + "."); setErrorMessage("");
      setInviteEmail(""); setInviteName(""); setInviteRole("info_officer"); setInviteWardId("");
      await client.invalidateQueries({ queryKey: ["admin", "staff-directory"] });
    },
    onError: (cause) => { setErrorMessage(cause instanceof Error ? cause.message : "Unable to invite staff member."); setMessage(""); },
  });
  const edit = (row: StaffRow) => {
    setSelected(row);
    setDisplayName(row.display_name);
    setRole(row.role);
    setWardId(row.ward_id ?? "");
    setIsActive(row.is_active);
    setMessage("");
    setErrorMessage("");
  };
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">Administration</p><h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">Staff access</h1><p className="mt-1 text-sm text-muted-foreground">Update roles and activation for existing staff profiles.</p></div>
        <Button variant="secondary" onClick={() => void staff.refetch()} disabled={staff.isFetching}><RefreshCw size={15}/> Refresh</Button>
      </header>
      {(message || errorMessage) && <div role={errorMessage ? "alert" : "status"} className={`rounded-xl p-3 text-sm ${errorMessage ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-800"}`}>{errorMessage || message}</div>}
      <Card><CardHeader><h2 className="font-semibold">Invite staff member</h2><p className="text-sm text-muted-foreground">Sends a Supabase Auth invitation. Staff set up their own access through the emailed link.</p></CardHeader><CardContent>
        <form className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" onSubmit={(event) => { event.preventDefault(); invite.mutate(); }}>
          <label className="block text-sm font-medium">Full name<input required maxLength={150} value={inviteName} onChange={(event) => setInviteName(event.target.value)} className={fieldClass}/></label>
          <label className="block text-sm font-medium">Email<input required type="email" maxLength={254} value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} className={fieldClass}/></label>
          <label className="block text-sm font-medium">Role<select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as StaffRole)} className={fieldClass}>{roles.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          {inviteRole === "nurse_station" && <label className="block text-sm font-medium">Assigned ward<select required value={inviteWardId} onChange={(event) => setInviteWardId(event.target.value)} className={fieldClass}><option value="">Select ward</option>{(wards.data ?? []).map((ward) => <option key={ward.id} value={ward.id}>{ward.name}</option>)}</select></label>}
          <div className="flex items-end"><Button block type="submit" disabled={invite.isPending || wards.isLoading}>{invite.isPending ? "Sending invite…" : "Send invitation"}</Button></div>
        </form>
      </CardContent></Card>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,.8fr)]">
        <Card><CardHeader><div className="flex items-center gap-2 font-semibold"><Users size={18} className="text-teal-700"/> Staff profiles</div><p className="text-sm text-muted-foreground">Manage existing staff identities and their role-based access.</p></CardHeader><CardContent>
          {staff.isLoading ? <p className="py-8 text-sm text-muted-foreground">Loading staff profiles…</p> : staff.isError ? <div className="py-8 text-center"><p role="alert" className="text-sm text-rose-700">Could not load staff profiles.</p><Button className="mt-3" variant="secondary" onClick={() => void staff.refetch()}>Retry</Button></div> : staff.data?.length ? <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="py-3 pr-3">Staff</th><th className="py-3 pr-3">Role</th><th className="py-3 pr-3">Status</th><th className="py-3">Action</th></tr></thead><tbody className="divide-y divide-border">{staff.data.map((row) => <tr key={row.user_id} className="hover:bg-muted/40"><td className="py-3 pr-3"><p className="font-medium">{row.display_name}</p><p className="text-xs text-muted-foreground">{row.email}</p></td><td className="py-3 pr-3">{roleLabel(row.role)}{row.role === "nurse_station" && <p className="text-xs text-muted-foreground">{wards.data?.find((ward) => ward.id === row.ward_id)?.name ?? "Ward not available"}</p>}</td><td className="py-3 pr-3"><Badge tone={row.is_active ? "success" : "neutral"}>{row.is_active ? "Active" : "Inactive"}</Badge></td><td className="py-3"><Button size="sm" variant="secondary" onClick={() => edit(row)}><Pencil size={14}/> Edit</Button></td></tr>)}</tbody></table></div> : <div className="py-8 text-center"><ShieldCheck className="mx-auto text-slate-300" size={28}/><p className="mt-2 font-medium">No staff profiles</p><p className="mt-1 text-sm text-muted-foreground">Use the invitation form above to create the first staff account.</p></div>}
        </CardContent></Card>
        <Card><CardHeader><h2 className="font-semibold">{selected ? "Edit staff profile" : "Staff access details"}</h2></CardHeader><CardContent>
          {selected ? <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
            <div className="rounded-lg bg-muted/50 p-3"><p className="text-sm font-medium">{selected.email}</p><p className="text-xs text-muted-foreground">Auth identity is not changed here.</p></div>
            <label className="block text-sm font-medium">Display name<input required maxLength={150} value={displayName} onChange={(event) => setDisplayName(event.target.value)} className={fieldClass}/></label>
            <label className="block text-sm font-medium">Role<select value={role} onChange={(event) => setRole(event.target.value as StaffRole)} className={fieldClass}>{roles.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            {role === "nurse_station" && <label className="block text-sm font-medium">Assigned ward<select required value={wardId} onChange={(event) => setWardId(event.target.value)} className={fieldClass}><option value="">Select ward</option>{(wards.data ?? []).map((ward) => <option key={ward.id} value={ward.id}>{ward.name}</option>)}</select>{wards.isError && <span className="mt-1 block text-xs text-rose-700">Could not load wards.</span>}</label>}
            <label className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm"><input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} className="size-4 accent-teal-700"/> Account active</label>
            <div className="flex flex-wrap gap-2"><Button type="submit" disabled={save.isPending || wards.isLoading}>{save.isPending ? "Saving…" : "Save changes"}</Button><Button type="button" variant="secondary" onClick={() => setSelected(null)}>Cancel</Button></div>
          </form> : <div className="space-y-3 text-sm text-muted-foreground"><p>Select a staff member to update their role, ward assignment, or active status.</p><p className="rounded-lg border border-border p-3">Changes are validated by a database function and written to the audit log.</p><p className="rounded-lg border border-border p-3">Invitations are sent through a secured Supabase Edge Function; this app never handles staff passwords.</p></div>}
        </CardContent></Card>
      </div>
    </div>
  );
}
