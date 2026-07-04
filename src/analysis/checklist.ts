import type { Signal } from '../shared/types.js';

/**
 * Generate actionable pre-commit checklist items from the detected signals.
 *
 * Each item is a short, imperative, locale-agnostic suggestion. The renderer
 * layer (prompt 04) handles localization and formatting.
 *
 * @param signals detected risk signals
 * @param maxItems cap on checklist length (default 8 per spec)
 */
export function generateChecklist(signals: Signal[], maxItems = 8): string[] {
  const items: string[] = [];

  // De-duplicate by signal type to avoid repetitive items.
  const seenTypes = new Set<string>();

  for (const sig of signals) {
    if (items.length >= maxItems) break;

    const item = checklistForSignal(sig);
    if (!item) continue;
    if (seenTypes.has(sig.type)) continue;
    seenTypes.add(sig.type);

    items.push(item);
  }

  return items;
}

/** Map a single signal to a checklist string. Returns undefined for low-risk. */
function checklistForSignal(sig: Signal): string | undefined {
  switch (sig.type) {
    case 'secret-keyword':
      return 'Confirm no real secrets / credentials are being committed';

    case 'config-change':
      return 'Review config changes for unintended production values';

    case 'dependency-change':
      return 'Confirm dependency changes are intentional and lockfile-consistent';

    case 'migration-change':
      return 'Verify database migration is reversible and tested';

    case 'ci-change':
      return 'Confirm CI/CD pipeline changes are correct';

    case 'high-risk-path':
      return 'Review high-risk path changes (auth / security / payment / data)';

    case 'test-missing':
      return 'Add or update tests for the changed production code';

    case 'test-deleted':
      return 'Confirm intentional test deletion; consider restoring coverage';

    case 'size-file-count':
      return 'Consider splitting this commit — too many files changed at once';

    case 'size-large-changeset':
      return 'Consider splitting this commit — total change is large';

    case 'size-large-single-file':
      return 'Review the large single-file change carefully';

    case 'public-api-change':
      return 'Confirm public API changes are intentional and backwards-compatible';

    case 'low-risk-collapsed':
      // Not actionable — skip.
      return undefined;

    default:
      return undefined;
  }
}
