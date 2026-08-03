/** Deterministic wording guards: numeric provenance, ownership verbs, and evidence-tagged language. */

import { ADMISSIBLE_CLAIM_STATUSES, ADMISSIBLE_METRIC_STATUSES, CONTEXT_SCOPES, LOW_OWNERSHIP_ACTIONS, USER_SCOPES, arrays, isObject } from "./ledger.mjs";

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

export function numericTokens(text) { return new Set([...String(text).matchAll(NUMBER_RE)].map((match) => match[0].replaceAll(" ", ""))); }

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

export function guardText(itemPath, text, claims, metrics, errors, { actionContext = false, ownershipContext = actionContext } = {}) {
  const textNumbers = numericTokens(text);
  const allowed = sourceNumericTokens(claims, metrics);
  for (const token of [...textNumbers].filter((value) => !allowed.has(value)).sort()) errors.push(`${itemPath}: numeric token '${token}' is not present in cited admissible sources`);
  if (textNumbers.size && APPROX_RE.test(text)) errors.push(`${itemPath}: approximate or range language is not allowed for numeric claims`);
  const assertedText = text.replace(/\bwithout\s+(?:claiming|asserting)[^.,;]*/giu, "").replace(/不(?:声称|主张|表示)[^，。；]*/gu, "");
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

export function validateSourced(item, itemPath, indexes, errors, { actionContext = false, allowContext = false, ownershipContext = actionContext } = {}) {
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
      const contextAllowed = allowContext && ADMISSIBLE_CLAIM_STATUSES.has(claim.data.status) && CONTEXT_SCOPES.includes(claim.data.scope);
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
  guardText(`${itemPath}.text`, item.text, claims, metrics, errors, { actionContext, ownershipContext });
}
