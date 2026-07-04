# Contributing

Thanks for your interest in contributing to Change Evidence.

Change Evidence is a local pre-commit risk summary CLI. It is not an AI reviewer, PR bot, auto-fixer, rollback tool, or governance platform. Please keep contributions aligned with that scope.

## Before You Start

- Open an issue first for larger behavior changes.
- Keep output concise. The report should help developers before commit without flooding the terminal.
- Prefer deterministic rules over LLM-dependent behavior.
- Avoid platform lock-in. The CLI should work with local git repositories and should not require GitHub, GitLab, or any hosted code platform.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```

Useful local commands:

```bash
npm run dev -- --staged
node dist/cli/index.js --staged --no-color
```

## Pull Requests

Before opening a pull request:

- Run `npm run typecheck`.
- Run `npm test`.
- Run `npm run build`.
- Update README or tests when behavior changes.
- Do not include generated local files, local editor config, credentials, or private project data.

## Security And Secrets

Do not paste real secrets, credentials, private diffs, or proprietary code into issues or pull requests. Use placeholders such as `***REDACTED***`.
