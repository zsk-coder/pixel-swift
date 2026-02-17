---
description: PixelSwift 项目上下文 — 技术栈、架构和核心原则
globs: "**/*"
alwaysApply: true
---

# PixelSwift 项目上下文

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Nuxt 3 + Vue 3 |
| 语言 | TypeScript（Strict Mode） |
| 样式 | TailwindCSS + SCSS（全局变量 / Mixin 已通过 Vite 注入） |
| UI 库 | Element Plus（`@element-plus/nuxt` 自动导入组件） |
| 国际化 | `@nuxtjs/i18n`（zh / en / ja / ko / fr / es / pt / de） |
| 暗色模式 | `@nuxtjs/color-mode`（`.dark:` 前缀） |
| SEO | `nuxt-schema-org`（FAQ Schema 等结构化数据） |
| 构建 | Vite（Nuxt 内置） |

## 项目目录

```
app/
├── components/common/   # 可复用组件（PascalCase）
├── composables/         # 组合式逻辑（useXxx.ts）
│   ├── useImageProcessor.ts  # 核心图片处理（Canvas/OffscreenCanvas）
│   ├── useFileUpload.ts      # 文件上传与验证
│   ├── useBatchProcess.ts    # 批量处理编排
│   ├── useDownload.ts        # 下载与 ZIP 打包
│   └── useTheme.ts           # 暗色模式
├── pages/               # 页面路由（kebab-case）
├── utils/               # 常量与纯函数
│   ├── constants.ts     # 全局常量（MAX_FILE_SIZE 等）
│   ├── fileNaming.ts    # 文件命名规则
│   └── formatDetector.ts # 格式检测
├── workers/             # Web Worker
└── layouts/             # 布局组件
locales/                 # 8 个语言 JSON 文件
```

## 核心原则

1. **本地处理**：所有图片操作在浏览器端完成（Canvas API / OffscreenCanvas），严禁上传到任何服务器。
2. **批量支持**：最多 20 个文件同时处理，单文件最大 50MB。
3. **依赖最小化**：优先使用 Web 原生 API（Canvas、FileReader、createImageBitmap），非必要不引入新依赖。

## 语言规范

- 所有代码注释必须使用 **中文**。
- 所有生成的文档必须使用 **中文**。
- 与用户交流时必须使用 **中文**。
- 变量名、函数名保持 **英文**（符合编程规范）。

## Nuxt 自动导入清单

以下函数 **不需要手动 import**：

- **Vue**：`ref`、`reactive`、`computed`、`watch`、`watchEffect`、`onMounted`、`onUnmounted`、`nextTick`、`readonly`、`shallowRef`
- **Nuxt**：`useHead`、`useSeoMeta`、`navigateTo`、`useRoute`、`useRouter`、`definePageMeta`
- **项目 Composable**：`useI18n`、`useLocalePath`、`useImageProcessor`、`useFileUpload`、`useDownload`、`useBatchProcess`、`useTheme`

**需要手动 import 的**：
- 类型定义：`import type { ProcessOptions } from "~/composables/useImageProcessor"`
- 第三方库类型：`import type { UploadFile } from "element-plus"`
