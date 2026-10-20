import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};
function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed." });
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anonKey || !serviceKey) return jsonResponse(500, { error: "Server authentication is not configured." });
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return jsonResponse(401, { error: "Sign in as an administrator first." });
    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await caller.auth.getUser();
    if (authError || !authData.user) return jsonResponse(401, { error: "Your session is invalid. Sign in again." });
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: actor, error: actorError } = await admin.from("staff_profiles").select("role,is_active").eq("user_id", authData.user.id).maybeSingle();
    if (actorError) return jsonResponse(500, { error: "Could not verify administrator access." });
    if (actor?.role !== "admin" || actor.is_active !== true) return jsonResponse(403, { error: "Only an active administrator can delete staff accounts." });
    const payload = await req.json().catch(() => null) as { userId?: unknown } | null;
    const targetId = typeof payload?.userId === "string" ? payload.userId.trim() : "";
    if (!targetId) return jsonResponse(400, { error: "Choose a staff account to delete." });
    if (targetId === authData.user.id) return jsonResponse(400, { error: "You cannot delete your own administrator account." });
    const { data: target, error: targetError } = await admin.from("staff_profiles").select("user_id,email,display_name,role,is_active").eq("user_id", targetId).maybeSingle();
    if (targetError) return jsonResponse(500, { error: "Could not load the selected staff account." });
    if (!target) return jsonResponse(404, { error: "The staff account was not found." });
    if (target.role === "admin" && target.is_active) {
      const { count, error: countError } = await admin.from("staff_profiles").select("user_id", { count: "exact", head: true }).eq("role", "admin").eq("is_active", true);
      if (countError) return jsonResponse(500, { error: "Could not verify administrator safety rules." });
      if ((count ?? 0) <= 1) return jsonResponse(409, { error: "The last active administrator cannot be deleted." });
    }
    const { error: deleteError } = await admin.auth.admin.deleteUser(targetId);
    if (deleteError) {
      console.error("Staff Auth deletion failed:", deleteError.message);
      return jsonResponse(500, { error: "Could not permanently delete this account. Check whether its related records prevent deletion." });
    }
    const { error: auditError } = await admin.from("audit_logs").insert({
      actor_id: authData.user.id,
      action: "staff.deleted",
      entity_type: "staff_profile",
      entity_id: targetId,
      details: { email: target.email, display_name: target.display_name, role: target.role, permanently_deleted: true },
    });
    if (auditError) {
      console.error("Staff was deleted but audit logging failed:", auditError.message);
      return jsonResponse(500, { error: "The account was deleted, but the audit event could not be saved. Check the audit log." });
    }
    return jsonResponse(200, { message: "Staff account permanently deleted.", userId: targetId });
  } catch (cause) {
    console.error("Unexpected admin-delete-staff error:", cause instanceof Error ? cause.message : cause);
    return jsonResponse(500, { error: "Unexpected error while deleting the staff account." });
  }
});
