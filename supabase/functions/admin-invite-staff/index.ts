import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

type InviteBody = {
  email?: unknown;
  displayName?: unknown;
  password?: unknown;
  role?: unknown;
  wardId?: unknown;
};

const allowedRoles = new Set([
  "admin",
  "info_officer",
  "emergency_nurse",
  "cashier",
  "pharmacy",
  "lab",
  "nurse_station",
]);

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error("Missing Supabase environment configuration.");
      return jsonResponse(500, {
        error: "Server authentication is not configured correctly.",
      });
    }

    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return jsonResponse(401, {
        error: "Sign in as an administrator before adding staff.",
      });
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } =
      await callerClient.auth.getUser();

    if (authError || !authData.user) {
      return jsonResponse(401, {
        error: "Your session is invalid or has expired. Please sign in again.",
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: actor, error: actorError } = await adminClient
      .from("staff_profiles")
      .select("role, is_active")
      .eq("user_id", authData.user.id)
      .maybeSingle();

    if (actorError) {
      console.error("Could not verify staff permissions:", actorError.message);
      return jsonResponse(500, {
        error: "Could not verify administrator access.",
      });
    }

    if (actor?.role !== "admin" || actor.is_active !== true) {
      return jsonResponse(403, {
        error: "Only an active administrator can add staff accounts.",
      });
    }

    let body: InviteBody;
    try {
      body = await req.json() as InviteBody;
    } catch {
      return jsonResponse(400, {
        error: "The request body must contain valid JSON.",
      });
    }

    const email = getString(body.email).toLowerCase();
    const displayName = getString(body.displayName);
    const password = typeof body.password === "string" ? body.password : "";
    const role = getString(body.role);
    const wardId = getString(body.wardId) || null;

    if (
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return jsonResponse(400, {
        error: "Enter a valid email address.",
      });
    }

    if (!displayName || displayName.length > 150) {
      return jsonResponse(400, {
        error: "Enter a staff name up to 150 characters.",
      });
    }

    if (password.length < 8 || password.length > 128) {
      return jsonResponse(400, {
        error: "The initial password must be 8 to 128 characters.",
      });
    }

    if (!allowedRoles.has(role)) {
      return jsonResponse(400, {
        error: "Select a valid staff role.",
      });
    }

    if (role === "nurse_station") {
      if (!wardId) {
        return jsonResponse(400, {
          error: "Select a ward for Nurse Station staff.",
        });
      }

      const { data: ward, error: wardError } = await adminClient
        .from("wards")
        .select("id")
        .eq("id", wardId)
        .eq("is_active", true)
        .maybeSingle();

      if (wardError) {
        console.error("Could not verify selected ward:", wardError.message);
        return jsonResponse(500, {
          error: "Could not verify the selected ward. Please try again.",
        });
      }

      if (!ward) {
        return jsonResponse(400, {
          error: "Select an active ward.",
        });
      }
    }

    const { data: existingProfile, error: profileLookupError } =
      await adminClient
        .from("staff_profiles")
        .select("user_id")
        .ilike("email", email)
        .maybeSingle();

    if (profileLookupError) {
      console.error(
        "Could not check existing staff profiles:",
        profileLookupError.message,
      );
      return jsonResponse(500, {
        error: "Could not check whether this email is already registered.",
      });
    }

    if (existingProfile) {
      return jsonResponse(409, {
        error: "A staff profile already uses this email address.",
      });
    }

    const { data: created, error: createError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          display_name: displayName,
          hms_role: role,
          must_change_password: true,
        },
      });

    if (createError || !created.user) {
      console.error("Auth user creation failed:", createError?.message);
      return jsonResponse(400, {
        error: createError?.message ?? "Could not create the staff account.",
      });
    }

    const newUserId = created.user.id;
    const { error: insertProfileError } = await adminClient
      .from("staff_profiles")
      .insert({
        user_id: newUserId,
        email,
        display_name: displayName,
        role,
        ward_id: role === "nurse_station" ? wardId : null,
        is_active: true,
      });

    if (insertProfileError) {
      console.error(
        "Staff profile creation failed; rolling back Auth user:",
        insertProfileError.message,
      );
      const { error: rollbackError } =
        await adminClient.auth.admin.deleteUser(newUserId);

      if (rollbackError) {
        console.error("Auth user rollback failed:", rollbackError.message);
      }

      return jsonResponse(500, {
        error: rollbackError
          ? "Staff profile creation failed and automatic cleanup also failed. Check Supabase Auth and staff profiles before retrying."
          : "Could not create the staff profile. No staff account was kept; check the database schema and retry.",
      });
    }

    const { error: auditError } = await adminClient
      .from("audit_logs")
      .insert({
        actor_id: authData.user.id,
        action: "staff.created",
        entity_type: "staff_profile",
        entity_id: newUserId,
        details: {
          email,
          display_name: displayName,
          role,
          ward_id: role === "nurse_station" ? wardId : null,
        },
      });

    if (auditError) {
      console.error("Staff was created but audit logging failed:", auditError.message);
      return jsonResponse(500, {
        error: "Staff account was created, but the audit log could not be saved. Check the audit log before trying again.",
        userId: newUserId,
      });
    }

    return jsonResponse(201, {
      userId: newUserId,
      email,
      displayName,
      role,
      message: "Staff account created successfully.",
    });
  } catch (error) {
    console.error(
      "Unexpected error in admin-invite-staff:",
      error instanceof Error ? error.message : error,
    );
    return jsonResponse(500, {
      error: "An unexpected server error occurred while adding staff. Check the Edge Function logs.",
    });
  }
});
