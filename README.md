# Change Evidence

English | [简体中文](README.zh-CN.md)

[![CI](https://github.com/qcodingdev/change-evidence/actions/workflows/ci.yml/badge.svg)](https://github.com/qcodingdev/change-evidence/actions/workflows/ci.yml)

<p align="center">
  <b>Spot code risks in 3 seconds before you commit</b><br>
  Pre-commit risk summaries for AI-assisted code changes
</p>

![Change Evidence terminal demo](assets/change-evidence-demo.gif)

Change Evidence is a local, CLI-first tool that summarizes risky parts of your uncommitted code changes before you commit. It is designed for the moment after AI coding tools modify many files and you want a short, deterministic report: what changed, where the risk signals are, and what to check before committing.

It is not an AI code reviewer. It does not judge code correctness, fix code, revert changes, approve commits, open pull requests, or upload your code. It only reads local git diffs and prints a concise terminal report.

## Why Change Evidence?
You just used Cursor / Claude Code / Copilot to generate 20 files. You're about to git commit — but did any secrets slip in? Are tests missing? Did production config change?

Change Evidence prints a concise risk report before every commit, helping you catch:

🔑 Secrets — tokens, passwords, API keys accidentally committed

🧪 Missing tests — production code changed without test coverage

📦 Config drift — dependency or infrastructure changes unchecked

🚨 High-risk paths — unexpected changes to auth, payment, or database code

Not an AI reviewer. No network calls. No code upload. — It only reads local git diff and prints a terminal report.

## Install

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

To uninstall the global CLI package:

```bash
npm uninstall -g change-evidence
```

## Privacy

Change Evidence runs locally. It shells out to `git diff`, analyzes the output in process, and prints a terminal report. It does not send code, diffs, or secrets to a remote service.

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
