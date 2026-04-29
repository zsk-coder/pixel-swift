import type { H3Event } from "h3";

// ────────────────────────────────────────────────────────
// 基于内存的固定窗口限流器（Per-User Rate Limiter）
//
// 对 AI 规划等高价值 API 做 per-user 频率控制：
// - 短窗口：3 次 / 分钟（防突发并发刷）
// - 长窗口：10 次 / 小时（防持续消耗）
//
// 生产环境可替换为 Redis（Upstash）实现持久化 + 分布式一致性
// ────────────────────────────────────────────────────────

interface RateBucket {
  count: number;
  resetAt: number; // Unix ms
}

// userId → windowKey → bucket
const store = new Map<string, Map<string, RateBucket>>();

// 触发惰性清理的时间戳（避免每次请求都遍历，降低开销）
let lastCleanupTime = Date.now();
const CLEANUP_INTERVAL = 5 * 60 * 1000;

function lazyCleanup(now: number) {
  if (now - lastCleanupTime < CLEANUP_INTERVAL) return;
  lastCleanupTime = now;
  for (const [userId, buckets] of store) {
    for (const [key, bucket] of buckets) {
      if (now > bucket.resetAt) buckets.delete(key);
    }
    if (buckets.size === 0) store.delete(userId);
  }
}

interface RateWindow {
  /** 窗口标识，如 "minute" / "hour" */
  name: string;
  /** 窗口时长（毫秒） */
  windowMs: number;
  /** 窗口内允许的最大请求数 */
  maxRequests: number;
}

interface RateLimitResult {
  allowed: boolean;
  /** 超限时，需等待多少毫秒才能重试 */
  retryAfterMs?: number;
  /** 超限的窗口名称 */
  exceededWindow?: string;
}

/**
 * 检查用户是否在所有窗口内的限额之内
 *
 * @param userId 用户 ID
 * @param windows 限流窗口配置数组
 * @returns RateLimitResult
 */
export function checkRateLimit(
  userId: string,
  windows: RateWindow[],
): RateLimitResult {
  const now = Date.now();
  lazyCleanup(now);

  if (!store.has(userId)) {
    store.set(userId, new Map());
  }
  const userBuckets = store.get(userId)!;

  // 先检查所有窗口是否有超限的
  for (const win of windows) {
    const bucket = userBuckets.get(win.name);
    if (bucket && now < bucket.resetAt && bucket.count >= win.maxRequests) {
      return {
        allowed: false,
        retryAfterMs: bucket.resetAt - now,
        exceededWindow: win.name,
      };
    }
  }

  // 全部通过 → 递增每个窗口的计数
  for (const win of windows) {
    const bucket = userBuckets.get(win.name);
    if (!bucket || now >= bucket.resetAt) {
      // 桶不存在或已过期，创建新桶
      userBuckets.set(win.name, {
        count: 1,
        resetAt: now + win.windowMs,
      });
    } else {
      bucket.count++;
    }
  }

  return { allowed: true };
}

/**
 * AI 规划接口专用的限流配置
 * - 短窗口：3 次 / 分钟
 * - 长窗口：10 次 / 小时
 */
export const AI_PLAN_RATE_WINDOWS: RateWindow[] = [
  { name: "minute", windowMs: 60 * 1000, maxRequests: 3 },
  { name: "hour", windowMs: 60 * 60 * 1000, maxRequests: 10 },
];

/**
 * H3 快捷方法：直接在 handler 中调用，超限时返回 429
 * 返回 true 表示已超限（handler 应 return），false 表示放行
 */
export function enforceRateLimit(
  event: H3Event,
  userId: string,
  windows: RateWindow[] = AI_PLAN_RATE_WINDOWS,
): boolean {
  const result = checkRateLimit(userId, windows);
  if (!result.allowed) {
    setResponseStatus(event, 429);
    setResponseHeader(
      event,
      "Retry-After",
      `${Math.ceil((result.retryAfterMs || 60000) / 1000)}`,
    );
    return true;
  }
  return false;
}
