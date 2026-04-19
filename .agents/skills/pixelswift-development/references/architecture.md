# PixelSwift 架构要点

- 页面入口在 `app/pages/`
- 可复用组件在 `app/components/`
- 主要页面逻辑与状态封装在 `app/composables/`
- 服务端接口在 `server/api/`
- 服务端业务逻辑在 `server/lib/`
- 前后端共享配置/工具在 `shared/`
- 8 语言文案固定在 `locales/`
- 全局样式与 Element 覆盖在 `assets/scss/`

实现前先判断改动属于哪个层，不要把视图、状态和服务端逻辑混写进一个地方。

更完整说明见：`docs/agent/architecture.md`
