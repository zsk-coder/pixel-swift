-- =================================================================================
-- 1. 创建核心功能表：user_entitlements（用户权益/额度表）
-- =================================================================================
create table if not exists public.user_entitlements (
  -- 绑定 Supabase 自带的 auth.users 表，当用户删除账号时，连带删除这里的权益记录（on delete cascade）
  user_id uuid primary key references auth.users (id) on delete cascade,

  -- 账号类型：默认为 'free'（免费版），未来还可以升级为 'pro'（专业版）
  plan_type text not null default 'free' check (plan_type in ('free', 'pro')),

  -- 免费试用总次数：默认送 3 次，且必须是正数
  trial_total integer not null default 3 check (trial_total >= 0),

  -- 已经消耗的试用次数：默认为 0 次
  trial_used integer not null default 0 check (trial_used >= 0),

  -- 订阅状态：用来拦截没有付费的用户，默认 'inactive'（未激活）
  subscription_status text not null default 'inactive' check (subscription_status in ('inactive', 'active')),

  -- 系统字段：记录这条权益创建的时间和最后更新的时间
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

-- =================================================================================
-- 2. 创建自动更新时间的函数和触发器（Trigger）
-- 作用：每次后端代码修改用户额度时，自动把 updated_at 更新为当前时间
-- =================================================================================
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

-- =================================================================================
-- 3. 开启行级安全策略（RLS: Row Level Security）
-- 作用：防止黑客通过前端 API 直接篡改自己的额度，比如把 trial_used 改回 0
-- =================================================================================
alter table public.user_entitlements enable row level security;

-- 删除可能存在的旧策略
drop policy if exists "Users can read their own entitlements" on public.user_entitlements;

-- 创建新策略：只允许登录用户（authenticated）"查看"（select）自己的额度记录，不允许修改！
-- 注意：我们的后端接口使用 service_role key，它不受此安全策略限制，可以任意修改。
create policy "Users can read their own entitlements"
on public.user_entitlements
for select
to authenticated
using (auth.uid() = user_id);

