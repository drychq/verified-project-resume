#!/usr/bin/env node
/** Offline read-only repository inventory and Git evidence collection. */

import { lstatSync, readdirSync, readlinkSync, statSync } from 'node:fs';
import { basename, extname, join, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { VERSION, absolutePath, parseCommandArgs, readJson, sha256File, utcNow, writeJson } from './lib/common.mjs';

const DOC_NAMES = new Set(['readme', 'license', 'changelog', 'contributing', 'authors', 'design', 'architecture']);
const BUILD_NAMES = new Set(['cmakelists.txt', 'makefile', 'meson.build', 'build.gradle', 'pom.xml', 'package.json', 'pyproject.toml', 'setup.py', 'cargo.toml', 'go.mod', 'build.zig', 'justfile']);
const DEPENDENCY_NAMES = new Set(['requirements.txt', 'poetry.lock', 'pdm.lock', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'cargo.lock', 'go.sum', 'vcpkg.json', 'conanfile.txt', 'conanfile.py']);
const SOURCE_EXTENSIONS = new Set(['.c', '.cc', '.cpp', '.cxx', '.h', '.hh', '.hpp', '.hxx', '.m', '.mm', '.py', '.rs', '.go', '.java', '.kt', '.kts', '.cs', '.js', '.jsx', '.ts', '.tsx', '.vue', '.swift', '.scala', '.sql', '.proto', '.glsl', '.vert', '.frag', '.comp', '.qml']);

function classifyFile(relativePath) {
  const lower = relativePath.toLowerCase(), parts = lower.split('/'), name = parts.at(-1), suffix = extname(name), stem = basename(name, suffix);
  if (parts.some((part) => ['vendor', 'vendors', 'third_party', 'third-party', 'external', 'extern'].includes(part))) return ['vendor', 'path identifies bundled third-party code'];
  if (parts.some((part) => ['generated', 'gen', 'autogen'].includes(part)) || name.endsWith('.generated.h') || name.endsWith('.generated.cpp')) return ['generated', 'path or filename identifies generated code'];
  if (DEPENDENCY_NAMES.has(name) || (name.includes('lock') && ['.json', '.yaml', '.yml', '.lock'].some((ending) => name.endsWith(ending)))) return ['dependency', 'dependency manifest or lock file'];
  if (BUILD_NAMES.has(name) || parts.slice(0, -1).some((part) => ['cmake', 'build', 'scripts'].includes(part))) return ['build', 'build or automation configuration'];
  if (parts.some((part) => ['benchmark', 'benchmarks', 'bench', 'benches'].includes(part)) || name.includes('benchmark')) return ['benchmark', 'benchmark path or filename'];
  if (parts.some((part) => ['test', 'tests', 'testing', 'spec', 'specs'].includes(part)) || name.startsWith('test_') || ['_test.py', '_test.cpp', '.spec.ts', '.test.js'].some((ending) => name.endsWith(ending))) return ['test', 'test path or filename'];
  if (['.md', '.rst', '.adoc', '.txt'].includes(suffix) && (DOC_NAMES.has(stem) || parts.some((part) => ['doc', 'docs'].includes(part)))) return ['documentation', 'documentation path or recognized document'];
  if (SOURCE_EXTENSIONS.has(suffix)) return ['source', 'recognized source-code extension'];
  return ['other', 'no deterministic category matched'];
}

function inventoryTree(repo, current, records, skipped) {
  let entries;
  try { entries = readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en')); }
  catch { return; }
  for (const entry of entries) {
    if (entry.name === '.git' && entry.isDirectory()) continue;
    const filename = join(current, entry.name), relativePath = relative(repo, filename).split(sep).join('/');
    try {
      const info = lstatSync(filename);
      if (info.isSymbolicLink()) {
        let directoryLink = false; try { directoryLink = statSync(filename).isDirectory(); } catch {}
        if (!directoryLink) records.push({ path: relativePath, category: 'other', classification_reason: 'symbolic link; target was not followed', size: null, sha256: null, symlink_target: readlinkSync(filename) });
      } else if (info.isDirectory()) inventoryTree(repo, filename, records, skipped);
      else {
        const [category, reason] = classifyFile(relativePath);
        records.push({ path: relativePath, category, classification_reason: reason, size: info.size, sha256: sha256File(filename), symlink_target: null });
      }
    } catch (error) { skipped.push({ path: relativePath, reason: error.message }); }
  }
}

export function commandInventory(args) {
  const repo = absolutePath(args.repo);
  try { if (!statSync(repo).isDirectory()) throw new Error(); } catch { console.error(`error: repository path is not a directory: ${repo}`); return 2; }
  const files = [], skipped = []; inventoryTree(repo, repo, files, skipped);
  const counts = {}; for (const item of files) counts[item.category] = (counts[item.category] ?? 0) + 1;
  writeJson(absolutePath(args.out), { repo_root: repo, collected_at: utcNow(), collection_policy: 'read-only-no-project-execution', files, category_counts: Object.fromEntries(Object.entries(counts).sort()), skipped });
  return 0;
}

function runGit(repo, parameters, check = true) {
  const result = spawnSync('git', ['-C', repo, ...parameters], { encoding: 'utf8', env: { ...process.env }, shell: false });
  if (result.error) throw result.error;
  const completed = { returncode: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
  if (check && completed.returncode !== 0) { const error = new Error(`git exited with status ${completed.returncode}`); Object.assign(error, completed); throw error; }
  return completed;
}

function parseIdentity(filename) {
  const raw = readJson(filename), names = raw?.names ?? [], emails = raw?.emails ?? [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !Array.isArray(names) || !names.every((value) => typeof value === 'string') || !Array.isArray(emails) || !emails.every((value) => typeof value === 'string')) throw new Error('identity requires string arrays names and emails');
  const normalize = (values) => [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
  return { names: normalize(names), emails: normalize(emails), github_handle: raw.github_handle ?? null, status: raw.status ?? (names.length || emails.length ? 'partial' : 'missing') };
}

function identityMatches(name, email, identity) {
  const reasons = [], normalizedName = name.trim().toLowerCase(), normalizedEmail = email.trim().toLowerCase();
  if (normalizedName && identity.names.some((value) => value.toLowerCase() === normalizedName)) reasons.push('author-name');
  if (normalizedEmail && identity.emails.some((value) => value.toLowerCase() === normalizedEmail)) reasons.push('author-email');
  return reasons;
}

// Splits git's "prefix{old => new}suffix" and plain "old => new" rename syntax into joinable paths.
function parseRenamePath(value) {
  const brace = value.match(/^(.*)\{(.*) => (.*)\}(.*)$/);
  if (brace) {
    const compose = (segment) => (brace[1] + segment + brace[4]).replaceAll('//', '/');
    return { path: compose(brace[3]), previous_path: compose(brace[2]) };
  }
  const arrow = value.split(' => ');
  if (arrow.length === 2) return { path: arrow[1], previous_path: arrow[0] };
  return { path: value, previous_path: null };
}

function parseNumstat(text) {
  const output = [];
  for (const line of text.split(/\r?\n/)) {
    const parts = line.split('\t'); if (parts.length < 3) continue;
    output.push({ ...parseRenamePath(parts.slice(2).join('\t')), added_lines: parts[0] === '-' ? null : Number.parseInt(parts[0], 10), deleted_lines: parts[1] === '-' ? null : Number.parseInt(parts[1], 10) });
  }
  return output;
}

const COAUTHOR_RE = /^Co-authored-by:\s*(.*?)\s*<([^>]+)>\s*$/gim;

function commitDetails(repo, sha) {
  // The body is the final field, so any field separator inside it must be rejoined, not truncated.
  const fields = runGit(repo, ['show', '-s', '--format=%H%x1f%P%x1f%an%x1f%ae%x1f%aI%x1f%cn%x1f%ce%x1f%cI%x1f%s%x1f%b', sha]).stdout.replace(/\n$/, '').split('\x1f');
  if (fields.length < 10) throw new Error(`could not parse commit metadata for ${sha}`);
  const body = fields.slice(9).join('\x1f');
  const coauthors = [...body.matchAll(COAUTHOR_RE)].map((match) => ({ name: match[1].trim(), email: match[2].trim() }));
  return {
    sha: fields[0], parents: fields[1] ? fields[1].split(/\s+/) : [], author: { name: fields[2], email: fields[3], date: fields[4] }, committer: { name: fields[5], email: fields[6], date: fields[7] }, subject: fields[8], body: body.trimEnd(), coauthors,
    is_merge: Boolean(fields[1] && fields[1].split(/\s+/).length > 1),
    changed_files: parseNumstat(runGit(repo, ['show', '--format=', '--numstat', '--find-renames', sha]).stdout),
    hunk_headers: runGit(repo, ['show', '--format=', '--unified=0', '--find-renames', sha]).stdout.split(/\r?\n/).filter((line) => line.startsWith('@@')),
  };
}

function baseline(repo, ref, head, kind) {
  const resolved = runGit(repo, ['rev-parse', '--verify', ref], false);
  if (resolved.returncode !== 0) return { kind, ref, availability: 'failed', reason: resolved.stderr.trim(), changed_files: [] };
  const diff = runGit(repo, ['diff', '--numstat', '--find-renames', `${ref}...${head}`], false);
  if (diff.returncode !== 0) return { kind, ref, availability: 'failed', reason: diff.stderr.trim(), changed_files: [] };
  return { kind, ref, resolved_sha: resolved.stdout.trim(), availability: 'collected', reason: null, changed_files: parseNumstat(diff.stdout) };
}

function unavailable(repo, identity, reason) {
  return { repo_root: repo, collected_at: utcNow(), availability: 'unavailable', reason, identity, revision: null, remotes: [], initial_commits: [], commit_count: null, identity_commits: [], identity_commit_count: 0, baselines: [] };
}

export function commandGit(args) {
  const repo = absolutePath(args.repo), out = absolutePath(args.out);
  let identity; try { identity = parseIdentity(absolutePath(args.identity)); } catch (error) { console.error(`error: invalid identity file: ${error.message}`); return 2; }
  let probe = null, isDirectory = false; try { isDirectory = statSync(repo).isDirectory(); } catch {}
  if (isDirectory) {
    try { probe = runGit(repo, ['rev-parse', '--show-toplevel'], false); }
    catch (error) { if (error.code !== 'ENOENT') throw error; writeJson(out, unavailable(repo, identity, 'git executable is unavailable')); return 0; }
  }
  if (!probe || probe.returncode !== 0 || resolve(probe.stdout.trim()) !== repo) { writeJson(out, unavailable(repo, identity, 'path is not the root of a standalone Git work tree')); return 0; }
  const head = runGit(repo, ['rev-parse', 'HEAD']).stdout.trim();
  const remotes = runGit(repo, ['remote', '-v'], false).stdout.split(/\r?\n/).filter(Boolean).map((line) => { const fields = line.trim().split(/\s+/); return { name: fields[0], url: fields[1], kind: fields[2]?.replace(/^\(|\)$/g, '') }; });
  const logArgs = ['log', '--all', '--format=%H%x1f%an%x1f%ae%x1f%aI%x1f%b%x1e'];
  if (args.start_date) logArgs.push(`--since=${args.start_date}`); if (args.end_date) logArgs.push(`--until=${args.end_date}`);
  const matched = [];
  for (const raw of runGit(repo, logArgs).stdout.split('\x1e')) {
    const fields = raw.replace(/^\n+|\n+$/g, '').split('\x1f'); if (fields.length < 5) continue;
    const body = fields.slice(4).join('\x1f');
    const reasons = identityMatches(fields[1], fields[2], identity);
    for (const match of body.matchAll(COAUTHOR_RE)) for (const reason of identityMatches(match[1], match[2], identity)) { const value = reason.replace('author-', 'coauthor-'); if (!reasons.includes(value)) reasons.push(value); }
    if (reasons.length) { const details = commitDetails(repo, fields[0]); details.identity_match_reasons = reasons; matched.push(details); }
  }
  const baselines = []; if (args.starter_ref) baselines.push(baseline(repo, args.starter_ref, head, 'starter')); if (args.upstream_ref) baselines.push(baseline(repo, args.upstream_ref, head, 'upstream'));
  writeJson(out, {
    repo_root: repo, collected_at: utcNow(), availability: 'collected', reason: null, identity, revision: head, remotes,
    initial_commits: runGit(repo, ['rev-list', '--max-parents=0', '--all'], false).stdout.split(/\r?\n/).filter(Boolean),
    commit_count: Number.parseInt(runGit(repo, ['rev-list', '--count', '--all']).stdout.trim(), 10), identity_commits: matched, identity_commit_count: matched.length, baselines,
    limitations: ['An identity match locates candidate commits; it does not prove sole authorship or technical ownership.', 'Squash, rebases, shared accounts, co-authorship, and missing identities require separate interpretation.'],
  });
  return 0;
}

const COMMANDS = {
  inventory: { fn: commandInventory, required: ['repo', 'out'], optional: [] },
  git: { fn: commandGit, required: ['repo', 'identity', 'out'], optional: ['start_date', 'end_date', 'starter_ref', 'upstream_ref'] },
};

const USAGE = 'usage: collect_evidence.mjs {inventory,git} ...';
const HELP = `${USAGE}

Offline read-only repository inventory and Git evidence collection. Never executes project code.

commands:
  inventory --repo <dir> --out <file>
      Classify every repository file deterministically without executing anything.
  git --repo <dir> --identity <identity.json> --out <file>
      [--start-date <date>] [--end-date <date>] [--starter-ref <ref>] [--upstream-ref <ref>]
      Collect commits matching the confirmed identity plus optional baseline diffs.
      Writes an "unavailable" artifact instead of failing when git or the repository is missing.

options:
  -h, --help     Show this help.
  --version      Print the skill version.

exit codes: 0 success or recorded degradation; 2 usage error.`;

export function main(argv = process.argv.slice(2)) {
  let parsed;
  try { parsed = parseCommandArgs(argv, COMMANDS); }
  catch (error) { console.error(USAGE); console.error(`collect_evidence.mjs: error: ${error.message}`); return 2; }
  if (parsed.kind === 'help') { console.log(HELP); return 0; }
  if (parsed.kind === 'version') { console.log(`verified-project-resume ${VERSION}`); return 0; }
  try { return COMMANDS[parsed.args.command].fn(parsed.args); }
  catch (error) { console.error(`collect_evidence.mjs: error: ${error.message}`); return 2; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = main();
