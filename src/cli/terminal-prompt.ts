import { closeSync, createReadStream, openSync } from 'node:fs';
import * as readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

export interface PromptSession {
  question(prompt: string): Promise<string>;
  close(): void;
}

export interface AskYesNoOptions {
  createSession?: () => PromptSession | null;
  writeError?: (message: string) => void;
}

/**
 * Git hooks do not reliably inherit an interactive stdin, even when `git
 * commit` was started from a terminal. Prefer stdin when it is interactive,
 * then try the controlling terminal directly.
 */
export function createHookPromptSession(): PromptSession | null {
  if (stdin.isTTY) {
    return readline.createInterface({ input: stdin, output: stdout });
  }

  const terminalPath = process.platform === 'win32' ? 'CONIN$' : '/dev/tty';
  let fd: number;
  try {
    fd = openSync(terminalPath, 'r');
  } catch {
    return null;
  }

  const input = createReadStream(terminalPath, { fd, autoClose: false });
  const rl = readline.createInterface({ input, output: stdout });
  let closed = false;

  return {
    question: (prompt) => rl.question(prompt),
    close: () => {
      if (closed) return;
      closed = true;
      rl.close();
      input.destroy();
      try {
        closeSync(fd);
      } catch {
        // The prompt is complete; cleanup must not change its answer.
      }
    },
  };
}

/**
 * Ask whether a triggered commit may continue. This path is deliberately
 * fail-closed: if no terminal is available, or the prompt fails, the commit
 * is rejected instead of being silently allowed.
 */
export async function askHookYesNo(
  question: string,
  options: AskYesNoOptions = {},
): Promise<boolean> {
  const createSession = options.createSession ?? createHookPromptSession;
  const writeError = options.writeError ??
    ((message) => process.stderr.write(message));
  let session: PromptSession | null;
  try {
    session = createSession();
  } catch {
    writeError(
      'change-evidence: unable to open confirmation prompt; commit aborted.\n',
    );
    return false;
  }

  if (!session) {
    writeError(
      'change-evidence: no interactive terminal is available; commit aborted.\n',
    );
    return false;
  }

  try {
    while (true) {
      const answer = (await session.question(question)).trim().toLowerCase();
      if (answer === 'y' || answer === 'yes') return true;
      if (answer === '' || answer === 'n' || answer === 'no') return false;
      writeError('Please answer y or n.\n');
    }
  } catch {
    writeError('change-evidence: unable to read confirmation; commit aborted.\n');
    return false;
  } finally {
    try {
      session.close();
    } catch {
      // Cleanup errors must not turn an explicit answer into a crash.
    }
  }
}
