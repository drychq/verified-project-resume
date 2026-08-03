#!/usr/bin/env node
/** CLI entry and stable public API for private ledger validation, legacy import, and rendering. */

import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { VERSION, absolutePath, parseCommandArgs } from "./lib/common.mjs";
import { ledgerPathFor, readLedger, sealLedger, writeLedger } from "./lib/ledger.mjs";
import { validateLedger } from "./lib/validate.mjs";
import { renderWorkspace } from "./lib/render.mjs";
import { importLegacyArchive } from "./lib/import-legacy.mjs";

export { indexLedger, ledgerPathFor, readLedger, sealLedger, writeLedger } from "./lib/ledger.mjs";
export { auditLedger, validateLedger } from "./lib/validate.mjs";
export { renderPool, renderResume, renderReview, renderStar, renderWorkspace } from "./lib/render.mjs";
export { importLegacyArchive } from "./lib/import-legacy.mjs";

const COMMANDS = {
  seal: { required: ["ledger"], optional: [] },
  validate: { required: ["ledger"], optional: ["stage"], choices: { stage: ["star", "resume"] } },
  render: { required: ["ledger", "workspace"], optional: ["stage"], choices: { stage: ["star", "resume"] } },
  "import-legacy": { required: ["archive", "workspace"], optional: [] },
};

const HELP = `usage: workspace.mjs {seal,validate,render,import-legacy} [options]

Private JSONL ledger validation, legacy import, and deterministic Markdown rendering.

commands:
  seal --ledger <ledger.jsonl>
      Fill evidence digests (canonical-record, user-confirmation-text, file-bytes) deterministically.
  validate --ledger <ledger.jsonl> [--stage star|resume]
      Check the ledger and report every violation without writing anything. Default stage: resume.
  render --ledger <ledger.jsonl> --workspace <dir> [--stage star|resume]
      Validate, then write star.md, resume-candidate-pool.md, resume.md, and review.md into the workspace.
  import-legacy --archive <star-project.json> --workspace <dir>
      Import a retired schema_version 1.0.0 archive into a new workspace ledger for review.

options:
  -h, --help     Show this help.
  --version      Print the skill version.

exit codes: 0 success; 1 validation or refusal failure; 2 usage error.`;

export async function main(argv = process.argv.slice(2)) {
  let parsed;
  try { parsed = parseCommandArgs(argv, COMMANDS); }
  catch (error) { console.error(`workspace.mjs: error: ${error.message}`); console.error("run 'workspace.mjs --help' for usage"); return 2; }
  if (parsed.kind === "help") { console.log(HELP); return 0; }
  if (parsed.kind === "version") { console.log(`verified-project-resume ${VERSION}`); return 0; }
  const args = parsed.args;

  if (args.command === "import-legacy") {
    const archivePath = absolutePath(args.archive);
    let archive;
    try { archive = JSON.parse(await readFile(archivePath, "utf8")); }
    catch (error) { console.error(`workspace.mjs: error: ${archivePath}: invalid legacy archive JSON: ${error.message}`); return 2; }
    const records = importLegacyArchive(archive);
    const workspace = absolutePath(args.workspace), ledger = ledgerPathFor(workspace);
    try { if ((await stat(ledger)).isFile()) { console.error(`error: refusing to overwrite existing ledger: ${ledger}`); return 1; } } catch (error) { if (error.code !== "ENOENT") throw error; }
    const errors = await validateLedger(records, { stage: "star", verifyFiles: true });
    if (errors.length) { errors.forEach((error) => console.error(`ERROR ${error}`)); return 1; }
    await writeLedger(ledger, records);
    const renderErrors = await renderWorkspace(records, workspace, "star");
    if (renderErrors.length) { renderErrors.forEach((error) => console.error(`ERROR ${error}`)); return 1; }
    console.log(`legacy facts imported; review required before resume use: ${workspace}`);
    return 0;
  }

  const ledger = absolutePath(args.ledger), records = await readLedger(ledger);
  if (args.command === "seal") {
    await sealLedger(records); await writeLedger(ledger, records); console.log(`sealed evidence digests: ${ledger}`); return 0;
  }
  if (args.command === "validate") {
    const errors = await validateLedger(records, { stage: args.stage ?? "resume", verifyFiles: true });
    if (errors.length) { errors.forEach((error) => console.error(`ERROR ${error}`)); return 1; }
    console.log(`${args.stage ?? "resume"} workflow is valid`); return 0;
  }
  const workspace = absolutePath(args.workspace);
  const errors = await renderWorkspace(records, workspace, args.stage ?? "resume");
  if (errors.length) { errors.forEach((error) => console.error(`ERROR ${error}`)); return 1; }
  console.log(`rendered verified workspace: ${workspace}`); return 0;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().then((code) => { process.exitCode = code; }).catch((error) => { console.error(`workspace.mjs: error: ${error.message}`); process.exitCode = 2; });
}
