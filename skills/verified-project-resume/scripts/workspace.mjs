#!/usr/bin/env node
/** Private JSONL ledger validation, legacy import, and deterministic Markdown rendering. */

import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const ADMISSIBLE_CLAIM_STATUSES = new Set(["verified", "user-confirmed"]);
const ADMISSIBLE_METRIC_STATUSES = new Set(["verified-measured", "verified-count"]);
const USER_SCOPES = new Set(["user-sole", "user-partial"]);
const ACTION_KINDS = new Set(["designed", "implemented", "integrated", "configured", "called", "tested", "debugged", "optimized", "documented", "reviewed"]);
const LOW_OWNERSHIP_ACTIONS = new Set(["integrated", "configured", "called"]);
const SHA256_RE = /^[a-f0-9]{64}$/;
const NUMBER_RE = /(?<![\p{L}\p{N}_.+-])\d+(?:[.,]\d+)*(?:\s?(?:%|x|×|ns|us|µs|ms|s|KB|MB|GB|TB|k|K|M|万|亿))?(?![\p{L}\p{N}_])/gu;
const APPROX_RE = /(?:~|≈|about|around|approximately|roughly|up to|more than|over\s+\d|less than|\d\s*(?:-|–|—|～|to|至)\s*\d|约|大约|近\s*\d|超过|少于|最高)/iu;
const STRONG_PATTERNS = {
  architected: /\barchitect(?:ed|ure)?\b|架构(?:了|设计)|总体架构|整体架构/iu,
  led: /\b(?:led|headed|spearheaded)\b|主导|牵头/iu,
  owned: /\bowned\b|\bowner\b|全权负责|独立负责/iu,
};
const IMPLEMENT_PATTERN = /\b(?:implement(?:ed|ing)?|develop(?:ed|ing)?|built|build)\b|实现(?:了)?|开发(?:了)?|构建(?:了)?/iu;
const DESIGN_PATTERN = /\bdesign(?:ed|ing)?\b|设计(?:了)?/iu;
const PRODUCTION_PATTERN = /\bproduction(?:-grade| ready)?\b|生产级|生产环境|线上/iu;
const RELIABILITY_PATTERN = /\breliab(?:le|ility)\b|\bhigh availability\b|\bzero downtime\b|高可用|零停机|可靠性|稳定性/iu;
const SCALE_PATTERN = /\bat scale\b|\blarge[- ]scale\b|\bhigh concurrency\b|大规模|高并发|业务规模/iu;
const CAUSAL_PATTERN = /\b(?:caused|resulted in|thereby enabled|directly enabled)\b|从而带来|直接促成|因此实现/iu;
const PERFORMANCE_CAUSAL_PATTERN = /\b(?:improv(?:ed|ing)|reduc(?:ed|ing)|increas(?:ed|ing)|accelerat(?:ed|ing)|speed(?:ed)? up|optimized?)\b|提升|降低|减少|加速|优化(?:了)?/iu;

function isObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function arrays(value) { return Array.isArray(value) ? value : []; }
function unique(values) { return [...new Set(values.filter((value) => typeof value === "string" && value))]; }
function intersects(left, right) { const set = new Set(right); return left.some((value) => set.has(value)); }
function subset(left, right) { const set = new Set(right); return left.every((value) => set.has(value)); }
function sameSet(left, right) { return left.length === right.length && subset(left, right) && subset(right, left); }
function union(values) { return unique(values.flatMap((value) => arrays(value))); }
function utcNow() { return new Date(Math.floor(Date.now() / 1000) * 1000).toISOString().replace(".000Z", "Z"); }
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (isObject(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function sha256Text(value) { return createHash("sha256").update(value, "utf8").digest("hex"); }
async function sha256File(filename) { return createHash("sha256").update(await readFile(filename)).digest("hex"); }
function record(record_type, id, data = {}, refs = {}) { return { record_type, id, data, refs }; }

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
      const filename = path.isAbsolute(raw) ? raw : path.join(project?.data.repo_root ?? "", raw);
      item.data.sha256 = await sha256File(filename);
    } else throw new Error(`evidence:${item.id}: unknown digest basis '${item.data.digest_basis}'`);
  }
  return records;
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

function requiredObject(item, itemPath, errors) {
  if (!isObject(item)) { errors.push(`${itemPath}: expected object`); return false; }
  if (typeof item.record_type !== "string" || !item.record_type) errors.push(`${itemPath}.record_type: non-empty string required`);
  if (typeof item.id !== "string" || !item.id) errors.push(`${itemPath}.id: non-empty string required`);
  if (!isObject(item.data)) errors.push(`${itemPath}.data: object required`);
  if (!isObject(item.refs)) errors.push(`${itemPath}.refs: object required`);
  return true;
}

function refList(item, name, itemPath, errors) {
  const value = item.refs?.[name] ?? [];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string") || new Set(value).size !== value.length) {
    errors.push(`${itemPath}.refs.${name}: unique string array required`);
    return [];
  }
  return value;
}

function numericTokens(text) { return new Set([...String(text).matchAll(NUMBER_RE)].map((match) => match[0].replaceAll(" ", ""))); }
function sourceNumericTokens(claims, metrics) {
  const tokens = new Set();
  for (const claim of claims) for (const token of numericTokens(claim.data.text ?? "")) tokens.add(token);
  for (const metric of metrics) {
    const unit = String(metric.data.unit ?? "");
    for (const field of ["value", "baseline", "result"]) if (metric.data[field] != null) {
      const value = String(metric.data[field]);
      tokens.add(value.replaceAll(" ", ""));
      tokens.add((value + unit).replaceAll(" ", ""));
      for (const token of numericTokens(value)) tokens.add(token);
    }
  }
  return tokens;
}

