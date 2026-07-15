# Changelog

All notable changes to Change Evidence will be documented in this file.

This project follows semantic versioning where practical.

## Unreleased

### Added

- Add `ce update` for npm-managed global updates.
- Add `ce version` and `ce update --check` for explicit latest-version queries and upgrade reminders.
- Add confirmed `ce uninstall` and non-interactive `ce uninstall --yes` flows that safely remove the current managed hook before uninstalling the global CLI.

## 0.1.1 - 2026-07-15

### Fixed

- Prevent prompt-mode hooks from silently allowing commits when confirmation is unavailable.
- Prevent controlling-terminal cleanup from failing an explicitly approved commit.
- Preserve special file names and rename statistics by parsing NUL-delimited Git output.
- Handle CRLF Git diff fixtures and file-URL paths correctly on Windows.
- Localize hook confirmation, blocking, and terminal-error messages.
- Respect linked worktrees and custom `core.hooksPath` locations when managing hooks.
- Reject invalid branch base revisions instead of reporting an empty diff.
- Keep risky-category and per-file severity consistent with the overall report.
- Build the CLI before running end-to-end tests so clean checkouts do not skip them.

### Added

- Run build, type-check, and test verification on Linux, macOS, and Windows in CI.

## 0.1.0

Initial public release.

### Added

- Local CLI commands: `ce` and `change-evidence`.
- Working tree, staged, and branch diff analysis.
- Deterministic risk signals for high-risk paths, tests, large changes, config/dependency/database/CI changes, sensitive keywords, and public API changes.
- Compact terminal report with Chinese and English output.
- Optional repository-local pre-commit hook.
- Hook install and uninstall commands.
