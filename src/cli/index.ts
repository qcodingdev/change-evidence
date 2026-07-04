#!/usr/bin/env node

/**
 * Entry point shared by both `change-evidence` and `ce` (see package.json bin).
 *
 * Prompt 01 scope: only CLI + config wiring. The analysis and hook
 * implementations are injected as no-ops until their respective prompts land.
 */

import { createProgram } from './commands.js';

const program = createProgram();

program.parseAsync(process.argv).catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`change-evidence: ${msg}\n`);
  process.exit(1);
});
