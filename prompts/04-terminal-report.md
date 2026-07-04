# Prompt 04：实现统一终端报告输出

请实现 V1 唯一终端报告格式。

## 要求

- 默认中文。
- 支持英文。
- 使用颜色区分 HIGH / MEDIUM / LOW / WARN / OK。
- 输出克制，不刷屏。
- 低风险折叠。
- 不输出 secret 值。
- 默认最多展示：
  - 20 个文件
  - 10 个高风险项
  - 8 条 checklist

## 中文报告示例

```text
Change Evidence 代码变更证据包

范围：staged changes
风险等级：MEDIUM

摘要
- 变更文件：12 个
- 新增行数：326
- 删除行数：48
- 生产代码文件：7 个
- 测试文件：0 个
- 高风险文件：3 个

高风险变更
[HIGH] src/main/java/com/example/auth/AuthService.java
原因：命中 auth 路径；生产代码变更但没有测试变更

测试信号
[WARN] 生产代码有变更，但没有 staged 测试文件

提交前建议
[ ] 确认 AuthService 的鉴权逻辑没有绕过校验
[ ] 补充或更新 auth 相关测试

折叠的低风险变更
- 5 个文档、注释或样式文件已折叠
```

## 修改文件

- `src/render/terminal-report.ts`
- `src/render/colors.ts`
- `src/render/i18n.ts`
