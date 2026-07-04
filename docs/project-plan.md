# Change Evidence 项目规划

## 1. 项目定位

Change Evidence 是一个 CLI-first 的本地代码变更证据包工具。

核心定位：

> 在 commit 前，帮开发者看清这次代码改动改了什么、风险在哪里、是否缺少测试。

英文表达：

> Understand risky code changes before you commit.

项目主要面向使用 Claude Code、Codex、Cursor、OpenCode、Trae、Qoder 等 AI coding 工具的开发者。AI 一次修改大量未提交代码后，开发者可以在终端或 IDE 中查看一份克制、清晰、可行动的风险报告，再决定是否 commit。

## 2. 真实痛点

AI coding 工具让代码修改速度变快，但也带来一个新问题：

- AI 可能一次修改很多文件。
- 开发者不一定完全看懂每个改动。
- 提交前逐行读完整 diff 成本高。
- `git diff --stat` 只能告诉你改了多少，不能告诉你风险在哪里。
- IDE diff 需要人工逐个看文件。
- PR review 工具通常发生在 PR 后，不贴近 commit 前自查。

Change Evidence 解决的是高频轻痛点：提交前快速看一眼这次改动的风险摘要。

## 3. 总目标

只做一件事：输出提交前代码变更风险报告。

总目标：

1. 读取本地 Git diff。
2. 识别变更文件、变更规模和文件类型。
3. 基于确定性规则识别风险信号。
4. 折叠低风险变更。
5. 输出美观、克制、统一的终端报告。
6. 可选通过 pre-commit hook 在 git commit 时触发。
7. 安装时支持语言选择和 hook 触发级别配置。

## 4. 第一版能力

### 4.1 CLI 命令

提供完整命令和短命令：

```bash
change-evidence
ce
change-evidence --staged
ce --staged
change-evidence --base main
ce --base main
change-evidence install-hook
ce hook install
```

`ce` 是日常主命令，`change-evidence` 是完整语义命令。

第一版不做多种输出模板，默认只输出统一终端报告。

### 4.2 Git 数据来源

使用本地 Git 命令获取事实数据：

- `git diff --name-status`
- `git diff --numstat`
- `git diff --unified=0`
- `git diff --staged`
- `git diff <base>...HEAD`

第一版不依赖 LLM，不上传代码，不需要服务端。

### 4.3 风险信号

识别：

- 高风险路径：auth、security、payment、database、migration、config、CI/CD
- 配置文件变更：application.yml、.env、Dockerfile 等
- 依赖文件变更：pom.xml、package.json、build.gradle
- 测试缺失：生产代码变化但测试文件没有变化
- 大改动：文件数、行数、单文件改动超过阈值
- 敏感关键词：token、secret、password、private key，但不打印具体值
- public API 简单变化：public 方法、Controller mapping、接口文件变化

## 5. Hook 设计

第一版带 hook，并将 hook 作为核心使用路径之一；但必须由用户在安装流程中明确选择触发模式和触发等级。

安装命令：

```bash
change-evidence install-hook
ce hook install
```

推荐用户安装 hook，并设置例如“改动文件数大于 10”或“风险等级达到 medium”时自动触发报告。

安装时交互：

```text
请选择输出语言：
1. 中文
2. English

是否安装 pre-commit hook？
1. 不安装
2. 安装，仅输出报告
3. 安装，中高风险时询问是否继续

触发条件：
- 改动文件数大于多少时触发？默认 10
- 最低风险等级？默认 medium
```

推荐配置：

```yaml
language: zh-CN
hook:
  enabled: true
  mode: prompt
  trigger:
    minChangedFiles: 10
    minRiskLevel: medium
```

Hook 模式：

- `off`：不自动触发
- `report`：输出报告后继续 commit
- `prompt`：命中触发条件时询问是否继续 commit
- `block`：仅显式高风险规则命中时阻止 commit，默认不推荐

## 6. 统一报告格式

第一版只做一种终端报告格式。

要求：

- 中文输出清楚。
- 颜色美观。
- 高风险醒目。
- 信息分组明确。
- 不刷屏。
- 低风险折叠。

示例：

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

[HIGH] src/main/resources/application.yml
原因：配置文件变更；检测到 token / secret 相关字段

测试信号
[WARN] 生产代码有变更，但没有 staged 测试文件

提交前建议
[ ] 确认 AuthService 的鉴权逻辑没有绕过校验
[ ] 补充或更新 auth 相关测试
[ ] 确认 application.yml 没有误提交真实密钥

折叠的低风险变更
- 5 个文档、注释或样式文件已折叠
```

## 7. 不做什么

第一版不做：

- AI code review
- 自动修复
- 自动回滚
- 自动 reset
- 自动创建 PR
- GitHub Action 主入口
- 复杂 IDE 插件
- 多模板输出系统
- Web dashboard
- 每日治理报告

## 8. 分阶段目标

### 阶段 1：CLI MVP

- 读取 staged / unstaged / branch diff。
- 输出统一终端报告。
- 支持高风险路径、测试缺失、大改动、配置变更检测。

### 阶段 2：可选 Hook

- `install-hook` / `ce hook install`。
- 安装时选择语言。
- 安装时选择 hook 模式。
- 支持触发阈值：例如改动大于 10 个文件时触发。

### 阶段 3：配置文件

- `.change-evidence.yml`
- 自定义风险路径。
- 自定义触发阈值。
- 自定义语言。

### 阶段 4：IDE / 平台包装

- VS Code command。
- JetBrains external tool 文档。
- GitHub Action wrapper。
- GitLab CI wrapper。

这些都是包装层，不改变 CLI-first 的核心定位。

## 9. 成功指标

- 开发者 3 分钟内安装并跑出第一份报告。
- AI coding 后修改 10 个以上文件时，报告能清楚指出 Top 风险。
- 默认报告不超过一个终端屏幕的 1.5 倍。
- 高风险规则不过度泛化，不把所有文件都标 high。
- 用户能根据 checklist 决定继续 commit、补测试、拆分 commit 或检查高风险文件。
