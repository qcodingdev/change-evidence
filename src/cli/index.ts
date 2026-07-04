#!/usr/bin/env node

/**
 * Entry point shared by both `change-evidence` and `ce` (see package.json bin).
 */

import { CommanderError } from 'commander';
import { createProgram, handleCommanderError } from './commands.js';

const program = createProgram();

program.parseAsync(process.argv).catch((err: unknown) => {
  if (err instanceof CommanderError) {
    handleCommanderError(err);
    return; // unreachable — handleCommanderError calls process.exit
  }
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`change-evidence: ${msg}\n`);
  process.exit(1);
});
