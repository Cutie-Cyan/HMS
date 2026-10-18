import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, RefreshCw, ShieldCheck, Users, Trash2, X } from "lucide-react";
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
const fieldClass = "mt-1.5 min-h-11 w-full rounded-xl border border-[#dedee4] bg-white px-3 text-sm outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10";
const roleLabel = (role: StaffRole) => roles.find((item) => item.value === role)?.label ?? role;

async function invitationErrorMessage(cause: unknown): Promise<string> {
  const context = cause && typeof cause === "object" && "context" in cause
    ? (cause as { context?: unknown }).context
    : null;
  if (context instanceof Response) {
    try {
      const payload: unknown = await context.clone().json();
      if (payload && typeof payload === "object") {
        const details = payload as { error?: unknown; message?: unknown };
        if (typeof details.error === "string" && details.error.trim()) return details.error;
        if (typeof details.message === "string" && details.message.trim()) return details.message;
      }
    } catch {
      // Fall back to the SDK error when the response isn't JSON.
    }
  }
  return cause instanceof Error ? cause.message : "Unable to invite staff member.";
}

export function StaffAdminWorkspace() {
  const client = useQueryClient();
  const [selected, setSelected] = useState<StaffRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffRow | null>(null);
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
  const [invitePassword, setInvitePassword] = useState("");
  const [showInvite, setShowInvite] = useState(false);
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
      const supabase = getSupabaseClient();
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Your session has expired. Sign in again.");

      const apiUrl = (import.meta.env.VITE_HMS_API_URL || "http://127.0.0.1:8000").replace(/\\/$/, "");
      const response = await fetch(`${apiUrl}/api/admin/staff/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          email: inviteEmail,
          displayName: inviteName,
          password: invitePassword,
          role: inviteRole,
          wardId: inviteRole === "nurse_station" ? inviteWardId : null,
        }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const detail = payload && typeof payload === "object" && "detail" in payload
          ? (payload as { detail?: unknown }).detail
          : null;
        throw new Error(typeof detail === "string" ? detail : "Unable to create staff account.");
      }
      return payload;
    },
    onSuccess: async () => {
      setMessage("Staff account created for " + inviteEmail.trim() + ". Give the initial password to the staff member securely."); setErrorMessage("");
      setInviteEmail(""); setInviteName(""); setInvitePassword(""); setInviteRole("info_officer"); setInviteWardId(""); setShowInvite(false);
      await client.invalidateQueries({ queryKey: ["admin", "staff-directory"] });
    },
    onError: async (cause) => { setErrorMessage(await invitationErrorMessage(cause)); setMessage(""); },
  });
  const removeStaff = useMutation({
    mutationFn: async () => {
      if (!deleteTarget) throw new Error("Select a staff account first.");
      const { data, error } = await getSupabaseClient().functions.invoke("admin-delete-staff", {
        body: { userId: deleteTarget.user_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: async () => {
      const deletedName = deleteTarget?.display_name ?? "Staff account";
      setDeleteTarget(null);
      setMessage(deletedName + " was permanently deleted.");
      setErrorMessage("");
      await client.invalidateQueries({ queryKey: ["admin", "staff-directory"] });
    },
    onError: (cause) => {
      setErrorMessage(cause instanceof Error ? cause.message : "Unable to delete staff account.");
      setMessage("");
    },
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
        <div><h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#202124] md:text-3xl">Staff access</h1></div>
        <div className="flex gap-2"><Button variant="secondary" onClick={() => void staff.refetch()} disabled={staff.isFetching}><RefreshCw size={15}/> Refresh</Button><Button onClick={() => { setShowInvite(true); setMessage(""); setErrorMessage(""); }}><Plus size={16}/> Add staff</Button></div>
      </header>
      {(message || errorMessage) && <div role={errorMessage ? "alert" : "status"} className={`rounded-xl p-3 text-sm ${errorMessage ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-800"}`}>{errorMessage || message}</div>}
      {showInvite && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !invite.isPending) setShowInvite(false); }}><section role="dialog" aria-modal="true" aria-labelledby="add-staff-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6"><div className="mb-5 flex items-start justify-between gap-3"><div><h2 id="add-staff-title" className="text-lg font-semibold">Add staff account</h2><p className="mt-1 text-sm text-slate-500">Create login access and assign a role.</p></div><button type="button" aria-label="Close add staff dialog" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={() => setShowInvite(false)} disabled={invite.isPending}><X size={18}/></button></div>
        <form className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" onSubmit={(event) => { event.preventDefault(); invite.mutate(); }}>
          <label className="block text-sm font-medium">Full name<input required maxLength={150} value={inviteName} onChange={(event) => setInviteName(event.target.value)} className={fieldClass}/></label>
          <label className="block text-sm font-medium">Email<input required type="email" maxLength={254} value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} className={fieldClass}/></label>
          <label className="block text-sm font-medium">Initial password<input required type="password" minLength={8} maxLength={128} autoComplete="new-password" value={invitePassword} onChange={(event) => setInvitePassword(event.target.value)} className={fieldClass} placeholder="At least 8 characters"/></label>
          <label className="block text-sm font-medium">Role<select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as StaffRole)} className={fieldClass}>{roles.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          {inviteRole === "nurse_station" && <label className="block text-sm font-medium">Ward / nurse station<select required value={inviteWardId} onChange={(event) => setInviteWardId(event.target.value)} className={fieldClass}><option value="">Select ward</option>{(wards.data ?? []).map((ward) => <option key={ward.id} value={ward.id}>{ward.name}</option>)}</select></label>}
          <div className="flex items-end"><Button type="submit" disabled={invite.isPending || wards.isLoading}>{invite.isPending ? "Adding staff…" : "Add staff"}</Button></div>
        </form>
      </section></div>}
      <div className="grid gap-5">
        <Card><CardHeader><div className="flex items-center gap-2 font-semibold"><Users size={18} className="text-teal-700"/> Staff profiles</div></CardHeader><CardContent>
          {staff.isLoading ? <p className="py-8 text-sm text-muted-foreground">Loading staff profiles…</p> : staff.isError ? <div className="py-8 text-center"><p role="alert" className="text-sm text-rose-700">Could not load staff profiles.</p><Button className="mt-3" variant="secondary" onClick={() => void staff.refetch()}>Retry</Button></div> : staff.data?.length ? <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="py-3 pr-3">Staff</th><th className="py-3 pr-3">Role</th><th className="py-3 pr-3">Status</th><th className="py-3">Actions</th></tr></thead><tbody className="divide-y divide-border">{staff.data.map((row) => <tr key={row.user_id} className="hover:bg-muted/40"><td className="py-3 pr-3"><p className="font-medium">{row.display_name}</p><p className="text-xs text-muted-foreground">{row.email}</p></td><td className="py-3 pr-3">{roleLabel(row.role)}{row.role === "nurse_station" && <p className="text-xs text-muted-foreground">{wards.data?.find((ward) => ward.id === row.ward_id)?.name ?? "Ward not available"}</p>}</td><td className="py-3 pr-3"><Badge tone={row.is_active ? "success" : "neutral"}>{row.is_active ? "Active" : "Inactive"}</Badge></td><td className="py-3"><div className="flex items-center gap-2"><Button size="sm" variant="secondary" onClick={() => edit(row)}><Pencil size={14}/> Edit</Button><Button size="sm" variant="danger" onClick={() => { setDeleteTarget(row); setMessage(""); setErrorMessage(""); }}><Trash2 size={14}/> Delete</Button></div></td></tr>)}</tbody></table></div> : <div className="py-8 text-center"><ShieldCheck className="mx-auto text-slate-300" size={28}/><p className="mt-2 font-medium">No staff profiles</p><p className="mt-1 text-sm text-muted-foreground">Select Add staff to create the first staff account.</p></div>}
        </CardContent></Card>
      {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !save.isPending) setSelected(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="edit-staff-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-3"><div><h2 id="edit-staff-title" className="text-lg font-semibold text-slate-900">Edit staff profile</h2><p className="mt-1 text-sm text-slate-500">{selected.email}</p></div><button type="button" aria-label="Close edit dialog" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={() => setSelected(null)} disabled={save.isPending}><X size={18}/></button></div>
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
            <label className="block text-sm font-medium">Display name<input required maxLength={150} value={displayName} onChange={(event) => setDisplayName(event.target.value)} className={fieldClass}/></label>
            <label className="block text-sm font-medium">Role<select value={role} onChange={(event) => setRole(event.target.value as StaffRole)} className={fieldClass}>{roles.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            {role === "nurse_station" && <label className="block text-sm font-medium">Assigned ward<select required value={wardId} onChange={(event) => setWardId(event.target.value)} className={fieldClass}><option value="">Select ward</option>{(wards.data ?? []).map((ward) => <option key={ward.id} value={ward.id}>{ward.name}</option>)}</select>{wards.isError && <span className="mt-1 block text-xs text-rose-700">Could not load wards.</span>}</label>}
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm"><input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} className="size-4 accent-teal-700"/> <span><span className="block font-medium text-slate-800">Account active</span><span className="block text-xs text-slate-500">Turn off to deactivate access while keeping the staff record.</span></span></label>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><Button type="button" variant="secondary" onClick={() => setSelected(null)} disabled={save.isPending}>Cancel</Button><Button type="submit" disabled={save.isPending || wards.isLoading}>{save.isPending ? "Saving…" : "Save changes"}</Button></div>
            {errorMessage && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{errorMessage}</p>}
          </form>
        </section>
      </div>}
      {deleteTarget && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !removeStaff.isPending) setDeleteTarget(null); }}>
        <section role="alertdialog" aria-modal="true" aria-labelledby="delete-staff-title" aria-describedby="delete-staff-description" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
          <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-rose-100 text-rose-700"><Trash2 size={20}/></div>
          <h2 id="delete-staff-title" className="text-lg font-semibold text-slate-900">Permanently delete staff account?</h2>
          <p id="delete-staff-description" className="mt-2 text-sm leading-6 text-slate-600">This permanently removes <strong>{deleteTarget.display_name}</strong> ({deleteTarget.email}) from staff access and deletes the linked login identity. This cannot be undone. To retain their record and history, cancel and deactivate the account from Edit instead.</p>
          {errorMessage && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{errorMessage}</p>}
          <div className="mt-6 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setDeleteTarget(null)} disabled={removeStaff.isPending}>Cancel</Button><Button type="button" variant="danger" onClick={() => removeStaff.mutate()} disabled={removeStaff.isPending}>{removeStaff.isPending ? "Deleting…" : "Delete permanently"}</Button></div>
        </section>
      </div>}
      </div>
    </div>
  );
}
