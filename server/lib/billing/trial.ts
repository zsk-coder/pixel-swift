// 默认每个新注册用户赠送的免费试用配额次数（用于处理某些 AI 高级功能）
export const DEFAULT_TRIAL_TOTAL = 3;

// Pro 用户每月配额上限
export const PRO_MONTHLY_QUOTA = 100;

// 定义用户的会员计划层级
export type PlanType = "free" | "pro";
// 定义会员的实际订阅活跃状态（例如，可能用户是 "pro" 但因为扣费失败暂时变为 "inactive"）
export type SubscriptionStatus = "inactive" | "active";

// 对应 Supabase 数据库表 `user_entitlements` 的原始行数据结构
export interface UserEntitlementRow {
  user_id: string;
  plan_type: PlanType;
  trial_total: number;
  trial_used: number;
  subscription_status?: SubscriptionStatus;
}

// 定义通过 API 暴露给前端的、经过加工清洗的标准 Payload 结构
// 这样前端就不需要直接关心底层数据库字段的区别，只用访问这几个布尔值就能判断 UI 逻辑
export interface QuotaPayload {
  authAvailable: boolean; // 系统的 Auth Module 是否正常工作中（如环境变量是否配齐）
  authenticated: boolean; // 用户当前是否已登录
  canGenerate: boolean; // 用户当前是否有足够的权限或扣费配额来执行受限的生成/耗时任务
  isLocked: boolean; // 是否处于完全冻结锁定状态
  planType: PlanType;
  subscriptionStatus: SubscriptionStatus;
  trialRemaining: number; // 剩余可用次数
  trialTotal: number;
  trialUsed: number; // 已经用掉的次数
}

/**
 * 构造用于初始化未产生任何记录的新用户的数据对象
 */
export function createDefaultEntitlement(userId: string): UserEntitlementRow {
  return {
    user_id: userId,
    plan_type: "free",
    trial_total: DEFAULT_TRIAL_TOTAL,
    trial_used: 0,
    subscription_status: "inactive",
  };
}

/**
 * 构造“用户未登录”时的配额占位对象
 * 用于 Fail-safe (降级体验)，保证前端不会遇到 Cannot read properties of undefined 报错
 */
export function createUnauthenticatedQuotaPayload(): QuotaPayload {
  return {
    authAvailable: true,
    authenticated: false,
    canGenerate: false, // 未登录当然不能进行高级生成
    isLocked: true,
    planType: "free",
    subscriptionStatus: "inactive",
    trialRemaining: 0,
    trialTotal: 0,
    trialUsed: 0,
  };
}

/**
 * 构造“系统未配置 Supabase / 鉴权系统不可用”时的配额占位对象
 */
export function createAuthUnavailableQuotaPayload(): QuotaPayload {
  return {
    authAvailable: false, // 这个标识允许前端自动隐藏登录按钮，或者显示“后台维护中”
    authenticated: false,
    canGenerate: false,
    isLocked: true,
    planType: "free",
    subscriptionStatus: "inactive",
    trialRemaining: 0,
    trialTotal: 0,
    trialUsed: 0,
  };
}

/**
 * 构造“用户已登录，但配额表里的数据离奇丢失/未生成”时的占位对象
 */
export function createMissingEntitlementQuotaPayload(): QuotaPayload {
  return {
    authAvailable: true,
    authenticated: true, // 身份确实验过了
    canGenerate: false, // 但没查到权益，安全起见仍然锁住生成功能
    isLocked: true,
    planType: "free",
    subscriptionStatus: "inactive",
    trialRemaining: 0,
    trialTotal: 0,
    trialUsed: 0,
  };
}

/**
 * 核心转换逻辑：将后端从数据库查到的脏数据，格式化成标准返回给前端的 Payload
 * 自动计算各种延伸的布尔状态，减少前端判断的心智负担
 *
 * @param entitlement 传入从数据库查询到的某一行局部字段
 * @returns 最终交给网络协议传输的标准 QuotaPayload 对象
 */
export function toQuotaPayload(
  entitlement: Pick<
    UserEntitlementRow,
    "plan_type" | "trial_total" | "trial_used"
  > &
    Partial<Pick<UserEntitlementRow, "subscription_status">>,
): QuotaPayload {
  // 防御性数值编程，防止数据库中出现 null 或者负数
  const trialTotal = Math.max(
    0,
    entitlement.trial_total ?? DEFAULT_TRIAL_TOTAL,
  );
  const trialUsed = Math.max(0, entitlement.trial_used ?? 0);
  const trialRemaining = Math.max(0, trialTotal - trialUsed);
  const planType = entitlement.plan_type;
  const subscriptionStatus = entitlement.subscription_status ?? "inactive";

  // 核心鉴权逻辑：
  // Pro 用户（订阅激活）：检查月度配额剩余（trial_total=100, trial_used 逐次递增）
  // Free 用户：检查免费试用次数
  const isPro = planType === "pro" && subscriptionStatus === "active";
  const canGenerate = isPro ? trialRemaining > 0 : trialRemaining > 0;

  return {
    authAvailable: true,
    authenticated: true,
    canGenerate,
    isLocked: !canGenerate, // isLocked 只是 canGenerate 方便前端处理 UI 置灰的一个取反别名
    planType,
    subscriptionStatus,
    trialRemaining,
    trialTotal,
    trialUsed,
  };
}
