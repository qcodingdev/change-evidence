# Change Evidence V1 实现规划与 AI 编码规格

## 1. V1 目标

Change Evidence V1 是一个 CLI-first 的本地代码变更风险报告工具。

核心目标：

> 在 commit 前，根据本地 Git diff 输出一份统一、美观、克制的风险报告。

V1 不做 AI reviewer，不做 PR bot，不做自动修复，不做回滚，不做多模板输出。

## 2. 使用场景

主要场景：

```text
开发者使用 Claude Code / Codex / Cursor / OpenCode / Trae / Qoder 修改大量代码
  -> 开发者 git add
  -> 运行 change-evidence --staged / ce --staged，或触发 pre-commit hook
  -> 查看修改摘要和风险信号
  -> 决定继续 commit、补测试、拆分提交或检查高风险文件
```

## 3. V1 命令

必须支持：

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

可选支持：

```bash
change-evidence --no-color
change-evidence --language zh-CN
change-evidence --language en
```

V1 默认输出统一终端报告，不实现多模板系统。

## 4. 数据来源

通过 Git 命令读取本地事实数据：

- `git diff --name-status`
- `git diff --numstat`
- `git diff --unified=0`
- `git diff --cached`
- `git diff <base>...HEAD`

V1 不上传代码，不需要服务端，不默认调用 LLM。

## 5. 核心模块

推荐结构：

```text
src/
  cli/
    index.ts
    commands.ts
  git/
    diff-source.ts
    diff-parser.ts
  analysis/
    file-classifier.ts
    risk-engine.ts
    test-signal.ts
    size-signal.ts
    sensitive-signal.ts
    checklist.ts
  hook/
    install-hook.ts
    hook-runner.ts
  config/
    config-loader.ts
    defaults.ts
  render/
    terminal-report.ts
    colors.ts
    i18n.ts
  shared/
    types.ts
```

## 6. 风险分析规则

### 6.1 高风险路径

默认高风险：

- `**/auth/**`
- `**/security/**`
- `**/payment/**`
- `**/migration/**`
- `**/database/**`
- `**/config/**`
- `.github/workflows/**`
- `**/application.yml`
- `**/application.yaml`
- `.env*`
- `Dockerfile`
- `pom.xml`
- `package.json`
- `build.gradle`

### 6.2 测试信号

规则：

- 生产代码变化但测试文件未变化 -> warning。
- 高风险模块变化但对应测试未变化 -> warning。
- 测试文件被删除 -> high。

### 6.3 大改动信号

默认阈值：

- 文件数 > 10：触发大改动信号。
- 总变更行数 > 500：触发大改动信号。
- 单文件变更行数 > 200：触发单文件大改动信号。

### 6.4 敏感关键词信号

只检测，不打印具体值。

关键词：

- token
- secret
- password
- private_key
- api_key
- access_key
- authorization

## 7. Hook 设计

V1 必须支持 hook 安装，并将 hook 作为核心使用路径之一；但安装时必须让用户明确选择触发模式和触发等级。

安装命令：

```bash
change-evidence install-hook
ce hook install
```

交互流程：

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

Hook 写入 `.git/hooks/pre-commit`，执行：

```bash
change-evidence --staged --hook
# 或
ce --staged --hook
```

Hook 返回规则：

- `report` 模式：总是 exit 0。
- `prompt` 模式：用户选择继续则 exit 0，取消则 exit 1。
- `block` 模式：仅显式 high-risk block 规则命中时 exit 1。

推荐安装 hook，但不能静默强制安装。安装流程必须询问用户，并支持按改动文件数和风险等级触发。

## 8. 配置文件

V1 支持 `.change-evidence.yml`。

示例：

```yaml
language: zh-CN
risk:
  highPaths:
    - "**/auth/**"
    - "**/security/**"
    - "**/payment/**"
report:
  maxFiles: 20
  maxRiskItems: 10
  maxChecklistItems: 8
  collapseLowRisk: true
hook:
  enabled: true
  mode: prompt
  trigger:
    minChangedFiles: 10
    minRiskLevel: medium
```

## 9. 终端报告格式

V1 只实现一个统一终端格式。

要求：

- 使用颜色区分 HIGH / MEDIUM / LOW / WARN / OK。
- 默认中文可读。
- 不输出 secret 值。
- 默认不超过一个终端屏幕的 1.5 倍。
- 低风险变更折叠。

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

测试信号
[WARN] 生产代码有变更，但没有 staged 测试文件

提交前建议
[ ] 确认 AuthService 的鉴权逻辑没有绕过校验
[ ] 补充或更新 auth 相关测试

折叠的低风险变更
- 5 个文档、注释或样式文件已折叠
```

## 10. 不做事项

V1 不做：

- AI code review
- 自动修复
- 自动 reset
- 自动 revert
- 自动创建 PR
- GitHub Action 主入口
- IDE 插件
- Web dashboard
- 多模板输出系统
- 每日治理报告

## 11. 验收标准

- 能分析 staged changes。
- 能分析 working tree changes。
- 能分析 branch diff。
- 能输出中文终端报告。
- 能识别高风险路径。
- 能识别测试缺失。
- 能识别大改动。
- 能折叠低风险变更。
- 能安装可选 pre-commit hook。
- hook 能根据改动文件数和风险等级触发。
- 不会打印 secret 值。
