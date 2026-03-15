alter table public.access_tokens
    add column if not exists max_interviews integer not null default 3,
    add column if not exists interviews_used integer not null default 0,
    add column if not exists sold_price_inr integer,
    add column if not exists sold_to text;

alter table public.access_tokens
    add constraint access_tokens_max_interviews_check
    check (max_interviews > 0);

alter table public.access_tokens
    add constraint access_tokens_interviews_used_check
    check (interviews_used >= 0 and interviews_used <= max_interviews);

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
    metadata jsonb,
    max_interviews integer,
    interviews_used integer
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
        s.metadata,
        t.max_interviews,
        t.interviews_used
    from public.access_tokens t
    join public.provider_secrets s on s.token_id = t.id
    where t.token_hash = encode(digest(convert_to(access_token, 'UTF8'), 'sha256'), 'hex')
      and t.is_active = true
      and (t.expires_at is null or t.expires_at > now())
      and t.interviews_used < t.max_interviews
    limit 1;
$$;

create or replace function public.consume_interview_credit(access_token text)
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
    metadata jsonb,
    max_interviews integer,
    interviews_used integer
)
language sql
security definer
set search_path = public
as $$
    with matched as (
        select t.id
        from public.access_tokens t
        where t.token_hash = encode(digest(convert_to(access_token, 'UTF8'), 'sha256'), 'hex')
          and t.is_active = true
          and (t.expires_at is null or t.expires_at > now())
          and t.interviews_used < t.max_interviews
        limit 1
        for update
    ), consumed as (
        update public.access_tokens t
        set interviews_used = t.interviews_used + 1,
            updated_at = now()
        from matched m
        where t.id = m.id
        returning t.*
    )
    select
        c.id as token_id,
        s.provider_mode,
        s.gemini_api_key,
        s.groq_api_key,
        s.azure_api_key,
        s.azure_endpoint,
        s.azure_deployment,
        s.cloud_token,
        c.expires_at,
        s.metadata,
        c.max_interviews,
        c.interviews_used
    from consumed c
    join public.provider_secrets s on s.token_id = c.id;
$$;

revoke all on function public.consume_interview_credit(text) from public;
grant execute on function public.consume_interview_credit(text) to service_role;