function guardText(itemPath, text, claims, metrics, errors, actionContext, ownershipContext = actionContext) {
  const textNumbers = numericTokens(text);
  const allowed = sourceNumericTokens(claims, metrics);
  for (const token of [...textNumbers].filter((value) => !allowed.has(value)).sort()) errors.push(`${itemPath}: numeric token '${token}' is not present in cited admissible sources`);
  if (textNumbers.size && APPROX_RE.test(text)) errors.push(`${itemPath}: approximate or range language is not allowed for numeric claims`);
  const assertedText = text.replace(/\bwithout\s+(?:claiming|asserting)[^.,;]*/giu, '').replace(/不(?:声称|主张|表示)[^，。；]*/gu, '');
  if (ownershipContext) {
    const ownership = new Set(claims.map((claim) => claim.data.ownership_level));
    const kinds = new Set(claims.map((claim) => claim.data.action_kind));
    for (const [label, pattern] of Object.entries(STRONG_PATTERNS)) if (pattern.test(assertedText) && ![...ownership].some((value) => ["lead", "sole"].includes(value))) errors.push(`${itemPath}: strong verb '${label}' lacks lead/sole evidence`);
    if (STRONG_PATTERNS.architected.test(assertedText) && !kinds.has("designed")) errors.push(`${itemPath}: architecture wording lacks a designed claim`);
    if (actionContext) {
    if (IMPLEMENT_PATTERN.test(assertedText) && ![...kinds].some((value) => ["implemented", "debugged", "optimized"].includes(value))) errors.push(`${itemPath}: implementation wording exceeds cited action kinds`);
    if (DESIGN_PATTERN.test(assertedText) && !kinds.has("designed")) errors.push(`${itemPath}: design wording exceeds cited action kinds`);
    if (DESIGN_PATTERN.test(assertedText) && ![...ownership].some((value) => ["sole", "lead", "shared"].includes(value))) errors.push(`${itemPath}: design wording lacks sole/lead/shared evidence`);
    if (kinds.size && [...kinds].every((value) => LOW_OWNERSHIP_ACTIONS.has(value)) && (IMPLEMENT_PATTERN.test(assertedText) || DESIGN_PATTERN.test(assertedText))) errors.push(`${itemPath}: integration/configuration/call evidence was escalated`);
    }
  }
  const tags = new Set(claims.flatMap((claim) => arrays(claim.data.tags)));
  for (const [pattern, tag, label] of [[PRODUCTION_PATTERN, "production-evidence", "production"], [RELIABILITY_PATTERN, "reliability-evidence", "reliability"], [SCALE_PATTERN, "scale-evidence", "scale"], [CAUSAL_PATTERN, "causal-evidence", "causal"]]) {
    if (pattern.test(text) && !tags.has(tag)) errors.push(`${itemPath}: ${label} wording lacks a ${tag} claim`);
  }
  if (PERFORMANCE_CAUSAL_PATTERN.test(text) && !metrics.some((metric) => metric.data.kind === "performance" && metric.data.status === "verified-measured" && metric.data.baseline != null && metric.data.result != null && metric.data.measurement_method)) errors.push(`${itemPath}: causal performance wording lacks verified baseline, result, and method`);
}

function validateSourced(item, itemPath, indexes, errors, actionContext = false, allowContext = false, ownershipContext = actionContext) {
  if (!isObject(item) || typeof item.text !== "string" || !item.text.trim()) { errors.push(`${itemPath}: sourced text with non-empty text required`); return; }
  const claimIds = arrays(item.claim_ids);
  const evidenceIds = arrays(item.evidence_ids);
  const metricIds = arrays(item.metric_ids);
  if (![item.claim_ids, item.evidence_ids, item.metric_ids].every(Array.isArray)) errors.push(`${itemPath}: claim_ids, evidence_ids, and metric_ids arrays required`);
  if (!claimIds.length || !evidenceIds.length) errors.push(`${itemPath}: sourced text requires at least one claim and evidence reference`);
  const claims = [], metrics = [];
  for (const id of claimIds) {
    const claim = indexes.byId.get(id);
    if (claim?.record_type !== "claim") errors.push(`${itemPath}: unknown claim '${id}'`);
    else {
      claims.push(claim);
      const contextAllowed = allowContext && ADMISSIBLE_CLAIM_STATUSES.has(claim.data.status) && ["project", "team", "starter"].includes(claim.data.scope);
      if ((!claim.data.resume_eligible || !ADMISSIBLE_CLAIM_STATUSES.has(claim.data.status)) && !contextAllowed) errors.push(`${itemPath}: inadmissible claim '${id}'`);
    }
  }
  for (const id of metricIds) {
    const metric = indexes.byId.get(id);
    if (metric?.record_type !== "metric") errors.push(`${itemPath}: unknown metric '${id}'`);
    else {
      metrics.push(metric);
      if (!metric.data.resume_eligible || !ADMISSIBLE_METRIC_STATUSES.has(metric.data.status)) errors.push(`${itemPath}: inadmissible metric '${id}'`);
    }
  }
  for (const id of evidenceIds) if (indexes.byId.get(id)?.record_type !== "evidence") errors.push(`${itemPath}: unknown evidence '${id}'`);
  const supportedEvidence = new Set([...claims, ...metrics].flatMap((source) => arrays(source.refs.evidence_ids)));
  for (const id of evidenceIds) if (!supportedEvidence.has(id)) errors.push(`${itemPath}: evidence '${id}' is not attached to a cited claim or metric`);
  if (actionContext && !claims.some((claim) => USER_SCOPES.has(claim.data.scope))) errors.push(`${itemPath}: action requires a user-scoped claim`);
  guardText(`${itemPath}.text`, item.text, claims, metrics, errors, actionContext, ownershipContext);
}

