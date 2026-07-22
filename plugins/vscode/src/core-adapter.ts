import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { promisify } from 'node:util';
import {
  tryAnalyzeRepository,
  type AnalysisError,
  type DiffScope,
  type RiskReport,
} from '../../../src/api/index.js';

const execFileAsync = promisify(execFile);

export type CoreAnalysisOutcome =
  | {
      ok: true;
      report: RiskReport;
      repositoryRoot: string;
      stagedFingerprint?: string;
    }
  | { ok: false; error: AnalysisError };

export async function analyzeWorkspace(
  cwd: string,
  scope: DiffScope,
  includeUntracked: boolean,
): Promise<CoreAnalysisOutcome> {
  let repositoryRoot: string;
  try {
    repositoryRoot = await resolveRepositoryRoot(cwd);
  } catch (error) {
    return {
      ok: false,
      error: fingerprintAnalysisError(error),
    };
  }

  let stagedBefore: string | undefined;
  let report: RiskReport | undefined;
  let stagedAfter: string | undefined;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      stagedBefore =
        scope === 'staged'
          ? await stagedDiffFingerprint(repositoryRoot)
          : undefined;
    } catch (error) {
      return {
        ok: false,
        error: fingerprintAnalysisError(error),
      };
    }
    const outcome = await tryAnalyzeRepository({
      cwd,
      scope,
      includeUntracked: scope === 'working-tree' && includeUntracked,
      applyReportLimits: false,
    });

    if (!outcome.ok) {
      return outcome;
    }
    report = outcome.report;
    try {
      stagedAfter =
        scope === 'staged'
          ? await stagedDiffFingerprint(repositoryRoot)
          : undefined;
    } catch (error) {
      return {
        ok: false,
        error: fingerprintAnalysisError(error),
      };
    }
    if (scope !== 'staged' || stagedBefore === stagedAfter) break;

    if (attempt === 1) {
      return {
        ok: false,
        error: {
          code: 'ANALYSIS_FAILED',
          message: 'STAGED_CHANGED_DURING_ANALYSIS',
        },
      };
    }
  }

  if (!report) {
    return {
      ok: false,
      error: {
        code: 'ANALYSIS_FAILED',
        message: 'Analysis completed without a report.',
      },
    };
  }
  return {
    ok: true,
    report,
    repositoryRoot,
    stagedFingerprint: stagedAfter,
  };
}

/** Hash the exact staged binary diff without retaining source content. */
export function stagedDiffFingerprint(cwd: string): Promise<string> {
  return new Promise((resolveFingerprint, reject) => {
    const hash = createHash('sha256');
    let stderr = '';
    const child = spawn(
      'git',
      [
        'diff',
        '--cached',
        '--binary',
        '--full-index',
        '--no-ext-diff',
        '--no-textconv',
      ],
      {
        cwd,
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    child.stdout.on('data', (chunk: Buffer) => hash.update(chunk));
    child.stderr.on('data', (chunk: Buffer) => {
      if (stderr.length < 8192) stderr += chunk.toString('utf8');
    });
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) {
        resolveFingerprint(hash.digest('hex'));
      } else {
        reject(new Error(stderr.trim() || `git diff exited with code ${code}`));
      }
    });
  });
}

async function resolveRepositoryRoot(cwd: string): Promise<string> {
  const result = await execFileAsync('git', ['rev-parse', '--show-toplevel'], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
    windowsHide: true,
  });
  return result.stdout.trim();
}

function fingerprintAnalysisError(error: unknown): AnalysisError {
  const candidate = error as NodeJS.ErrnoException;
  if (candidate.code === 'ENOENT') {
    return {
      code: 'GIT_UNAVAILABLE',
      message: 'git is not installed or is not available to the extension host',
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  if (
    normalized.includes('not a git repository') ||
    normalized.includes('fatal: not a git')
  ) {
    return {
      code: 'NOT_A_REPOSITORY',
      message: 'not a git repository',
    };
  }
  return {
    code: 'ANALYSIS_FAILED',
    message,
  };
}
