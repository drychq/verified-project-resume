/** Ledger record envelope, JSONL I/O, domain constants, and deterministic evidence sealing. */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { sha256File } from "./common.mjs";

export const ADMISSIBLE_CLAIM_STATUSES = new Set(["verified", "user-confirmed"]);
export const ADMISSIBLE_METRIC_STATUSES = new Set(["verified-measured", "verified-count"]);
export const USER_SCOPES = new Set(["user-sole", "user-partial"]);
export const CONTEXT_SCOPES = ["project", "team", "starter"];
export const INADMISSIBLE_RESUME_SCOPES = ["starter", "third-party", "generated", "unknown"];
export const ACTION_KINDS = new Set(["designed", "implemented", "integrated", "configured", "called", "tested", "debugged", "optimized", "documented", "reviewed"]);
export const LOW_OWNERSHIP_ACTIONS = new Set(["integrated", "configured", "called"]);
export const LANGUAGES = ["zh-CN", "en"];
export const STORY_SECTIONS = ["situation", "task", "actions", "results"];
export const COMPRESSION_METHODS = ["action-method-result", "action-method-verified-capability"];
export const SHA256_RE = /^[a-f0-9]{64}$/;

export function isObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
export function arrays(value) { return Array.isArray(value) ? value : []; }
export function unique(values) { return [...new Set(values.filter((value) => typeof value === "string" && value))]; }
export function intersects(left, right) { const set = new Set(right); return left.some((value) => set.has(value)); }
export function subset(left, right) { const set = new Set(right); return left.every((value) => set.has(value)); }
export function sameSet(left, right) { return left.length === right.length && subset(left, right) && subset(right, left); }
export function union(values) { return unique(values.flatMap((value) => arrays(value))); }
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (isObject(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
export function sha256Text(value) { return createHash("sha256").update(value, "utf8").digest("hex"); }
export function record(record_type, id, data = {}, refs = {}) { return { record_type, id, data, refs }; }
export function ledgerPathFor(workspace) { return path.join(workspace, ".verified-resume", "ledger.jsonl"); }

export function resolveEvidencePath(project, raw, id) {
  if (path.isAbsolute(raw)) return raw;
  const root = project?.data.repo_root;
  if (typeof root !== "string" || !root) throw new Error(`evidence:${id}: relative locator path requires a project repo_root`);
  return path.join(root, raw);
}

export async function readLedger(filename) {
  const records = [];
  const lines = (await readFile(filename, "utf8")).split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].trim()) continue;
    try { records.push(JSON.parse(lines[index])); }
    catch (error) { throw new Error(`${filename}:${index + 1}: invalid JSONL record: ${error.message}`); }
  }
  return records;
}

export async function writeLedger(filename, records) {
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename, `${records.map((item) => JSON.stringify(item)).join("\n")}\n`, "utf8");
}

export function indexLedger(records) {
  const byId = new Map();
  const byType = new Map();
  for (const item of records) {
    if (!byType.has(item.record_type)) byType.set(item.record_type, []);
    byType.get(item.record_type).push(item);
    byId.set(item.id, item);
  }
  return { byId, byType };
}

export async function sealLedger(records) {
  const indexes = indexLedger(records);
  const project = (indexes.byType.get("project") ?? [])[0];
  for (const item of indexes.byType.get("evidence") ?? []) {
    if (item.data.availability !== "collected") { item.data.digest_basis = "not-applicable"; item.data.sha256 = null; continue; }
    if (item.data.digest_basis === "canonical-record") {
      item.data.sha256 = sha256Text(canonical({ type: item.data.type, title: item.data.title, locator: item.data.locator ?? {}, excerpt: item.data.excerpt ?? null }));
    } else if (item.data.digest_basis === "user-confirmation-text") {
      if (typeof item.data.excerpt !== "string") throw new Error(`evidence:${item.id}: user confirmation requires excerpt text`);
      item.data.sha256 = sha256Text(item.data.excerpt);
    } else if (item.data.digest_basis === "file-bytes") {
      const raw = item.data.locator?.artifact_path ?? item.data.locator?.path;
      if (typeof raw !== "string" || !raw) throw new Error(`evidence:${item.id}: file-bytes requires locator path`);
      item.data.sha256 = sha256File(resolveEvidencePath(project, raw, item.id));
    } else throw new Error(`evidence:${item.id}: unknown digest basis '${item.data.digest_basis}'`);
  }
  return records;
}
