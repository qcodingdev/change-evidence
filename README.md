<p align="center">
  <img src="assets/brand/change-evidence-icon-256.png" width="128" alt="Change Evidence icon">
</p>

<h1 align="center">Change Evidence</h1>

<p align="center">
  <b>See the risk before you commit the change.</b><br>
  Local, deterministic pre-commit evidence for AI-assisted development.
</p>

<p align="center">
  English · <a href="README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <a href="https://github.com/qcodingdev/change-evidence/actions/workflows/ci.yml"><img src="https://github.com/qcodingdev/change-evidence/actions/workflows/ci.yml/badge.svg" alt="Core CI"></a>
  <a href="https://github.com/qcodingdev/change-evidence/actions/workflows/plugins.yml"><img src="https://github.com/qcodingdev/change-evidence/actions/workflows/plugins.yml/badge.svg" alt="Plugin CI"></a>
  <img src="https://img.shields.io/badge/privacy-local--only-22c55e" alt="Local-only analysis">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License">
</p>

![Change Evidence terminal demo](assets/change-evidence-demo.gif)

Change Evidence turns an uncommitted Git diff into a compact, explainable risk
report. Use it after an AI coding agent—or a human—changes many files and you
need to know what deserves attention before commit.

The **AI Change Radar** product is available as a native **VS Code extension** and
a native **JetBrains plugin**. Both are powered by the **Change Evidence** engine,
which remains available as the `ce` **CLI/Git hook**. Normal analysis runs locally without an
account, API key, telemetry, source upload, or remote model.

## Why Change Evidence?

You just used Cursor, Claude Code, Copilot, or another coding agent to change 20
files. Before commit, Change Evidence helps answer:

- Did a credential-like literal or high-risk path slip into the diff?
- Did production behavior change without a test change?
- Did dependencies, runtime configuration, migrations, or CI change?
- Is the change unusually large or likely to affect a public API?

The signals are deterministic and explainable. Change Evidence is not a
compiler, full semantic analyzer, secret scanner, or automatic code reviewer,
and it never automatically rewrites or rolls back user files.

## Choose Your Workflow

| Surface | Best for | Commit protection |
|---|---|---|
| AI Change Radar for VS Code | Staged/working-tree review inside VS Code | Explicit Review & Commit; aborts if the staged diff changes after review |
| AI Change Radar for JetBrains IDEs | Native IDEA-family change review | Analyzes the exact selected commit changes; medium/high risk requires Continue or Cancel |
| CLI + Git hook | Terminal use and repository-wide Git-client coverage | Configurable report, prompt, or high-risk block mode |

See [IDE plugin usage](docs/PLUGIN_USAGE.md), [privacy](PRIVACY.md), and the
[marketplace publishing guide](docs/PLUGIN_PUBLISHING.md).

## Install AI Change Radar

With JDK 21 active, build both ready-to-install marketplace archives:

```bash
npm run build:plugins
```

The command produces:

- `release-artifacts/ai-change-radar-0.1.0.vsix`
- `release-artifacts/ai-change-radar-intellij-0.1.0.zip`

Install the VSIX with **Extensions: Install from VSIX…** in VS Code. Install the
ZIP with **Settings / Preferences → Plugins → Install Plugin from Disk…** in a
compatible JetBrains IDE.

## Install the CLI

Requires Node.js 20+ and `git`.

```bash
npm install -g change-evidence
```

After npm installation, Change Evidence prints the next step: enter a git repository and run `ce install-hook` if you want automatic pre-commit checks.

Or use the one-line installer:

```bash
curl -fsSL https://raw.githubusercontent.com/qcodingdev/change-evidence/main/install.sh | sh
```

The installer uses npm to install the CLI globally. If you run it inside a git repository, it starts the optional hook setup flow: choose the output language first, then decide whether to install the hook, then choose mode and trigger thresholds. If you run it outside a git repository, only the global CLI is installed; run `ce install-hook` later inside a project to configure language and automatic pre-commit checks. Hook installation is never silent or forced.

For local testing from a cloned repository:

```bash
npm install
npm run build
npm install -g .
```

## Usage

Change Evidence provides two identical commands:

- `ce`
- `change-evidence`

Daily usage usually feels best with `ce`:

```bash
# Analyze staged changes before commit
ce --staged

# Analyze unstaged working-tree changes
ce

# Analyze a branch diff against main
ce --base main
```

## Commands

