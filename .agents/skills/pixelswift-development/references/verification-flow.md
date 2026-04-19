# 验证顺序速记

默认顺序：
1. 阅读相关代码与 locale
2. 实现改动
3. **先跑 `npm run dev`**
4. 打开真实页面/路由手动验证
5. 再跑相关测试
6. 最后跑 `npm run build`

不要把 `npm run build` 当成开发期第一验证动作。

更完整说明见：`docs/agent/verification-flow.md`
