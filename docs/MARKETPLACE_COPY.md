# Marketplace Listing Copy

The following copy is ready to paste into the Visual Studio Marketplace and
JetBrains Marketplace listings.

## Product Name

**AI Change Radar**

## Short Description

Local risk checks for AI-assisted code changes.

## Short Description — 简体中文

AI 编程代码变更风险雷达，在提交前发现敏感信息、测试缺失、配置变更和高风险代码。

## Full Description

Built for AI-assisted coding. Runs locally. No LLM required. No source code upload.

Powered by the open-source Change Evidence engine.

AI Change Radar gives developers a concise risk summary for working-tree or
staged Git changes before they commit.

It is designed for the moment after an AI coding agent modifies many files and
you need a fast answer to practical questions:

- Did authentication, payment, database, migration, dependency, or CI files
  change?
- Were production files changed without a matching test-file change?
- Did the diff introduce sensitive-looking keys such as tokens or passwords?
- Is the change unusually large?
- Does the diff appear to change a public API?

Analysis runs locally using deterministic rules. AI Change Radar does not send
source code or diffs to a remote model or service, and it does not require an
account or API key.

### Editor Experience

- Analyze staged or working-tree changes on demand.
- See risk summaries and per-file reasons inside the IDE.
- Navigate findings from the IDE's native change and problem views.
- Review medium/high-risk changes before committing.
- Explicitly continue or cancel; cancelling never modifies user files.
- Chinese and English user interface.

### What AI Change Radar Is Not

AI Change Radar is not a compiler, full semantic static analyzer, AI code
reviewer, or dedicated secret scanner. Its signals are intentionally fast and
explainable and should complement tests, linters, security scanners, and human
review.

## 完整介绍 — 简体中文

AI Change Radar 在提交前为工作区或暂存区的 Git 变更生成一份精简的风险摘要。

它面向 AI 编码工具一次修改大量文件后的关键时刻，帮助开发者快速确认：

- 是否改动了认证、支付、数据库、迁移、依赖或 CI/CD 文件；
- 生产代码变化时是否没有任何测试文件变化；
- 是否新增了 token、password 等敏感信息线索；
- 本次变更规模是否异常；
- 是否可能影响公开 API。

分析完全在本机通过确定性规则完成，不上传源码或 diff，不调用远程模型，不需要账号或 API Key。

### IDE 体验

- 一键分析暂存区或工作区变更；
- 在 IDE 内查看总体风险和逐文件原因；
- 从原生变更视图或问题列表定位结果；
- 提交中高风险变更前进行明确确认；
- 用户可以继续或取消，取消不会修改任何文件；
- 支持简体中文和英文。

### 能力边界

AI Change Radar 不是编译器、完整语义静态分析器、AI Code Review 或专业密钥扫描器。它提供的是快速、透明、可解释的风险线索，应与测试、Lint、安全扫描和人工评审配合使用。

## Privacy Summary

All analysis runs locally. No source code, diff, repository metadata, or
analysis result is uploaded. The extensions include no analytics, advertising,
remote AI calls, or account login.

## Suggested Categories and Tags

- Developer Tools
- Source Control
- Testing
- Security
- Git
- pre-commit
- code review
- AI coding
- local-first
- privacy
- risk analysis
- change review
