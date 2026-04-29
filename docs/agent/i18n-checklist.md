# PixelSwift 多语言修改清单

## 固定语言文件
当前仓库固定维护以下 8 个 locale 文件：

- `locales/en.json`
- `locales/zh.json`
- `locales/es.json`
- `locales/ja.json`
- `locales/de.json`
- `locales/fr.json`
- `locales/pt.json`
- `locales/ko.json`

## 强制规则
- 任何用户可见文案改动，必须同步更新全部 8 个文件。
- 禁止只改 `zh` 或 `en` 后就结束。
- 禁止在页面里写死最终文案，除非它永远不会对用户可见。

## key 设计
- key 结构保持模块化：`module.group.key`
- 新功能文案优先聚合到现有模块下，不随意散落
- 修改前先搜索旧 key，优先复用，而不是创造近似重复 key

## 修改流程
1. 先在页面/组件中定位使用的 `t()` / `$t()` / key
2. 搜索 `locales/` 中该 key 是否已存在
3. 若新增 key，立刻同步补到 8 个 locale 文件
4. 若修改 key 文案，检查所有语言是否同步更新
5. 跑本地开发环境并切换语言做抽样验证

## 验收清单
- 是否 8 个语言文件都改了
- 是否没有遗漏旧 key 或拼写错误
- 是否没有把用户可见文案写死在组件里
- 是否在桌面与移动端都检查了对应文案显示