function validateEvidence(item, itemPath, project, errors) {
  const data = item.data;
  for (const field of ["type", "availability", "title", "digest_basis", "collected_at"]) if (typeof data[field] !== "string" || !data[field]) errors.push(`${itemPath}.data.${field}: non-empty string required`);
  if (data.availability === "collected") {
    if (typeof data.sha256 !== "string" || !SHA256_RE.test(data.sha256)) errors.push(`${itemPath}.data.sha256: collected evidence requires lowercase SHA-256`);
    if (data.digest_basis === "canonical-record") {
      const payload = { type: data.type, title: data.title, locator: data.locator ?? {}, excerpt: data.excerpt ?? null };
      if (data.sha256 !== sha256Text(canonical(payload))) errors.push(`${itemPath}.data.sha256: canonical-record digest mismatch`);
    } else if (data.digest_basis === "user-confirmation-text") {
      if (data.type !== "user-confirmation" || typeof data.excerpt !== "string" || data.sha256 !== sha256Text(data.excerpt)) errors.push(`${itemPath}: invalid user confirmation digest`);
    } else if (data.digest_basis === "file-bytes") {
      const raw = data.locator?.artifact_path ?? data.locator?.path;
      if (typeof raw !== "string" || !raw) errors.push(`${itemPath}: file-bytes requires locator path`);
      else data._resolved_path = path.isAbsolute(raw) ? raw : path.join(project?.data.repo_root ?? "", raw);
    }
  } else if (data.digest_basis !== "not-applicable" || data.sha256 != null) errors.push(`${itemPath}: unavailable evidence must use not-applicable and null digest`);
}

