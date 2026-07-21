#!/usr/bin/env node
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { makeLedger } from './fixture-data.mjs';
import { renderWorkspace, writeLedger } from '../skills/verified-project-resume/scripts/workspace.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEMO = path.join(ROOT, 'examples/synthetic-demo');

export async function main() {
  const records = makeLedger({ storyCount: 6, selectedCount: 3, languages: ['zh-CN', 'en'] });
  const privateDirectory = path.join(DEMO, '.verified-resume');
  await mkdir(privateDirectory, { recursive: true });
  await writeLedger(path.join(privateDirectory, 'ledger.jsonl'), records);
  const errors = await renderWorkspace(records, DEMO, 'resume');
  if (errors.length) throw new Error(`invalid demo workspace:\n${errors.join('\n')}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
