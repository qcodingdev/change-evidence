import { execa } from 'execa';
import { lstat, readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import type { DiffResult, DiffScope, FileChange } from '../shared/types.js';
import {
  buildFileChanges,
  extractExtension,
  redactSecretsForKeywords,
} from './diff-parser.js';

/** Maximum untracked file size read into memory for patch analysis. */
export const MAX_UNTRACKED_PATCH_BYTES = 1024 * 1024;
/** Maximum combined untracked patch content retained by one analysis. */
export const MAX_TOTAL_UNTRACKED_PATCH_BYTES = 5 * 1024 * 1024;

/** Error thrown when git is not installed or not on PATH. */
export class GitUnavailableError extends Error {
  readonly code = 'GIT_UNAVAILABLE';

  constructor(message = 'git is not installed or not on PATH') {
    super(message);
    this.name = 'GitUnavailableError';
  }
}

/** Error thrown when the cwd is not inside a git repository. */
export class NotARepositoryError extends Error {
  readonly code = 'NOT_A_REPOSITORY';

  constructor(message = 'not a git repository') {
    super(message);
    this.name = 'NotARepositoryError';
  }
}

/** Error thrown when a requested branch/base revision does not exist. */
export class InvalidRevisionError extends Error {
  readonly code = 'INVALID_REVISION';

  constructor(message = 'unknown or invalid git revision') {
    super(message);
    this.name = 'InvalidRevisionError';
  }
}

export interface DiffSourceOptions {
  /** Working directory to run git in. Defaults to process.cwd(). */
  cwd?: string;
  /** Base ref for branch-diff scope (required when scope is "branch"). */
  base?: string;
  /** Sensitive keywords for patch redaction; falls back to parser defaults. */
  sensitiveKeywords?: string[];
  /**
   * Include untracked, non-ignored files in working-tree analysis.
   * Ignored for staged and branch scopes. Defaults to false for compatibility.
   */
  includeUntracked?: boolean;
  /**
   * Injection seam for tests: provide a custom git runner instead of execa.
   * Must accept (args, options) and return { stdout: string }.
   */
  gitRunner?: (args: string[], opts: { cwd: string }) => Promise<{ stdout: string }>;
}

/**
 * Build the git args for the three diff views (name-status, numstat,
 * unified=0) for the given scope.
 *
 * `format` is one of: "name-status", "numstat", "unified=0".
 */
function diffArgs(scope: DiffScope, base: string | undefined, format: string): string[] {
  const nulTerminated = format === 'name-status' || format === 'numstat';
  const formatArgs = [`--${format}`, ...(nulTerminated ? ['-z'] : [])];

  if (scope === 'staged') {
    return ['diff', '--cached', ...formatArgs];
  }

  if (scope === 'branch') {
    if (!base) {
      throw new InvalidRevisionError('branch scope requires a base ref (--base)');
    }
    return ['diff', `${base}...HEAD`, ...formatArgs];
  }

  // working-tree
  return ['diff', ...formatArgs];
}

/**
 * Classify an error from either execa or an injected gitRunner and translate
 * it into one of our domain errors.
 */
function classifyGitError(err: unknown): never {
  const e = err as { exitCode?: number; stderr?: string; message?: string; code?: string };

  // ENOENT-style: git binary not found (execa or injected runner).
  if (e.code === 'ENOENT') {
    throw new GitUnavailableError();
  }

  const stderr = e.stderr ?? e.message ?? '';
  const normalized = stderr.toLowerCase();

  // "not a git repository"
  if (
    normalized.includes('not a git repository') ||
    normalized.includes('fatal: not a git')
  ) {
    throw new NotARepositoryError();
  }

  // An invalid base must fail closed instead of looking like an empty diff.
  if (
    normalized.includes('unknown revision') ||
    normalized.includes('bad revision') ||
    normalized.includes('ambiguous argument') ||
    normalized.includes('needed a single revision')
  ) {
    throw new InvalidRevisionError(stderr.trim() || undefined);
  }

  throw err;
}

function parseNulPaths(raw: string): string[] {
  if (!raw) return [];
  return raw.split('\0').filter((path) => path.length > 0);
}

function isPathInside(root: string, candidate: string): boolean {
  return candidate === root || candidate.startsWith(root + sep);
}

function countTextLines(content: string): number {
  if (content.length === 0) return 0;
  const lines = content.split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines.length;
}

function untrackedPatch(content: string, lineCount: number): string {
  if (lineCount === 0) return '';
  const lines = content.split('\n');
  if (lines.at(-1) === '') lines.pop();
  return [
    `@@ -0,0 +1,${lineCount} @@`,
    ...lines.map((line) => `+${line}`),
  ].join('\n');
}

/**
 * Safely collect untracked working-tree files. Symlinks, binary files and
 * files over 1 MiB remain visible in the report but their contents are not
 * read into a patch.
 */
async function collectUntrackedFiles(
  rawPaths: string,
  cwd: string,
  sensitiveKeywords?: string[],
): Promise<import('../shared/types.js').FileChange[]> {
  const root = resolve(cwd);
  const results: FileChange[] = [];
  let retainedBytes = 0;

  // Deliberately process sequentially: an unbounded Promise.all can read many
  // 1 MiB files at once in repositories with generated, unignored output.
  for (const path of parseNulPaths(rawPaths)) {
    const absolutePath = resolve(root, path);
    if (!isPathInside(root, absolutePath)) continue;

    try {
      const stat = await lstat(absolutePath);
      if (!stat.isFile() || stat.isSymbolicLink()) {
        results.push({
          path,
          status: 'added' as const,
          additions: 0,
          deletions: 0,
          patch: '',
          extension: extractExtension(path),
        });
        continue;
      }

      if (
        stat.size > MAX_UNTRACKED_PATCH_BYTES ||
        retainedBytes + stat.size > MAX_TOTAL_UNTRACKED_PATCH_BYTES
      ) {
        results.push({
          path,
          status: 'added' as const,
          additions: 0,
          deletions: 0,
          patch: '',
          extension: extractExtension(path),
        });
        continue;
      }

      const data = await readFile(absolutePath);
      if (data.includes(0)) {
        results.push({
          path,
          status: 'added' as const,
          additions: 0,
          deletions: 0,
          patch: '',
          extension: extractExtension(path),
        });
        continue;
      }

      const content = data.toString('utf8');
      const additions = countTextLines(content);
      results.push({
        path,
        status: 'added' as const,
        additions,
        deletions: 0,
        patch: redactSecretsForKeywords(
          untrackedPatch(content, additions),
          sensitiveKeywords,
        ),
        extension: extractExtension(path),
      });
      retainedBytes += data.byteLength;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      // Files can disappear between `git ls-files` and `readFile`.
      if (code === 'ENOENT') continue;
      throw error;
    }
  }

  return results;
}

async function runGit(
  runner: DiffSourceOptions['gitRunner'],
  args: string[],
  cwd: string,
): Promise<string> {
  try {
    if (runner) {
      const result = await runner(args, { cwd });
      return result.stdout;
    }

    const result = await execa('git', args, { cwd, reject: true });
    return result.stdout;
  } catch (err) {
    return classifyGitError(err);
  }
}

/**
 * Wait for every Git subprocess before surfacing a failure. Promise.all would
 * reject immediately and leave sibling Git processes briefly running, which
 * can keep repository files locked on Windows.
 */
async function waitForGitOutputs(
  commands: Array<Promise<string>>,
): Promise<string[]> {
  const results = await Promise.allSettled(commands);
  const failure = results.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );
  if (failure) throw failure.reason;
  return results.map(
    (result) => (result as PromiseFulfilledResult<string>).value,
  );
}

