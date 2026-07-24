// Supabase Edge Function: manage-users
// Lets a 'dba' account list every user and change roles (app_metadata.role).
// The browser has no way to write app_metadata directly (by design — that's
// what makes roles tamper-proof), so this function does it server-side with
// the service_role key. Restricted to 'dba' only: role management is the
// highest-privilege action in the app (it can grant someone else write/delete
// access or dba itself), so it gets the same treatment as shippo-label
// spending money — verify the session, then check the role, every request.
//
// Deploy:   supabase functions deploy manage-users
// (No extra secret needed — SUPABASE_URL / SUPABASE_ANON_KEY /
//  SUPABASE_SERVICE_ROLE_KEY are all injected automatically by Supabase.)
//
// Actions (POST JSON body):
//   { action: "list" }
//     -> { users: [{ id, email, role, created_at, last_sign_in_at }, ...] }
//   { action: "setRole", user_id, role }
//     -> { ok: true, user: { id, email, role } }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VALID_ROLES = new Set(["dba", "admin", "user", "viewer"]);

function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("Origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // ── Verify the caller's session and role (their own token, anon-key client) ─
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json(req, { error: "Missing bearer token" }, 401);

  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user: caller }, error: authErr } = await callerClient.auth.getUser();
  if (authErr || !caller) return json(req, { error: "Invalid or expired session" }, 401);

  const callerRole = (caller.app_metadata as any)?.role || "user";
  if (callerRole !== "dba") {
    return json(req, { error: "Only a dba account can manage user roles" }, 403);
  }

  // ── Admin client (service_role) for the actual privileged operations ───────
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  let body: any;
  try { body = await req.json(); } catch { return json(req, { error: "Invalid JSON body" }, 400); }

  try {
    if (body.action === "list") {
      const users: any[] = [];
      for (let page = 1; page <= 10; page++) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
        if (error) return json(req, { error: error.message }, 502);
        users.push(...data.users);
        if (data.users.length < 100) break;
      }
      return json(req, {
        users: users
          .map(u => ({
            id: u.id,
            email: u.email,
            role: (u.app_metadata as any)?.role || "user",
            created_at: u.created_at,
            last_sign_in_at: u.last_sign_in_at,
          }))
          .sort((a, b) => (a.email || "").localeCompare(b.email || "")),
      });
    }

    if (body.action === "setRole") {
      const targetId = body.user_id;
      const newRole = body.role;
      if (!targetId || typeof targetId !== "string") return json(req, { error: "user_id is required" }, 400);
      if (!VALID_ROLES.has(newRole)) {
        return json(req, { error: `role must be one of: ${[...VALID_ROLES].join(", ")}` }, 400);
      }
      // Merge into existing app_metadata rather than assuming the admin API
      // replaces it wholesale — fetch first, merge, then write back.
      const { data: existing, error: getErr } = await admin.auth.admin.getUserById(targetId);
      if (getErr || !existing.user) return json(req, { error: getErr?.message || "User not found" }, 404);

      const mergedAppMeta = { ...(existing.user.app_metadata || {}), role: newRole };
      const { data: updated, error: updateErr } = await admin.auth.admin.updateUserById(targetId, {
        app_metadata: mergedAppMeta,
      });
      if (updateErr || !updated.user) return json(req, { error: updateErr?.message || "Update failed" }, 502);

      return json(req, {
        ok: true,
        user: { id: updated.user.id, email: updated.user.email, role: (updated.user.app_metadata as any)?.role },
      });
    }

    return json(req, { error: "Unknown action (expected 'list' or 'setRole')" }, 400);
  } catch (e) {
    return json(req, { error: String((e as Error).message || e) }, 502);
  }
});
