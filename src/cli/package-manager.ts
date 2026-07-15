import { execa } from 'execa';
import type { Language } from '../shared/types.js';
import { uninstallHook } from '../hook/install-hook.js';
import { t } from '../render/i18n.js';

export const PACKAGE_NAME = 'change-evidence';

export type NpmRunner = (args: readonly string[]) => Promise<void>;
export type LatestVersionReader = () => Promise<string>;

export interface PackageCommandIO {
  runNpm?: NpmRunner;
  readLatestVersion?: LatestVersionReader;
  write?: (message: string) => void;
  writeError?: (message: string) => void;
}

async function defaultRunNpm(args: readonly string[]): Promise<void> {
  await execa('npm', [...args], { stdio: 'inherit' });
}

async function defaultReadLatestVersion(): Promise<string> {
  const { stdout } = await execa(
    'npm',
    ['view', `${PACKAGE_NAME}@latest`, 'version', '--json'],
  );
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    parsed = stdout.trim();
  }
  if (typeof parsed !== 'string' || parsed.trim() === '') {
    throw new Error('npm returned an invalid latest version');
  }
  return parsed.trim();
}

interface ParsedVersion {
  core: [number, number, number];
  prerelease: string[];
}

function parseVersion(value: string): ParsedVersion | undefined {
  const match = value.trim().match(
    /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/,
  );
  if (!match) return undefined;
  return {
    core: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4]?.split('.') ?? [],
  };
}

/** Compare two semantic versions: positive when left is newer than right. */
export function compareVersions(left: string, right: string): number | undefined {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) return undefined;

  for (let i = 0; i < a.core.length; i++) {
    if (a.core[i] !== b.core[i]) return a.core[i] - b.core[i];
  }

  if (a.prerelease.length === 0 && b.prerelease.length === 0) return 0;
  if (a.prerelease.length === 0) return 1;
  if (b.prerelease.length === 0) return -1;

  const count = Math.max(a.prerelease.length, b.prerelease.length);
  for (let i = 0; i < count; i++) {
    const leftPart = a.prerelease[i];
    const rightPart = b.prerelease[i];
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    if (leftPart === rightPart) continue;

    const leftNumeric = /^\d+$/.test(leftPart);
    const rightNumeric = /^\d+$/.test(rightPart);
    if (leftNumeric && rightNumeric) return Number(leftPart) - Number(rightPart);
    if (leftNumeric) return -1;
    if (rightNumeric) return 1;
    return leftPart < rightPart ? -1 : 1;
  }
  return 0;
}

/** Query npm and print the current/latest version plus an upgrade reminder. */
export async function checkGlobalCliVersion(
  currentVersion: string,
  language: Language,
  io: PackageCommandIO = {},
): Promise<void> {
  const readLatestVersion = io.readLatestVersion ?? defaultReadLatestVersion;
  const write = io.write ?? ((message) => process.stdout.write(message + '\n'));
  const latestVersion = await readLatestVersion();
  const comparison = compareVersions(latestVersion, currentVersion);

  write(t('package.versionCurrent', language, { version: currentVersion }));
  write(t('package.versionLatest', language, { version: latestVersion }));
  if (comparison === undefined) {
    write(t('package.versionUnknown', language));
  } else if (comparison > 0) {
    write(t('package.updateAvailable', language, { version: latestVersion }));
  } else if (comparison === 0) {
    write(t('package.upToDate', language));
  } else {
    write(t('package.versionAhead', language));
  }
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
