import { openSync } from 'node:fs';
import * as readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { ReadStream as TtyReadStream } from 'node:tty';
import type { Language } from '../shared/types.js';
import { t } from '../render/i18n.js';

export interface PromptSession {
  question(prompt: string): Promise<string>;
  close(): void;
}

export interface AskYesNoOptions {
  createSession?: () => PromptSession | null;
  writeError?: (message: string) => void;
  language?: Language;
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

  // A filesystem ReadStream performs blocking terminal reads in libuv's
  // thread pool, which can keep process.exit() waiting after the answer. A
  // native TTY stream is non-blocking and owns the descriptor lifecycle.
  const input = new TtyReadStream(fd);
  // Git hooks may not be the terminal's foreground process group, so raw-mode
  // setup can fail with EPERM. Line-oriented y/n input does not need raw mode.
  const rl = readline.createInterface({ input, output: stdout, terminal: false });
  let closed = false;

  return {
    question: (prompt) => rl.question(prompt),
    close: () => {
      if (closed) return;
      closed = true;
      rl.close();
      input.destroy();
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
  const language = options.language ?? 'zh-CN';
  let session: PromptSession | null;
  try {
    session = createSession();
  } catch {
    writeError(t('hook.openFailed', language) + '\n');
    return false;
  }

  if (!session) {
    writeError(t('hook.noTerminal', language) + '\n');
    return false;
  }

  try {
    while (true) {
      const answer = (await session.question(question)).trim().toLowerCase();
      if (answer === 'y' || answer === 'yes') return true;
      if (answer === '' || answer === 'n' || answer === 'no') return false;
      writeError(t('hook.answerYesNo', language) + '\n');
    }
  } catch {
    writeError(t('hook.readFailed', language) + '\n');
    return false;
  } finally {
    try {
      session.close();
    } catch {
      // Cleanup errors must not turn an explicit answer into a crash.
    }
  }
}
