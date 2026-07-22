# Privacy Policy

Last updated: 2026-07-20

AI Change Radar - Local AI Change Guard for JetBrains IDEs performs its analysis
inside the local IDE process.

The plugin does not:

- send source code, diffs, file names, findings, credentials, or telemetry to
  QCoding or another service;
- create an account or collect identity, usage, analytics, advertising, or
  payment data;
- connect to an AI model or cloud API;
- write to, delete, roll back, stage, or unstage project files.

The plugin reads only the local changes supplied by the IntelliJ Platform VCS
API when the user starts an analysis or begins a commit. Text content is
analyzed in memory and is not persisted by the plugin. Binary files and text
files larger than 2 MiB are not loaded for content analysis; path-only checks
still apply.

The JetBrains IDE and installed VCS integrations may have their own privacy
policies and network behavior, which are outside this plugin.

Security reports should use GitHub private vulnerability reporting when
available. Do not include real secrets in public issues.

Repository: <https://github.com/qcodingdev/change-evidence>
Issue tracker: <https://github.com/qcodingdev/change-evidence/issues>
