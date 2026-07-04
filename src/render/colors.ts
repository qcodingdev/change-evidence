import { Chalk } from 'chalk';
import type { RiskLevel, SignalSeverity } from '../shared/types.js';

/**
 * Color palette for terminal output.
 *
 * When noColor is false we create a chalk instance with level=1 (basic
 * 16-color) so colors appear even when stdout is piped — matching the
 * expectation that `ce --staged` produces colored output when the user
 * hasn't passed `--no-color`.
 *
 * When noColor is true all methods return plain text.
 */

export interface ColorPalette {
  severity(level: RiskLevel | SignalSeverity, text: string): string;
  severityLabel(level: RiskLevel | SignalSeverity, text: string): string;
  bold(text: string): string;
  dim(text: string): string;
  green(text: string): string;
  yellow(text: string): string;
  red(text: string): string;
  cyan(text: string): string;
}

/** Build a palette instance. Pass `noColor: true` to disable all coloring. */
export function createPalette(noColor = false): ColorPalette {
  if (noColor) {
    return {
      severity: (_l, text) => text,
      severityLabel: (_l, text) => text,
      bold: (text) => text,
      dim: (text) => text,
      green: (text) => text,
      yellow: (text) => text,
      red: (text) => text,
      cyan: (text) => text,
    };
  }

  // Force basic color support even in non-TTY contexts.
  const c = new Chalk({ level: 1 });

  return {
    severity(level, text) {
      switch (level) {
        case 'high': return c.red(text);
        case 'medium': return c.yellow(text);
        case 'low': return c.cyan(text);
        case 'ok': return c.green(text);
        default: return text;
      }
    },
    severityLabel(level, text) {
      switch (level) {
        case 'high': return c.red.bold(text);
        case 'medium': return c.yellow.bold(text);
        case 'low': return c.cyan(text);
        case 'ok': return c.green(text);
        default: return text;
      }
    },
    bold: (text) => c.bold(text),
    dim: (text) => c.dim(text),
    green: (text) => c.green(text),
    yellow: (text) => c.yellow(text),
    red: (text) => c.red(text),
    cyan: (text) => c.cyan(text),
  };
}

/** Severity tag labels: [HIGH] [MEDIUM] [LOW] [OK]. */
export function severityTag(level: RiskLevel | SignalSeverity): string {
  switch (level) {
    case 'high': return '[HIGH]';
    case 'medium': return '[MEDIUM]';
    case 'low': return '[LOW]';
    case 'ok': return '[OK]';
    default: return '[OK]';
  }
}
