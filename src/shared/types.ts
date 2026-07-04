/** Language codes supported by the CLI. */
export type Language = 'zh-CN' | 'en';

/** Hook trigger mode. */
export type HookMode = 'off' | 'report' | 'prompt' | 'block';

/** Risk level ordering: ok < low < medium < high. */
export type RiskLevel = 'ok' | 'low' | 'medium' | 'high';

/** What diff scope the user asked to analyse. */
export type DiffScope = 'working-tree' | 'staged' | 'branch';

/** Full configuration model (merged result). */
export interface ChangeEvidenceConfig {
  language: Language;
  risk: {
    highPaths: string[];
    sensitiveKeywords: string[];
    sizeThresholds: {
      maxFiles: number;
      maxTotalLines: number;
      maxSingleFileLines: number;
    };
  };
  report: {
    maxFiles: number;
    maxRiskItems: number;
    maxChecklistItems: number;
    collapseLowRisk: boolean;
  };
  hook: {
    enabled: boolean;
    mode: HookMode;
    trigger: {
      minChangedFiles: number;
      minRiskLevel: RiskLevel;
    };
  };
}

/** Raw CLI flags parsed by commander. */
export interface CliFlags {
  staged?: boolean;
  base?: string;
  language?: string;
  /**
   * Color flag. Defined via `--no-color`, so commander stores the negated
   * value here: `true` by default, `false` when `--no-color` is passed.
   */
  color?: boolean;
  hook?: boolean;
}

/** Resolved options after merging CLI flags → config → defaults. */
export interface ResolvedOptions {
  scope: DiffScope;
  base?: string;
  language: Language;
  noColor: boolean;
  hookMode?: boolean;
  config: ChangeEvidenceConfig;
}

// ─── Git diff data model (prompt 02) ──────────────────────────

/** Normalized git file status. */
export type FileStatus = 'added' | 'modified' | 'deleted' | 'renamed';

/**
 * A single changed file as understood by Change Evidence.
 *
 * `patch` is the `git diff --unified=0` hunk text, with secret-looking
 * values redacted before it ever reaches the report layer.
 */
export interface FileChange {
  path: string;
  /** For renames, the original path; undefined otherwise. */
  oldPath?: string;
  status: FileStatus;
  /** Lines added, from numstat. Binary files report 0. */
  additions: number;
  /** Lines deleted, from numstat. Binary files report 0. */
  deletions: number;
  /** Patch hunks from `git diff --unified=0`, secrets redacted. */
  patch: string;
  /** Lowercased file extension without the leading dot (e.g. "ts", "yml"). */
  extension: string;
}

/** Aggregate diff result across all changed files in a scope. */
export interface DiffResult {
  files: FileChange[];
  totalAdditions: number;
  totalDeletions: number;
}
