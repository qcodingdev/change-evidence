import { execa } from 'execa';
import type { DiffResult, DiffScope } from '../shared/types.js';
import { buildFileChanges } from './diff-parser.js';

/** Error thrown when git is not installed or not on PATH. */
export class GitUnavailableError extends Error {
  constructor(message = 'git is not installed or not on PATH') {
    super(message);
    this.name = 'GitUnavailableError';
  }
}

/** Error thrown when the cwd is not inside a git repository. */
export class NotARepositoryError extends Error {
  constructor(message = 'not a git repository') {
    super(message);
    this.name = 'NotARepositoryError';
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
  if (scope === 'staged') {
    return ['diff', '--cached', `--${format}`];
  }

  if (scope === 'branch') {
    if (!base) {
      throw new Error('branch scope requires a base ref (--base)');
    }
    return ['diff', `${base}...HEAD`, `--${format}`];
  }

  // working-tree
  return ['diff', `--${format}`];
}

/**
 * Classify an error from either execa or an injected gitRunner and translate
 * it into one of our domain errors, or return empty string for recoverable
 * cases (unknown revision).
 */
function classifyGitError(err: unknown): string | never {
  const e = err as { exitCode?: number; stderr?: string; message?: string; code?: string };

  // ENOENT-style: git binary not found (execa or injected runner).
  if (e.code === 'ENOENT') {
    throw new GitUnavailableError();
  }

  const stderr = e.stderr ?? '';

  // "not a git repository"
  if (stderr.includes('not a git repository') || stderr.includes('fatal: not a git')) {
    throw new NotARepositoryError();
  }

  // Unknown commit / bad ref — treat as empty diff.
  if (stderr.includes('unknown revision') || stderr.includes('bad revision')) {
    return '';
  }

  throw err;
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
    const handled = classifyGitError(err);
    return handled; // empty string for recoverable cases
  }
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

  const [nameStatus, numstat, unified] = await Promise.all([
    runGit(runner, diffArgs(scope, options.base, 'name-status'), cwd),
    runGit(runner, diffArgs(scope, options.base, 'numstat'), cwd),
    runGit(runner, diffArgs(scope, options.base, 'unified=0'), cwd),
  ]);

  const files = buildFileChanges(nameStatus, numstat, unified, options.sensitiveKeywords);

  const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
  const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);

  return { files, totalAdditions, totalDeletions };
}
