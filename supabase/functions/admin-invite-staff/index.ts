import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigin = Deno.env.get("HMS_ALLOWED_ORIGIN");
const cors = {
  "Access-Control-Allow-Origin": allowedOrigin ?? "null",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: cors });
const allowedRoles = new Set([
  "admin", "info_officer", "emergency_nurse", "cashier", "pharmacy", "lab", "nurse_station",
]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed." });
  if (!allowedOrigin) return json(500, { error: "Server auth configuration is missing the allowed frontend origin." });

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return json(500, { error: "Server auth configuration is missing." });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Sign in as an administrator first." });

  const callerClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData.user) return json(401, { error: "Your session is invalid or expired." });

  const adminClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: actor, error: actorError } = await adminClient
    .from("staff_profiles")
    .select("role,is_active")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (actorError) return json(500, { error: "Could not verify administrator access." });
  if (!actor || actor.role !== "admin" || actor.is_active !== true) {
    return json(403, { error: "Only an active administrator may invite staff." });
  }

  let body: { email?: unknown; password?: unknown; displayName?: unknown; role?: unknown; wardId?: unknown };
  try { body = await req.json(); } catch { return json(400, { error: "Request body must be valid JSON." }); }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
  const role = typeof body.role === "string" ? body.role : "";
  const wardId = typeof body.wardId === "string" && body.wardId ? body.wardId : null;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return json(400, { error: "Enter a valid email address." });
  }
  if (password.length < 8 || password.length > 128) return json(400, { error: "Initial password must be between 8 and 128 characters." });
  if (!displayName || displayName.length > 150) return json(400, { error: "Display name is required (maximum 150 characters)." });
  if (!allowedRoles.has(role)) return json(400, { error: "Choose a valid staff role." });
  if (role === "nurse_station") {
    if (!wardId) return json(400, { error: "Nurse Station staff must be assigned to a ward." });
    const { data: ward, error } = await adminClient.from("wards").select("id").eq("id", wardId).eq("is_active", true).maybeSingle();
    if (error || !ward) return json(400, { error: "Choose an active ward." });
  }

  const { data: existing, error: existingError } = await adminClient
    .from("staff_profiles").select("user_id").ilike("email", email).maybeSingle();
  if (existingError) return json(500, { error: "Could not check existing staff profiles." });
  if (existing) return json(409, { error: "A staff profile already uses that email." });

  const { data: invitation, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { display_name: displayName, hms_role: role },
  });
  if (inviteError || !invitation.user) {
    return json(400, { error: inviteError?.message ?? "Could not send the invitation." });
  }

  const { error: profileError } = await adminClient.from("staff_profiles").insert({
    user_id: created.user.id,
    email,
    display_name: displayName,
    role,
    ward_id: role === "nurse_station" ? wardId : null,
    is_active: true,
  });
  if (profileError) {
    await adminClient.auth.admin.deleteUser(invitation.user.id);
    return json(500, { error: "Invitation setup failed and the unlinked Auth account was rolled back. Check the database schema and retry." });
  }

  const { error: auditError } = await adminClient.from("audit_logs").insert({
    actor_id: userData.user.id,
    action: "staff.invited",
    entity_type: "staff_profile",
    entity_id: invitation.user.id,
    details: { email, display_name: displayName, role, ward_id: role === "nurse_station" ? wardId : null },
  });
  if (auditError) {
    // The invitation/profile exists; surface audit failure instead of claiming a fully audited success.
    return json(500, { error: "Staff invitation was created, but its audit event failed. Check audit logs before retrying." });
  }
  return json(201, { userId: invitation.user.id, email, displayName, role, message: "Staff account created. Give the initial password to the staff member securely and require a password change at first sign-in." });
});
