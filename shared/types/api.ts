/**
 * PixelSwift 统一 API 响应体
 * 所有走 $api 封装的接口统一采用此格式返回
 */
export interface ApiResponse<T = unknown> {
  /** 业务状态码，0 表示成功，非 0 表示业务错误 */
  code: number;
  /** 成功时携带的业务数据 */
  data?: T;
  /** 失败时的错误提示文案 */
  msg?: string;
}

/**
 * 业务错误码约定（与 HTTP 状态码解耦）
 *
 * 设计原则：HTTP 层只反映"传输是否成功"，业务层通过 code 字段反映"逻辑结果"。
 * 这样即便同一个接口需要同时返回"已登录"和"未登录"两种数据，也无需用 401 打断 SSR。
 *
 * 200  - 成功
 * 1001 - 未登录（前端应跳转 /login）
 * 1002 - 权限不足（已登录但无权访问该资源）
 * 1003 - 试用次数已耗尽
 * 5000 - 服务器内部错误
 */
export const ApiCode = {
  OK: 200,
  UNAUTHORIZED: 1001,
  FORBIDDEN: 1002,
  QUOTA_EXHAUSTED: 1003,
  SERVER_ERROR: 5000,
} as const;

export type ApiCodeValue = (typeof ApiCode)[keyof typeof ApiCode];
