import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Pencil, Plus, ShieldCheck, Users, Trash2, X, UserCheck } from "lucide-react";
import { getSupabaseClient } from "../../lib/supabase";
import { Button } from "../../components/ui/Button";
import { Card, CardContent } from "../../components/ui/Card";
import { ListEmpty, ListError, ListToolbar, Metric, MetricDivider, MetricStrip, PageToast, RefreshButton, StatusPill, TableSkeleton, ToolbarActions } from "../../components/ui/ListTable";
import { rowClass, tbodyClass, theadClass, thClass, thFirstClass } from "../../components/ui/listTableStyles";
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
const fieldClass = "mt-1.5 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/10";
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
      const { data, error } = await getSupabaseClient().functions.invoke("admin-invite-staff", {
        body: {
          email: inviteEmail,
          displayName: inviteName,
          password: invitePassword,
          role: inviteRole,
          wardId: inviteRole === "nurse_station" ? inviteWardId : null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
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
      const { error } = await getSupabaseClient().rpc("admin_update_staff_profile", {
        p_user_id: deleteTarget.user_id,
        p_display_name: deleteTarget.display_name,
        p_role: deleteTarget.role,
        p_ward_id: deleteTarget.ward_id,
        p_is_active: false,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      const deactivatedName = deleteTarget?.display_name ?? "Staff account";
      setDeleteTarget(null);
      setMessage(deactivatedName + " was deactivated. The login and audit history were retained.");
      setErrorMessage("");
      await client.invalidateQueries({ queryKey: ["admin", "staff-directory"] });
    },
    onError: (cause) => {
      setErrorMessage(cause instanceof Error ? cause.message : "Unable to deactivate staff account.");
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
  const staffRows = staff.data ?? [];
  return (
    <div className="mx-auto max-w-[1440px] space-y-3 pb-5">
      <PageToast message={message} error={errorMessage} />
      {showInvite && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !invite.isPending) setShowInvite(false); }}><section role="dialog" aria-modal="true" aria-labelledby="add-staff-title" className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"><div className="mb-5 flex items-start justify-between gap-3"><div><h2 id="add-staff-title" className="text-lg font-semibold">Add staff account</h2></div><button type="button" aria-label="Close add staff dialog" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={() => setShowInvite(false)} disabled={invite.isPending}><X size={18}/></button></div>
        <form className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" onSubmit={(event) => { event.preventDefault(); invite.mutate(); }}>
          <label className="block text-sm font-medium text-slate-700">Full name<input required maxLength={150} value={inviteName} onChange={(event) => setInviteName(event.target.value)} className={fieldClass}/></label>
          <label className="block text-sm font-medium text-slate-700">Email<input required type="email" maxLength={254} value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} className={fieldClass}/></label>
          <label className="block text-sm font-medium text-slate-700">Initial password<input required type="password" minLength={8} maxLength={128} autoComplete="new-password" value={invitePassword} onChange={(event) => setInvitePassword(event.target.value)} className={fieldClass} placeholder="At least 8 characters"/></label>
          <label className="block text-sm font-medium text-slate-700">Role<select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as StaffRole)} className={fieldClass}>{roles.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          {inviteRole === "nurse_station" && <label className="block text-sm font-medium text-slate-700">Ward / nurse station<select required disabled={!wards.data?.length} value={inviteWardId} onChange={(event) => setInviteWardId(event.target.value)} className={fieldClass}><option value="">{wards.data?.length ? "Select ward" : "No wards available"}</option>{(wards.data ?? []).map((ward) => <option key={ward.id} value={ward.id}>{ward.name}</option>)}</select>{!wards.data?.length && <span className="mt-1 block text-xs text-slate-500">No wards available to assign.</span>}</label>}
          <div className="flex items-end"><Button type="submit" disabled={invite.isPending || wards.isLoading}>{invite.isPending ? "Adding staff…" : "Add staff"}</Button></div>
        </form>
      </section></div>}
      <Card><CardContent className="px-4 pb-4 pt-6 sm:px-5 sm:pb-5 sm:pt-7">
        <ListToolbar>
          <ToolbarActions className="xl:ml-auto">
            <MetricStrip>
              <Metric icon={<Users size={16} className="text-sky-700"/>} label="Total staff" value={staff.isLoading ? "—" : staffRows.length} />
              <MetricDivider />
              <Metric icon={<UserCheck size={16} className="text-emerald-700"/>} label="Active" value={staff.isLoading ? "—" : staffRows.filter((row) => row.is_active).length} />
              <MetricDivider />
              <Metric icon={<Activity size={16} className="text-sky-700"/>} label="Roles" value={staff.isLoading ? "—" : new Set(staffRows.map((row) => row.role)).size} />
            </MetricStrip>
            <Button onClick={() => { setShowInvite(true); setMessage(""); setErrorMessage(""); }}><Plus size={16}/> Add staff</Button>
            <RefreshButton label="Refresh staff list" onClick={() => void staff.refetch()} spinning={staff.isFetching} />
          </ToolbarActions>
        </ListToolbar>
        {staff.isLoading ? <TableSkeleton label="Loading staff profiles" /> : staff.isError ? <ListError message="Could not load staff." onRetry={() => void staff.refetch()} /> : staffRows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-[13px]"><thead className={theadClass}><tr><th className={thFirstClass}>Staff</th><th className={thClass}>Email</th><th className={thClass}>Role</th><th className={thClass}>Status</th><th className="py-3.5 pr-2 text-base font-bold">Action</th></tr></thead><tbody className={tbodyClass}>{staffRows.map((row) => <tr key={row.user_id} className={rowClass}><td className="py-3 pr-4 pl-2 font-medium text-slate-900">{row.display_name}</td><td className="py-3 pr-4 text-slate-600">{row.email}</td><td className="py-3 pr-4">{row.role === "nurse_station" ? (wards.data?.find((ward) => ward.id === row.ward_id)?.name ?? roleLabel(row.role)) : roleLabel(row.role)}</td><td className="py-3 pr-4"><StatusPill tone={row.is_active ? "success" : "neutral"}>{row.is_active ? "Active" : "Inactive"}</StatusPill></td><td className="py-3"><div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={() => edit(row)}><Pencil size={14}/> Edit</Button>{row.is_active && <Button size="sm" variant="danger" onClick={() => { setDeleteTarget(row); setMessage(""); setErrorMessage(""); }}><Trash2 size={14}/> Deactivate</Button>}</div></td></tr>)}</tbody></table></div> : <ListEmpty icon={<ShieldCheck className="mx-auto text-slate-300" size={30}/>} title="No staff profiles" hint="Select Add staff to create the first staff account." />}
      </CardContent></Card>
      {selected && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !save.isPending) setSelected(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="edit-staff-title" className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-3"><div><h2 id="edit-staff-title" className="text-lg font-semibold text-slate-900">Edit staff profile</h2><p className="mt-1 text-sm text-slate-500">{selected.email}</p></div><button type="button" aria-label="Close edit dialog" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={() => setSelected(null)} disabled={save.isPending}><X size={18}/></button></div>
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
            <label className="block text-sm font-medium text-slate-700">Display name<input required maxLength={150} value={displayName} onChange={(event) => setDisplayName(event.target.value)} className={fieldClass}/></label>
            <label className="block text-sm font-medium text-slate-700">Role<select value={role} onChange={(event) => setRole(event.target.value as StaffRole)} className={fieldClass}>{roles.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            {role === "nurse_station" && <label className="block text-sm font-medium text-slate-700">Assigned ward<select required value={wardId} onChange={(event) => setWardId(event.target.value)} className={fieldClass}><option value="">Select ward</option>{(wards.data ?? []).map((ward) => <option key={ward.id} value={ward.id}>{ward.name}</option>)}</select>{wards.isError && <span className="mt-1 block text-xs text-rose-700">Could not load wards.</span>}</label>}
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm"><input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} className="size-4 accent-sky-700"/> <span><span className="block font-medium text-slate-800">Account active</span><span className="block text-xs text-slate-500">Turn off to deactivate access while keeping the staff record.</span></span></label>
            {errorMessage && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{errorMessage}</p>}
            <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setSelected(null)} disabled={save.isPending}>Cancel</Button><Button type="submit" disabled={save.isPending || wards.isLoading}>{save.isPending ? "Saving…" : "Save staff"}</Button></div>
          </form>
        </section>
      </div>}
      {deleteTarget && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !removeStaff.isPending) setDeleteTarget(null); }}>
        <section role="alertdialog" aria-modal="true" aria-labelledby="delete-staff-title" aria-describedby="delete-staff-description" className="my-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
          <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-rose-100 text-rose-700"><Trash2 size={20}/></div>
          <h2 id="delete-staff-title" className="text-lg font-semibold text-slate-900">Deactivate staff account?</h2>
          <p id="delete-staff-description" className="mt-2 text-sm leading-6 text-slate-600"><strong>{deleteTarget.display_name}</strong> ({deleteTarget.email}) will lose HMS access. Their login identity and audit history will be retained, and an administrator can reactivate the account later.</p>
          {errorMessage && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{errorMessage}</p>}
          <div className="mt-6 flex flex-wrap justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setDeleteTarget(null)} disabled={removeStaff.isPending}>Cancel</Button><Button type="button" variant="danger" onClick={() => removeStaff.mutate()} disabled={removeStaff.isPending}>{removeStaff.isPending ? "Deactivating…" : "Deactivate account"}</Button></div>
        </section>
      </div>}
    </div>
  );
}
