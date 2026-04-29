import { serverSupabaseUser } from "#supabase/server";
import { isSupabaseServiceEnabled } from "~~/shared/utils/supabaseAuth";

/**
 * 需要强制登录的路由前缀列表
 *
 * 当前仅预留，实际 AI / 写操作接口上线时在此追加。
 * 注意：/api/workflow-copilot/quota 和 /api/workflow-copilot/plan 均使用
 *       fail-safe 设计（未登录返回 200 + 业务 payload），不在此列表中。
 */
const PROTECTED_PREFIXES: string[] = ["/api/ai/", "/api/user/"];

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname;

  // 不在受保护的路由范围内，直接放行
  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    path.startsWith(prefix),
  );
  if (!isProtected) return;

  const runtimeConfig = useRuntimeConfig(event);

  // Auth 服务未配置（本地开发或 CI 环境）时放行，避免因环境变量缺失而阻断所有请求
  if (!isSupabaseServiceEnabled(runtimeConfig)) return;

  try {
    const user = await serverSupabaseUser(event);
    if (!user) {
      throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
    }
    // 将解析出的用户信息挂载到请求上下文，后续各 handler 可直接通过 event.context.user 取用
    event.context.user = user;
  } catch (error: any) {
    // 保留已知的 HTTP 错误（如上方手动 throw 的 401），只对未知错误做降级处理
    if (error?.statusCode) throw error;
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }
});
