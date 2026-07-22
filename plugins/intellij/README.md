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

## Install a local build

1. Build the distribution:

   ```bash
   cd plugins/intellij
   ./gradlew clean test verifyPluginProjectConfiguration buildPlugin
   ```

2. In the IDE, open
   **Settings/Preferences > Plugins > gear icon > Install Plugin from Disk**.
3. Select `build/distributions/ai-change-radar-intellij-0.1.0.zip`.
4. Restart the IDE if requested.

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

## Developer build and verification

Requirements:

- JDK 21 or newer.
- Gradle Wrapper included in this directory.

Run the full local verification:

```bash
./gradlew clean test verifyPluginProjectConfiguration verifyPluginStructure buildPlugin verifyPlugin
```

To build against a local IntelliJ IDEA installation instead of downloading the
configured platform:

```bash
./gradlew clean test buildPlugin \
  -PlocalIdeaPath="/Applications/IntelliJ IDEA.app"
```

## Sign and publish to JetBrains Marketplace

1. Create the `QCoding` publisher and the first plugin listing in
   [JetBrains Marketplace](https://plugins.jetbrains.com/).
2. Confirm that the listing uses plugin ID `dev.qcoding.aichangeradar`.
3. Create a Marketplace publishing token and a JetBrains plugin signing
   certificate.
4. Export the following values without committing them:

   ```bash
   export PUBLISH_TOKEN="..."
   export CERTIFICATE_CHAIN="-----BEGIN CERTIFICATE-----..."
   export PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."
   export PRIVATE_KEY_PASSWORD="..."
   ```

5. Verify and sign:

   ```bash
   ./gradlew clean test verifyPluginProjectConfiguration verifyPluginStructure verifyPlugin signPlugin
   ```

6. Publish the signed archive:

   ```bash
   ./gradlew publishPlugin
   ```

For the first release, JetBrains reviews the listing before it becomes public.
Keep the repository URL, issue tracker, license, screenshots, privacy statement,
and release notes complete in the Marketplace form.

## Privacy and security

Analysis is performed in the IDE process. No source text, file path, finding,
credential, telemetry, or account information is sent to a remote service by
this plugin.

Source: <https://github.com/qcodingdev/change-evidence>
Issues: <https://github.com/qcodingdev/change-evidence/issues>
License: [MIT](LICENSE)
