# Prompt 06：补测试和验收

请为 Change Evidence V1 补充测试，并确保项目可构建。

## 必须测试

- diff parser：name-status、numstat、patch parsing。
- file classifier：Java、config、dependency、migration、CI、docs、test。
- risk engine：高风险路径、测试缺失、大改动、敏感关键词。
- report limiter：Top N 和低风险折叠。
- i18n：中文和英文核心文案。
- hook trigger：minChangedFiles、minRiskLevel、mode 行为。

## 必须运行

```bash
npm run typecheck
npm test
npm run build
```

## 验收输出

请在最终回复中列出：

- 实现了哪些模块。
- 哪些命令可用。
- 测试结果。
- 是否有未实现项。
- 如何手动试用 `ce --staged` 和 `ce hook install`。
