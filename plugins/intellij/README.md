# AI Change Radar

![AI Change Radar](artwork/change-evidence-icon-256.png)

**Local risk checks for AI-assisted code changes.**

Built for AI-assisted coding. Runs locally. No LLM required. No source code
upload.

AI Change Radar reviews AI-assisted and human-written code changes before they
are committed. The plugin is local, deterministic, explainable, and does not
require an account, cloud service, Node.js installation, or the Change Evidence
CLI. Powered by the open-source Change Evidence engine.

## What the first release does

- Analyzes the exact changes selected in the JetBrains Commit tool window.
- Requires an explicit **Continue Commit** or **Cancel Commit** choice when the
  overall risk is medium or high.
- Analyzes all current versioned and untracked files from
  **Tools > AI Change Radar: Analyze Current Changes**.
- Shows the report in a native **AI Change Radar** tool window.
- Opens a file at the relevant line when a finding is double-clicked.
- Automatically uses English or Simplified Chinese based on the IDE locale.
- Never uploads code and never performs automatic rollback or file deletion.

## Checks

| Check | Default risk |
|---|---|
| Authentication, authorization, security, payment, credential, `.env`, private-key paths | High |
| Possible literal assignment to password, secret, token, or API-key fields | High |
| Database migrations | High |
| Deleted tests | High |
| Production changes without any changed test | Medium |
| Dependency manifests and lockfiles | Medium |
| Runtime/build configuration and CI/CD definitions | Medium |
| Large changesets and large single-file changes | Medium or High |
| Possible Java, Kotlin, Spring, JavaScript, TypeScript, or HTTP public API changes | Medium |

Sensitive values are never included in findings. The plugin only reports the
matched field name, file, and line.

## Compatibility

- IntelliJ Platform build `261` or later.
- Built and verified against IntelliJ IDEA `2026.1.4`.
- Uses only the IntelliJ Platform and VCS modules, so the packaged plugin can be
  installed in compatible JetBrains IDEs that provide VCS support.

## Install

1. Open **Settings / Preferences > Plugins > Marketplace**.
2. Search for **AI Change Radar** by **QCoding**.
3. Select **Install** and restart the IDE if requested.

For manual or offline installation, download the plugin `.zip` from the
[latest GitHub Release](https://github.com/qcodingdev/change-evidence/releases/latest),
then choose **Install Plugin from Disk** from the Plugins gear
menu. No JDK, Node.js, or external CLI installation is required.

## Use it

To review the working tree at any time, choose
**Tools > AI Change Radar: Analyze Current Changes**. Review the summary and
individual findings in the bottom **AI Change Radar** tool window. Double-click
a finding to open its file at the detected line.

During a normal commit, the plugin analyzes only the files selected in the
Commit tool window. Low-risk or clean changes continue normally. Medium- and
high-risk changes show a confirmation dialog:

- **Continue Commit** allows this commit to proceed.
- **Cancel Commit** returns to the commit UI without changing any file.

The plugin does not automatically roll back, delete, stage, unstage, or rewrite
changes.

## Privacy and security

Analysis is performed in the IDE process. No source text, file path, finding,
credential, telemetry, or account information is sent to a remote service by
this plugin.

- Source: <https://github.com/qcodingdev/change-evidence>
- Issues: <https://github.com/qcodingdev/change-evidence/issues>
- License: [MIT](LICENSE)
