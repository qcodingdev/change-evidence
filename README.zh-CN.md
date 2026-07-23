<p align="center">
  <img src="assets/brand/change-evidence-icon-256.png" width="128" alt="Change Evidence 图标">
</p>

<h1 align="center">Change Evidence</h1>

<p align="center">
  <b>提交变更前，先看清风险。</b><br>
  面向 AI 辅助开发的本地、确定性提交前变更证据。
</p>

<p align="center">
  <a href="README.md">English</a> · 简体中文
</p>

<p align="center">
  <a href="https://github.com/qcodingdev/change-evidence/actions/workflows/ci.yml"><img src="https://github.com/qcodingdev/change-evidence/actions/workflows/ci.yml/badge.svg" alt="核心 CI"></a>
  <a href="https://github.com/qcodingdev/change-evidence/actions/workflows/plugins.yml"><img src="https://github.com/qcodingdev/change-evidence/actions/workflows/plugins.yml/badge.svg" alt="插件 CI"></a>
  <img src="https://img.shields.io/badge/隐私-仅本地分析-22c55e" alt="仅本地分析">
  <img src="https://img.shields.io/badge/许可证-MIT-blue" alt="MIT 许可证">
</p>

![Change Evidence 终端演示](assets/change-evidence-demo.gif)

Change Evidence 把尚未提交的 Git diff 转成一份精简、可解释的风险报告。
无论是 AI 编码代理还是人工一次改动了大量文件，你都可以在 commit 前快速确认
哪些内容最需要关注。

外层产品 **AI Change Radar** 同时提供原生 **VS Code 插件**和原生
**JetBrains 插件**；底层继续使用 **Change Evidence** 引擎，并保留 `ce`
**CLI/Git Hook**。普通分析不需要账号、API Key 或远程模型，不上传源码，
也不包含遥测。

## 为什么需要 Change Evidence？

你用 Cursor、Claude Code、Copilot 或其他编码代理改了 20 个文件，准备提交前，
Change Evidence 可以快速回答：

- 是否混入疑似凭据字面量，或改动了认证、支付等高风险路径；
- 是否修改了生产行为，却没有任何测试文件变化；
- 是否改动了依赖、运行配置、数据库迁移或 CI/CD；
- 变更规模是否异常，是否可能影响公开 API。

所有信号均来自确定性规则，结果可解释。Change Evidence 不是编译器、完整语义
分析器、专业密钥扫描器或自动 Code Review，也不会自动改写、删除或回滚用户文件。

## 选择使用方式

| 入口 | 适合场景 | 提交保护 |
|---|---|---|
| AI Change Radar for VS Code | 在 VS Code 内审查暂存区或工作区 | 显式“审查并提交”；审查后暂存区变化会取消提交 |
| AI Change Radar for JetBrains IDE | IDEA 系列 IDE 原生变更审查 | 分析提交窗口实际选中内容；中高风险必须继续或取消 |
| CLI + Git Hook | 终端与跨 Git 客户端覆盖 | 可配置报告、询问或仅高风险阻止模式 |

详见[插件使用说明](docs/PLUGIN_USAGE.md)和[隐私说明](PRIVACY.md)。

## 安装 AI Change Radar

插件已经内置分析引擎。普通用户不需要安装 Node.js、JDK、`ce` CLI，也不需要
账号或 API Key。

### VS Code 与 Cursor

1. 打开“扩展”。
2. 搜索 **AI Change Radar**，认准发布者 **QCoding**。
3. 点击“安装”。

