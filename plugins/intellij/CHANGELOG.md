# AI Change Radar for JetBrains Changelog

## 0.1.0 Public Preview - 2026-07-22

### Added

- Native Kotlin analysis engine with no Node.js or external CLI dependency.
- Pre-commit analysis of the changes selected in the JetBrains commit UI.
- Explicit **Continue Commit** and **Cancel Commit** choices for medium- and high-risk reports.
- Manual analysis from **Tools > AI Change Radar: Analyze Current Changes**.
- AI Change Radar tool window with summary, individual findings, and source navigation.
- Deterministic checks for high-risk paths, sensitive literal assignments, missing tests,
  deleted tests, dependencies, configuration, migrations, CI/CD, change size, and public APIs.
- English and Simplified Chinese UI selected from the IDE locale.
- Gradle tasks for tests, plugin packaging, signing, publishing, and Plugin Verifier.
