#!/usr/bin/env node
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { makeNarrationRecords, makeRepositoryRecords } from './fixture-data.mjs';
import { renderWorkspace, writeRecords } from '../skills/verified-project-resume/scripts/workspace.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEMOS = [
  { dir: path.join(ROOT, 'examples/synthetic-demo'), records: () => makeRepositoryRecords({ storyCount: 6, selectedCount: 3, languages: ['zh-CN', 'en'] }) },
  { dir: path.join(ROOT, 'examples/narration-demo'), records: () => makeNarrationRecords() },
];

export async function main() {
  for (const demo of DEMOS) {
    const records = demo.records();
    const privateDirectory = path.join(demo.dir, '.verified-resume');
    await mkdir(privateDirectory, { recursive: true });
    await writeRecords(path.join(privateDirectory, 'records.jsonl'), records);
    const errors = await renderWorkspace(records, demo.dir, 'resume');
    if (errors.length) throw new Error(`invalid demo workspace ${demo.dir}:\n${errors.join('\n')}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