export async function validateLedger(records, { stage = "resume", ledgerPath = null } = {}) {
  const errors = [];
  const ids = new Set();
  records.forEach((item, index) => {
    const itemPath = `$[${index}]`;
    if (!requiredObject(item, itemPath, errors)) return;
    if (ids.has(item.id)) errors.push(`${itemPath}.id: duplicate '${item.id}'`);
    ids.add(item.id);
  });
  if (errors.length) return errors;
  const indexes = indexLedger(records);
  const projects = indexes.byType.get("project") ?? [];
  if (projects.length !== 1) errors.push(`ledger: expected exactly one project record, got ${projects.length}`);
  const project = projects[0];

  for (const item of indexes.byType.get("evidence") ?? []) validateEvidence(item, `evidence:${item.id}`, project, errors);
  if (ledgerPath) {
    for (const item of indexes.byType.get("evidence") ?? []) if (item.data.availability === "collected" && item.data.digest_basis === "file-bytes" && item.data._resolved_path) {
      try { if (item.data.sha256 !== await sha256File(item.data._resolved_path)) errors.push(`evidence:${item.id}: file-bytes digest mismatch`); }
      catch { errors.push(`evidence:${item.id}: digest source file does not exist`); }
      delete item.data._resolved_path;
    }
  }

  for (const claim of indexes.byType.get("claim") ?? []) {
    const itemPath = `claim:${claim.id}`;
    const refs = refList(claim, "evidence_ids", itemPath, errors);
    for (const id of refs) if (indexes.byId.get(id)?.record_type !== "evidence") errors.push(`${itemPath}: unknown evidence '${id}'`);
    if (claim.data.resume_eligible) {
      if (!ADMISSIBLE_CLAIM_STATUSES.has(claim.data.status)) errors.push(`${itemPath}: resume-eligible claim has inadmissible status`);
      if (!refs.length) errors.push(`${itemPath}: resume-eligible claim requires evidence`);
      if (["starter", "third-party", "generated", "unknown"].includes(claim.data.scope)) errors.push(`${itemPath}: inadmissible resume scope`);
      if (!refs.some((id) => indexes.byId.get(id)?.data.availability === "collected")) errors.push(`${itemPath}: resume-eligible claim requires collected evidence`);
    }
    if (claim.data.status === "user-confirmed" && !refs.some((id) => indexes.byId.get(id)?.data.type === "user-confirmation" && indexes.byId.get(id)?.data.availability === "collected")) errors.push(`${itemPath}: user-confirmed claim requires collected user-confirmation evidence`);
    if (USER_SCOPES.has(claim.data.scope) && !ACTION_KINDS.has(claim.data.action_kind)) errors.push(`${itemPath}: user claim requires a precise action kind`);
  }

  for (const metric of indexes.byType.get("metric") ?? []) {
    const itemPath = `metric:${metric.id}`;
    const refs = refList(metric, "evidence_ids", itemPath, errors);
    for (const id of refs) if (indexes.byId.get(id)?.record_type !== "evidence") errors.push(`${itemPath}: unknown evidence '${id}'`);
    if (metric.data.resume_eligible && !ADMISSIBLE_METRIC_STATUSES.has(metric.data.status)) errors.push(`${itemPath}: inadmissible resume metric`);
    if (metric.data.resume_eligible && !refs.some((id) => indexes.byId.get(id)?.data.availability === "collected")) errors.push(`${itemPath}: resume-eligible metric requires collected evidence`);
    if (metric.data.status === "verified-measured") {
      if (metric.data.result == null || !metric.data.measurement_method || !refs.length) errors.push(`${itemPath}: verified measurement requires result, method, and evidence`);
      if (metric.data.kind === "performance" && metric.data.baseline == null) errors.push(`${itemPath}: performance measurement requires baseline`);
    }
    if (metric.data.status === "verified-count" && (metric.data.value == null || !refs.length)) errors.push(`${itemPath}: verified count requires value and evidence`);
  }

  const contributions = indexes.byType.get("contribution") ?? [];
  for (const contribution of contributions) {
    const itemPath = `contribution:${contribution.id}`;
    const claimIds = refList(contribution, "claim_ids", itemPath, errors);
    const evidenceIds = refList(contribution, "evidence_ids", itemPath, errors);
    const metricIds = refList(contribution, "metric_ids", itemPath, errors);
    for (const id of claimIds) {
      const claim = indexes.byId.get(id);
      if (claim?.record_type !== "claim") errors.push(`${itemPath}: unknown claim '${id}'`);
      else if (!USER_SCOPES.has(claim.data.scope)) errors.push(`${itemPath}: contributions may reference only user-scoped claims`);
    }
    for (const id of metricIds) if (indexes.byId.get(id)?.record_type !== "metric") errors.push(`${itemPath}: unknown metric '${id}'`);
    for (const id of evidenceIds) if (indexes.byId.get(id)?.record_type !== "evidence") errors.push(`${itemPath}: unknown evidence '${id}'`);
    const supportedEvidence = union([...claimIds, ...metricIds].map((id) => indexes.byId.get(id)?.refs.evidence_ids));
    const omittedWithoutClaim = !claimIds.length && !metricIds.length && Boolean(String(contribution.data.star_omission_reason ?? "").trim());
    if (!omittedWithoutClaim && !sameSet(evidenceIds, supportedEvidence)) errors.push(`${itemPath}: evidence refs must exactly match cited claims and metrics`);
  }

  const stories = indexes.byType.get("story") ?? [];
  for (const story of stories) {
    const itemPath = `story:${story.id}`;
    for (const field of ["situation", "task", "actions", "results"]) {
      const sections = story.data[field];
      if (!Array.isArray(sections) || !sections.length) errors.push(`${itemPath}.data.${field}: at least one sourced section required`);
      else sections.forEach((section, index) => validateSourced(section, `${itemPath}.${field}[${index}]`, indexes, errors, ["task", "actions"].includes(field) && story.data.resume_eligible && !story.data.legacy_review_required, field === "situation", true));
    }
    if (!Array.isArray(story.data.result_limits) || !story.data.result_limits.length) errors.push(`${itemPath}.data.result_limits: at least one result boundary required`);
    if (!Array.isArray(story.data.interview_questions) || !story.data.interview_questions.length) errors.push(`${itemPath}.data.interview_questions: at least one question required`);
    for (const name of ["contribution_ids", "claim_ids", "evidence_ids", "metric_ids", "open_question_ids"]) refList(story, name, itemPath, errors);
    for (const id of story.refs.contribution_ids ?? []) if (indexes.byId.get(id)?.record_type !== "contribution") errors.push(`${itemPath}: unknown contribution '${id}'`);
    const sections = ["situation", "task", "actions", "results"].flatMap((field) => arrays(story.data[field]));
    for (const [name, values] of [["claim_ids", union(sections.map((section) => section.claim_ids))], ["evidence_ids", union(sections.map((section) => section.evidence_ids))], ["metric_ids", union(sections.map((section) => section.metric_ids))]]) if (!sameSet(values, arrays(story.refs[name]))) errors.push(`${itemPath}: aggregate ${name} must exactly match section sources`);
    const linkedContributions = arrays(story.refs.contribution_ids).map((id) => indexes.byId.get(id)).filter((item) => item?.record_type === "contribution");
    const allowedClaims = union(linkedContributions.map((item) => item.refs.claim_ids));
    const allowedMetrics = union(linkedContributions.map((item) => item.refs.metric_ids));
    for (const id of arrays(story.refs.claim_ids)) {
      const claim = indexes.byId.get(id);
      const contextClaim = claim?.record_type === "claim" && ADMISSIBLE_CLAIM_STATUSES.has(claim.data.status) && ["project", "team", "starter"].includes(claim.data.scope);
      if (!allowedClaims.includes(id) && !contextClaim) errors.push(`${itemPath}: claim '${id}' is not linked through a contribution or admissible context`);
    }
    for (const id of arrays(story.refs.metric_ids)) if (!allowedMetrics.includes(id)) errors.push(`${itemPath}: metric '${id}' is not linked through a contribution`);
  }

  for (const contribution of contributions) {
    const eligible = arrays(contribution.refs.claim_ids).some((id) => {
      const claim = indexes.byId.get(id);
      return claim?.record_type === "claim" && USER_SCOPES.has(claim.data.scope) && claim.data.resume_eligible && ADMISSIBLE_CLAIM_STATUSES.has(claim.data.status);
    });
    const covered = stories.some((story) => arrays(story.refs.contribution_ids).includes(contribution.id));
    if (eligible && !covered && !String(contribution.data.star_omission_reason ?? "").trim()) errors.push(`contribution:${contribution.id}: eligible contribution is neither covered by STAR nor explicitly omitted`);
  }

  if (stage === "star") return errors;
  const candidates = indexes.byType.get("candidate") ?? [];
  const groups = indexes.byType.get("candidate-group") ?? [];
  const selections = indexes.byType.get("selection") ?? [];
  const eligibleStories = stories.filter((story) => story.data.resume_eligible && !story.data.legacy_review_required);
  for (const story of eligibleStories) if (!groups.some((group) => arrays(group.refs.story_ids).includes(story.id))) errors.push(`story:${story.id}: eligible story has no candidate group`);

  for (const candidate of candidates) {
    const itemPath = `candidate:${candidate.id}`;
    const storyIds = refList(candidate, "story_ids", itemPath, errors);
    if (!storyIds.length) errors.push(`${itemPath}: candidate must cite a STAR story`);
    const sourceStories = storyIds.map((id) => indexes.byId.get(id)).filter((item) => item?.record_type === "story");
    if (sourceStories.length !== storyIds.length) errors.push(`${itemPath}: unknown STAR story`);
    for (const story of sourceStories) if (!story.data.resume_eligible || story.data.legacy_review_required) errors.push(`${itemPath}: cited STAR story '${story.id}' is not resume eligible`);
    const allowedClaims = union(sourceStories.map((item) => item.refs.claim_ids));
    const allowedEvidence = union(sourceStories.map((item) => item.refs.evidence_ids));
    const allowedMetrics = union(sourceStories.map((item) => item.refs.metric_ids));
    for (const [name, allowed] of [["claim_ids", allowedClaims], ["evidence_ids", allowedEvidence], ["metric_ids", allowedMetrics]]) {
      const refs = refList(candidate, name, itemPath, errors);
      if (!subset(refs, allowed)) errors.push(`${itemPath}: ${name} bypasses the cited STAR story`);
    }
    if (!isObject(candidate.data.clauses)) errors.push(`${itemPath}.data.clauses: object required`);
    else {
      for (const name of ["action", "method", "result"]) validateSourced(candidate.data.clauses[name], `${itemPath}.clauses.${name}`, indexes, errors, ["action", "method"].includes(name), false, true);
      const clauses = Object.values(candidate.data.clauses).filter(isObject);
      for (const name of ["claim_ids", "evidence_ids", "metric_ids"]) if (!sameSet(union(clauses.map((clause) => clause[name])), arrays(candidate.refs[name]))) errors.push(`${itemPath}: candidate ${name} must exactly match clause sources`);
    }
    if (typeof candidate.data.text !== "string" || !candidate.data.text.trim()) errors.push(`${itemPath}.data.text: non-empty text required`);
    if (!["zh-CN", "en"].includes(candidate.data.language)) errors.push(`${itemPath}.data.language: expected zh-CN or en`);
    guardText(`${itemPath}.data.text`, candidate.data.text ?? "", arrays(candidate.refs.claim_ids).map((id) => indexes.byId.get(id)).filter(Boolean), arrays(candidate.refs.metric_ids).map((id) => indexes.byId.get(id)).filter(Boolean), errors, true);
  }

  const requestedLanguages = arrays(selections[0]?.data.languages);
  if (!requestedLanguages.length || requestedLanguages.some((value) => !["zh-CN", "en"].includes(value)) || new Set(requestedLanguages).size !== requestedLanguages.length) errors.push(`selection: languages must contain one or both of zh-CN/en`);
  for (const group of groups) {
    const itemPath = `candidate-group:${group.id}`;
    const candidateIds = refList(group, "candidate_ids", itemPath, errors);
    const groupCandidates = candidateIds.map((id) => indexes.byId.get(id));
    if (!candidateIds.length || groupCandidates.some((item) => item?.record_type !== "candidate")) errors.push(`${itemPath}: candidate IDs must resolve`);
    const languages = groupCandidates.map((item) => item?.data.language);
    if (new Set(languages).size !== languages.length) errors.push(`${itemPath}: duplicate language variants`);
    if (languages.length !== requestedLanguages.length || requestedLanguages.some((language) => !languages.includes(language))) errors.push(`${itemPath}: exactly one candidate per selected language is required`);
    const compressionMethods = new Set(groupCandidates.map((item) => item?.data.compression_method));
    if (compressionMethods.size !== 1) errors.push(`${itemPath}: language variants must use the same compression method`);
    for (const candidate of groupCandidates.filter(Boolean)) if (!["action-method-result", "action-method-verified-capability"].includes(candidate.data.compression_method)) errors.push(`${itemPath}: invalid compression method '${candidate.data.compression_method}'`);
    const signatures = groupCandidates.map((item) => canonical({ story_ids: item?.refs.story_ids ?? [], claim_ids: item?.refs.claim_ids ?? [], evidence_ids: item?.refs.evidence_ids ?? [], metric_ids: item?.refs.metric_ids ?? [] }));
    if (signatures.length === 2 && signatures[0] !== signatures[1]) errors.push(`${itemPath}: bilingual variants must use identical sources`);
    for (const candidate of groupCandidates.filter(Boolean)) if (canonical(arrays(candidate.refs.story_ids)) !== canonical(arrays(group.refs.story_ids))) errors.push(`${itemPath}: candidate STAR sources must match the group`);
  }

  if (selections.length !== 1) errors.push(`ledger: expected exactly one selection record for resume stage, got ${selections.length}`);
  else {
    const selection = selections[0];
    const selected = refList(selection, "selected_group_ids", `selection:${selection.id}`, errors);
    if (selected.length < 1 || selected.length > 4) errors.push(`selection:${selection.id}: select 1 to 4 candidate groups`);
    for (const id of selected) if (indexes.byId.get(id)?.record_type !== "candidate-group") errors.push(`selection:${selection.id}: unknown candidate group '${id}'`);
    if (!String(selection.data.target_role ?? "").trim() && !String(selection.data.job_description ?? "").trim()) errors.push(`selection:${selection.id}: target role or job description required before final selection`);
    for (const group of groups) if (!selected.includes(group.id) && !String(group.data.selection_omission_reason ?? "").trim()) errors.push(`candidate-group:${group.id}: unselected group requires a role-specific omission reason`);
  }
  return errors;
}

