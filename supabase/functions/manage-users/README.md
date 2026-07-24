# manage-users — Edge Function

Lets a `dba` account list every user and change roles (`app_metadata.role`).
The browser has no way to write `app_metadata` directly — that's what makes
roles tamper-proof — so this runs server-side with the `service_role` key.
Restricted to `dba` only: role management is the highest-privilege action in
the app (it can grant someone else write/delete access or `dba` itself).

## Deploy

No extra secret to set — `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` are all injected automatically by Supabase.

```bash
supabase functions deploy manage-users
```

The function is then live at:
`https://euulsabzjzrdrhmgzxfu.supabase.co/functions/v1/manage-users`

## Request shape

```jsonc
// List every user (dba only)
{ "action": "list" }
// -> { "users": [{ "id", "email", "role", "created_at", "last_sign_in_at" }, ...] }

// Change one user's role (dba only)
{ "action": "setRole", "user_id": "<uuid>", "role": "admin" }
// role must be one of: dba, admin, user, viewer
// -> { "ok": true, "user": { "id", "email", "role" } }
```
