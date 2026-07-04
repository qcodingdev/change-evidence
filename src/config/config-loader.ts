import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import type {
  ChangeEvidenceConfig,
  HookMode,
  Language,
  RiskLevel,
} from '../shared/types.js';
import { createDefaultConfig } from './defaults.js';

const SUPPORTED_LANGUAGES: readonly Language[] = ['zh-CN', 'en'];
const SUPPORTED_HOOK_MODES: readonly HookMode[] = [
  'off',
  'report',
  'prompt',
  'block',
];
const RISK_LEVEL_RANK: Record<RiskLevel, number> = {
  ok: 0,
  low: 1,
  medium: 2,
  high: 3,
};

/** Result returned by loadConfig so callers can inspect provenance. */
export interface LoadConfigResult {
  config: ChangeEvidenceConfig;
  source: 'defaults' | 'file' | 'cli';
  configPath?: string;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function asStringArray(value: unknown): string[] | undefined {
  return isStringArray(value) ? value : undefined;
}

function asLanguage(value: unknown): Language | undefined {
  return typeof value === 'string' &&
    (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
    ? (value as Language)
    : undefined;
}

function asHookMode(value: unknown): HookMode | undefined {
  return typeof value === 'string' &&
    (SUPPORTED_HOOK_MODES as readonly string[]).includes(value)
    ? (value as HookMode)
    : undefined;
}

function asRiskLevel(value: unknown): RiskLevel | undefined {
  if (typeof value !== 'string') return undefined;
  const lower = value.toLowerCase();
  return lower in RISK_LEVEL_RANK ? (lower as RiskLevel) : undefined;
}

/**
 * Validate that a value is a positive integer (>= 1). This applies to all
 * numeric config thresholds (report limits, size thresholds, hook triggers).
 * Zero, negatives, fractions and non-finite numbers are silently ignored.
 */
function asPositiveInt(value: unknown): number | undefined {
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 1
    ? value
    : undefined;
}

function asBool(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

/**
 * Apply a raw parsed object onto a config clone. Unknown / invalid fields are
 * silently ignored — the loader must never throw on a malformed user file.
 */
function applyRawConfig(
  base: ChangeEvidenceConfig,
  raw: unknown,
): ChangeEvidenceConfig {
  const result: ChangeEvidenceConfig = {
    language: base.language,
    risk: {
      highPaths: [...base.risk.highPaths],
      sensitiveKeywords: [...base.risk.sensitiveKeywords],
      sizeThresholds: { ...base.risk.sizeThresholds },
    },
    report: { ...base.report },
    hook: {
      ...base.hook,
      trigger: { ...base.hook.trigger },
    },
  };

  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;

    const language = asLanguage(obj.language);
    if (language) result.language = language;

    const risk = obj.risk;
    if (risk && typeof risk === 'object') {
      const r = risk as Record<string, unknown>;
      const highPaths = asStringArray(r.highPaths);
      if (highPaths) result.risk.highPaths = highPaths;
      const sensitiveKeywords = asStringArray(r.sensitiveKeywords);
      if (sensitiveKeywords) result.risk.sensitiveKeywords = sensitiveKeywords;
      const thresholds = r.sizeThresholds;
      if (thresholds && typeof thresholds === 'object') {
        const t = thresholds as Record<string, unknown>;
        const maxFiles = asPositiveInt(t.maxFiles);
        if (maxFiles !== undefined) result.risk.sizeThresholds.maxFiles = maxFiles;
        const maxTotalLines = asPositiveInt(t.maxTotalLines);
        if (maxTotalLines !== undefined)
          result.risk.sizeThresholds.maxTotalLines = maxTotalLines;
        const maxSingleFileLines = asPositiveInt(t.maxSingleFileLines);
        if (maxSingleFileLines !== undefined)
          result.risk.sizeThresholds.maxSingleFileLines = maxSingleFileLines;
      }
    }

    const report = obj.report;
    if (report && typeof report === 'object') {
      const rp = report as Record<string, unknown>;
      const maxFiles = asPositiveInt(rp.maxFiles);
      if (maxFiles !== undefined) result.report.maxFiles = maxFiles;
      const maxRiskItems = asPositiveInt(rp.maxRiskItems);
      if (maxRiskItems !== undefined) result.report.maxRiskItems = maxRiskItems;
      const maxChecklistItems = asPositiveInt(rp.maxChecklistItems);
      if (maxChecklistItems !== undefined)
        result.report.maxChecklistItems = maxChecklistItems;
      const collapseLowRisk = asBool(rp.collapseLowRisk);
      if (collapseLowRisk !== undefined)
        result.report.collapseLowRisk = collapseLowRisk;
    }

    const hook = obj.hook;
    if (hook && typeof hook === 'object') {
      const h = hook as Record<string, unknown>;
      const enabled = asBool(h.enabled);
      if (enabled !== undefined) result.hook.enabled = enabled;
      const mode = asHookMode(h.mode);
      if (mode) result.hook.mode = mode;
      const trigger = h.trigger;
      if (trigger && typeof trigger === 'object') {
        const tr = trigger as Record<string, unknown>;
        const minChangedFiles = asPositiveInt(tr.minChangedFiles);
        if (minChangedFiles !== undefined)
          result.hook.trigger.minChangedFiles = minChangedFiles;
        const minRiskLevel = asRiskLevel(tr.minRiskLevel);
        if (minRiskLevel) result.hook.trigger.minRiskLevel = minRiskLevel;
      }
    }
  }

  return result;
}

/** Walk up from `startDir` to find the first existing config file. */
function findConfigPath(startDir: string, fileName: string): string | undefined {
  let dir = startDir;
  // Bounded walk — stop at the filesystem root.
  for (let i = 0; i < 40; i++) {
    const candidate = join(dir, fileName);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

/**
 * Load and merge configuration. Priority (highest wins) is applied later by the
 * CLI layer via `applyCliOverrides`; this function only handles file + defaults.
 *
 * @param cwd directory to start searching from (default: process.cwd())
 */
export function loadConfig(cwd: string = process.cwd()): LoadConfigResult {
  const defaults = createDefaultConfig();
  const configPath = findConfigPath(cwd, '.change-evidence.yml');

  if (!configPath) {
    return { config: defaults, source: 'defaults' };
  }

  let rawText: string;
  try {
    rawText = readFileSync(configPath, 'utf8');
  } catch {
    // Unreadable file is treated as "no config" — never crash the CLI.
    return { config: defaults, source: 'defaults' };
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(rawText);
  } catch {
    // Malformed YAML → fall back to defaults silently.
    return { config: defaults, source: 'defaults' };
  }

  // An empty or null document is valid YAML; treat as no overrides.
  if (parsed == null || typeof parsed !== 'object') {
    return { config: defaults, source: 'file', configPath };
  }

  return {
    config: applyRawConfig(defaults, parsed),
    source: 'file',
    configPath,
  };
}

/**
 * Resolve a language string from CLI flags into a validated Language, falling
 * back to the configured language when the flag is absent or invalid.
 */
export function resolveLanguage(
  flag: string | undefined,
  fallback: Language,
): Language {
  return asLanguage(flag) ?? fallback;
}

/** Exported for tests that need to inspect validation helpers. */
export const __internals = {
  asLanguage,
  asHookMode,
  asRiskLevel,
  asStringArray,
  asPositiveInt,
  applyRawConfig,
  findConfigPath,
};

// Allow tests / consumers to locate this module's directory if ever needed.
export const THIS_DIR = dirname(fileURLToPath(import.meta.url));
