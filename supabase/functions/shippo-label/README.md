# shippo-label — Edge Function

Secure proxy between the PWA and the Shippo API. The Shippo token lives here as a
secret, never in the client. Requires a valid Supabase login **and** an
`app_metadata.role` of `dba` or `admin` before it will buy a label.

## One-time setup

1. **Create a Shippo account** and get an API token from the Shippo dashboard
   (API → Tokens). **Start with the TEST token** (`shippo_test_…`) — test labels
   don't charge money. Switch to the live token only once the flow works.

2. **Install & link the Supabase CLI** (if not already):
   ```bash
   brew install supabase/tap/supabase
   supabase login
   supabase link --project-ref euulsabzjzrdrhmgzxfu
   ```

3. **Set the token secret** (never commit it):
   ```bash
   supabase secrets set SHIPPO_TOKEN=shippo_test_xxxxxxxx
   ```

4. **Deploy:**
   ```bash
   supabase functions deploy shippo-label
   ```

The function is then live at:
`https://euulsabzjzrdrhmgzxfu.supabase.co/functions/v1/shippo-label`

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are injected automatically — you only set
`SHIPPO_TOKEN`.

## Switching to live (spends real money)

```bash
supabase secrets set SHIPPO_TOKEN=shippo_live_xxxxxxxx
supabase functions deploy shippo-label   # redeploy not required for secret change, but harmless
```

## Request shape

```jsonc
// Get rates (read-only)
{ "action": "rates",
  "from":   { "name":"Tangy Nature", "street1":"...", "city":"...", "state":"MA", "zip":"...", "country":"US" },
  "to":     { "name":"Buyer", "street1":"...", "city":"...", "state":"...", "zip":"...", "country":"US" },
  "parcel": { "length":10, "width":8, "height":6, "distance_unit":"in", "weight":3, "mass_unit":"lb" } }

// Buy the chosen rate (charges the account)
{ "action": "buy", "rate_id": "<object_id from a rate>", "label_file_type": "PDF_4x6" }
```
