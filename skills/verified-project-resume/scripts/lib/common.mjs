/** Shared filesystem, hashing, time, and CLI utilities for both collector and workspace scripts. */

import { createHash } from "node:crypto";
import { closeSync, mkdirSync, openSync, readFileSync, readSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

export const VERSION = "0.2.0";

export function expandUser(value) { return value === "~" ? homedir() : value.startsWith("~/") ? join(homedir(), value.slice(2)) : value; }
export function absolutePath(value) { return resolve(expandUser(value)); }
export function utcNow() { return new Date().toISOString().replace(/\.\d{3}Z$/, "Z"); }
export function readJson(filename) { return JSON.parse(readFileSync(filename, "utf8")); }
export function writeJson(filename, value) { mkdirSync(dirname(filename), { recursive: true }); writeFileSync(filename, `${JSON.stringify(value, null, 2)}\n`, "utf8"); }

export function sha256File(filename) {
  const digest = createHash("sha256"), descriptor = openSync(filename, "r"), buffer = Buffer.allocUnsafe(1024 * 1024);
  try { for (;;) { const length = readSync(descriptor, buffer, 0, buffer.length, null); if (!length) break; digest.update(buffer.subarray(0, length)); } }
  finally { closeSync(descriptor); }
  return digest.digest("hex");
}

/**
 * Strict command-line parser shared by both scripts.
 * `commands` maps a command name to `{ required: [...], optional: [...], choices: { flag: [...] } }`
 * using underscore keys; flags are read as `--kebab-case value` pairs. Unknown commands, unknown
 * flags, missing values, missing required flags, and out-of-choice values all throw.
 * Returns `{ kind: "help" }`, `{ kind: "version" }`, or `{ kind: "run", args }`.
 */
export function parseCommandArgs(argv, commands) {
  if (argv[0] === "--help" || argv[0] === "-h") return { kind: "help" };
  if (argv[0] === "--version") return { kind: "version" };
  const [command, ...tokens] = argv, spec = commands[command];
  if (!spec) throw new Error(`argument command: invalid choice '${command}'`);
  const allowed = new Set([...spec.required, ...(spec.optional ?? [])]);
  const args = { command };
  for (let index = 0; index < tokens.length; index += 2) {
    const option = tokens[index];
    if (option === "--help" || option === "-h") return { kind: "help" };
    const key = option?.startsWith("--") ? option.slice(2).replaceAll("-", "_") : null;
    if (!key || !allowed.has(key) || index + 1 >= tokens.length) throw new Error(`unrecognized or incomplete argument: ${option ?? ""}`);
    args[key] = tokens[index + 1];
  }
  for (const key of spec.required) if (!args[key]) throw new Error(`required: --${key.replaceAll("_", "-")}`);
  for (const [key, choices] of Object.entries(spec.choices ?? {})) {
    if (args[key] != null && !choices.includes(args[key])) throw new Error(`argument --${key.replaceAll("_", "-")}: invalid choice '${args[key]}' (choose from ${choices.join(", ")})`);
  }
  return { kind: "run", args };
}
