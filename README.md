# Change Evidence

English | [简体中文](README.zh-CN.md)

Understand risky code changes before you commit.

Change Evidence is a local CLI that generates a concise risk report for your uncommitted code changes. It is especially useful after AI coding tools such as Claude Code, Codex, Cursor, OpenCode, Trae, or Qoder modify many files and you want to understand what changed before committing.

It is not an AI code reviewer. It does not fix code, revert changes, approve commits, or manage pull requests. It only summarizes changed files, risk signals, missing tests, and commit-time checklist items.

## What It Does

Run it before commit with the full command or the short alias:

```bash
change-evidence --staged
ce --staged
```

`ce` is the short daily command for terminals, IDE tasks, and hooks.

It reports:

- changed file summary
- production vs test file ratio
- high-risk paths such as auth, security, payment, config, migration, CI/CD
- large change signals
- missing test signals
- sensitive keyword signals without printing secret values
- pre-commit checklist
- collapsed low-risk changes

## Main Use Case

```text
AI coding tool changes many files
  -> developer stages changes
  -> Change Evidence prints a risk report
  -> developer decides whether to commit, add tests, split changes, or inspect risky files
```

## Optional Git Hook

The first version treats pre-commit hook support as a core workflow, but setup must ask users how it should trigger.

Recommended usage: install the hook and let it automatically print a report when many files changed or the risk level reaches the configured threshold.

Install commands:

```bash
change-evidence install-hook
ce hook install
```

During setup, users can choose whether to install the hook and how it should trigger:

```yaml
hook:
  enabled: true
  mode: prompt
  trigger:
    minChangedFiles: 10
    minRiskLevel: medium
```

Hook modes:

- `off`: never run automatically
- `report`: print a report and continue
- `prompt`: ask whether to continue when trigger rules match
- `block`: block only when explicit high-risk rules match, not recommended as default

The setup should recommend hook installation, but it must not silently force it. Users should explicitly choose the trigger mode and threshold, such as automatically reporting when more than 10 files changed.

## Output Style

The first version uses one unified terminal report format with clean layout and colors. It does not provide many output templates in v1.

Future wrappers can reuse the same report core for:

- IDE commands
- pre-commit hook
- GitHub Action
- GitLab CI
- local markdown export

## Boundary

Change Evidence only reports evidence and risk signals.

It does not:

- review code correctness
- auto-fix code
- run `git reset`
- run `git revert`
- create rollback PRs
- approve or reject commits
- upload code by default
