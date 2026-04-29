import type { ApiResponse } from "~~/shared/types/api";
import { ApiCode } from "~~/shared/types/api";

/**
 * 构造成功响应体
 * @example return ok(userProfile)
 */
export function ok<T>(data: T, msg: string = "success"): ApiResponse<T> {
  return { code: ApiCode.OK, data, msg };
}

/**
 * 构造业务失败响应体（HTTP 仍返回 200，由前端根据 code 字段判断）
 * @example return fail(ApiCode.UNAUTHORIZED, "请先登录")
 */
export function fail<T = null>(
  code: number,
  msg: string,
  data: T | null = null,
): ApiResponse<T | null> {
  return { code, msg, data };
}
