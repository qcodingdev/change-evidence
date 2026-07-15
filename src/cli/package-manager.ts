import { execa } from 'execa';
import type { Language } from '../shared/types.js';
import { uninstallHook } from '../hook/install-hook.js';
import { t } from '../render/i18n.js';

export const PACKAGE_NAME = 'change-evidence';

export type NpmRunner = (args: readonly string[]) => Promise<void>;

export interface PackageCommandIO {
  runNpm?: NpmRunner;
  write?: (message: string) => void;
  writeError?: (message: string) => void;
}

async function defaultRunNpm(args: readonly string[]): Promise<void> {
  await execa('npm', [...args], { stdio: 'inherit' });
}

/** Update the globally installed CLI through the package manager that owns it. */
export async function updateGlobalCli(
  language: Language,
  io: PackageCommandIO = {},
): Promise<void> {
  const runNpm = io.runNpm ?? defaultRunNpm;
  const write = io.write ?? ((message) => process.stdout.write(message + '\n'));

  write(t('package.updateStarting', language));
  await runNpm(['install', '--global', `${PACKAGE_NAME}@latest`]);
  write(t('package.updateComplete', language));
}

/**
 * Remove the managed hook in the current repository, then uninstall the
 * global CLI. Hooks in unrelated repositories cannot be discovered safely.
 */
export async function uninstallGlobalCli(
  repoRoot: string,
  language: Language,
  io: PackageCommandIO = {},
): Promise<void> {
  const runNpm = io.runNpm ?? defaultRunNpm;
  const write = io.write ?? ((message) => process.stdout.write(message + '\n'));
  const writeError = io.writeError ?? ((message) => process.stderr.write(message + '\n'));
  const hookResult = uninstallHook(repoRoot);

  if (hookResult.removed) {
    write(t('package.hookRemoved', language, { path: hookResult.hookPath }));
    if (hookResult.configPath) {
      write(t('package.hookConfigUpdated', language, { path: hookResult.configPath }));
    }
  } else if (hookResult.preserved) {
    writeError(t('package.customHookPreserved', language, { path: hookResult.hookPath }));
  } else {
    write(t('package.noManagedHook', language));
  }

  writeError(t('package.otherHooksWarning', language));
  write(t('package.uninstallStarting', language));
  await runNpm(['uninstall', '--global', PACKAGE_NAME]);
  write(t('package.uninstallComplete', language));
}
