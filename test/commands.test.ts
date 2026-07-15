import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { CommanderError } from 'commander';
import { createProgram, handleCommanderError } from '../src/cli/commands.js';
import type { ChangeEvidenceConfig, ResolvedOptions } from '../src/shared/types.js';

/**
 * Drive a program instance with the given argv and capture calls to the
 * injected analysis / installHook handlers.
 */
async function runProgram(
  argv: string[],
): Promise<{
  analysisCalls: ResolvedOptions[];
  hookCalls: Array<{
    config: ChangeEvidenceConfig;
    interactive: boolean;
    force?: boolean;
  }>;
  uninstallCalls: ChangeEvidenceConfig[];
  updateCalls: Array<{ config: ChangeEvidenceConfig; check: boolean }>;
  packageUninstallCalls: Array<{ config: ChangeEvidenceConfig; yes: boolean }>;
  stdout: string[];
}> {
  const analysisCalls: ResolvedOptions[] = [];
  const hookCalls: Array<{
    config: ChangeEvidenceConfig;
    interactive: boolean;
    force?: boolean;
  }> = [];
  const uninstallCalls: ChangeEvidenceConfig[] = [];
  const updateCalls: Array<{
    config: ChangeEvidenceConfig;
    check: boolean;
  }> = [];
  const packageUninstallCalls: Array<{
    config: ChangeEvidenceConfig;
    yes: boolean;
  }> = [];
  const stdout: string[] = [];

  const program = createProgram({
    cwd: fileURLToPath(new URL('./fixtures', import.meta.url)),
    runAnalysis: async (o) => {
      analysisCalls.push(o);
    },
    installHook: async (options) => {
      hookCalls.push(options);
    },
    uninstallHook: async (options) => {
      uninstallCalls.push(options.config);
    },
    updateCli: async (options) => {
      updateCalls.push(options);
    },
    uninstallCli: async (options) => {
      packageUninstallCalls.push(options);
    },
    stdout: {
      write: (s: string) => {
        stdout.push(s);
        return true;
      },
    } as NodeJS.WritableStream,
  });

  await program.parseAsync(['node', 'ce', ...argv]);
  return {
    analysisCalls,
    hookCalls,
    uninstallCalls,
    updateCalls,
    packageUninstallCalls,
    stdout,
  };
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
    await expect(runProgram(['--language', 'fr'])).rejects.toThrow(
      CommanderError,
    );
  });

  it('routes `ce install-hook` to the install handler', async () => {
    const { analysisCalls, hookCalls } = await runProgram(['install-hook']);
    expect(hookCalls).toHaveLength(1);
    expect(analysisCalls).toHaveLength(0);
  });

  it('routes `ce hook install` to the install handler', async () => {
    const { analysisCalls, hookCalls } = await runProgram([
      'hook',
      'install',
    ]);
    expect(hookCalls).toHaveLength(1);
    expect(analysisCalls).toHaveLength(0);
  });

  it('routes `ce uninstall-hook` to the uninstall handler', async () => {
    const { analysisCalls, uninstallCalls } = await runProgram(['uninstall-hook']);
    expect(uninstallCalls).toHaveLength(1);
    expect(analysisCalls).toHaveLength(0);
  });

  it('routes `ce hook uninstall` to the uninstall handler', async () => {
    const { analysisCalls, uninstallCalls } = await runProgram([
      'hook',
      'uninstall',
    ]);
    expect(uninstallCalls).toHaveLength(1);
    expect(analysisCalls).toHaveLength(0);
  });

  it('routes `ce update` to the global update handler', async () => {
    const { analysisCalls, updateCalls } = await runProgram(['update']);
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].check).toBe(false);
    expect(analysisCalls).toHaveLength(0);
  });

  it('routes `ce update --check` to version checking without installing', async () => {
    const { updateCalls } = await runProgram(['update', '--check']);
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].check).toBe(true);
  });

  it('routes `ce version` to the remote version query', async () => {
    const { updateCalls } = await runProgram(['version']);
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].check).toBe(true);
  });

  it('routes `ce uninstall` to the global uninstall handler', async () => {
    const { analysisCalls, packageUninstallCalls } = await runProgram(['uninstall']);
    expect(packageUninstallCalls).toHaveLength(1);
    expect(packageUninstallCalls[0].yes).toBe(false);
    expect(analysisCalls).toHaveLength(0);
  });

  it('passes --yes through global uninstall', async () => {
    const { packageUninstallCalls } = await runProgram(['uninstall', '--yes']);
    expect(packageUninstallCalls[0].yes).toBe(true);
  });

  it('passes --force through install-hook', async () => {
    const { hookCalls } = await runProgram(['install-hook', '--force']);
    expect(hookCalls[0].force).toBe(true);
  });

  it('passes --force through hook install', async () => {
    const { hookCalls } = await runProgram(['hook', 'install', '--force']);
    expect(hookCalls[0].force).toBe(true);
  });

  it('rejects unknown hook actions', async () => {
    const err = await runProgram(['hook', 'remove']).catch((e) => e);
    expect(err).toBeInstanceOf(CommanderError);
    expect((err as CommanderError).message).toContain('Unknown hook action');
    expect((err as CommanderError).message).toContain('uninstall');
  });

  it('passes the hook flag through to resolved options', async () => {
    const { analysisCalls } = await runProgram(['--staged', '--hook']);
    expect(analysisCalls[0].scope).toBe('staged');
    expect(analysisCalls[0].hookMode).toBe(true);
  });

  it('rejects unknown positional arguments', async () => {
    await expect(runProgram(['foo'])).rejects.toThrow(CommanderError);
  });

  it('rejects misspelled flags like --statged', async () => {
    await expect(runProgram(['--statged'])).rejects.toThrow(CommanderError);
  });

  it('supports --version', async () => {
    const err = await runProgram(['--version']).catch((e) => e);
    expect(err).toBeInstanceOf(CommanderError);
    expect((err as CommanderError).code).toBe('commander.version');
    expect((err as CommanderError).exitCode).toBe(0);
  });
});

describe('handleCommanderError', () => {
  function makeError(code: string, exitCode: number, message = 'test'): CommanderError {
    return new CommanderError(exitCode, code, message);
  }

  it('exits 0 for help display', () => {
    const err = makeError('commander.helpDisplayed', 0);
    // vitest intercepts process.exit as an error with the exit code.
    expect(() => handleCommanderError(err)).toThrow('0');
  });

  it('exits 0 for commander.help', () => {
    const err = makeError('commander.help', 0);
    expect(() => handleCommanderError(err)).toThrow('0');
  });

  it('exits 1 for unknown option errors', () => {
    const err = makeError('commander.unknownOption', 1);
    expect(() => handleCommanderError(err)).toThrow('1');
  });
});
