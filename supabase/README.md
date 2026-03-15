# Supabase backend setup for access-token auth

This app now expects **access tokens** on the client. Provider keys (Gemini/Groq/Azure) are resolved server-side through a Supabase Edge Function.

## 1) Apply migration

Run `supabase/migrations/20260314_access_token_provider_secrets.sql` on your project.
Run `supabase/migrations/20260314_token_quota_and_consume.sql` on your project.
Run `supabase/migrations/20260315_harden_access_token_security.sql` on your project.

## 2) Deploy edge function

Deploy `supabase/functions/resolve-provider-secrets/index.ts` as function slug:

`resolve-provider-secrets`

## 3) Configure Electron runtime

Set environment variables before running/packaging the app:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_SECRETS_FUNCTION` (optional, defaults to `resolve-provider-secrets`)

## 4) Create access token records

Store **SHA-256 hash** of each token in `public.access_tokens.token_hash`.

Example hash generation (Node.js):

```js
require('crypto').createHash('sha256').update('your-access-token').digest('hex')
```

Insert matching secret row in `public.provider_secrets`.

## Notes

- Clients never submit raw provider keys.
- Token validation + key resolution happen in the edge function using `service_role`.
- Edge function now requires `Authorization: Bearer <SKI-...>` and validates `apikey` header against `SUPABASE_ANON_KEY` when configured.
- Tables and RPC execution are hardened to `service_role` only via RLS policies and grants.
- Optional `pg_cron` job cleans up expired tokens every 6 hours when extension is available.
