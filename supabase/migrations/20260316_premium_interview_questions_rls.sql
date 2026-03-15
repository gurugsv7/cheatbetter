create table if not exists public.premium_interview_questions (
    id uuid primary key default gen_random_uuid(),
    slug text not null unique,
    title text not null,
    content jsonb not null default '{}'::jsonb,
    difficulty text check (difficulty in ('easy', 'medium', 'hard')),
    company text,
    tags text[] not null default '{}'::text[],
    is_published boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists premium_interview_questions_published_idx
on public.premium_interview_questions(is_published);

create index if not exists premium_interview_questions_difficulty_idx
on public.premium_interview_questions(difficulty);

drop trigger if exists trg_premium_interview_questions_updated_at on public.premium_interview_questions;
create trigger trg_premium_interview_questions_updated_at
before update on public.premium_interview_questions
for each row
execute function public.touch_updated_at();

alter table public.premium_interview_questions enable row level security;
alter table public.premium_interview_questions force row level security;

revoke all on table public.premium_interview_questions from public, anon, authenticated;
grant select on table public.premium_interview_questions to authenticated;
grant select, insert, update, delete on table public.premium_interview_questions to service_role;

drop policy if exists premium_questions_paid_users_select on public.premium_interview_questions;
create policy premium_questions_paid_users_select
on public.premium_interview_questions
for select
to authenticated
using (
    is_published = true
    and public.user_has_active_subscription(auth.uid())
);

drop policy if exists premium_questions_service_role_all on public.premium_interview_questions;
create policy premium_questions_service_role_all
on public.premium_interview_questions
for all
to service_role
using (true)
with check (true);

comment on table public.premium_interview_questions is 'Premium question bank; read access restricted to active/trial subscribers via RLS.';