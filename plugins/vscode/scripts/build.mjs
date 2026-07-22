import { build, context } from 'esbuild';

const watch = process.argv.includes('--watch');
const options = {
  entryPoints: ['src/extension.ts'],
  outfile: 'dist/extension.js',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  sourcemap: watch,
  sourcesContent: false,
  minify: !watch,
  external: ['vscode'],
  define: {
    'import.meta.url': '__aiChangeRadarModuleUrl',
  },
  banner: {
    js: 'var __aiChangeRadarModuleUrl = require("node:url").pathToFileURL(__filename).href;',
  },
  logLevel: 'info',
};

if (watch) {
  const buildContext = await context(options);
  await buildContext.watch();
  console.log('Watching AI Change Radar VS Code extension sources…');
} else {
  await build(options);
}
