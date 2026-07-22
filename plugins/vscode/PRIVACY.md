# Privacy Policy

Last updated: 2026-07-20

AI Change Radar performs risk analysis inside the VS Code extension host. It
does not send source code, diffs, file names, findings, credentials, telemetry,
or account information to QCoding or any third party.

The extension:

- invokes the local `git` executable to read staged or working-tree changes;
- analyzes text in memory and does not persist source or diff content;
- makes no remote AI, analytics, advertising, or account requests;
- commits only when the user explicitly runs **Review & Commit** and confirms
  any reported high risk;
- never rewrites, deletes, rolls back, stages, or unstages user files.

VS Code, Git, and extension marketplaces may have independent privacy and
network behavior outside this extension.

Report security concerns through GitHub private vulnerability reporting when
available. Never include real secrets in a public issue.

Repository: <https://github.com/qcodingdev/change-evidence>
Issue tracker: <https://github.com/qcodingdev/change-evidence/issues>
