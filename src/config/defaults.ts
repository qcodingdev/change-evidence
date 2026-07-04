import type { ChangeEvidenceConfig, Language } from '../shared/types.js';

/** Default language for CLI output. */
export const DEFAULT_LANGUAGE: Language = 'zh-CN';

/** Default configuration. Returns a fresh copy so callers cannot mutate shared state. */
export function createDefaultConfig(): ChangeEvidenceConfig {
  return {
    language: DEFAULT_LANGUAGE,
    risk: {
      highPaths: [
        '**/auth/**',
        '**/security/**',
        '**/payment/**',
        '**/migration/**',
        '**/database/**',
        '**/config/**',
        '.github/workflows/**',
        '**/application.yml',
        '**/application.yaml',
        '.env*',
        'Dockerfile',
        'pom.xml',
        'package.json',
        'build.gradle',
      ],
      sensitiveKeywords: [
        'token',
        'secret',
        'password',
        'private_key',
        'api_key',
        'access_key',
        'authorization',
      ],
      sizeThresholds: {
        maxFiles: 10,
        maxTotalLines: 500,
        maxSingleFileLines: 200,
      },
    },
    report: {
      maxFiles: 20,
      maxRiskItems: 10,
      maxChecklistItems: 8,
      collapseLowRisk: true,
    },
    hook: {
      enabled: true,
      mode: 'prompt',
      trigger: {
        minChangedFiles: 10,
        minRiskLevel: 'medium',
      },
    },
  };
}
