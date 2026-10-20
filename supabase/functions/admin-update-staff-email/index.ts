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
    if (!url || !anonKey || !serviceKey) {
      return jsonResponse(500, { error: "Server authentication is not configured." });
    }

    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return jsonResponse(401, { error: "Sign in as an administrator first." });
    }

    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await caller.auth.getUser();
    if (authError || !authData.user) {
      return jsonResponse(401, { error: "Your session is invalid. Sign in again." });
    }

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: actor, error: actorError } = await admin
      .from("staff_profiles").select("role,is_active")
      .eq("user_id", authData.user.id).maybeSingle();
    if (actorError) return jsonResponse(500, { error: "Could not verify administrator access." });
    if (actor?.role !== "admin" || actor.is_active !== true) {
      return jsonResponse(403, { error: "Only an active administrator can change staff email addresses." });
    }

    const payload = await req.json().catch(() => null) as { userId?: unknown; email?: unknown } | null;
    const userId = typeof payload?.userId === "string" ? payload.userId.trim() : "";
    const email = typeof payload?.email === "string" ? payload.email.trim().toLowerCase() : "";
    if (!userId) return jsonResponse(400, { error: "Choose a staff account." });
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse(400, { error: "Enter a valid email address." });
    }

    const { data: target, error: targetError } = await admin
      .from("staff_profiles").select("user_id,email,display_name,role")
      .eq("user_id", userId).maybeSingle();
    if (targetError) return jsonResponse(500, { error: "Could not load the selected staff account." });
    if (!target) return jsonResponse(404, { error: "The staff account was not found." });

    if (target.email.toLowerCase() === email) {
      return jsonResponse(200, { message: "Email address is unchanged.", email });
    }

    const { data: duplicate, error: duplicateError } = await admin
      .from("staff_profiles").select("user_id").ilike("email", email)
      .neq("user_id", userId).limit(1).maybeSingle();
    if (duplicateError) return jsonResponse(500, { error: "Could not check whether the email is already in use." });
    if (duplicate) return jsonResponse(409, { error: "Another staff profile already uses this email address." });

    const { data: updatedAuth, error: authUpdateError } = await admin.auth.admin.updateUserById(userId, {
      email,
      email_confirm: true,
    });
    if (authUpdateError || !updatedAuth.user) {
      return jsonResponse(400, { error: authUpdateError?.message ?? "Could not update the authentication email." });
    }

    const { error: profileUpdateError } = await admin
      .from("staff_profiles").update({ email, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (profileUpdateError) {
      const { error: rollbackError } = await admin.auth.admin.updateUserById(userId, {
        email: target.email,
        email_confirm: true,
      });
      console.error("Staff profile email update failed:", profileUpdateError.message, rollbackError?.message);
      return jsonResponse(500, { error: "Could not update the staff profile email. Please retry; the authentication email update was rolled back when possible." });
    }

    const { error: auditError } = await admin.from("audit_logs").insert({
      actor_id: authData.user.id,
      action: "staff.email_updated",
      entity_type: "staff_profile",
      entity_id: userId,
      details: { display_name: target.display_name, role: target.role, previous_email: target.email, new_email: email },
    });
    if (auditError) {
      console.error("Staff email updated but audit logging failed:", auditError.message);
      return jsonResponse(500, { error: "Email was updated, but the audit event could not be saved. Check the audit log." });
    }

    return jsonResponse(200, { message: "Staff email updated.", userId, email });
  } catch (cause) {
    console.error("Unexpected admin-update-staff-email error:", cause instanceof Error ? cause.message : cause);
    return jsonResponse(500, { error: "Unexpected error while updating the staff email." });
  }
});
