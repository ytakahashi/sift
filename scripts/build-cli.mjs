import { build } from 'esbuild';
import { readReviewSkillFiles } from '../src/mcp/review-skill-files.ts';

const reviewSkills = await readReviewSkillFiles();

await build({
  entryPoints: ['src/entrypoints/cli/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outdir: 'dist/cli',
  packages: 'external',
  banner: { js: '#!/usr/bin/env node' },
  define: { __SIFT_REVIEW_SKILLS__: JSON.stringify(reviewSkills) },
  logLevel: 'info',
});
