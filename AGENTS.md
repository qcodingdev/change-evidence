# AGENTS.md

## 项目定位

本项目是 Change Evidence，一个 CLI-first 的本地代码变更证据包工具。

核心场景：AI coding 工具一次修改大量未提交代码后，开发者在 commit 前运行 CLI 或通过可选 Git Hook 自动触发，查看修改摘要、风险信号和提交前 checklist。

项目不是 AI reviewer，不判断代码正确性，不修复代码，不回滚代码，不管理 PR。它只做提交前风险输出。

## 产品规则

- 主打本地 CLI，不主打 GitHub Action。
- 同时提供完整命令 `change-evidence` 和短命令 `ce`。日常使用优先考虑 `ce` 的体验。
- 主要服务开发者本人，不是管理人员或 maintainer。
- 主要针对 AI coding 后大量未提交代码的风险分析报告。
- 第一版只输出统一终端报告格式，要求排版清晰、颜色美观、信息克制。
- 不提供大量输出模板。
- 不默认依赖 LLM；第一版优先使用 Git diff 和确定性规则。
- 不绑定 GitHub / GitLab / 任意单一代码托管平台。
- 报告必须控制长度，避免 AI 改动很多时刷屏。
- Hook 是第一版核心体验之一，安装流程应推荐配置 hook，但不能静默强制开启。

## 第一版范围

必须实现：

- 读取本地 Git diff：working tree、staged changes、branch diff
- `change-evidence --staged` / `ce --staged`
- `change-evidence --base main` / `ce --base main`
- 识别变更文件类型
- 标记高风险路径
- 检查是否有测试改动
- 检测大改动信号
- 检测配置、依赖、数据库迁移、CI/CD 变更
- 检测敏感关键词，但不输出 secret 值
- 生成统一终端风险报告
- 输出提交前 checklist
- 支持报告长度限制和低风险改动折叠
- 安装时选择语言：中文或英文
- 可选安装 pre-commit hook
- Hook 支持触发级别，例如改动文件数大于 10 时自动触发报告

不做：

- 完整 AI code review
- 多模板输出系统
- 自动修复代码
- 自动合并
- 自动回滚
- 自动 reset
- 自动创建 revert PR
- 复杂每日治理报告
- 复杂 Web 平台
- 第一版完整 IDE 插件
- 第一版 GitHub Action 主入口

## Hook 规则

Hook 是第一版核心体验，但必须由用户明确选择安装和触发等级。

安装时需要让用户选择：

- 是否安装 hook
- 输出语言：中文 / 英文
- hook 模式：off / report / prompt / block
- 触发条件：改动文件数、风险等级、是否修改高风险路径

推荐默认：

```yaml
language: zh-CN
hook:
  enabled: true
  mode: prompt
  trigger:
    minChangedFiles: 10
    minRiskLevel: medium
```

模式说明：

- `off`：不自动触发
- `report`：commit 前输出报告后继续
- `prompt`：命中触发条件时询问是否继续 commit
- `block`：仅显式高风险规则命中时阻止 commit，默认不推荐

## 风险规则

高风险路径和文件：

- auth
- security
- payment
- migration
- database
- config
- CI/CD
- secrets
- public API
- application.yml / application.yaml
- .env
- Dockerfile
- pom.xml / package.json / build.gradle

测试信号：

- production code changed but test files unchanged
- critical module changed with no tests
- test files deleted

大改动信号：

- changed files > configured threshold
- total changed lines > configured threshold
- single file changed lines > configured threshold

## 报告限制规则

报告必须默认限量展示，不能把所有改动流水账式列出来。

建议默认限制：

- 最多展示 20 个文件。
- 最多展示 10 个高风险项。
- 最多展示 8 条 checklist。
- 低风险文档、注释、样式变更默认折叠。
- 优先展示认证、权限、支付、数据库、配置、CI/CD、public API 等高风险区域。

## 操作边界

不允许默认执行：

- `git reset`
- `git revert`
- `git add`
- `git commit`
- `git push`
- 强推分支
- 自动回滚文件
- 自动创建 revert PR
- 自动修复代码

## 文档规则

- README 保持中英文双入口。
- 内部规划使用中文。
- 必须强调：本项目是提交前风险摘要 CLI，不是 reviewer，不是 PR bot。