/**
 * Collect the git diff for the requested scope and return a structured
 * DiffResult. Never throws for "no changes" — returns an empty result.
 *
 * @throws GitUnavailableError if git is not installed
 * @throws NotARepositoryError if cwd is not a git repo
 */
export async function getDiff(
  scope: DiffScope,
  options: DiffSourceOptions = {},
): Promise<DiffResult> {
  const cwd = options.cwd ?? process.cwd();
  const runner = options.gitRunner;

  const shouldIncludeUntracked =
    scope === 'working-tree' && options.includeUntracked === true;
  const [nameStatus, numstat, unified, untrackedPaths] = await waitForGitOutputs([
    runGit(runner, diffArgs(scope, options.base, 'name-status'), cwd),
    runGit(runner, diffArgs(scope, options.base, 'numstat'), cwd),
    runGit(runner, diffArgs(scope, options.base, 'unified=0'), cwd),
    shouldIncludeUntracked
      ? runGit(
          runner,
          ['ls-files', '--others', '--exclude-standard', '-z'],
          cwd,
        )
      : Promise.resolve(''),
  ]);

  const files = buildFileChanges(
    nameStatus,
    numstat,
    unified,
    options.sensitiveKeywords,
  );
  if (shouldIncludeUntracked && untrackedPaths) {
    const trackedPaths = new Set(files.map((file) => file.path));
    const untrackedFiles = await collectUntrackedFiles(
      untrackedPaths,
      cwd,
      options.sensitiveKeywords,
    );
    for (const file of untrackedFiles) {
      if (!trackedPaths.has(file.path)) files.push(file);
    }
  }

  const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
  const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);

  return { files, totalAdditions, totalDeletions };
}
