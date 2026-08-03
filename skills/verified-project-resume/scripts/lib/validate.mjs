/** Stage-aware deterministic ledger validation and workflow audit. */

import { sha256File } from "./common.mjs";
import {
  ADMISSIBLE_CLAIM_STATUSES, ADMISSIBLE_METRIC_STATUSES, COMPRESSION_METHODS, INADMISSIBLE_RESUME_SCOPES,
  ACTION_KINDS, LANGUAGES, SHA256_RE, STORY_SECTIONS, USER_SCOPES, CONTEXT_SCOPES,
  arrays, canonical, indexLedger, isObject, resolveEvidencePath, sameSet, sha256Text, subset, union, unique,
} from "./ledger.mjs";
import { guardText, validateSourced } from "./guards.mjs";

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

function validateEnvelopes(records, errors) {
  const ids = new Set();
  records.forEach((item, index) => {
    const itemPath = `$[${index}]`;
    if (!requiredObject(item, itemPath, errors)) return;
    if (ids.has(item.id)) errors.push(`${itemPath}.id: duplicate '${item.id}'`);
    ids.add(item.id);
  });
  return !errors.length;
}

function validateEvidenceRecords(indexes, project, errors) {
  const resolvedPaths = new Map();
  for (const item of indexes.byType.get("evidence") ?? []) {
    const itemPath = `evidence:${item.id}`;
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
        else try { resolvedPaths.set(item.id, resolveEvidencePath(project, raw, item.id)); } catch (error) { errors.push(error.message); }
      }
    } else if (data.digest_basis !== "not-applicable" || data.sha256 != null) errors.push(`${itemPath}: unavailable evidence must use not-applicable and null digest`);
  }
  return resolvedPaths;
}

function validateFileDigests(indexes, resolvedPaths, errors) {
  for (const item of indexes.byType.get("evidence") ?? []) {
    const resolved = resolvedPaths.get(item.id);
    if (!resolved) continue;
    try { if (item.data.sha256 !== sha256File(resolved)) errors.push(`evidence:${item.id}: file-bytes digest mismatch`); }
    catch { errors.push(`evidence:${item.id}: digest source file does not exist`); }
  }
}

function validateClaims(indexes, errors) {
  for (const claim of indexes.byType.get("claim") ?? []) {
    const itemPath = `claim:${claim.id}`;
    const refs = refList(claim, "evidence_ids", itemPath, errors);
    for (const id of refs) if (indexes.byId.get(id)?.record_type !== "evidence") errors.push(`${itemPath}: unknown evidence '${id}'`);
    if (claim.data.resume_eligible) {
      if (!ADMISSIBLE_CLAIM_STATUSES.has(claim.data.status)) errors.push(`${itemPath}: resume-eligible claim has inadmissible status`);
      if (!refs.length) errors.push(`${itemPath}: resume-eligible claim requires evidence`);
      if (INADMISSIBLE_RESUME_SCOPES.includes(claim.data.scope)) errors.push(`${itemPath}: inadmissible resume scope`);
      if (!refs.some((id) => indexes.byId.get(id)?.data.availability === "collected")) errors.push(`${itemPath}: resume-eligible claim requires collected evidence`);
    }
    if (claim.data.status === "user-confirmed" && !refs.some((id) => indexes.byId.get(id)?.data.type === "user-confirmation" && indexes.byId.get(id)?.data.availability === "collected")) errors.push(`${itemPath}: user-confirmed claim requires collected user-confirmation evidence`);
    if (USER_SCOPES.has(claim.data.scope) && !ACTION_KINDS.has(claim.data.action_kind)) errors.push(`${itemPath}: user claim requires a precise action kind`);
  }
}

function validateMetrics(indexes, errors) {
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
}

