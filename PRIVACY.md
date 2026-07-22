# Privacy Policy

Last updated: July 20, 2026

Change Evidence is a local code-change risk analysis tool.

## Data Processing

The Change Evidence CLI, Visual Studio Code extension, and IntelliJ Platform
plugin analyze Git working-tree or staged changes on the user's device. They do
not upload source code, diffs, file contents, repository metadata, credentials,
or analysis results to Change Evidence or any third-party service.

## Network Access

Normal analysis does not require network access.

- The CLI accesses the npm registry only when the user explicitly runs a
  version-check or update command.
- The IDE plugins do not include analytics, advertising, account login, or
  remote AI requests.
- The IDE or plugin marketplace may independently check for extension updates
  according to the user's IDE settings and the marketplace's own policies.

## Local Storage

Change Evidence may read `.change-evidence.yml` from the current repository.
The IDE plugins may store non-sensitive presentation preferences using the
standard local settings storage provided by the host IDE. No source code or
diff content is persisted by Change Evidence.

## Sensitive Information

The analyzer can flag sensitive-looking keywords. Secret-looking values are
redacted before terminal or IDE rendering. This heuristic is not a replacement
for a dedicated secret scanner.

## Contact

Report privacy or security concerns through GitHub private vulnerability
reporting for the
[qcodingdev/change-evidence](https://github.com/qcodingdev/change-evidence)
repository. If private reporting is unavailable, open a minimal issue without
including source code, secrets, private diffs, or sensitive logs.
