# JetBrains Marketplace Listing

## Product name

AI Change Radar

## Short description

Local risk checks for AI-assisted code changes.

## Vendor

QCoding

## Plugin ID

`dev.qcoding.aichangeradar`

## Suggested categories and tags

- Category: Code tools
- Tags: code review, VCS, Git, pre-commit, AI coding, security, quality

## Full description

AI Change Radar is a local pre-commit risk guard for AI-assisted and
human-written code changes.

Built for AI-assisted coding. Runs locally. No LLM required. No source code
upload. Powered by the open-source Change Evidence engine.

It reviews the exact files selected in the JetBrains Commit tool window and
surfaces explainable signals before the commit proceeds. Medium- and high-risk
reports require an explicit **Continue Commit** or **Cancel Commit** choice, so
the developer remains in control.

Use **Tools > AI Change Radar: Analyze Current Changes** to review the complete
working tree, including untracked text files. Results appear in a native tool
window with risk severity, file, line, rule, and reason. Double-click a finding
to navigate to the source location.

The first release detects:

- high-risk authentication, authorization, security, payment, credential,
  environment, and private-key paths;
- possible literal assignments to password, secret, token, and API-key fields;
- production changes without changed tests and deleted tests;
- dependency, configuration, migration, and CI/CD changes;
- large changesets and large individual files;
- possible public API changes in Java, Kotlin, Spring, JavaScript, TypeScript,
  and HTTP route code.

No account, Node.js installation, external CLI, cloud service, or AI API is
required. Source code and findings stay inside the IDE process. The plugin does
not automatically roll back, delete, stage, unstage, or rewrite files.

English and Simplified Chinese are selected automatically from the IDE locale.

## Marketplace links

- Source code: <https://github.com/qcodingdev/change-evidence>
- Issue tracker: <https://github.com/qcodingdev/change-evidence/issues>
- Privacy policy:
  <https://github.com/qcodingdev/change-evidence/blob/main/plugins/intellij/PRIVACY.md>
- License:
  <https://github.com/qcodingdev/change-evidence/blob/main/plugins/intellij/LICENSE>

## Assets

- Square icon: `artwork/change-evidence-icon-1024.png`
- README icon: `artwork/change-evidence-icon-256.png`
- IDE icon: `src/main/resources/icons/changeEvidence.svg`

Optional post-launch screenshots can show:

1. the AI Change Radar tool window with a mixed-risk report;
2. the medium/high commit confirmation with both choices visible;
3. the Simplified Chinese UI;
4. source navigation from a finding.

Do not include private repository names, source code, credentials, or personal
data in screenshots.
