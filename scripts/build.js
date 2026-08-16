import { build as esbuild } from 'esbuild';
import { copyFileSync, existsSync, mkdirSync, rmSync, cpSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const outDir = resolve(__dirname, '../dist');

async function runBuild() {
  // Clean dist directory
  if (existsSync(outDir)) {
    rmSync(outDir, { recursive: true, force: true });
  }
  mkdirSync(outDir, { recursive: true });

  // Build server/index.ts -> dist/server/index.js
  await esbuild({
    entryPoints: ['server/index.ts'],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    outdir: join(outDir, 'server'),
    external: ['better-sqlite3'],
    format: 'esm',
    banner: {
      js: 'import { createRequire } from "module"; import { fileURLToPath } from "url"; import { dirname, resolve } from "path"; const require = createRequire(import.meta.url); const __filename = fileURLToPath(import.meta.url); const __dirname = dirname(__filename);'
    },
    define: {
      'process.env.NODE_ENV': '"production"'
    },
    treeShaking: true,
    minify: false,
    sourcemap: false,
  });

  // Copy non-TypeScript files (drizzle config, etc.)
  const filesToCopy = [
    'drizzle.config.ts',
    'drizzle.pg.config.ts',
  ];

  for (const file of filesToCopy) {
    const src = resolve(__dirname, '..', file);
    const dest = resolve(outDir, file);
    if (existsSync(src)) {
      cpSync(src, dest);
    }
  }

  // Copy server/db.ts and server/schema.ts as they are needed at runtime
  const serverFiles = [
    'server/db.ts',
    'server/schema.ts',
    'server/auth/password.ts',
    'server/auth/token.ts',
  ];

  for (const file of serverFiles) {
    const src = resolve(__dirname, '..', file);
    const dest = resolve(outDir, file);
    if (existsSync(src)) {
      const destDir = resolve(dest, '..');
      if (!existsSync(destDir)) {
        mkdirSync(destDir, { recursive: true });
      }
      cpSync(src, dest);
    }
  }

  // Copy drizzle config files
  const drizzleFiles = ['drizzle.config.ts', 'drizzle.pg.config.ts'];
  for (const file of drizzleFiles) {
    const src = resolve(__dirname, '..', file);
    const dest = resolve(outDir, file);
    if (existsSync(src)) {
      cpSync(src, dest);
    }
  }

  // Copy package.json and package-lock.json for dependencies
  cpSync(resolve(__dirname, '..', 'package.json'), resolve(outDir, 'package.json'));
  if (existsSync(resolve(__dirname, '..', 'package-lock.json'))) {
    cpSync(resolve(__dirname, '..', 'package-lock.json'), resolve(outDir, 'package-lock.json'));
  }

  console.log('Build completed successfully!');
}

runBuild().catch(() => process.exit(1));