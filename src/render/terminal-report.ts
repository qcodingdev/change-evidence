import type {
  DiffScope,
  Language,
  RiskReport,
  Signal,
} from '../shared/types.js';
import { createPalette, severityTag, type ColorPalette } from './colors.js';
import { t, scopeLabel, riskLevelLabel, MESSAGES, type MessageKey } from './i18n.js';

export interface RenderOptions {
  scope: DiffScope;
  language: Language;
  noColor: boolean;
}

// Pre-compute the set of signal.* i18n keys for fast lookup.
const SIGNAL_MESSAGE_KEYS = new Set<string>(
  Object.keys(MESSAGES).filter((k) => k.startsWith('signal.')),
);

/** Escape control characters and backslashes in untrusted Git path names. */
function terminalSafePath(path: string): string {
  return JSON.stringify(path).slice(1, -1);
}

/**
 * Render a RiskReport into a single string suitable for terminal output.
 *
 * The output is intentionally compact: header → summary → high-risk files →
 * signals → checklist → collapsed low-risk footer.
 *
 * Each section is separated by a blank line. Line widths are kept within
 * typical terminal limits.
 */
export function renderReport(
  report: RiskReport,
  options: RenderOptions,
): string {
  const { scope, language, noColor } = options;
  const c = createPalette(noColor);
  const colon = t('punct.colon', language);
  const join = t('punct.listJoin', language);
  const lines: string[] = [];

  // ── Header ────────────────────────────────────────────────────
  lines.push(c.bold(t('header.title', language)));
  lines.push('');

  // ── Scope + Overall risk ──────────────────────────────────────
  const scopeText = scopeLabel(scope, language);
  const riskLabel = riskLevelLabel(report.overallRisk, language);
  lines.push(
    `${t('header.scope', language)}${colon}${scopeText}    ${t('header.riskLevel', language)}${colon}${c.severityLabel(report.overallRisk, riskLabel)}`,
  );
  lines.push('');

  // ── Empty diff shortcut ───────────────────────────────────────
  if (report.summary.fileCount === 0) {
    lines.push(t('empty.noChanges', language));
    return lines.join('\n');
  }

  // ── Summary ───────────────────────────────────────────────────
  lines.push(c.bold(t('section.summary', language)));
  const s = report.summary;
  lines.push(`- ${t('summary.fileCount', language)}${colon}${s.fileCount}`);
  lines.push(`- ${t('summary.additions', language)}${colon}${s.totalAdditions}`);
  lines.push(`- ${t('summary.deletions', language)}${colon}${s.totalDeletions}`);
  lines.push(`- ${t('summary.productionFiles', language)}${colon}${s.productionFiles}`);
  lines.push(`- ${t('summary.testFiles', language)}${colon}${s.testFiles}`);
  lines.push(`- ${t('summary.highRiskFiles', language)}${colon}${s.highRiskFiles}`);
  lines.push('');

  // ── High-risk files ───────────────────────────────────────────
  if (report.highRiskFiles.length > 0) {
    lines.push(c.bold(t('section.highRisk', language)));
    for (const hf of report.highRiskFiles) {
      const tag = c.severityLabel(hf.severity, severityTag(hf.severity));
      const reasons = hf.reasons
        .map((r) => t(`reason.${r}` as MessageKey, language))
        .join(join);
      lines.push(`${tag} ${terminalSafePath(hf.path)}`);
      lines.push(`  ${c.dim(reasons)}`);
    }
    lines.push('');
  }

  // ── Signals (excluding low-risk-collapsed, which goes in footer) ──
  const displaySignals = report.signals.filter(
    (sig) => sig.type !== 'low-risk-collapsed',
  );
  if (displaySignals.length > 0) {
    lines.push(c.bold(t('section.signals', language)));
    for (const sig of displaySignals) {
      lines.push(renderSignal(sig, language, c));
    }
    lines.push('');
  }

  // ── Checklist ─────────────────────────────────────────────────
  if (report.checklistItems.length > 0) {
    lines.push(c.bold(t('section.checklist', language)));
    for (const item of report.checklistItems) {
      lines.push(`${t('checklist.marker', language)} ${item}`);
    }
    lines.push('');
  }

  // ── Collapsed low-risk footer ─────────────────────────────────
  if (report.collapsedLowRiskCount > 0) {
    lines.push(c.bold(t('section.collapsed', language)));
    lines.push(
      c.dim(
        t('collapsed.summary', language, {
          count: report.collapsedLowRiskCount,
        }),
      ),
    );
    lines.push('');
  }

  // Trim trailing blank line
  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }

  return lines.join('\n');
}

/**
 * Render a single signal line. [WARN] tag is used for test-missing
 * (per spec example); otherwise [severity].
 */
function renderSignal(
  sig: Signal,
  language: Language,
  c: ColorPalette,
): string {
  const tagText =
    sig.type === 'test-missing'
      ? '[WARN]'
      : severityTag(sig.severity);
  const tag = sig.type === 'test-missing'
    ? c.yellow(tagText)
    : c.severityLabel(sig.severity, tagText);

  const msgKey = `signal.${sig.type}` as MessageKey;
  const hasTemplate = SIGNAL_MESSAGE_KEYS.has(msgKey);

  let message: string;
  if (hasTemplate) {
    const params: Record<string, string | number> = {};
    if (sig.paths?.length) {
      params.path = terminalSafePath(sig.paths[0]);
    }
    // Secret-keyword: extract keyword list from engine message.
    if (sig.type === 'secret-keyword') {
      const colonIdx = sig.message.indexOf(':');
      if (colonIdx !== -1) {
        params.keywords = sig.message.slice(colonIdx + 1).trim();
      }
    }
    // Size signals: extract count from engine message.
    if (
      sig.type === 'size-file-count' ||
      sig.type === 'size-large-changeset'
    ) {
      const m = sig.message.match(/\((\d+)\)/);
      if (m) params.count = m[1];
    }
    message = t(msgKey, language, params);
  } else {
    // Fallback: use the engine's raw message.
    message = sig.message;
  }

  return `${tag} ${message}`;
}
