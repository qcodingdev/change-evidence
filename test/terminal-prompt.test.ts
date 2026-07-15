import { describe, expect, it, vi } from 'vitest';
import { askHookYesNo, type PromptSession } from '../src/cli/terminal-prompt.js';

function sessionWithAnswers(...answers: string[]): PromptSession {
  return {
    question: vi.fn(async () => answers.shift() ?? ''),
    close: vi.fn(),
  };
}

describe('askHookYesNo', () => {
  it.each(['y', 'Y', 'yes', 'YES'])('allows the commit for %s', async (answer) => {
    const session = sessionWithAnswers(answer);
    await expect(askHookYesNo('Continue? ', {
      createSession: () => session,
      language: 'en',
    })).resolves.toBe(true);
    expect(session.close).toHaveBeenCalledOnce();
  });

  it.each(['', 'n', 'N', 'no', 'NO'])('blocks the commit for %j', async (answer) => {
    const session = sessionWithAnswers(answer);
    await expect(askHookYesNo('Continue? ', {
      createSession: () => session,
      language: 'en',
    })).resolves.toBe(false);
    expect(session.close).toHaveBeenCalledOnce();
  });

  it('asks again after an invalid answer', async () => {
    const session = sessionWithAnswers('maybe', 'y');
    const writeError = vi.fn();
    await expect(askHookYesNo('Continue? ', {
      createSession: () => session,
      writeError,
      language: 'en',
    })).resolves.toBe(true);
    expect(session.question).toHaveBeenCalledTimes(2);
    expect(writeError).toHaveBeenCalledWith('Please answer y or n.\n');
  });

  it('fails closed when no interactive terminal is available', async () => {
    const writeError = vi.fn();
    await expect(askHookYesNo('Continue? ', {
      createSession: () => null,
      writeError,
      language: 'en',
    })).resolves.toBe(false);
    expect(writeError).toHaveBeenCalledWith(
      expect.stringContaining('commit aborted'),
    );
  });

  it('fails closed when opening the prompt throws', async () => {
    const writeError = vi.fn();
    await expect(askHookYesNo('Continue? ', {
      createSession: () => { throw new Error('open failed'); },
      writeError,
      language: 'en',
    })).resolves.toBe(false);
    expect(writeError).toHaveBeenCalledWith(
      expect.stringContaining('commit aborted'),
    );
  });

  it('fails closed when reading the answer throws', async () => {
    const session: PromptSession = {
      question: vi.fn(async () => { throw new Error('closed'); }),
      close: vi.fn(),
    };
    const writeError = vi.fn();
    await expect(askHookYesNo('Continue? ', {
      createSession: () => session,
      writeError,
      language: 'en',
    })).resolves.toBe(false);
    expect(session.close).toHaveBeenCalledOnce();
    expect(writeError).toHaveBeenCalledWith(
      expect.stringContaining('commit aborted'),
    );
  });

  it('preserves the answer when closing the prompt throws', async () => {
    const session = sessionWithAnswers('y');
    session.close = vi.fn(() => { throw new Error('close failed'); });
    await expect(askHookYesNo('Continue? ', {
      createSession: () => session,
    })).resolves.toBe(true);
  });

  it('localizes prompt errors in Chinese', async () => {
    const writeError = vi.fn();
    await expect(askHookYesNo('继续？', {
      createSession: () => null,
      writeError,
      language: 'zh-CN',
    })).resolves.toBe(false);
    expect(writeError).toHaveBeenCalledWith(
      expect.stringContaining('没有可交互终端'),
    );
  });
});
