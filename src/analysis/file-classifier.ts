import type { FileCategory, FileChange } from '../shared/types.js';
import pm from 'picomatch';

/**
 * Static classification rules. A file matches the FIRST category whose test
 * returns true; order matters (more specific categories first).
 *
 * Test files are detected before production because e.g. `AuthService.test.ts`
 * should be classified as a test, not production.
 */
const CATEGORY_RULES: ReadonlyArray<{
  category: FileCategory;
  test: (path: string, ext: string) => boolean;
}> = [
  // CI configuration
  {
    category: 'ci',
    test: (p) =>
      p.startsWith('.github/workflows/') ||
      p.startsWith('.gitlab-ci') ||
      p.startsWith('.circleci/') ||
      p.includes('/.github/workflows/'),
  },
  // Database migrations
  {
    category: 'migration',
    test: (p) => /(^|\/)migrations?\//.test(p) || /(^|\/)db\/(migrate|migration)/.test(p),
  },
  // Test files
  {
    category: 'test',
    test: (p) =>
      /\.(test|spec)\.[a-z0-9]+$/i.test(p) ||
      /(^|\/)(tests?|__tests?__|spec|specs)\//.test(p),
  },
  // Dependency manifests
  {
    category: 'dependency',
    test: (p, ext) =>
      p === 'package.json' ||
      p.endsWith('/package.json') ||
      p === 'package-lock.json' ||
      p.endsWith('/package-lock.json') ||
      p === 'pom.xml' ||
      p.endsWith('/pom.xml') ||
      p === 'build.gradle' ||
      p.endsWith('/build.gradle') ||
      p === 'build.gradle.kts' ||
      p.endsWith('/build.gradle.kts') ||
      p === 'go.mod' ||
      p.endsWith('/go.mod') ||
      p === 'Cargo.toml' ||
      p.endsWith('/Cargo.toml') ||
      p === 'requirements.txt' ||
      p.endsWith('/requirements.txt') ||
      p === 'Gemfile' ||
      p === 'Gemfile.lock' ||
      ext === 'lock' ||
      p.endsWith('-lock.json') ||
      p.endsWith('.lock'),
  },
  // Configuration files
  {
    category: 'config',
    test: (p, ext) =>
      p === 'Dockerfile' ||
      p.endsWith('/Dockerfile') ||
      /^\.env/.test(p) ||
      p.endsWith('.env') ||
      p.endsWith('.env.local') ||
      ext === 'yml' ||
      ext === 'yaml' ||
      ext === 'toml' ||
      ext === 'ini' ||
      ext === 'conf' ||
      ext === 'properties' ||
      p.endsWith('.editorconfig') ||
      p === 'tsconfig.json' ||
      p.endsWith('/tsconfig.json') ||
      p.endsWith('.eslintrc') ||
      p.endsWith('.eslintrc.js') ||
      p.endsWith('.eslintrc.json') ||
      p.endsWith('.prettierrc') ||
      p.endsWith('.prettierrc.js') ||
      p.endsWith('.prettierrc.json'),
  },
  // Documentation
  {
    category: 'documentation',
    test: (p, ext) =>
      ext === 'md' ||
      ext === 'markdown' ||
      ext === 'rst' ||
      ext === 'txt' ||
      p === 'LICENSE' ||
      p === 'CHANGELOG' ||
      p === 'README' ||
      p.startsWith('docs/') ||
      p.includes('/docs/'),
  },
  // Style and static assets
  {
    category: 'style-asset',
    test: (p, ext) =>
      ext === 'css' ||
      ext === 'scss' ||
      ext === 'sass' ||
      ext === 'less' ||
      ext === 'svg' ||
      ext === 'png' ||
      ext === 'jpg' ||
      ext === 'jpeg' ||
      ext === 'gif' ||
      ext === 'ico' ||
      ext === 'woff' ||
      ext === 'woff2' ||
      ext === 'ttf' ||
      ext === 'eot',
  },
];

/** Default rule for "production" code. */
function isProduction(path: string, ext: string): boolean {
  const CODE_EXTENSIONS = new Set([
    'ts',
    'tsx',
    'js',
    'jsx',
    'mjs',
    'cjs',
    'py',
    'rb',
    'java',
    'kt',
    'go',
    'rs',
    'php',
    'c',
    'cc',
    'cpp',
    'h',
    'hpp',
    'cs',
    'swift',
    'scala',
    'clj',
    'ex',
    'exs',
    'lua',
    'sh',
  ]);
  return CODE_EXTENSIONS.has(ext) && !path.includes('/node_modules/');
}

/**
 * Classify a single file into a category. Falls back to "production" for
 * unrecognised code files, or "documentation" for truly unknown files.
 */
export function classifyFile(file: FileChange): FileCategory {
  const { path, extension } = file;

  for (const rule of CATEGORY_RULES) {
    if (rule.test(path, extension)) {
      return rule.category;
    }
  }

  if (isProduction(path, extension)) {
    return 'production';
  }

  // Unknown files default to production so they are not silently collapsed.
  return 'production';
}

/** Classify all files in a diff, returning a Map for O(1) lookup. */
export function classifyFiles(files: FileChange[]): Map<string, FileCategory> {
  const result = new Map<string, FileCategory>();
  for (const f of files) {
    result.set(f.path, classifyFile(f));
  }
  return result;
}

/**
 * Match a file path against high-risk path globs (picomatch).
 * Returns the matched pattern, or undefined.
 */
export function matchHighRiskPath(
  path: string,
  highPaths: string[],
): string | undefined {
  return highPaths.find((pattern) => pm.isMatch(path, pattern));
}

/** Categories considered "low risk" for collapse purposes. */
export const LOW_RISK_CATEGORIES: ReadonlySet<FileCategory> = new Set([
  'documentation',
  'style-asset',
]);
