# Change Evidence

[English](README.md) | 简体中文

在 commit 前，看清这次代码改动的风险。

Change Evidence 是一个本地 CLI，用来为未提交的代码改动生成简洁的风险报告。它尤其适合 Claude Code、Codex、Cursor、OpenCode、Trae、Qoder 等 AI coding 工具一次修改很多文件后，开发者在提交前快速了解：到底改了什么、哪些地方有风险、是否缺少测试。

它不是 AI Code Reviewer，不修代码，不回滚，不批准提交，也不管理 PR。它只做一件事：输出修改摘要和风险信号。

## 它要做什么

提交前运行完整命令或短命令：

```bash
change-evidence --staged
ce --staged
```

`ce` 是日常使用的短命令，适合在终端、IDE task 或 hook 中快速触发。

它会输出：

- 变更文件摘要
- 生产代码和测试代码比例
- 高风险路径，例如 auth、security、payment、config、migration、CI/CD
- 大改动信号
- 测试缺失信号
- 敏感关键词信号，但不打印 secret 值
- 提交前 checklist
- 折叠低风险变更

## 主要使用场景

```text
AI coding 工具修改了很多文件
  -> 开发者 git add
  -> Change Evidence 输出风险报告
  -> 开发者决定继续 commit、补测试、拆分改动或检查高风险文件
```

## 可选 Git Hook

第一版把 pre-commit hook 作为核心能力之一，但安装时必须让用户选择触发等级。

推荐体验是：用户安装后直接配置 hook，当修改文件过多或风险达到阈值时自动触发报告。

安装命令：

```bash
change-evidence install-hook
ce hook install
```

安装时让用户选择是否开启 hook，以及什么条件下触发：

```yaml
hook:
  enabled: true
  mode: prompt
  trigger:
    minChangedFiles: 10
    minRiskLevel: medium
```

Hook 模式：

- `off`：不自动运行
- `report`：只打印报告，不打断提交
- `prompt`：命中触发条件时询问是否继续提交
- `block`：仅在显式高风险规则命中时阻止提交，默认不推荐

默认推荐安装 hook，但不能静默强制安装。用户必须明确选择触发模式和触发阈值，例如改动文件数大于 10 时自动输出报告。

## 输出格式

第一版只提供统一的终端报告格式，重点是排版清晰、颜色美观、信息克制。不做很多模板。

后续可以复用同一套报告核心扩展到：

- IDE 命令
- pre-commit hook
- GitHub Action
- GitLab CI
- 本地 Markdown 导出

## 边界

Change Evidence 只输出证据和风险信号。

它不做：

- 判断代码正确性
- 自动修复代码
- 执行 `git reset`
- 执行 `git revert`
- 创建回滚 PR
- 自动批准或拒绝提交
- 默认上传代码