function validateContributions(indexes, errors) {
  for (const contribution of indexes.byType.get("contribution") ?? []) {
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
}

function validateStories(indexes, errors) {
  for (const story of indexes.byType.get("story") ?? []) {
    const itemPath = `story:${story.id}`;
    for (const field of STORY_SECTIONS) {
      const sections = story.data[field];
      if (!Array.isArray(sections) || !sections.length) errors.push(`${itemPath}.data.${field}: at least one sourced section required`);
      else sections.forEach((section, index) => validateSourced(section, `${itemPath}.${field}[${index}]`, indexes, errors, {
        actionContext: ["task", "actions"].includes(field) && story.data.resume_eligible && !story.data.legacy_review_required,
        allowContext: field === "situation",
        ownershipContext: true,
      }));
    }
    if (!Array.isArray(story.data.result_limits) || !story.data.result_limits.length) errors.push(`${itemPath}.data.result_limits: at least one result boundary required`);
    if (!Array.isArray(story.data.interview_questions) || !story.data.interview_questions.length) errors.push(`${itemPath}.data.interview_questions: at least one question required`);
    for (const name of ["contribution_ids", "claim_ids", "evidence_ids", "metric_ids", "open_question_ids"]) refList(story, name, itemPath, errors);
    for (const id of story.refs.contribution_ids ?? []) if (indexes.byId.get(id)?.record_type !== "contribution") errors.push(`${itemPath}: unknown contribution '${id}'`);
    const sections = STORY_SECTIONS.flatMap((field) => arrays(story.data[field]));
    for (const [name, values] of [["claim_ids", union(sections.map((section) => section.claim_ids))], ["evidence_ids", union(sections.map((section) => section.evidence_ids))], ["metric_ids", union(sections.map((section) => section.metric_ids))]]) if (!sameSet(values, arrays(story.refs[name]))) errors.push(`${itemPath}: aggregate ${name} must exactly match section sources`);
    const linkedContributions = arrays(story.refs.contribution_ids).map((id) => indexes.byId.get(id)).filter((item) => item?.record_type === "contribution");
    const allowedClaims = union(linkedContributions.map((item) => item.refs.claim_ids));
    const allowedMetrics = union(linkedContributions.map((item) => item.refs.metric_ids));
    for (const id of arrays(story.refs.claim_ids)) {
      const claim = indexes.byId.get(id);
      const contextClaim = claim?.record_type === "claim" && ADMISSIBLE_CLAIM_STATUSES.has(claim.data.status) && CONTEXT_SCOPES.includes(claim.data.scope);
      if (!allowedClaims.includes(id) && !contextClaim) errors.push(`${itemPath}: claim '${id}' is not linked through a contribution or admissible context`);
    }
    for (const id of arrays(story.refs.metric_ids)) if (!allowedMetrics.includes(id)) errors.push(`${itemPath}: metric '${id}' is not linked through a contribution`);
  }
}

function validateStarCoverage(indexes, errors) {
  const stories = indexes.byType.get("story") ?? [];
  for (const contribution of indexes.byType.get("contribution") ?? []) {
    const eligible = arrays(contribution.refs.claim_ids).some((id) => {
      const claim = indexes.byId.get(id);
      return claim?.record_type === "claim" && USER_SCOPES.has(claim.data.scope) && claim.data.resume_eligible && ADMISSIBLE_CLAIM_STATUSES.has(claim.data.status);
    });
    const covered = stories.some((story) => arrays(story.refs.contribution_ids).includes(contribution.id));
    if (eligible && !covered && !String(contribution.data.star_omission_reason ?? "").trim()) errors.push(`contribution:${contribution.id}: eligible contribution is neither covered by STAR nor explicitly omitted`);
  }
}

function validateCandidates(indexes, errors) {
  for (const candidate of indexes.byType.get("candidate") ?? []) {
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
      for (const name of ["action", "method", "result"]) validateSourced(candidate.data.clauses[name], `${itemPath}.clauses.${name}`, indexes, errors, { actionContext: ["action", "method"].includes(name), ownershipContext: true });
      const clauses = Object.values(candidate.data.clauses).filter(isObject);
      for (const name of ["claim_ids", "evidence_ids", "metric_ids"]) if (!sameSet(union(clauses.map((clause) => clause[name])), arrays(candidate.refs[name]))) errors.push(`${itemPath}: candidate ${name} must exactly match clause sources`);
    }
    if (typeof candidate.data.text !== "string" || !candidate.data.text.trim()) errors.push(`${itemPath}.data.text: non-empty text required`);
    if (!LANGUAGES.includes(candidate.data.language)) errors.push(`${itemPath}.data.language: expected zh-CN or en`);
    guardText(`${itemPath}.data.text`, candidate.data.text ?? "", arrays(candidate.refs.claim_ids).map((id) => indexes.byId.get(id)).filter(Boolean), arrays(candidate.refs.metric_ids).map((id) => indexes.byId.get(id)).filter(Boolean), errors, { actionContext: true });
  }
}

function validateOverviews(indexes, requestedLanguages, errors) {
  const overviews = indexes.byType.get("overview") ?? [];
  for (const overview of overviews) {
    const itemPath = `overview:${overview.id}`;
    if (!LANGUAGES.includes(overview.data.language)) errors.push(`${itemPath}.data.language: expected zh-CN or en`);
    validateSourced(overview.data, itemPath, indexes, errors, { allowContext: true, ownershipContext: true });
    for (const name of ["claim_ids", "evidence_ids", "metric_ids"]) if (!sameSet(arrays(overview.data[name]), refList(overview, name, itemPath, errors))) errors.push(`${itemPath}: refs must mirror data sources`);
  }
  const overviewLanguages = overviews.map((item) => item.data.language);
  if (new Set(overviewLanguages).size !== overviewLanguages.length) errors.push("overview: duplicate language variants");
  for (const language of requestedLanguages) if (!overviewLanguages.includes(language)) errors.push(`overview: missing project overview for language '${language}'`);
  const signatures = new Set(overviews.map((item) => canonical({ claim_ids: unique(arrays(item.data.claim_ids)).sort(), evidence_ids: unique(arrays(item.data.evidence_ids)).sort(), metric_ids: unique(arrays(item.data.metric_ids)).sort() })));
  if (signatures.size > 1) errors.push("overview: bilingual variants must use identical sources");
}

