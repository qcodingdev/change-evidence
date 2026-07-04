import { describe, it, expect } from 'vitest';
import { classifyFile, classifyFiles, matchHighRiskPath, LOW_RISK_CATEGORIES } from '../src/analysis/file-classifier.js';
import type { FileChange } from '../src/shared/types.js';

function makeFile(path: string, patch = ''): FileChange {
  const ext = path.includes('.') ? path.split('.').pop()!.toLowerCase() : '';
  return {
    path,
    status: 'modified',
    additions: 1,
    deletions: 0,
    patch,
    extension: ext,
  };
}

describe('classifyFile', () => {
  it('classifies CI workflow files', () => {
    expect(classifyFile(makeFile('.github/workflows/ci.yml'))).toBe('ci');
    expect(classifyFile(makeFile('.gitlab-ci.yml'))).toBe('ci');
  });

  it('classifies database migrations', () => {
    expect(classifyFile(makeFile('db/migration/V1__init.sql'))).toBe('migration');
    expect(classifyFile(makeFile('src/migrations/001_add_users.ts'))).toBe('migration');
  });

  it('classifies test files before production', () => {
    // AuthService.test.ts should be 'test', not 'production'
    expect(classifyFile(makeFile('src/auth/AuthService.test.ts'))).toBe('test');
    expect(classifyFile(makeFile('src/auth/AuthService.spec.js'))).toBe('test');
    expect(classifyFile(makeFile('tests/helper.test.ts'))).toBe('test');
    expect(classifyFile(makeFile('src/__tests__/foo.ts'))).toBe('test');
  });

  it('classifies dependency manifests', () => {
    expect(classifyFile(makeFile('package.json'))).toBe('dependency');
    expect(classifyFile(makeFile('package-lock.json'))).toBe('dependency');
    expect(classifyFile(makeFile('pom.xml'))).toBe('dependency');
    expect(classifyFile(makeFile('build.gradle'))).toBe('dependency');
    expect(classifyFile(makeFile('go.mod'))).toBe('dependency');
    expect(classifyFile(makeFile('Cargo.toml'))).toBe('dependency');
  });

  it('classifies config files', () => {
    expect(classifyFile(makeFile('Dockerfile'))).toBe('config');
    expect(classifyFile(makeFile('.env'))).toBe('config');
    expect(classifyFile(makeFile('.env.local'))).toBe('config');
    expect(classifyFile(makeFile('src/main/resources/application.yml'))).toBe('config');
    expect(classifyFile(makeFile('app.yaml'))).toBe('config');
    expect(classifyFile(makeFile('tsconfig.json'))).toBe('config');
    expect(classifyFile(makeFile('app.properties'))).toBe('config');
  });

  it('classifies documentation', () => {
    expect(classifyFile(makeFile('README.md'))).toBe('documentation');
    expect(classifyFile(makeFile('docs/guide.md'))).toBe('documentation');
    expect(classifyFile(makeFile('CHANGELOG.md'))).toBe('documentation');
    expect(classifyFile(makeFile('LICENSE'))).toBe('documentation');
  });

  it('classifies style and assets', () => {
    expect(classifyFile(makeFile('src/styles.css'))).toBe('style-asset');
    expect(classifyFile(makeFile('src/theme.scss'))).toBe('style-asset');
    expect(classifyFile(makeFile('logo.svg'))).toBe('style-asset');
    expect(classifyFile(makeFile('icon.png'))).toBe('style-asset');
  });

  it('classifies source code as production', () => {
    expect(classifyFile(makeFile('src/index.ts'))).toBe('production');
    expect(classifyFile(makeFile('src/auth/AuthService.java'))).toBe('production');
    expect(classifyFile(makeFile('app/main.py'))).toBe('production');
    expect(classifyFile(makeFile('src/server.go'))).toBe('production');
  });
});

describe('classifyFiles', () => {
  it('classifies a batch of files', () => {
    const files = [makeFile('a.ts'), makeFile('b.test.ts'), makeFile('c.yml')];
    const result = classifyFiles(files);
    expect(result.get('a.ts')).toBe('production');
    expect(result.get('b.test.ts')).toBe('test');
    expect(result.get('c.yml')).toBe('config');
  });
});

describe('matchHighRiskPath', () => {
  const HIGH_PATHS = [
    '**/auth/**',
    '**/security/**',
    '**/payment/**',
    '**/config/**',
    '.github/workflows/**',
    '**/application.yml',
    '.env*',
    'Dockerfile',
    'package.json',
  ];

  it('matches auth paths', () => {
    expect(matchHighRiskPath('src/auth/AuthService.java', HIGH_PATHS)).toBe('**/auth/**');
  });

  it('matches payment paths', () => {
    expect(matchHighRiskPath('modules/payment/Checkout.ts', HIGH_PATHS)).toBe('**/payment/**');
  });

  it('matches .env variants', () => {
    expect(matchHighRiskPath('.env', HIGH_PATHS)).toBe('.env*');
    expect(matchHighRiskPath('.env.local', HIGH_PATHS)).toBe('.env*');
    expect(matchHighRiskPath('.env.production', HIGH_PATHS)).toBe('.env*');
  });

  it('matches root config files', () => {
    expect(matchHighRiskPath('Dockerfile', HIGH_PATHS)).toBe('Dockerfile');
    expect(matchHighRiskPath('package.json', HIGH_PATHS)).toBe('package.json');
  });

  it('matches application.yml anywhere', () => {
    expect(matchHighRiskPath('src/main/resources/application.yml', HIGH_PATHS)).toBe('**/application.yml');
  });

  it('returns undefined for non-matching paths', () => {
    expect(matchHighRiskPath('src/utils/helper.ts', HIGH_PATHS)).toBeUndefined();
    expect(matchHighRiskPath('README.md', HIGH_PATHS)).toBeUndefined();
  });
});

describe('LOW_RISK_CATEGORIES', () => {
  it('contains documentation and style-asset', () => {
    expect(LOW_RISK_CATEGORIES.has('documentation')).toBe(true);
    expect(LOW_RISK_CATEGORIES.has('style-asset')).toBe(true);
    expect(LOW_RISK_CATEGORIES.has('production')).toBe(false);
    expect(LOW_RISK_CATEGORIES.has('test')).toBe(false);
  });
});