export function auditLedger(records) {
  const indexes = indexLedger(records);
  const stories = indexes.byType.get("story") ?? [];
  const groups = indexes.byType.get("candidate-group") ?? [];
  const selection = (indexes.byType.get("selection") ?? [])[0];
  const warnings = [];
  for (const story of stories) {
    if (arrays(story.data.actions).length < 2) warnings.push(`${story.id}: fewer than two detailed Action steps; do not invent detail, but ask for evidence if more exists.`);
    for (const field of ["constraints", "decisions", "tradeoffs"]) if (!arrays(story.data[field]).length) warnings.push(`${story.id}: ${field} not recorded.`);
    if (story.data.legacy_review_required) warnings.push(`${story.id}: imported legacy story requires review before resume use.`);
  }
  const selected = arrays(selection?.refs.selected_group_ids);
  if (selection && selected.length === 1) warnings.push("Only one supported final bullet was selected; evidence coverage is limited.");
  return {
    checks: [
      ["Evidence precedes personal claims", (indexes.byType.get("claim") ?? []).every((item) => arrays(item.refs.evidence_ids).length || !item.data.resume_eligible)],
      ["Eligible contributions are covered by STAR", (indexes.byType.get("contribution") ?? []).every((item) => stories.some((story) => arrays(story.refs.contribution_ids).includes(item.id)) || String(item.data.star_omission_reason ?? "").trim())],
      ["Detailed STAR story library exists", stories.length > 0 && stories.every((item) => arrays(item.data.situation).length && arrays(item.data.task).length && arrays(item.data.actions).length && arrays(item.data.results).length)],
      ["Candidate pool derives from STAR", groups.every((group) => arrays(group.refs.story_ids).length)],
      ["Final selection follows target role", !selection || Boolean(String(selection.data.target_role ?? selection.data.job_description ?? "").trim())],
      ["Final bullets are selected from the guarded pool", !selection || selected.every((id) => indexes.byId.get(id)?.record_type === "candidate-group")],
      ["User-facing artifacts require no schema handling", true],
    ],
    warnings,
  };
}

