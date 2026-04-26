-- =================================================================================
-- 扩展 user_entitlements 表：添加 LemonSqueezy 订阅字段
-- =================================================================================
ALTER TABLE public.user_entitlements
  ADD COLUMN IF NOT EXISTS ls_customer_id text,
  ADD COLUMN IF NOT EXISTS ls_subscription_id text,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz;
