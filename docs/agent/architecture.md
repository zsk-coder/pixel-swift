# PixelSwift 架构地图

## 技术栈
- `Nuxt 4` + `Vue 3` + `TypeScript`
- `TailwindCSS` + `SCSS`
- `Element Plus`
- `@nuxtjs/i18n`
- `@nuxtjs/supabase`
- `@nuxt/content`

## 目录与职责
- `app/pages/`：页面入口，当前包括工具页、博客页、登录页、认证回调页
- `app/components/`：可复用组件，公共头部/页脚、上传组件、账号菜单等
- `app/composables/`：页面逻辑与状态封装，如图片处理、认证、试用额度
- `app/utils/`：纯函数与轻量工具
- `server/api/`：Nitro API，如 `workflow-copilot/quota`
- `server/lib/`：服务端业务逻辑，如 `billing/trial.ts`
- `shared/`：前后端共享工具，如 Supabase 配置判断
- `locales/`：8 语言文案文件
- `assets/scss/`：全局 SCSS、Element Plus 覆盖、混入与变量

## 当前前端架构习惯
- 页面负责组装，复杂逻辑优先下沉到 composable。
- 公共头部、账号状态、上传等跨页能力优先复用组件，不重复在页面内实现。
- 与认证、额度、配置探测相关的逻辑优先放在 composable 和 `shared/`，不要散落到多个页面。

## 当前样式分层
1. `tailwind.config.ts` 中的 design token：`primary`、`brand`、`surface`、`text` 等
2. `assets/scss/main.scss` 中的全局类：如 `.btn-primary`、`.card`、`.content-wrapper`
3. `assets/scss/element-overrides.scss` 中的 Element Plus 主题覆盖
4. 页面/组件内 `scoped` 样式，仅用于无法通过前 3 层表达的局部差异

## 与 Agent 直接相关的结论
- 修改功能前，先定位它属于哪个层：页面、组件、composable、server API、shared。
- 新功能应尽量沿现有层次扩展，而不是把状态、请求和视图逻辑堆在一个文件里。
- 看到用户可见文案、登录、试用额度、主题色、Element Plus 组件时，应自动联想到对应规范文档。