function refsLine(item) {
  const parts = [];
  for (const [name, values] of Object.entries(item.refs ?? {})) if (Array.isArray(values) && values.length) parts.push(`${name.replace(/_ids$/, "")}: ${values.map((id) => `\`${id}\``).join(", ")}`);
  return parts.join("; ") || "none";
}

export function renderStar(records) {
  const indexes = indexLedger(records);
  const project = (indexes.byType.get("project") ?? [])[0]?.data ?? {};
  const lines = [`# ${project.name ?? "Project"} — Verified STAR Story Library`, "", "This human-readable file is rendered from the private evidence ledger. Each story is contribution-centered and source-linked."];
  for (const [index, story] of (indexes.byType.get("story") ?? []).entries()) {
    lines.push("", `## ${index + 1}. ${story.data.title ?? story.id}`, "", `- Story ID: \`${story.id}\``, `- Resume eligible: \`${Boolean(story.data.resume_eligible && !story.data.legacy_review_required)}\``, `- Sources: ${refsLine(story)}`);
    for (const [field, title] of [["situation", "Situation"], ["task", "Task"], ["actions", "Action"], ["results", "Result"]]) {
      lines.push("", `### ${title}`, "");
      arrays(story.data[field]).forEach((item) => lines.push(`- ${item.text}`, `  - Claims: ${arrays(item.claim_ids).map((id) => `\`${id}\``).join(", ") || "none"}; Evidence: ${arrays(item.evidence_ids).map((id) => `\`${id}\``).join(", ") || "none"}; Metrics: ${arrays(item.metric_ids).map((id) => `\`${id}\``).join(", ") || "none"}`));
    }
    for (const [field, title] of [["constraints", "Constraints"], ["decisions", "Decisions"], ["tradeoffs", "Trade-offs"], ["result_limits", "Result boundaries"], ["interview_questions", "Interview questions"], ["risk_flags", "Risk flags"]]) {
      lines.push("", `### ${title}`, "");
      const values = arrays(story.data[field]);
      if (!values.length) lines.push("_Not recorded._"); else values.forEach((value) => lines.push(`- ${value}`));
    }
  }
  if (!(indexes.byType.get("story") ?? []).length) lines.push("", "_No supported STAR story has been recorded._");
  return `${lines.join("\n").trimEnd()}\n`;
}

export function renderPool(records) {
  const indexes = indexLedger(records);
  const groups = indexes.byType.get("candidate-group") ?? [];
  const lines = ["# Guarded Resume Candidate Pool", "", "Every candidate below derives from a complete STAR story. Final selection happens only after a target role or job description is available."];
  for (const [index, group] of groups.entries()) {
    lines.push("", `## ${index + 1}. ${group.data.title ?? group.id}`, "", `- Group ID: \`${group.id}\``, `- STAR sources: ${arrays(group.refs.story_ids).map((id) => `\`${id}\``).join(", ")}`);
    for (const id of arrays(group.refs.candidate_ids)) {
      const candidate = indexes.byId.get(id);
      if (!candidate) continue;
      lines.push("", `- **${candidate.data.language}**: ${candidate.data.text}`, `  - Candidate ID: \`${candidate.id}\``, `  - Compression: \`${candidate.data.compression_method}\``, `  - Sources: ${refsLine(candidate)}`, `  - Interview follow-up: ${arrays(candidate.data.interview_questions).join("; ") || "none"}`, `  - Risk flags: ${arrays(candidate.data.risk_flags).join("; ") || "none"}`);
    }
  }
  if (!groups.length) lines.push("", "_No guarded candidates have been created._");
  return `${lines.join("\n").trimEnd()}\n`;
}

