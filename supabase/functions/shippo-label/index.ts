// Supabase Edge Function: shippo-label
// Secure proxy to the Shippo API. Holds SHIPPO_TOKEN as a secret so it never
// touches the public PWA. Verifies the caller's Supabase session and requires
// an owner/admin role before allowing a (money-spending) label purchase.
//
// Deploy:   supabase functions deploy shippo-label
// Secret:   supabase secrets set SHIPPO_TOKEN=shippo_test_xxx   (use a TEST token first)
//
// Actions (POST JSON body):
//   { action: "rates", from, to, parcel }        -> { shipment_id, rates[] }   (read-only)
//   { action: "buy",   rate_id, label_file_type } -> { label_url, tracking_number, ... } (charges!)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SHIPPO_BASE = "https://api.goshippo.com";
const SHIPPO_TOKEN = Deno.env.get("SHIPPO_TOKEN") ?? "";

function corsHeaders(req: Request): HeadersInit {
  // The Supabase JWT + role check below is the real gate, so reflecting the
  // caller's origin is safe and avoids hard-coding the Pages domain.
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

const SIGNATURE_VALUES = new Set([
  "STANDARD", "ADULT", "CERTIFIED", "INDIRECT", "CARRIER_CONFIRMATION",
]);
const INSURANCE_PROVIDERS = new Set(["FEDEX", "UPS", "ONTRAC"]);

// Whitelist the shipment "extra" object so the client can only request the
// specific add-ons we support (insurance, signature confirmation) — not
// arbitrary Shippo shipment options.
function sanitizeExtra(extra: any): Record<string, unknown> | undefined {
  if (!extra || typeof extra !== "object") return undefined;
  const out: Record<string, unknown> = {};

  if (typeof extra.signature_confirmation === "string" && SIGNATURE_VALUES.has(extra.signature_confirmation)) {
    out.signature_confirmation = extra.signature_confirmation;
  }

  const ins = extra.insurance;
  if (ins && typeof ins === "object" && ins.amount && Number(ins.amount) > 0) {
    const insurance: Record<string, unknown> = {
      amount: String(ins.amount),
      currency: typeof ins.currency === "string" ? ins.currency : "USD",
      content: typeof ins.content === "string" && ins.content.trim() ? ins.content.trim() : "Camera gear",
    };
    if (typeof ins.provider === "string" && INSURANCE_PROVIDERS.has(ins.provider)) {
      insurance.provider = ins.provider;
    }
    out.insurance = insurance;
  }

  return Object.keys(out).length ? out : undefined;
}

async function shippo(path: string, payload: unknown): Promise<any> {
  const res = await fetch(SHIPPO_BASE + path, {
    method: "POST",
    headers: {
      "Authorization": `ShippoToken ${SHIPPO_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.detail || JSON.stringify(data) || `Shippo ${res.status}`);
  }
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  if (!SHIPPO_TOKEN) return json(req, { error: "SHIPPO_TOKEN not configured" }, 500);

  // ── Verify the caller's Supabase session and role ──────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json(req, { error: "Missing bearer token" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return json(req, { error: "Invalid or expired session" }, 401);

  // Buying labels spends money — restrict to owner/admin. app_metadata is the
  // only trustworthy source now (user_metadata is self-editable by the user).
  const role = (user.app_metadata as any)?.role || "user";
  if (role !== "dba" && role !== "admin") {
    return json(req, { error: "Your role is not permitted to buy shipping labels" }, 403);
  }

  // ── Handle the action ──────────────────────────────────────────────────────
  let body: any;
  try { body = await req.json(); } catch { return json(req, { error: "Invalid JSON body" }, 400); }

  try {
    if (body.action === "rates") {
      if (!body.from || !body.to || !body.parcel) {
        return json(req, { error: "from, to and parcel are required" }, 400);
      }
      const shipment = await shippo("/shipments/", {
        address_from: body.from,
        address_to: body.to,
        parcels: [body.parcel],
        extra: sanitizeExtra(body.extra),
        async: false,
      });
      const rates = (shipment.rates ?? []).map((r: any) => ({
        object_id: r.object_id,
        amount: r.amount,
        currency: r.currency,
        provider: r.provider,
        servicelevel: r.servicelevel?.name ?? r.servicelevel?.token ?? "",
        estimated_days: r.estimated_days ?? null,
      }));
      // Cheapest first
      rates.sort((a: any, b: any) => parseFloat(a.amount) - parseFloat(b.amount));
      return json(req, { shipment_id: shipment.object_id, rates });
    }

    if (body.action === "buy") {
      if (!body.rate_id) return json(req, { error: "rate_id is required" }, 400);
      const tx = await shippo("/transactions/", {
        rate: body.rate_id,
        label_file_type: body.label_file_type || "PDF_4x6",
        async: false,
      });
      if (tx.status !== "SUCCESS") {
        return json(req, { error: "Label purchase failed", detail: tx.messages ?? tx }, 400);
      }
      return json(req, {
        status: tx.status,
        label_url: tx.label_url,
        tracking_number: tx.tracking_number,
        tracking_url: tx.tracking_url_provider,
        amount: tx.rate?.amount ?? null,
        currency: tx.rate?.currency ?? null,
      });
    }

    return json(req, { error: "Unknown action (expected 'rates' or 'buy')" }, 400);
  } catch (e) {
    return json(req, { error: String((e as Error).message || e) }, 502);
  }
});
