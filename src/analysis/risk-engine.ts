import type {
  ChangeEvidenceConfig,
  DiffResult,
  FileCategory,
  HighRiskFile,
  RiskLevel,
  RiskReport,
  RiskSummary,
  Signal,
} from '../shared/types.js';
import { classifyFile, classifyFiles, matchHighRiskPath, LOW_RISK_CATEGORIES } from './file-classifier.js';
import { detectTestSignals } from './test-signal.js';
import { detectSizeSignals } from './size-signal.js';
import { detectSensitiveSignals } from './sensitive-signal.js';
import { generateChecklist } from './checklist.js';

/**
 * Simple heuristic for public API changes. Detects:
 * - Java: public method signature changes
 * - Spring-style @Controller / @RequestMapping / @GetMapping / @PostMapping etc.
 * - TypeScript/JavaScript: export function / export class / export default
 * - Interface files (.interface.ts, /api/, /routes/)
 */
function detectPublicApiSignals(files: import('../shared/types.js').FileChange[]): Signal[] {
  const signals: Signal[] = [];
  const publicApiIndicators: ReadonlyArray<{
    test: (p: string, patch: string) => boolean;
    message: (p: string) => string;
  }> = [
    {
      test: (p) => p.includes('/api/') || p.includes('/routes/') || p.endsWith('.api.ts'),
      message: (p) => `Public API file changed: ${p}`,
    },
    {
      test: (_p, patch) => /public\s+(static\s+)?[\w<>\[\]]+\s+\w+\s*\(/.test(patch),
      message: (p) => `Java public method signature changed in ${p}`,
    },
    {
      test: (_p, patch) => /@(Request|Get|Post|Put|Delete|Patch)Mapping/.test(patch),
      message: (p) => `Spring controller mapping changed in ${p}`,
    },
    {
      test: (_p, patch) => /export\s+(default\s+)?(function|class|interface|const|type)\s/.test(patch),
      message: (p) => `Exported API surface changed in ${p}`,
    },
  ];

  for (const f of files) {
    if (!f.patch) continue;
    for (const indicator of publicApiIndicators) {
      if (indicator.test(f.path, f.patch)) {
        signals.push({
          type: 'public-api-change',
          severity: 'medium',
          message: indicator.message(f.path),
          paths: [f.path],
        });
        break; // one signal per file is enough
      }
    }
  }

  return signals;
}

/** Return the highest risk level among all signals. */
function computeOverallRisk(signals: Signal[]): RiskLevel {
  const RANK: Record<RiskLevel, number> = { ok: 0, low: 1, medium: 2, high: 3 };
  let max: RiskLevel = 'ok';
  for (const s of signals) {
    if (RANK[s.severity] > RANK[max]) {
      max = s.severity;
    }
  }
  return max;
}

/**
 * Run the full risk analysis pipeline on a DiffResult.
 *
 * This is the main entry point that wires together all signal detectors and
 * produces a RiskReport ready for rendering.
 */
export function analyse(
  diff: DiffResult,
  config: ChangeEvidenceConfig,
  options: { applyReportLimits?: boolean } = {},
): RiskReport {
  const { files, totalAdditions, totalDeletions } = diff;

  // ── 1. Classify files ─────────────────────────────────────────
  const categories = classifyFiles(files);
  const byCategory: Record<FileCategory, number> = {
    production: 0,
    test: 0,
    config: 0,
    dependency: 0,
    migration: 0,
    ci: 0,
    documentation: 0,
    'style-asset': 0,
  };
  for (const cat of categories.values()) {
    byCategory[cat]++;
  }

  // ── 2. High-risk path signals ─────────────────────────────────
  const allSignals: Signal[] = [];
  const highRiskFiles: HighRiskFile[] = [];
  const highRiskFileSet = new Set<string>();

  for (const f of files) {
    const cat = categories.get(f.path) ?? 'production';
    const matchedPattern = matchHighRiskPath(f.path, config.risk.highPaths);
    const categorySignalType = deriveSignalTypeForCategory(cat);

    if (matchedPattern) {
      highRiskFileSet.add(f.path);
      allSignals.push({
        type: categorySignalType,
        severity: cat === 'ci' ? 'medium' : 'high',
        message: `High-risk path: ${f.path} (matched ${matchedPattern})`,
        paths: [f.path],
      });
    } else if (categorySignalType !== 'high-risk-path') {
      // Risky categories must affect overall risk even when they do not match
      // a configured high-risk path glob.
      allSignals.push({
        type: categorySignalType,
        severity: 'medium',
        message: `${cat} file changed: ${f.path}`,
        paths: [f.path],
      });
    }
  }

  // ── 3. Sensitive keyword signals ──────────────────────────────
  const sensitive = detectSensitiveSignals(files, config.risk.sensitiveKeywords);
  allSignals.push(...sensitive.signals);
  const sensitiveHits = sensitive.hitsByFile;

  // ── 4. Test signals ───────────────────────────────────────────
  const testResult = detectTestSignals(files, categories);
  allSignals.push(...testResult.signals);

  // ── 5. Size signals ───────────────────────────────────────────
  const sizeResult = detectSizeSignals(files, totalAdditions, totalDeletions, config.risk.sizeThresholds);
  allSignals.push(...sizeResult.signals);

  // ── 6. Public API signals ─────────────────────────────────────
  const publicApiSignals = detectPublicApiSignals(files);
  allSignals.push(...publicApiSignals);

  // ── 7. Build high-risk files list ─────────────────────────────
  for (const f of files) {
    const cat = categories.get(f.path) ?? 'production';
    const isHighPath = highRiskFileSet.has(f.path);
    const hasSecret = sensitiveHits.has(f.path);
    const reasons: string[] = [];

    if (isHighPath) reasons.push('high-risk-path');
    if (hasSecret) reasons.push('secret-keyword');
    if (cat === 'config') reasons.push('config-change');
    if (cat === 'dependency') reasons.push('dependency-change');
    if (cat === 'migration') reasons.push('migration-change');
    if (cat === 'ci') reasons.push('ci-change');
    if (testResult.deletedTestPaths.includes(f.path)) reasons.push('test-deleted');
    if (publicApiSignals.some((s) => s.paths?.includes(f.path))) reasons.push('public-api-change');

    if (reasons.length > 0) {
      const fileSignals = allSignals.filter((signal) =>
        signal.paths?.includes(f.path),
      );
      highRiskFiles.push({
        path: f.path,
        category: cat,
        severity: computeOverallRisk(fileSignals),
        reasons,
      });
    }
  }

  // ── 8. Summary ────────────────────────────────────────────────
  const summary: RiskSummary = {
    fileCount: files.length,
    totalAdditions,
    totalDeletions,
    productionFiles: byCategory.production,
    testFiles: byCategory.test,
    highRiskFiles: highRiskFiles.length,
    byCategory,
  };

  // ── 9. Collapsed low-risk count ───────────────────────────────
  let collapsedLowRiskCount = 0;
  if (config.report.collapseLowRisk) {
    for (const f of files) {
      const cat = categories.get(f.path) ?? 'production';
      if (LOW_RISK_CATEGORIES.has(cat)) {
        collapsedLowRiskCount++;
      }
    }
    if (collapsedLowRiskCount > 0) {
      allSignals.push({
        type: 'low-risk-collapsed',
        severity: 'ok',
        message: `${collapsedLowRiskCount} documentation/style files collapsed`,
      });
    }
  }

  // ── 10. Overall risk & checklist ──────────────────────────────
  const overallRisk = computeOverallRisk(allSignals);
  const checklistItems = generateChecklist(allSignals, config.report.maxChecklistItems);
  const maxFiles = Math.max(0, config.report.maxFiles);
  const maxRiskItems = Math.max(0, config.report.maxRiskItems);
  const applyReportLimits = options.applyReportLimits !== false;
  const visibleHighRiskFiles = applyReportLimits
    ? highRiskFiles.slice(0, Math.min(maxFiles, maxRiskItems))
    : highRiskFiles;
  const severityRank: Record<RiskLevel, number> = {
    ok: 0,
    low: 1,
    medium: 2,
    high: 3,
  };
  const visibleSignals = applyReportLimits
    ? allSignals
        .map((signal, index) => ({ signal, index }))
        .sort(
          (a, b) =>
            severityRank[b.signal.severity] - severityRank[a.signal.severity] ||
            a.index - b.index,
        )
        .slice(0, maxRiskItems)
        .map(({ signal }) => signal)
    : allSignals;

  return {
    overallRisk,
    summary,
    highRiskFiles: visibleHighRiskFiles,
    signals: visibleSignals,
    collapsedLowRiskCount,
    checklistItems,
    truncation: {
      highRiskFilesOmitted: highRiskFiles.length - visibleHighRiskFiles.length,
      signalsOmitted: allSignals.length - visibleSignals.length,
    },
  };
}

function deriveSignalTypeForCategory(cat: FileCategory): Signal['type'] {
  switch (cat) {
    case 'ci': return 'ci-change';
    case 'config': return 'config-change';
    case 'dependency': return 'dependency-change';
    case 'migration': return 'migration-change';
    default: return 'high-risk-path';
  }
}