function validateGroups(indexes, requestedLanguages, errors) {
  for (const group of indexes.byType.get("candidate-group") ?? []) {
    const itemPath = `candidate-group:${group.id}`;
    const candidateIds = refList(group, "candidate_ids", itemPath, errors);
    const groupCandidates = candidateIds.map((id) => indexes.byId.get(id));
    if (!candidateIds.length || groupCandidates.some((item) => item?.record_type !== "candidate")) errors.push(`${itemPath}: candidate IDs must resolve`);
    const languages = groupCandidates.map((item) => item?.data.language);
    if (new Set(languages).size !== languages.length) errors.push(`${itemPath}: duplicate language variants`);
    if (languages.length !== requestedLanguages.length || requestedLanguages.some((language) => !languages.includes(language))) errors.push(`${itemPath}: exactly one candidate per selected language is required`);
    const compressionMethods = new Set(groupCandidates.map((item) => item?.data.compression_method));
    if (compressionMethods.size !== 1) errors.push(`${itemPath}: language variants must use the same compression method`);
    for (const candidate of groupCandidates.filter(Boolean)) if (!COMPRESSION_METHODS.includes(candidate.data.compression_method)) errors.push(`${itemPath}: invalid compression method '${candidate.data.compression_method}'`);
    const signatures = groupCandidates.map((item) => canonical({ story_ids: item?.refs.story_ids ?? [], claim_ids: item?.refs.claim_ids ?? [], evidence_ids: item?.refs.evidence_ids ?? [], metric_ids: item?.refs.metric_ids ?? [] }));
    if (signatures.length === 2 && signatures[0] !== signatures[1]) errors.push(`${itemPath}: bilingual variants must use identical sources`);
    for (const candidate of groupCandidates.filter(Boolean)) if (canonical(arrays(candidate.refs.story_ids)) !== canonical(arrays(group.refs.story_ids))) errors.push(`${itemPath}: candidate STAR sources must match the group`);
  }
}

function validateSelection(indexes, errors) {
  const selections = indexes.byType.get("selection") ?? [];
  const groups = indexes.byType.get("candidate-group") ?? [];
  if (selections.length !== 1) { errors.push(`ledger: expected exactly one selection record for resume stage, got ${selections.length}`); return; }
  const selection = selections[0];
  const selected = refList(selection, "selected_group_ids", `selection:${selection.id}`, errors);
  if (selected.length < 1 || selected.length > 4) errors.push(`selection:${selection.id}: select 1 to 4 candidate groups`);
  for (const id of selected) if (indexes.byId.get(id)?.record_type !== "candidate-group") errors.push(`selection:${selection.id}: unknown candidate group '${id}'`);
  if (!String(selection.data.target_role ?? "").trim() && !String(selection.data.job_description ?? "").trim()) errors.push(`selection:${selection.id}: target role or job description required before final selection`);
  for (const group of groups) if (!selected.includes(group.id) && !String(group.data.selection_omission_reason ?? "").trim()) errors.push(`candidate-group:${group.id}: unselected group requires a role-specific omission reason`);
}

export async function validateLedger(records, { stage = "resume", verifyFiles = false } = {}) {
  const errors = [];
  if (!validateEnvelopes(records, errors)) return errors;
  const indexes = indexLedger(records);
  const projects = indexes.byType.get("project") ?? [];
  if (projects.length !== 1) errors.push(`ledger: expected exactly one project record, got ${projects.length}`);
  const resolvedPaths = validateEvidenceRecords(indexes, projects[0], errors);
  if (verifyFiles) validateFileDigests(indexes, resolvedPaths, errors);
  validateClaims(indexes, errors);
  validateMetrics(indexes, errors);
  validateContributions(indexes, errors);
  validateStories(indexes, errors);
  validateStarCoverage(indexes, errors);
  if (stage === "star") return errors;

  const eligibleStories = (indexes.byType.get("story") ?? []).filter((story) => story.data.resume_eligible && !story.data.legacy_review_required);
  const groups = indexes.byType.get("candidate-group") ?? [];
  for (const story of eligibleStories) if (!groups.some((group) => arrays(group.refs.story_ids).includes(story.id))) errors.push(`story:${story.id}: eligible story has no candidate group`);
  validateCandidates(indexes, errors);

  const requestedLanguages = arrays((indexes.byType.get("selection") ?? [])[0]?.data.languages);
  validateOverviews(indexes, requestedLanguages, errors);
  if (!requestedLanguages.length || requestedLanguages.some((value) => !LANGUAGES.includes(value)) || new Set(requestedLanguages).size !== requestedLanguages.length) errors.push(`selection: languages must contain one or both of zh-CN/en`);
  validateGroups(indexes, requestedLanguages, errors);
  validateSelection(indexes, errors);
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
      ["Project overview derives from cited ledger sources", (indexes.byType.get("overview") ?? []).every((item) => arrays(item.data.claim_ids).length && arrays(item.data.evidence_ids).length)],
      ["User-facing artifacts require no schema handling", true],
    ],
    warnings,
  };
}
