import type { FileChange, Signal } from '../shared/types.js';

export interface SizeThresholds {
  maxFiles: number;
  maxTotalLines: number;
  maxSingleFileLines: number;
}

export interface SizeSignalResult {
  signals: Signal[];
  /** Files that individually exceed the single-file threshold. */
  largeFiles: string[];
}

/**
 * Detect size-related risk signals:
 * 1. Changed file count exceeds threshold
 * 2. Total changed lines exceed threshold
 * 3. Single file changed lines exceed threshold
 */
export function detectSizeSignals(
  files: FileChange[],
  totalAdditions: number,
  totalDeletions: number,
  thresholds: SizeThresholds,
): SizeSignalResult {
  const signals: Signal[] = [];
  const largeFiles: string[] = [];

  if (files.length > thresholds.maxFiles) {
    signals.push({
      type: 'size-file-count',
      severity: 'medium',
      message: `Changed files (${files.length}) exceed threshold (${thresholds.maxFiles})`,
    });
  }

  const totalLines = totalAdditions + totalDeletions;
  if (totalLines > thresholds.maxTotalLines) {
    signals.push({
      type: 'size-large-changeset',
      severity: 'medium',
      message: `Total changed lines (${totalLines}) exceed threshold (${thresholds.maxTotalLines})`,
    });
  }

  for (const f of files) {
    const fileLines = f.additions + f.deletions;
    if (fileLines > thresholds.maxSingleFileLines) {
      largeFiles.push(f.path);
      signals.push({
        type: 'size-large-single-file',
        severity: 'low',
        message: `Single file has ${fileLines} changed lines: ${f.path}`,
        paths: [f.path],
      });
    }
  }

  return { signals, largeFiles };
}