如需离线安装，可从[最新 GitHub Release](https://github.com/qcodingdev/change-evidence/releases/latest)
下载 `.vsix`，然后在命令面板执行
“Extensions: Install from VSIX…”。

### JetBrains IDE

1. 打开“Settings / Preferences → Plugins → Marketplace”。
2. 搜索 **AI Change Radar**，认准发布者 **QCoding**。
3. 点击“Install”，根据提示重启 IDE。

如需离线安装，可从[最新 GitHub Release](https://github.com/qcodingdev/change-evidence/releases/latest)
下载插件 `.zip`，然后在 Plugins 齿轮
菜单中选择“Install Plugin from Disk…”。首个公开预览版支持 IntelliJ Platform
2026.1 及以上版本。

## 安装 CLI

需要 Node.js 20+ 和 `git`。

```bash
npm install -g change-evidence
```

npm 安装完成后，Change Evidence 会提示下一步：进入某个 git 仓库后执行 `ce install-hook`，即可启用自动提交前检查。

也可以使用一行安装脚本：

```bash
curl -fsSL https://raw.githubusercontent.com/qcodingdev/change-evidence/main/install.sh | sh
```

安装脚本会通过 npm 全局安装 CLI。如果你在 git 仓库中运行，它会进入可选 hook 配置流程：先选择输出语言，再选择是否安装 hook，然后选择模式和触发阈值。如果你在非 git 仓库目录运行，它只会安装全局 CLI；之后需要进入项目目录执行 `ce install-hook` 来配置语言和自动提交前检查。Hook 不会被静默安装或强制启用。

如果只是从源码仓库本地试用：

```bash
npm install
npm run build
npm install -g .
```

## 使用

Change Evidence 提供两个等价命令：

- `ce`
- `change-evidence`

日常建议使用短命令 `ce`：

```bash
# 分析暂存区改动，提交前最常用
ce --staged

# 分析未暂存的工作区改动
ce

# 分析当前分支相对 main 的差异
ce --base main
```

## 命令

| 命令 | 说明 |
|---|---|
| `ce` | 使用 `git diff` 分析工作区改动 |
| `ce --staged` | 使用 `git diff --cached` 分析暂存区改动 |
| `ce --base main` | 分析 `git diff main...HEAD` |
| `ce --language en` | 输出英文报告 |
| `ce --language zh-CN` | 输出中文报告 |
| `ce --no-color` | 关闭终端颜色 |
| `ce install-hook` | 安装可选 pre-commit hook |
| `ce install-hook --force` | 覆盖已有的非本工具管理的 pre-commit hook |
| `ce uninstall-hook` | 从当前仓库移除本工具管理的 pre-commit hook |
| `ce hook install` | `ce install-hook` 的别名 |
| `ce hook uninstall` | `ce uninstall-hook` 的别名 |
| `ce --version` | 离线显示当前安装版本 |
| `ce version` | 查询 npm，显示当前版、最新版及升级提醒 |
| `ce update --check` | 只检查是否有更新，不执行安装 |
| `ce update` | 通过 npm 更新全局安装的 CLI |
| `ce uninstall` | 确认后移除当前仓库 Hook，并全局卸载 CLI |
| `ce uninstall --yes` | 明确接受影响后，在非交互环境直接卸载 |

## 输出示例

```text
Change Evidence 代码变更证据包

范围：暂存区改动    风险等级：高风险

摘要
- 变更文件：12
- 新增行数：326
- 删除行数：48
- 生产代码文件：7
- 测试文件：0
- 高风险文件：3

高风险变更
[HIGH] src/auth/AuthService.ts
  命中高风险路径；公开 API 变更

风险信号
[HIGH] 检测到敏感关键词：token, password
[WARN] 生产代码有变更，但没有测试文件变更

提交前建议
[ ] 确认没有误提交真实密钥
[ ] 为改动过的生产代码补充或更新测试
```

## 检测内容

Change Evidence 基于本地 git diff 和确定性规则工作，不需要 LLM。

- 高风险路径：`auth`、`security`、`payment`、`migration`、`database`、`config`、CI/CD workflow、`.env*`、`Dockerfile`、`application.yml`、`package.json`、`pom.xml`、`build.gradle`
- 测试信号：生产代码变更但测试未变、关键区域变更但无测试、测试文件被删除
- 大改动信号：文件数过多、总行数过多、单文件改动过大
- 配置、依赖、数据库迁移、CI/CD 变更
- 敏感关键词：`token`、`secret`、`password`、`private_key`、`api_key`、`access_key`、`authorization`
- 公开 API 信号：TypeScript/JavaScript export、Java public 方法、Spring route mapping、`/api/` 和 `/routes/` 改动

疑似 secret 的值会在报告渲染前被脱敏。报告可能提示命中的关键词，但不会打印 secret 值。

## 配置

在仓库中创建 `.change-evidence.yml`：

```yaml
language: zh-CN # zh-CN | en

risk:
  highPaths:
    - "**/auth/**"
    - "**/security/**"
    - "**/payment/**"
    - "**/migration/**"
    - "**/database/**"
    - "**/config/**"
    - ".github/workflows/**"
    - "**/application.yml"
    - "**/application.yaml"
    - ".env*"
    - "Dockerfile"
    - "pom.xml"
    - "package.json"
    - "build.gradle"
  sensitiveKeywords:
    - token
    - secret
    - password
    - private_key
    - api_key
    - access_key
    - authorization
  sizeThresholds:
    maxFiles: 10
    maxTotalLines: 500
    maxSingleFileLines: 200

report:
  maxFiles: 20
  maxRiskItems: 10
  maxChecklistItems: 8
  collapseLowRisk: true

hook:
  enabled: true
  mode: prompt # off | report | prompt | block
  trigger:
    minChangedFiles: 10
    minRiskLevel: medium # ok | low | medium | high
```

非法配置会被忽略，并回退到默认值。

## Pre-commit Hook

在 git 仓库内安装可选 hook：

```bash
ce install-hook
```

安装器会询问：

- 输出语言
- 是否安装 hook
- hook 模式
- 触发阈值

它会在 Git 实际使用的 hooks 目录（包括 `core.hooksPath`）写入一个由 Change Evidence 管理的 `pre-commit` 脚本，并把你的选择保存到 `.change-evidence.yml`。

Hook 按仓库生效。在一个项目里安装 hook，不会影响其他项目。如果 IDE 走标准 git hooks 流程提交，例如 IntelliJ IDEA 默认的 Git commit 流程，也会触发该 hook。使用 `--no-verify` 或 IDE 中跳过 hooks 的设置时不会触发。

Hook 模式：

| 模式 | 行为 |
|---|---|
| `off` | 不自动运行 |
| `report` | 打印报告并继续提交 |
| `prompt` | 命中触发规则时询问是否继续；无可交互终端时中止提交 |
| `block` | 仅在高风险触发规则命中时阻止提交 |

触发规则同时使用变更文件数和总体风险等级。已有的非 Change Evidence 管理的 pre-commit hook 会被保留，除非传入 `--force`。

从当前仓库卸载 hook：

```bash
ce uninstall-hook
```

卸载默认是安全的：只会删除 Change Evidence 自己写入的 hook，不会删除用户自定义 hook。

## 更新与卸载

仅查看当前安装版本，不访问网络：

```bash
ce --version
```

查询 npm 最新版本，并在需要时显示升级提醒：

```bash
ce version
# 或
ce update --check
```

版本检查只会在用户明确执行命令时发生，普通风险分析和 Git Hook 不会为了检查更新而访问 npm。

通过 npm 更新全局安装的 CLI：

```bash
ce update
```

移除当前仓库 Hook，并全局卸载 CLI：

```bash
ce uninstall
```

该命令会先要求确认，只删除当前仓库中由 Change Evidence 管理的 Hook，保留自定义 Hook，然后执行 npm 全局卸载。非交互环境默认拒绝卸载，必须明确接受影响：

```bash
ce uninstall --yes
```

Change Evidence 无法安全扫描机器上的所有代码仓库。如果多个仓库安装过 Hook，应在最终全局卸载前逐个清理：

```bash
cd /path/to/another/repository
ce uninstall-hook
```

也可以继续使用等价的 npm 手动卸载命令：

```bash
npm uninstall -g change-evidence
```

## 隐私

Change Evidence 的风险分析完全在本地运行。它调用 `git diff`，在当前进程中分析输出，然后打印终端报告。它不会把代码、diff 或 secret 发送到远程服务。只有 `ce version`、`ce update --check`、`ce update` 等用户主动执行的包管理操作会调用 npm，并可能访问当前配置的 npm registry。

## 贡献

欢迎贡献代码。提交 pull request 前请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。

安全问题请阅读 [SECURITY.md](SECURITY.md)。请不要在公开 issue 中粘贴真实 secret、凭证或私有代码。

## 开发

```bash
npm install
npm run typecheck
npm test
npm run build
```

常用本地命令：

```bash
npm run dev -- --staged
node dist/cli/index.js --staged --no-color
```

只有从源码构建 JetBrains 插件的贡献者才需要 JDK 21。插件构建和市场发布说明
统一放在[发布指南](docs/PLUGIN_PUBLISHING.md)中。

## 作者

由 QCoding 创建。

QCoding｜专注 AI 应用开发与 Java 技术实践。

## 许可证

MIT
