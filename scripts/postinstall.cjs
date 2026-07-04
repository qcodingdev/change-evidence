#!/usr/bin/env node

const message = `
Change Evidence installed.

Use it in any git repository:
  ce --staged

Enable the optional pre-commit hook per repository:
  cd /path/to/your/project
  ce install-hook

After the hook is installed, git commit and IDE commits that run git hooks will trigger Change Evidence automatically.
`;

console.log(message.trim());
