-- Strict hardening for access-token auth tables and RPC functions

-- Lock down table privileges so only service_role can access token/secrets data.
revoke all on table public.access_tokens from public, anon, authenticated;
revoke all on table public.provider_secrets from public, anon, authenticated;

grant select, insert, update, delete on table public.access_tokens to service_role;
grant select, insert, update, delete on table public.provider_secrets to service_role;

-- Enforce RLS on both tables and allow only service_role role to operate on rows.
alter table public.access_tokens force row level security;
alter table public.provider_secrets force row level security;

drop policy if exists access_tokens_service_role_all on public.access_tokens;
create policy access_tokens_service_role_all
on public.access_tokens
for all
to service_role
using (true)
with check (true);

drop policy if exists provider_secrets_service_role_all on public.provider_secrets;
create policy provider_secrets_service_role_all
on public.provider_secrets
for all
to service_role
using (true)
with check (true);

-- Ensure RPC functions are callable only by service_role.
revoke all on function public.resolve_provider_secrets(text) from public, anon, authenticated;
revoke all on function public.consume_interview_credit(text) from public, anon, authenticated;

grant execute on function public.resolve_provider_secrets(text) to service_role;
grant execute on function public.consume_interview_credit(text) to service_role;

comment on table public.access_tokens is 'Sensitive token metadata. Access restricted to service_role only.';
comment on table public.provider_secrets is 'Sensitive provider keys. Access restricted to service_role only.';