| Command | Description |
|---|---|
| `ce` | Analyze working-tree changes with `git diff` |
| `ce --staged` | Analyze staged changes with `git diff --cached` |
| `ce --base main` | Analyze `git diff main...HEAD` |
| `ce --language en` | Print English output |
| `ce --language zh-CN` | Print Chinese output |
| `ce --no-color` | Disable terminal colors |
| `ce install-hook` | Install the optional pre-commit hook |
| `ce install-hook --force` | Replace an existing non-managed pre-commit hook |
| `ce uninstall-hook` | Remove the managed pre-commit hook from the current repository |
| `ce hook install` | Alias for `ce install-hook` |
| `ce hook uninstall` | Alias for `ce uninstall-hook` |
| `ce --version` | Print the installed version without a network request |
| `ce version` | Query npm and show the installed/latest versions with an upgrade reminder |
| `ce update --check` | Check for an update without installing it |
| `ce update` | Update the globally installed CLI through npm |
| `ce uninstall` | Confirm, remove the current managed hook, and uninstall the global CLI |
| `ce uninstall --yes` | Uninstall non-interactively after explicitly accepting the impact |

## Example Output

```text
Change Evidence code change risk report

Scope: staged changes    Risk level: high

Summary
- Files changed: 12
- Lines added: 326
- Lines deleted: 48
- Production files: 7
- Test files: 0
- High-risk files: 3

High-risk changes
[HIGH] src/auth/AuthService.ts
  matches high-risk path; public API changed

Risk signals
[HIGH] Sensitive keywords detected: token, password
[WARN] Production code changed but no test files were modified

Pre-commit checklist
[ ] Confirm no real secrets / credentials are being committed
[ ] Add or update tests for the changed production code
```

## What It Detects

Change Evidence uses deterministic rules over local git diff output. No LLM is required.

- High-risk paths: `auth`, `security`, `payment`, `migration`, `database`, `config`, CI/CD workflows, `.env*`, `Dockerfile`, `application.yml`, `package.json`, `pom.xml`, `build.gradle`
- Test signals: production code changed without tests, critical areas changed without tests, test files deleted
- Large-change signals: many changed files, large total line count, large single-file change
- Config/dependency/database/CI changes
- Sensitive keywords such as `token`, `secret`, `password`, `private_key`, `api_key`, `access_key`, `authorization`
- Public API signals such as exported TypeScript/JavaScript symbols, Java public methods, Spring route mappings, `/api/` and `/routes/` changes

Secret-looking values are redacted before report rendering. The report may mention the keyword, but it does not print the secret value.

## Configuration

Create `.change-evidence.yml` in your repository:

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

Invalid config values are ignored and fall back to defaults.

## Pre-commit Hook

Install the optional hook inside a git repository:

```bash
ce install-hook
```

The installer asks for:

- output language
- whether to install the hook
- hook mode
- trigger thresholds

It writes a managed `pre-commit` script to Git's effective hooks directory (including `core.hooksPath`) and persists your answers to `.change-evidence.yml`.

Hooks are repository-local. Installing the hook in one project does not affect other projects. If your IDE commits through normal git hooks, such as IntelliJ IDEA's default Git commit flow, the hook will run there too. Commits made with `--no-verify` or IDE settings that skip hooks will not trigger it.

Hook modes:

| Mode | Behavior |
|---|---|
| `off` | Do not run automatically |
| `report` | Print the report and allow the commit |
| `prompt` | Ask whether to continue when trigger rules match; abort if no interactive terminal is available |
| `block` | Block only when a high-risk trigger matches |

Trigger rules use both changed-file count and overall risk level. Existing pre-commit hooks not created by Change Evidence are preserved unless you pass `--force`.

Remove the hook from the current repository:

```bash
ce uninstall-hook
```

Uninstall is safe by default: it only removes hooks written by Change Evidence and preserves custom hooks.

## Update And Uninstall

Print only the installed version without accessing the network:

```bash
ce --version
```

Query npm for the latest version and show an upgrade reminder when needed:

```bash
ce version
# or
ce update --check
```

Version checks are explicit. Normal risk analysis and Git hooks never contact npm to check for updates.

Update the globally installed CLI through npm:

```bash
ce update
```

Uninstall from the current repository and then remove the global CLI:

```bash
ce uninstall
```

The command asks for confirmation, removes only the current repository's Change Evidence managed hook, preserves custom hooks, and then runs the global npm uninstall. In a non-interactive environment, it refuses to uninstall unless the impact is explicitly accepted:

```bash
ce uninstall --yes
```

Change Evidence cannot safely discover every repository on your machine. If you installed hooks in multiple repositories, remove those hooks before the final global uninstall:

```bash
cd /path/to/another/repository
ce uninstall-hook
```

The equivalent manual global command remains available:

```bash
npm uninstall -g change-evidence
```

## Privacy

Change Evidence risk analysis runs locally. It shells out to `git diff`, analyzes the output in process, and prints a terminal report. It does not send code, diffs, or secrets to a remote service. Only explicit package-management actions such as `ce version`, `ce update --check`, and `ce update` invoke npm and may access the configured npm registry.

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

For security reports, please read [SECURITY.md](SECURITY.md). Do not paste real secrets, credentials, or private code into public issues.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```

Useful local commands:

```bash
npm run dev -- --staged
node dist/cli/index.js --staged --no-color
```

## Author

Created by QCoding.

QCoding focuses on AI application development and Java engineering practice.

## License

MIT
