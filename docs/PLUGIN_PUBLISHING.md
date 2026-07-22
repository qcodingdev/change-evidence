# Plugin Publishing Guide

This guide starts from a verified source checkout and produces the exact
artifacts accepted by the Visual Studio Marketplace and JetBrains Marketplace.
Never commit marketplace tokens, signing certificates, private keys, or
passwords.

## Release Checklist

Both marketplace packages are version `0.1.0` and should be introduced as
**Public Preview**.

Before publishing either plugin:

1. Update the plugin version and its `CHANGELOG.md`.
2. Confirm `README.md`, `LICENSE`, `PRIVACY.md`, repository, issue tracker,
   vendor, and icon metadata.
3. Run the repository and plugin verification commands documented below.
4. Install the packaged artifact into a clean IDE and complete the smoke test.
5. Check that normal analysis performs no network requests.
6. Publish a pre-release first when changing commit interception behavior.

## Visual Studio Marketplace

### One-time account setup

1. Sign in to Azure DevOps with the Microsoft account that will own the
   extension.
2. Create the Visual Studio Marketplace publisher `qcodingdev` with display name
   `QCoding`. The `publisher` value in `plugins/vscode/package.json` must exactly match this publisher ID.
3. Configure Marketplace authentication. Microsoft has announced retirement of
   Azure DevOps global Personal Access Tokens on December 1, 2026, so prefer
   Microsoft Entra ID-based automated publishing for the long term. A scoped
   Marketplace PAT can still be used while supported.

### Build and inspect

```bash
npm ci
npm run typecheck
npm test
npm --prefix plugins/vscode ci
npm --prefix plugins/vscode run check
npm --prefix plugins/vscode run package
```

The final `.vsix` is written under `release-artifacts/` by the repository
release script. Install it before publishing:

```bash
code --install-extension release-artifacts/ai-change-radar-*.vsix
```

Smoke test:

1. Open a Git repository with staged changes.
2. Run `AI Change Radar: Analyze Staged Changes`.
3. Confirm the AI Change Radar view, Problems entries, and output report agree.
4. Run `AI Change Radar: Review & Commit`.
5. Confirm high-risk changes require an explicit continue action and cancelling
   leaves the index and working tree untouched.

### Publish

With `@vscode/vsce` authenticated for the publisher:

```bash
cd plugins/vscode
npx @vscode/vsce login qcodingdev
npx @vscode/vsce publish
```

To upload a prebuilt artifact instead:

```bash
npx @vscode/vsce publish --packagePath ../../release-artifacts/ai-change-radar-*.vsix
```

For a pre-release channel:

```bash
npx @vscode/vsce publish --pre-release
```

After publication, install the Marketplace build into a clean VS Code profile
and repeat the smoke test.

### Optional Open VSX publication

Create an Open VSX namespace and token, then:

```bash
cd plugins/vscode
npx ovsx publish ../../release-artifacts/ai-change-radar-*.vsix -p "$OVSX_PAT"
```

## JetBrains Marketplace

### One-time account setup

1. Sign in to JetBrains Marketplace.
2. Accept the Marketplace Developer Agreement.
3. Create the `QCoding` Vendor profile and complete the trader/non-trader
   declaration required for EEA consumer-protection compliance.
4. Create a permanent Marketplace token for automated publication.
5. For author-side signing, prepare a certificate chain, private key, and
   optional key password. Keep all signing material outside the repository.

### Build, test, and verify

Use JDK 21:

```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 21)
cd plugins/intellij
./gradlew clean test buildPlugin verifyPlugin
```

The distributable ZIP is produced by `buildPlugin` and copied to
`release-artifacts/` by the repository release script.

Install it before Marketplace upload:

1. Open IntelliJ IDEA.
2. Select **Settings / Preferences → Plugins**.
3. Choose **Install Plugin from Disk…**.
4. Select `release-artifacts/ai-change-radar-intellij-*.zip`.
5. Restart the IDE when requested.

Smoke test:

1. Open a Git project and modify a production file.
2. Use **Tools → AI Change Radar: Analyze Current Changes**.
3. Confirm the tool window shows the correct file and risk reasons.
4. Commit a medium/high-risk selected change.
5. Confirm the plugin offers explicit continue and cancel actions.
6. Cancel and verify that no file, changelist, staged entry, or commit was
   changed.

### Sign and publish

The Gradle build reads credentials only from environment variables:

```bash
export PUBLISH_TOKEN='perm:...'
export CERTIFICATE_CHAIN="$(cat /secure/path/chain.crt)"
export PRIVATE_KEY="$(cat /secure/path/private.pem)"
export PRIVATE_KEY_PASSWORD='...'

cd plugins/intellij
./gradlew clean test buildPlugin signPlugin verifyPluginSignature publishPlugin
```

For the first release, the ZIP can also be uploaded manually from the
JetBrains Marketplace account menu with **Upload plugin**. New plugins and
updates are reviewed by JetBrains before becoming public.

## Versioning

The CLI and IDE plugins use independent package versions but share compatible
analysis semantics:

- CLI/npm: `package.json`
- VS Code: `plugins/vscode/package.json`
- IntelliJ Platform: `plugins/intellij/gradle.properties`

Use semantic versioning. A breaking result-schema or configuration change
requires a major version increase once the project reaches `1.0.0`.

## Official References

- [Publishing VS Code extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [VS Code extension continuous integration](https://code.visualstudio.com/api/working-with-extensions/continuous-integration)
- [Uploading a JetBrains plugin](https://plugins.jetbrains.com/docs/marketplace/uploading-a-new-plugin.html)
- [JetBrains Marketplace approval guidelines](https://plugins.jetbrains.com/docs/marketplace/jetbrains-marketplace-approval-guidelines.html)
- [IntelliJ plugin signing](https://plugins.jetbrains.com/docs/intellij/plugin-signing.html)
