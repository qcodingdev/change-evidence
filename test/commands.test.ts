import { describe, it, expect } from 'vitest';
import { createProgram } from '../src/cli/commands.js';
import type { ResolvedOptions } from '../src/shared/types.js';

/**
 * Drive a program instance with the given argv and capture calls to the
 * injected analysis / installHook handlers.
 */
async function runProgram(
  argv: string[],
  opts: {
    runAnalysis?: (o: ResolvedOptions) => void;
    installHook?: () => void;
  } = {},
): Promise<{
  analysisCalls: ResolvedOptions[];
  hookCalls: number;
  stdout: string[];
}> {
  const analysisCalls: ResolvedOptions[] = [];
  const hookCalls = { count: 0 };
  const stdout: string[] = [];

  const program = createProgram({
    cwd: new URL('./fixtures', import.meta.url).pathname,
    runAnalysis: async (o) => {
      analysisCalls.push(o);
      opts.runAnalysis?.(o);
    },
    installHook: async () => {
      hookCalls.count += 1;
      opts.installHook?.();
    },
    exitProcess: false,
    stdout: {
      write: (s: string) => {
        stdout.push(s);
        return true;
      },
    } as NodeJS.WritableStream,
  });

  // commander mutates process.argv via parse; pass [node, script, ...args].
  await program.parseAsync(['node', 'ce', ...argv]);
  return { analysisCalls, hookCalls: hookCalls.count, stdout };
}

describe('createProgram CLI routing', () => {
  it('defaults to working-tree scope with no flags', async () => {
    const { analysisCalls } = await runProgram([]);
    expect(analysisCalls).toHaveLength(1);
    expect(analysisCalls[0].scope).toBe('working-tree');
    expect(analysisCalls[0].language).toBe('zh-CN');
    expect(analysisCalls[0].noColor).toBe(false);
  });

  it('honors --staged', async () => {
    const { analysisCalls } = await runProgram(['--staged']);
    expect(analysisCalls[0].scope).toBe('staged');
    expect(analysisCalls[0].base).toBeUndefined();
  });

  it('honors --base main', async () => {
    const { analysisCalls } = await runProgram(['--base', 'main']);
    expect(analysisCalls[0].scope).toBe('branch');
    expect(analysisCalls[0].base).toBe('main');
  });

  it('prioritizes --base over --staged', async () => {
    const { analysisCalls } = await runProgram(['--staged', '--base', 'dev']);
    expect(analysisCalls[0].scope).toBe('branch');
    expect(analysisCalls[0].base).toBe('dev');
  });

  it('passes --no-color through', async () => {
    const { analysisCalls } = await runProgram(['--no-color']);
    expect(analysisCalls[0].noColor).toBe(true);
  });

  it('applies --language and validates the choice', async () => {
    const en = await runProgram(['--language', 'en']);
    expect(en.analysisCalls[0].language).toBe('en');

    const zh = await runProgram(['--language', 'zh-CN']);
    expect(zh.analysisCalls[0].language).toBe('zh-CN');
  });

  it('rejects an invalid --language value', async () => {
    await expect(runProgram(['--language', 'fr'])).rejects.toThrow();
  });

  it('routes `ce install-hook` to the install handler', async () => {
    const { analysisCalls, hookCalls } = await runProgram(['install-hook']);
    expect(hookCalls).toBe(1);
    expect(analysisCalls).toHaveLength(0);
  });

  it('routes `ce hook install` to the install handler', async () => {
    const { analysisCalls, hookCalls } = await runProgram([
      'hook',
      'install',
    ]);
    expect(hookCalls).toBe(1);
    expect(analysisCalls).toHaveLength(0);
  });

  it('rejects unknown hook actions', async () => {
    const { hookCalls, stdout } = await runProgram(['hook', 'remove']);
    expect(hookCalls).toBe(0);
    expect(stdout.join('')).toContain('Unknown hook action');
  });

  it('passes the hook flag through to resolved options', async () => {
    const { analysisCalls } = await runProgram(['--staged', '--hook']);
    expect(analysisCalls[0].scope).toBe('staged');
    expect(analysisCalls[0].hookMode).toBe(true);
  });
});
