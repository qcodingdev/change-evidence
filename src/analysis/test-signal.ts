import type { FileChange, Signal, FileCategory } from '../shared/types.js';
import { classifyFile } from './file-classifier.js';

export interface TestSignalResult {
  signals: Signal[];
  /** true when production code was changed but no test files were touched. */
  productionWithoutTests: boolean;
  /** Paths of test files that were deleted. */
  deletedTestPaths: string[];
}

/**
 * Detect test-related risk signals:
 * 1. Production code changed but no test files changed → warning
 * 2. Test files deleted → high
 */
export function detectTestSignals(
  files: FileChange[],
  categories: Map<string, FileCategory>,
): TestSignalResult {
  const signals: Signal[] = [];
  const deletedTestPaths: string[] = [];

  let hasProduction = false;
  let hasTest = false;

  for (const f of files) {
    const cat = categories.get(f.path) ?? classifyFile(f);

    if (cat === 'production') hasProduction = true;
    if (cat === 'test') {
      hasTest = true;
      if (f.status === 'deleted') {
        deletedTestPaths.push(f.path);
      }
    }
  }

  if (hasProduction && !hasTest) {
    signals.push({
      type: 'test-missing',
      severity: 'medium',
      message: 'Production code changed but no test files were modified',
    });
  }

  for (const path of deletedTestPaths) {
    signals.push({
      type: 'test-deleted',
      severity: 'high',
      message: `Test file deleted: ${path}`,
      paths: [path],
    });
  }

  return {
    signals,
    productionWithoutTests: hasProduction && !hasTest,
    deletedTestPaths,
  };
}
