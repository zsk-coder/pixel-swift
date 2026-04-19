create table if not exists public.user_entitlements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan_type text not null default 'free' check (plan_type in ('free', 'pro')),
  trial_total integer not null default 3 check (trial_total >= 0),
  trial_used integer not null default 0 check (trial_used >= 0),
  subscription_status text not null default 'inactive' check (subscription_status in ('inactive', 'active')),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create or replace function public.set_user_entitlements_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists set_user_entitlements_updated_at on public.user_entitlements;

create trigger set_user_entitlements_updated_at
before update on public.user_entitlements
for each row
execute procedure public.set_user_entitlements_updated_at();

alter table public.user_entitlements enable row level security;

drop policy if exists "Users can read their own entitlements" on public.user_entitlements;

create policy "Users can read their own entitlements"
on public.user_entitlements
for select
to authenticated
using (auth.uid() = user_id);
