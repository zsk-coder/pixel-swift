# Troubleshooting: Nuxt Content SSR & Cloudflare D1 死锁问题

本文档记录了 `@nuxt/content` v3 部署到 Cloudflare Pages 并在 SSR 期间出现“页面空白”和“无限转圈（挂起）”的深层原因及解决办法。如果未来在此类技术栈中遇到类似现象，请优先参考此文档。

## 现象描述

### 现象 1：`queryCollection` 在 SSR 时返回 `null`（导致搜索引擎收录掉落）
- **现象**：在页面组件中调用 `queryCollection('blog').first()` 时，本地开发有数据，但线上部署后，刷新页面时拿到的结果是 `null`。这导致 SSR 吐出的 HTML 中 `<article>` 区域为空，网页被判定为“薄内容”，从索引库中大规模剔除。但由于 Vue 的 Hydration 机制，页面加载后会在客户端重新拉取数据，所以用户肉眼看一切正常。
- **深层原因**：没有在 `wrangler.toml` 中绑定 D1。在没有 D1 时，Nuxt Content 默认尝试运行基于 `SQLite WASM` 的内存引擎。但在 Cloudflare Pages Worker 环境中，原生的 WASM 模块按需加载存在兼容性限制，导致 SSR 调用内部的 `/__nuxt_content/blog/query` 接口时直接抛出 `500 Server Error`。由于 Nuxt 的 `useAsyncData` 机制，这个 500 错误在服务端被静默拦截（吞掉了），数据对象直接被赋值为 `null`。

### 现象 2：部署 D1 后，SSR 页面无限转圈（挂起超时）
- **现象**：按要求在 `wrangler.toml` 中配置了 `[[d1_databases]]` 后，新部署上线，第一次访问博客页面时请求无限转圈（Pending），直到超时失败。
- **原因**：这是 Cloudflare Worker 的 CPU 限制与 Nuxt Content “自动初始化机制”碰撞产生的**分布式死锁**。

## 死锁的底层原理

Nuxt Content V3 的 `_checkAndImportDatabaseIntegrity` 机制在检测到 D1 数据库为空（首次绑定）或哈希校验不符时，会做以下操作：

1. **加锁**：执行 `INSERT INTO _content_info VALUES ('checksum_blog', false, ...)`，将 `ready` 设为 `0`（未就绪）。
2. **大批量插入**：遍历本地打包生成的巨大 SQL Dump 文件，使用 `db.exec()` 逐条导入内容（几十甚至上百篇文章）。
3. **超时强杀**：Cloudflare Pages 对每个请求有几十毫秒（50ms）的严格 CPU 耗时上限。在循环插入中途，程序执行时间严重超标，Cloudflare Watchdog **强制杀死了 Worker 进程**。
4. **解锁失败**：最后一句解锁的 SQL（`UPDATE _content_info SET ready = true`）永远没有机会执行，导致数据库里永远留着 `ready: 0` 的记录。
5. **死锁循环**：之后的所有请求在查询内容前，发现 `ready` 是 0，便进入一个 `setInterval` 每秒轮询一次、最多干等 90 秒的阶段。用户端表现为永远在转圈。

## 解决方案

一旦发生此问题（数据库卡死在 `ready: 0`），需在云端强行“拔掉”锁。
增量更新时（发新文章）由于比较了哈希，只会更新发生变化的少量数据，耗时极短，**绝不会再引发死锁**。此坑仅发生在**首次全量导入**。

### 手动解除死锁指令
打开本地终端，确保已经登录 Cloudflare 账号，然后执行以下命令连接远程 D1 并解锁：

```bash
# 确认当前数据库状态（应能看到 ready 字段为 0）
npx wrangler d1 execute pixelswift-content --remote --command="SELECT * FROM _content_info;"

# 强制解锁（把 ready 改为 1）
npx wrangler d1 execute pixelswift-content --remote --command="UPDATE _content_info SET ready=1;"
```
*(注：`pixelswift-content` 是 `wrangler.toml` 中配的 `database_name`)*

执行完毕后，重新刷新前端页面（必要时先重新部署），SSR 即可恢复，瞬间渲染完整 HTML，彻底解决由于内容空洞导致的 SEO 掉收录问题。
