# AI Change Radar

**Local risk checks for AI-assisted code changes.**

Built for AI-assisted coding. Runs locally. No LLM required. No source code
upload.

Review staged and working-tree changes locally before committing. AI Change Radar
uses the same deterministic analysis core as the `ce` CLI and does not upload
source code or require a global `ce`/Node package installation.

Powered by the open-source Change Evidence engine.

[中文说明](#中文说明)

## Features

- Analyze **staged changes** or the **working tree**, including untracked,
  non-ignored files by default.
- See the result in the AI Change Radar Activity Bar view, the Problems panel,
  and a dedicated output channel.
- Run **Review & Commit** from Source Control. A modal Continue/Cancel decision
  is required when high-risk changes are detected.
- Reuse `.change-evidence.yml` from the repository.
- Work with multi-root workspaces and show friendly errors for folders without
  Git repositories.
- Follow the VS Code display language for English and Chinese UI.

The extension is local and deterministic. It does not call an AI service and it
does not replace tests, secret scanners, or human review.

## Use

1. Open a trusted Git workspace in VS Code.
2. Open the AI Change Radar shield in the Activity Bar, or use the Source
   Control title-bar buttons.
3. Run **Analyze Working Tree** while developing, or **Analyze Staged Changes**
   before commit.
4. Select a risk item to open its file. The same file-level findings appear in
   the Problems panel.
5. Run **Review & Commit** to analyze staged changes, make the explicit
   high-risk decision when necessary, enter a commit message, and commit through
   VS Code's built-in Git extension.

Settings:

- `aiChangeRadar.includeUntracked`: include untracked, non-ignored files in
  working-tree analysis (default: `true`).
- `aiChangeRadar.revealOutputOnSuccess`: reveal the output channel after every
  successful analysis (default: `false`).

## Install a local VSIX

```bash
cd plugins/vscode
npm install
npm run package
code --install-extension ai-change-radar-0.1.0.vsix
```

You can also choose **Extensions: Install from VSIX…** in the Command Palette.

## Marketplace release

1. Create a Visual Studio Marketplace publisher. The package currently uses
   `qcodingdev`; if that ID is unavailable, change only the `publisher` field.
2. Create an Azure DevOps personal access token with Marketplace management
   permission.
3. Run `npx @vscode/vsce login <publisher>`.
4. Run `npm ci && npm run check`.
5. Run `npx @vscode/vsce publish`.

For Open VSX, create a namespace/token and run:

```bash
npx ovsx publish ai-change-radar-0.1.0.vsix -p "$OVSX_TOKEN"
```

Increase the extension version before each release. Never commit publisher
tokens.

## Important boundary

VS Code's public extension API does not provide a universal interception hook
for every commit path. **Review & Commit** is an explicit safe workflow; users
can still invoke other Git commit commands. Install the Change Evidence engine's
Git hook separately if repository-wide enforcement is required.

## 中文说明

AI Change Radar 在本地分析暂存区或工作区变更，默认包含未跟踪且未被忽略的
文件。它内置项目分析核心，不需要全局安装 `ce` 或 Node 包，也不会上传代码。

使用方法：

1. 在 VS Code 中打开可信任的 Git 工作区。
2. 点击活动栏中的盾牌，运行“分析工作区变更”或“分析暂存区变更”；也可直接使用
   源代码管理标题栏按钮。
3. 在 AI Change Radar 树、问题面板和输出面板查看风险；点击文件风险可打开文件。
4. 使用“审查并提交”时，插件会先重新分析暂存区。若发现高风险，必须明确选择
   “仍然提交”或“取消”，之后输入提交说明并通过 VS Code 内置 Git 扩展提交。

VS Code 公共扩展 API 没有覆盖所有提交入口的通用拦截器，因此本插件不会虚假
承诺能拦截任意提交命令。如需仓库级强制检查，请另外安装 Change Evidence
引擎提供的 Git Hook。

[Privacy](PRIVACY.md) · [Support](SUPPORT.md) · [MIT License](LICENSE)
