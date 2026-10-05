#!/usr/bin/env node
/** CLI entry and stable public API for private record validation and rendering. */

import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { VERSION, absolutePath, parseCommandArgs } from "./lib/common.mjs";
import { indexRecords, readRecords, sealRecords, writeRecords } from "./lib/records.mjs";
import { validateRecords } from "./lib/validate.mjs";
import { renderBulletOptions, renderResume, renderReview, renderStories, renderWorkspace } from "./lib/render.mjs";

export { indexRecords, readRecords, sealRecords, writeRecords } from "./lib/records.mjs";
export { auditRecords, validateRecords } from "./lib/validate.mjs";
export { renderBulletOptions, renderResume, renderReview, renderStories, renderWorkspace } from "./lib/render.mjs";

const COMMANDS = {
  seal: { required: ["records"], optional: [] },
  validate: { required: ["records"], optional: ["stage"], choices: { stage: ["star", "resume"] } },
  render: { required: ["records", "workspace"], optional: ["stage"], choices: { stage: ["star", "resume"] } },
};

const HELP = `usage: workspace.mjs {seal,validate,render} [options]

Validate the private JSONL records file and render the four Markdown files.

commands:
  seal --records <records.jsonl>
      Fill evidence digests (canonical-record, user-confirmation-text, proposal-confirmation-text, file-bytes) deterministically.
  validate --records <records.jsonl> [--stage star|resume]
      Check the records file and report every violation without writing anything. Default stage: resume.
  render --records <records.jsonl> --workspace <dir> [--stage star|resume]
      Validate, then write stories.md, bullet-options.md, resume.md, and review.md into the workspace.

options:
  -h, --help     Show this help.
  --version      Print the skill version.

exit codes: 0 success; 1 validation failure; 2 usage error.`;

export async function main(argv = process.argv.slice(2)) {
  let parsed;
  try { parsed = parseCommandArgs(argv, COMMANDS); }
  catch (error) { console.error(`workspace.mjs: error: ${error.message}`); console.error("run 'workspace.mjs --help' for usage"); return 2; }
  if (parsed.kind === "help") { console.log(HELP); return 0; }
  if (parsed.kind === "version") { console.log(`verified-project-resume ${VERSION}`); return 0; }
  const args = parsed.args;

  const recordsPath = absolutePath(args.records), records = await readRecords(recordsPath);
  if (args.command === "seal") {
    await sealRecords(records); await writeRecords(recordsPath, records); console.log(`sealed evidence digests: ${recordsPath}`); return 0;
  }
  if (args.command === "validate") {
    const warnings = [];
    const errors = await validateRecords(records, { stage: args.stage ?? "resume", verifyFiles: true, warnings });
    for (const warning of new Set(warnings)) console.error(`WARNING ${warning}`);
    if (errors.length) { errors.forEach((error) => console.error(`ERROR ${error}`)); return 1; }
    console.log(`${args.stage ?? "resume"} workflow is valid`); return 0;
  }
  const workspace = absolutePath(args.workspace);
  const errors = await renderWorkspace(records, workspace, args.stage ?? "resume");
  if (errors.length) { errors.forEach((error) => console.error(`ERROR ${error}`)); return 1; }
  console.log(`rendered workspace: ${workspace}`); return 0;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().then((code) => { process.exitCode = code; }).catch((error) => { console.error(`workspace.mjs: error: ${error.message}`); process.exitCode = 2; });
}
