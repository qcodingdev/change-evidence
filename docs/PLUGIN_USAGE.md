# IDE Plugin Usage

AI Change Radar is available as a VS Code extension and a native JetBrains plugin.
Both are powered by the open-source Change Evidence engine. All three surfaces use
deterministic local rules and do not require
an account, API key, cloud service, or remote AI model.

## VS Code

### Install

Open **Extensions**, search for **AI Change Radar** by **QCoding**, and select
**Install**. The extension includes the analysis engine and does not require a
global `ce` or Node.js installation.

For manual or offline installation, download the `.vsix` from the
[latest GitHub Release](https://github.com/qcodingdev/change-evidence/releases/latest)
and use **Extensions: Install from VSIX…**. Command-line
installation is also available:

```bash
code --install-extension ai-change-radar-0.1.0.vsix
```

### Analyze changes

1. Open a trusted Git workspace.
2. Select the AI Change Radar shield in the Activity Bar.
3. Choose **Analyze Working Tree** or **Analyze Staged Changes**.
4. Review the result in the AI Change Radar tree, Problems panel, and AI Change Radar
   output channel.
5. Select a file-level finding to open that file.

Working-tree analysis includes untracked, non-ignored files by default. Disable
this with `aiChangeRadar.includeUntracked` if needed.

### Review and commit

Use **AI Change Radar: Review & Commit** from Source Control or the Command
Palette. The extension analyzes the staged diff, asks for explicit confirmation
when the result is high risk, collects the commit message, and verifies that the
staged diff has not changed since analysis before committing through VS Code's
built-in Git extension.

If the staged diff changes after review, the commit is cancelled and must be
reviewed again.

VS Code does not expose a universal interception API for every possible commit
command. Use the repository-local Change Evidence engine Git hook if every Git
client must be covered.

## IntelliJ IDEA and compatible JetBrains IDEs

### Install

1. Open **Settings / Preferences → Plugins → Marketplace**.
2. Search for **AI Change Radar** by **QCoding**.
3. Select **Install** and restart the IDE if requested.

For manual or offline installation, download the plugin `.zip` from the
[latest GitHub Release](https://github.com/qcodingdev/change-evidence/releases/latest)
and choose **Install Plugin from Disk…** from the Plugins gear
menu. Users do not need JDK, Node.js, or an external CLI.

### Analyze changes

Choose **Tools → AI Change Radar: Analyze Current Changes**. The native tool
window shows the overall risk, file and line, rule, and localized reason.
Double-click a finding to navigate to the relevant file.

### Commit protection

During a normal IDE commit, AI Change Radar analyzes exactly the changes
selected in the Commit tool window:

- clean or low-risk selections continue normally;
- medium- or high-risk selections require **Continue Commit** or
  **Cancel Commit**;
- cancelling returns to the commit UI without staging, unstaging, deleting,
  reverting, or rewriting any file.

The first release intentionally performs no automatic rollback. This keeps the
plugin safe for repositories that also contain concurrent IDE, user, or coding
agent edits.

## What is checked

- authentication, authorization, security, payment, credential, and private-key
  paths;
- possible literal assignments to secret-, token-, password-, or API-key-like
  fields;
- deleted tests and production changes without test changes;
- dependency, runtime configuration, migration, and CI/CD changes;
- unusually large changesets and large single-file changes;
- likely public API changes.

AI Change Radar is a fast risk signal layer, not a compiler, full static
analyzer, secret scanner, or substitute for tests and human review.

## Privacy

Normal IDE analysis does not make network requests. Source code, diffs,
repository metadata, file names, and results remain local. See
[PRIVACY.md](../PRIVACY.md) for the complete statement.
