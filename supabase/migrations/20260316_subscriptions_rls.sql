create table if not exists public.subscriptions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    status text not null check (status in ('active', 'expired', 'trial', 'canceled', 'past_due')),
    plan text not null default 'free',
    starts_at timestamptz not null default now(),
    expires_at timestamptz,
    canceled_at timestamptz,
    provider text not null default 'manual',
    provider_subscription_id text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint subscriptions_expires_after_start check (expires_at is null or expires_at > starts_at)
);

create unique index if not exists subscriptions_provider_subscription_id_key
on public.subscriptions(provider, provider_subscription_id)
where provider_subscription_id is not null;

create index if not exists subscriptions_user_id_idx
on public.subscriptions(user_id);

create index if not exists subscriptions_status_expires_idx
on public.subscriptions(status, expires_at);

drop trigger if exists trg_subscriptions_updated_at on public.subscriptions;
create trigger trg_subscriptions_updated_at
before update on public.subscriptions
for each row
execute function public.touch_updated_at();

alter table public.subscriptions enable row level security;
alter table public.subscriptions force row level security;

revoke all on table public.subscriptions from public, anon, authenticated;
grant select, insert, update, delete on table public.subscriptions to service_role;
grant select on table public.subscriptions to authenticated;

drop policy if exists subscriptions_service_role_all on public.subscriptions;
create policy subscriptions_service_role_all
on public.subscriptions
for all
to service_role
using (true)
with check (true);

drop policy if exists subscriptions_authenticated_select_own on public.subscriptions;
create policy subscriptions_authenticated_select_own
on public.subscriptions
for select
to authenticated
using (auth.uid() = user_id);

create or replace function public.user_has_active_subscription(target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.subscriptions s
        where s.user_id = target_user_id
          and s.status in ('active', 'trial')
          and (s.expires_at is null or s.expires_at > now())
    );
$$;

revoke all on function public.user_has_active_subscription(uuid) from public, anon;
grant execute on function public.user_has_active_subscription(uuid) to authenticated, service_role;

comment on table public.subscriptions is 'Subscription status ledger used for server-side premium access enforcement.';
comment on function public.user_has_active_subscription(uuid)
is 'Returns true when a user currently has active premium access (active/trial and not expired).';

-- Reusable policy pattern for any premium table:
-- create policy "paid users only"
-- on public.<premium_table>
-- for select
-- to authenticated
-- using (public.user_has_active_subscription(auth.uid()));