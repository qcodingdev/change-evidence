import type { FileChange, Signal } from '../shared/types.js';

export interface SensitiveSignalResult {
  signals: Signal[];
  /** Map of file path → list of keyword hits. */
  hitsByFile: Map<string, string[]>;
}

/**
 * Detect sensitive keywords in patch content. This checks the *redacted*
 * patch text for the presence of sensitive key names (not values — those are
 * already redacted by diff-parser). Finding a keyword name in a diff line
 * means the file contains credentials/secrets that deserve attention.
 *
 * We look for the keyword name on lines that start with + (added lines only),
 * so we flag when new secrets are introduced, not when old ones are shown in
 * context.
 */
export function detectSensitiveSignals(
  files: FileChange[],
  sensitiveKeywords: string[],
): SensitiveSignalResult {
  const signals: Signal[] = [];
  const hitsByFile = new Map<string, string[]>();

  if (!sensitiveKeywords.length) {
    return { signals, hitsByFile };
  }

  // Build a single regex: \b(keyword1|keyword2|...)\b
  const pattern = new RegExp(
    `\\b(${sensitiveKeywords.join('|')})\\b`,
    'gi',
  );

  for (const f of files) {
    if (!f.patch) continue;

    const hits = new Set<string>();
    for (const line of f.patch.split('\n')) {
      // Only check added lines — we care about new introductions.
      if (!line.startsWith('+')) continue;
      const matches = line.matchAll(pattern);
      for (const m of matches) {
        hits.add(m[1].toLowerCase());
      }
    }

    if (hits.size > 0) {
      const hitList = [...hits];
      hitsByFile.set(f.path, hitList);
      signals.push({
        type: 'secret-keyword',
        severity: 'high',
        message: `Sensitive keywords detected in ${f.path}: ${hitList.join(', ')}`,
        paths: [f.path],
      });
    }
  }

  return { signals, hitsByFile };
}