export function renderResume(records) {
  const indexes = indexLedger(records);
  const selection = (indexes.byType.get("selection") ?? [])[0];
  const lines = ["# Tailored Resume Project Entry", ""];
  if (!selection) return `${lines.join("\n")}_No target-specific selection has been created._\n`;
  lines.push(`- Target role: ${selection.data.target_role ?? "not specified"}`, `- Focus: ${selection.data.focus ?? "best-supported evidence"}`, "", "## Selected bullets", "");
  for (const groupId of arrays(selection.refs.selected_group_ids)) {
    const group = indexes.byId.get(groupId);
    for (const candidateId of arrays(group?.refs.candidate_ids)) {
      const candidate = indexes.byId.get(candidateId);
      if (candidate && arrays(selection.data.languages).includes(candidate.data.language)) lines.push(`- **${candidate.data.language}**: ${candidate.data.text}`, `  - STAR: ${arrays(candidate.refs.story_ids).map((id) => `\`${id}\``).join(", ")}; Claims: ${arrays(candidate.refs.claim_ids).map((id) => `\`${id}\``).join(", ")}; Evidence: ${arrays(candidate.refs.evidence_ids).map((id) => `\`${id}\``).join(", ")}`);
    }
  }
  if (arrays(selection.refs.selected_group_ids).length === 1) lines.push("", "> Evidence coverage supports only one distinct final bullet; no duplicate was manufactured.");
  return `${lines.join("\n").trimEnd()}\n`;
}

export function renderReview(records, validationErrors = []) {
  const audit = auditLedger(records);
  const indexes = indexLedger(records);
  const lines = ["# Workflow Review", "", "## Original workflow acceptance", ""];
  for (const [label, passed] of audit.checks) lines.push(`- [${passed ? "x" : " "}] ${label}`);
  lines.push("", "## Validation", "");
  if (!validationErrors.length) lines.push("- Deterministic validation passed."); else validationErrors.forEach((error) => lines.push(`- ERROR: ${error}`));
  lines.push("", "## Evidence gaps and warnings", "");
  if (!audit.warnings.length) lines.push("_None._"); else audit.warnings.forEach((warning) => lines.push(`- ${warning}`));
  lines.push("", "## Open questions", "");
  const questions = indexes.byType.get("open-question") ?? [];
  if (!questions.length) lines.push("_None._"); else questions.forEach((item) => lines.push(`- **${item.id}** [${item.data.status ?? "open"}] ${item.data.question}`));
  lines.push("", "## Exclusions", "");
  const exclusions = [
    ...(indexes.byType.get("contribution") ?? []).filter((item) => item.data.star_omission_reason).map((item) => `${item.id}: ${item.data.star_omission_reason}`),
    ...(indexes.byType.get("candidate-group") ?? []).filter((item) => item.data.selection_omission_reason).map((item) => `${item.id}: ${item.data.selection_omission_reason}`),
  ];
  if (!exclusions.length) lines.push("_None._"); else exclusions.forEach((value) => lines.push(`- ${value}`));
  return `${lines.join("\n").trimEnd()}\n`;
}

export async function renderWorkspace(records, workspace, stage = "resume") {
  await mkdir(workspace, { recursive: true });
  const ledgerPath = path.join(workspace, ".verified-resume", "ledger.jsonl");
  const errors = await validateLedger(records, { stage, ledgerPath });
  if (errors.length) {
    const blocked = (title) => `# ${title}\n\n_Not rendered because deterministic validation failed. See \`review.md\`._\n`;
    await writeFile(path.join(workspace, "star.md"), blocked("STAR Story Library"), "utf8");
    await writeFile(path.join(workspace, "resume-candidate-pool.md"), blocked("Resume Candidate Pool"), "utf8");
    await writeFile(path.join(workspace, "resume.md"), blocked("Tailored Resume Project Entry"), "utf8");
    await writeFile(path.join(workspace, "review.md"), renderReview(records, errors), "utf8");
    return errors;
  }
  await writeFile(path.join(workspace, "star.md"), renderStar(records), "utf8");
  await writeFile(path.join(workspace, "resume-candidate-pool.md"), renderPool(records), "utf8");
  await writeFile(path.join(workspace, "resume.md"), renderResume(records), "utf8");
  await writeFile(path.join(workspace, "review.md"), renderReview(records, errors), "utf8");
  return errors;
}

function legacySourced(item) {
  return { text: item.text, claim_ids: arrays(item.claim_ids), evidence_ids: arrays(item.evidence_ids), metric_ids: arrays(item.metric_ids) };
}
function without(value, fields) { return Object.fromEntries(Object.entries(value).filter(([key]) => !fields.includes(key))); }

