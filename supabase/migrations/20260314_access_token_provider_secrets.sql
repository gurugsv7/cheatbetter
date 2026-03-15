create extension if not exists pgcrypto;

create table if not exists public.access_tokens (
    id uuid primary key default gen_random_uuid(),
    token_hash text not null unique,
    label text,
    is_active boolean not null default true,
    expires_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.provider_secrets (
    token_id uuid primary key references public.access_tokens(id) on delete cascade,
    provider_mode text not null default 'byok',
    gemini_api_key text,
    groq_api_key text,
    azure_api_key text,
    azure_endpoint text,
    azure_deployment text,
    cloud_token text,
    metadata jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_access_tokens_updated_at on public.access_tokens;
create trigger trg_access_tokens_updated_at
before update on public.access_tokens
for each row
execute function public.touch_updated_at();

drop trigger if exists trg_provider_secrets_updated_at on public.provider_secrets;
create trigger trg_provider_secrets_updated_at
before update on public.provider_secrets
for each row
execute function public.touch_updated_at();

alter table public.access_tokens enable row level security;
alter table public.provider_secrets enable row level security;

create or replace function public.resolve_provider_secrets(access_token text)
returns table (
    token_id uuid,
    provider_mode text,
    gemini_api_key text,
    groq_api_key text,
    azure_api_key text,
    azure_endpoint text,
    azure_deployment text,
    cloud_token text,
    expires_at timestamptz,
    metadata jsonb
)
language sql
security definer
set search_path = public
as $$
    select
        t.id as token_id,
        s.provider_mode,
        s.gemini_api_key,
        s.groq_api_key,
        s.azure_api_key,
        s.azure_endpoint,
        s.azure_deployment,
        s.cloud_token,
        t.expires_at,
        s.metadata
    from public.access_tokens t
    join public.provider_secrets s on s.token_id = t.id
        where t.token_hash = encode(extensions.digest(access_token::bytea, 'sha256'), 'hex')
      and t.is_active = true
      and (t.expires_at is null or t.expires_at > now())
    limit 1;
$$;

revoke all on function public.resolve_provider_secrets(text) from public;
grant execute on function public.resolve_provider_secrets(text) to service_role;

create or replace function public.cleanup_expired_access_tokens()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    deleted_count integer;
begin
    delete from public.access_tokens
    where expires_at is not null
      and expires_at < now();

    get diagnostics deleted_count = row_count;
    return deleted_count;
end;
$$;

-- Optional cron registration (works when pg_cron is available).
do $$
begin
    if exists (select 1 from pg_extension where extname = 'pg_cron') then
        if not exists (
            select 1
            from cron.job
            where jobname = 'cleanup-expired-access-tokens'
        ) then
            perform cron.schedule(
                'cleanup-expired-access-tokens',
                '0 */6 * * *',
                'select public.cleanup_expired_access_tokens();'
            );
        end if;
    end if;
exception when others then
    null;
end;
$$;

comment on function public.resolve_provider_secrets(text)
is 'Resolves provider secrets from an access token hash. Intended for Edge Functions using service_role.';