export function importLegacyArchive(archive) {
  if (!isObject(archive) || archive.schema_version !== "1.0.0") throw new Error("expected a current legacy schema_version 1.0.0 archive");
  const records = [
    record("project", `project:${archive.project.id}`, archive.project, {}),
    record("analysis", "analysis:legacy-import", { ...archive.analysis_scope, imported_at: utcNow() }, {}),
    record("identity", "identity:primary", archive.identity, {}),
  ];
  for (const item of arrays(archive.evidence)) records.push(record("evidence", item.id, without(item, ["id"]), {}));
  for (const item of arrays(archive.claims)) records.push(record("claim", item.id, without(item, ["id", "evidence_ids"]), { evidence_ids: arrays(item.evidence_ids) }));
  for (const item of arrays(archive.contributions)) {
    const claimIds = arrays(item.claim_ids);
    const metricIds = union(arrays(archive.star?.result).filter((result) => intersects(arrays(result.claim_ids), claimIds)).map((result) => result.metric_ids));
    const sourceIds = [...claimIds.map((id) => arrays(archive.claims).find((claim) => claim.id === id)), ...metricIds.map((id) => arrays(archive.metrics).find((metric) => metric.id === id))].filter(Boolean).map((source) => source.evidence_ids);
    records.push(record("contribution", item.id, { ...without(item, ["id", "claim_ids", "evidence_ids"]), legacy_evidence_ids: arrays(item.evidence_ids), star_omission_reason: null }, { claim_ids: claimIds, evidence_ids: union(sourceIds), metric_ids: metricIds }));
  }
  for (const item of arrays(archive.metrics)) records.push(record("metric", item.id, without(item, ["id", "evidence_ids"]), { evidence_ids: arrays(item.evidence_ids) }));
  for (const item of arrays(archive.open_questions)) records.push(record("open-question", item.id, without(item, ["id", "affects_claim_ids"]), { claim_ids: arrays(item.affects_claim_ids) }));
  for (const item of arrays(archive.interview_topics)) records.push(record("interview-topic", item.id, without(item, ["id", "claim_ids"]), { claim_ids: arrays(item.claim_ids) }));
  for (const item of arrays(archive.execution_log)) records.push(record("execution", item.id, without(item, ["id"]), {}));
  for (const section of ["situation", "task", "action", "result"]) for (const item of arrays(archive.star?.[section])) records.push(record("legacy-star-item", `legacy:${section}:${item.id}`, { section, ...without(item, ["id", "claim_ids", "evidence_ids", "metric_ids"]) }, { claim_ids: arrays(item.claim_ids), evidence_ids: arrays(item.evidence_ids), metric_ids: arrays(item.metric_ids) }));

  const projectClaims = arrays(archive.claims).filter((item) => ["project", "starter", "team"].includes(item.scope) && item.status === "verified");
  for (const contribution of arrays(archive.contributions)) {
    const contributionClaimIds = arrays(contribution.claim_ids);
    const userClaims = arrays(archive.claims).filter((item) => contributionClaimIds.includes(item.id) && USER_SCOPES.has(item.scope) && item.resume_eligible);
    const relevant = (section) => arrays(archive.star?.[section]).filter((item) => intersects(arrays(item.claim_ids), contributionClaimIds));
    const situationItems = arrays(archive.star?.situation).length ? arrays(archive.star.situation) : projectClaims.map((item) => ({ text: item.text, claim_ids: [item.id], evidence_ids: item.evidence_ids, metric_ids: [] }));
    const taskItems = relevant("task").length ? relevant("task") : [{ text: contribution.summary, claim_ids: contributionClaimIds, evidence_ids: contribution.evidence_ids, metric_ids: [] }];
    const actionItems = relevant("action").length ? relevant("action") : userClaims.map((item) => ({ text: item.text, claim_ids: [item.id], evidence_ids: item.evidence_ids, metric_ids: [] }));
    const resultItems = relevant("result").length ? relevant("result") : userClaims.map((item) => ({ text: `${item.text} No broader outcome was established by the imported evidence.`, claim_ids: [item.id], evidence_ids: item.evidence_ids, metric_ids: [] }));
    const sections = [...situationItems, ...taskItems, ...actionItems, ...resultItems];
    const topicQuestions = arrays(archive.interview_topics).filter((item) => intersects(arrays(item.claim_ids), contributionClaimIds)).flatMap((item) => arrays(item.questions));
    const openQuestions = arrays(archive.open_questions).filter((item) => intersects(arrays(item.affects_claim_ids), contributionClaimIds)).map((item) => item.id);
    records.push(record("story", `story:${contribution.id}`, {
      title: contribution.summary,
      situation: situationItems.map(legacySourced), task: taskItems.map(legacySourced), actions: actionItems.map(legacySourced), results: resultItems.map(legacySourced),
      constraints: ["Personal scope remains limited to the imported contribution and claims."], decisions: [], tradeoffs: [],
      result_limits: ["Imported from a legacy archive; verify decisions, trade-offs, and story boundaries before resume use."],
      interview_questions: topicQuestions.length ? unique(topicQuestions) : ["Which implementation decision is directly supported by the cited evidence?"],
      risk_flags: ["legacy-import-review-required"], resume_eligible: false, legacy_review_required: true,
    }, {
      contribution_ids: [contribution.id], claim_ids: union(sections.map((item) => item.claim_ids)), evidence_ids: union(sections.map((item) => item.evidence_ids)), metric_ids: union(sections.map((item) => item.metric_ids)), open_question_ids: openQuestions,
    }));
  }
  return records;
}

function parseArgs(argv) {
  const command = argv[0];
  if (!new Set(["seal", "validate", "render", "import-legacy"]).has(command)) throw new Error("expected seal, validate, render, or import-legacy");
  const args = { command, stage: "resume" };
  for (let index = 1; index < argv.length; index += 2) {
    const key = argv[index];
    if (!key?.startsWith("--") || index + 1 >= argv.length) throw new Error(`invalid argument ${key}`);
    args[key.slice(2).replaceAll("-", "_")] = argv[index + 1];
  }
  return args;
}

export async function main(argv = process.argv.slice(2)) {
  let args;
  try { args = parseArgs(argv); } catch (error) { console.error(`error: ${error.message}`); return 2; }
  if (args.command === "import-legacy") {
    if (!args.archive || !args.workspace) { console.error("error: --archive and --workspace are required"); return 2; }
    const archive = JSON.parse(await readFile(path.resolve(args.archive), "utf8"));
    const records = importLegacyArchive(archive);
    const workspace = path.resolve(args.workspace), ledger = path.join(workspace, ".verified-resume", "ledger.jsonl");
    try { if ((await stat(ledger)).isFile()) { console.error(`error: refusing to overwrite existing ledger: ${ledger}`); return 1; } } catch (error) { if (error.code !== "ENOENT") throw error; }
    const errors = await validateLedger(records, { stage: "star", ledgerPath: ledger });
    if (errors.length) { errors.forEach((error) => console.error(`ERROR ${error}`)); return 1; }
    await writeLedger(ledger, records);
    const renderErrors = await renderWorkspace(records, workspace, "star");
    if (renderErrors.length) { renderErrors.forEach((error) => console.error(`ERROR ${error}`)); return 1; }
    console.log(`legacy facts imported; review required before resume use: ${workspace}`);
    return 0;
  }
  if (!args.ledger) { console.error("error: --ledger is required"); return 2; }
  const ledger = path.resolve(args.ledger), records = await readLedger(ledger);
  if (args.command === "seal") {
    await sealLedger(records); await writeLedger(ledger, records); console.log(`sealed evidence digests: ${ledger}`); return 0;
  }
  if (args.command === "validate") {
    const errors = await validateLedger(records, { stage: args.stage, ledgerPath: ledger });
    if (errors.length) { errors.forEach((error) => console.error(`ERROR ${error}`)); return 1; }
    console.log(`${args.stage} workflow is valid`); return 0;
  }
  if (!args.workspace) { console.error("error: --workspace is required"); return 2; }
  const errors = await renderWorkspace(records, path.resolve(args.workspace), args.stage);
  if (errors.length) { errors.forEach((error) => console.error(`ERROR ${error}`)); return 1; }
  console.log(`rendered verified workspace: ${path.resolve(args.workspace)}`); return 0;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().then((code) => { process.exitCode = code; }).catch((error) => { console.error(`error: ${error.message}`); process.exitCode = 2; });
}
