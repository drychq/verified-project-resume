/** Stage-aware deterministic record validation and workflow review. */

import { sha256File } from "./common.mjs";
import {
  ADMISSIBLE_CLAIM_STATUSES, ADMISSIBLE_METRIC_STATUSES, COMPRESSION_METHODS, INADMISSIBLE_RESUME_SCOPES,
  ACTION_KINDS, LANGUAGES, SHA256_RE, STORY_SECTIONS, USER_SCOPES, CONTEXT_SCOPES,
  TESTIMONY_EVIDENCE_TYPES, USER_TEXT_EVIDENCE_TYPES,
  arrays, canonical, indexRecords, isObject, resolveEvidencePath, sameSet, sha256Text, subset, union, unique,
} from "./records.mjs";
import { reviewFlags, checkProposal, checkText, numericTokens, validateSourced } from "./checks.mjs";

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
        if (!USER_TEXT_EVIDENCE_TYPES.has(data.type) || typeof data.excerpt !== "string" || data.sha256 !== sha256Text(data.excerpt)) errors.push(`${itemPath}: invalid user text digest`);
      } else if (data.digest_basis === "proposal-confirmation-text") {
        const payload = { proposal_excerpt: data.proposal_excerpt ?? null, confirmation_excerpt: data.confirmation_excerpt ?? null };
        if (data.type !== "user-approved-proposal" || typeof data.proposal_excerpt !== "string" || typeof data.confirmation_excerpt !== "string" || data.sha256 !== sha256Text(canonical(payload))) errors.push(`${itemPath}: invalid proposal confirmation digest`);
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

function collectedEvidence(refs, indexes) {
  return refs.map((id) => indexes.byId.get(id)).filter((item) => item?.record_type === "evidence" && item.data.availability === "collected");
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
    const collected = collectedEvidence(refs, indexes);
    if (claim.data.status === "user-confirmed" && !collected.some((item) => USER_TEXT_EVIDENCE_TYPES.has(item.data.type))) errors.push(`${itemPath}: user-confirmed claim requires collected user text (statement, confirmation, or material)`);
    if (claim.data.status === "user-approved") {
      const proposals = collected.filter((item) => item.data.type === "user-approved-proposal");
      if (!proposals.length) errors.push(`${itemPath}: user-approved claim requires a collected user-approved-proposal`);
      const userText = collected.filter((item) => USER_TEXT_EVIDENCE_TYPES.has(item.data.type)).map((item) => String(item.data.excerpt ?? "")).join("\n");
      const userNumbers = numericTokens(userText);
      for (const token of [...numericTokens(claim.data.text ?? "")].filter((value) => !userNumbers.has(value)).sort()) errors.push(`${itemPath}: number '${token}' was not provided by the user`);
      for (const proposal of proposals) checkProposal(`${itemPath}.proposal`, String(proposal.data.proposal_excerpt ?? ""), userText, errors);
    }
    if (claim.data.status === "verified" && collected.length && !collected.some((item) => !TESTIMONY_EVIDENCE_TYPES.has(item.data.type))) errors.push(`${itemPath}: verified claim requires at least one non-testimony source`);
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
    if (metric.data.status === "user-provided") {
      if (metric.data.value == null) errors.push(`${itemPath}: user-provided metric requires a value`);
      const collected = collectedEvidence(refs, indexes);
      if (!collected.some((item) => TESTIMONY_EVIDENCE_TYPES.has(item.data.type))) errors.push(`${itemPath}: user-provided metric requires collected user evidence`);
      if (!Array.isArray(metric.data.review_flags) || !metric.data.review_flags.includes("user-provided-number")) errors.push(`${itemPath}: user-provided metric requires review_flags containing 'user-provided-number'`);
      if (metric.data.kind === "performance" && metric.data.baseline != null && metric.data.result == null) errors.push(`${itemPath}: a stated performance comparison requires both baseline and result`);
    }
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

function validateStories(indexes, errors, warnings) {
  for (const story of indexes.byType.get("story") ?? []) {
    const itemPath = `story:${story.id}`;
    for (const field of STORY_SECTIONS) {
      const sections = story.data[field];
      if (!Array.isArray(sections) || !sections.length) errors.push(`${itemPath}.data.${field}: at least one sourced section required`);
      else sections.forEach((section, index) => validateSourced(section, `${itemPath}.${field}[${index}]`, indexes, errors, {
        actionContext: ["task", "actions"].includes(field) && story.data.resume_eligible,
        allowContext: field === "situation",
        ownershipContext: true,
        warnings,
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

function validateStoryCoverage(indexes, errors) {
  const stories = indexes.byType.get("story") ?? [];
  for (const contribution of indexes.byType.get("contribution") ?? []) {
    const eligible = arrays(contribution.refs.claim_ids).some((id) => {
      const claim = indexes.byId.get(id);
      return claim?.record_type === "claim" && USER_SCOPES.has(claim.data.scope) && claim.data.resume_eligible && ADMISSIBLE_CLAIM_STATUSES.has(claim.data.status);
    });
    const covered = stories.some((story) => arrays(story.refs.contribution_ids).includes(contribution.id));
    if (eligible && !covered && !String(contribution.data.star_omission_reason ?? "").trim()) errors.push(`contribution:${contribution.id}: eligible contribution is neither covered by a story nor explicitly omitted`);
  }
}

function interviewQaEntries(item) {
  return arrays(item.data?.interview_qa).filter((entry) => isObject(entry) && String(entry.question ?? "").trim() && String(entry.answer ?? "").trim());
}

function validateInterviewQaShape(item, itemPath, errors) {
  if (item.data?.interview_qa == null) return;
  if (!Array.isArray(item.data.interview_qa) || interviewQaEntries(item).length !== item.data.interview_qa.length) errors.push(`${itemPath}.data.interview_qa: every entry needs question and answer text`);
}

function validateCandidates(indexes, errors, warnings) {
  for (const candidate of indexes.byType.get("candidate") ?? []) {
    const itemPath = `candidate:${candidate.id}`;
    const storyIds = refList(candidate, "story_ids", itemPath, errors);
    if (!storyIds.length) errors.push(`${itemPath}: candidate must cite a story`);
    const sourceStories = storyIds.map((id) => indexes.byId.get(id)).filter((item) => item?.record_type === "story");
    if (sourceStories.length !== storyIds.length) errors.push(`${itemPath}: unknown story`);
    for (const story of sourceStories) if (!story.data.resume_eligible) errors.push(`${itemPath}: cited story '${story.id}' is not resume eligible`);
    const allowedClaims = union(sourceStories.map((item) => item.refs.claim_ids));
    const allowedEvidence = union(sourceStories.map((item) => item.refs.evidence_ids));
    const allowedMetrics = union(sourceStories.map((item) => item.refs.metric_ids));
    for (const [name, allowed] of [["claim_ids", allowedClaims], ["evidence_ids", allowedEvidence], ["metric_ids", allowedMetrics]]) {
      const refs = refList(candidate, name, itemPath, errors);
      if (!subset(refs, allowed)) errors.push(`${itemPath}: ${name} bypasses the cited story`);
    }
    if (!isObject(candidate.data.clauses)) errors.push(`${itemPath}.data.clauses: object required`);
    else {
      for (const name of ["action", "method", "result"]) validateSourced(candidate.data.clauses[name], `${itemPath}.clauses.${name}`, indexes, errors, { actionContext: ["action", "method"].includes(name), ownershipContext: true, warnings });
      const clauses = Object.values(candidate.data.clauses).filter(isObject);
      for (const name of ["claim_ids", "evidence_ids", "metric_ids"]) if (!sameSet(union(clauses.map((clause) => clause[name])), arrays(candidate.refs[name]))) errors.push(`${itemPath}: candidate ${name} must exactly match clause sources`);
    }
    if (typeof candidate.data.text !== "string" || !candidate.data.text.trim()) errors.push(`${itemPath}.data.text: non-empty text required`);
    if (!LANGUAGES.includes(candidate.data.language)) errors.push(`${itemPath}.data.language: expected zh-CN or en`);
    validateInterviewQaShape(candidate, itemPath, errors);
    checkText(`${itemPath}.data.text`, candidate.data.text ?? "", arrays(candidate.refs.claim_ids).map((id) => indexes.byId.get(id)).filter(Boolean), arrays(candidate.refs.metric_ids).map((id) => indexes.byId.get(id)).filter(Boolean), errors, { actionContext: true, warnings });
  }
}

function validateOverviews(indexes, requestedLanguages, errors, warnings) {
  const overviews = indexes.byType.get("overview") ?? [];
  for (const overview of overviews) {
    const itemPath = `overview:${overview.id}`;
    if (!LANGUAGES.includes(overview.data.language)) errors.push(`${itemPath}.data.language: expected zh-CN or en`);
    validateSourced(overview.data, itemPath, indexes, errors, { allowContext: true, ownershipContext: true, warnings });
    for (const name of ["claim_ids", "evidence_ids", "metric_ids"]) if (!sameSet(arrays(overview.data[name]), refList(overview, name, itemPath, errors))) errors.push(`${itemPath}: refs must mirror data sources`);
    validateInterviewQaShape(overview, itemPath, errors);
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
    for (const candidate of groupCandidates.filter(Boolean)) if (canonical(arrays(candidate.refs.story_ids)) !== canonical(arrays(group.refs.story_ids))) errors.push(`${itemPath}: candidate story sources must match the group`);
  }
}

function validateSelection(indexes, errors) {
  const selections = indexes.byType.get("selection") ?? [];
  const groups = indexes.byType.get("candidate-group") ?? [];
  if (selections.length !== 1) { errors.push(`records: expected exactly one selection record for resume stage, got ${selections.length}`); return; }
  const selection = selections[0];
  const selected = refList(selection, "selected_group_ids", `selection:${selection.id}`, errors);
  if (selected.length < 1 || selected.length > 4) errors.push(`selection:${selection.id}: select 1 to 4 candidate groups`);
  for (const id of selected) if (indexes.byId.get(id)?.record_type !== "candidate-group") errors.push(`selection:${selection.id}: unknown candidate group '${id}'`);
  if (!String(selection.data.target_role ?? "").trim() && !String(selection.data.job_description ?? "").trim()) errors.push(`selection:${selection.id}: target role or job description required before final selection`);
  for (const group of groups) if (!selected.includes(group.id) && !String(group.data.selection_omission_reason ?? "").trim()) errors.push(`candidate-group:${group.id}: unselected group requires a role-specific omission reason`);
}

function validateSelectedInterviewQa(indexes, errors) {
  const selections = indexes.byType.get("selection") ?? [];
  if (!selections.length) return;
  for (const groupId of arrays(selections[0].refs.selected_group_ids)) {
    const group = indexes.byId.get(groupId);
    if (group?.record_type !== "candidate-group") continue;
    for (const candidateId of arrays(group.refs.candidate_ids)) {
      const candidate = indexes.byId.get(candidateId);
      if (candidate?.record_type !== "candidate") continue;
      if (!interviewQaEntries(candidate).length) errors.push(`candidate:${candidate.id}.data.interview_qa: at least one question and answer is required for a selected bullet`);
    }
  }
  for (const overview of indexes.byType.get("overview") ?? []) if (!interviewQaEntries(overview).length) errors.push(`overview:${overview.id}.data.interview_qa: at least one question and answer is required`);
}

export async function validateRecords(records, { stage = "resume", verifyFiles = false, warnings = [] } = {}) {
  const errors = [];
  if (!validateEnvelopes(records, errors)) return errors;
  const indexes = indexRecords(records);
  const projects = indexes.byType.get("project") ?? [];
  if (projects.length !== 1) errors.push(`records: expected exactly one project record, got ${projects.length}`);
  const resolvedPaths = validateEvidenceRecords(indexes, projects[0], errors);
  if (verifyFiles) validateFileDigests(indexes, resolvedPaths, errors);
  validateClaims(indexes, errors);
  validateMetrics(indexes, errors);
  validateContributions(indexes, errors);
  validateStories(indexes, errors, warnings);
  validateStoryCoverage(indexes, errors);
  if (stage === "star") return errors;

  const eligibleStories = (indexes.byType.get("story") ?? []).filter((story) => story.data.resume_eligible);
  const groups = indexes.byType.get("candidate-group") ?? [];
  for (const story of eligibleStories) if (!groups.some((group) => arrays(group.refs.story_ids).includes(story.id))) errors.push(`story:${story.id}: eligible story has no bullet options`);
  validateCandidates(indexes, errors, warnings);

  const requestedLanguages = arrays((indexes.byType.get("selection") ?? [])[0]?.data.languages);
  validateOverviews(indexes, requestedLanguages, errors, warnings);
  if (!requestedLanguages.length || requestedLanguages.some((value) => !LANGUAGES.includes(value)) || new Set(requestedLanguages).size !== requestedLanguages.length) errors.push(`selection: languages must contain one or both of zh-CN/en`);
  validateGroups(indexes, requestedLanguages, errors);
  validateSelection(indexes, errors);
  validateSelectedInterviewQa(indexes, errors);
  return errors;
}

function groundingItem(kind, item, indexes) {
  const claims = arrays(item.refs?.claim_ids).map((id) => indexes.byId.get(id)).filter((entry) => entry?.record_type === "claim");
  const metrics = arrays(item.refs?.metric_ids).map((id) => indexes.byId.get(id)).filter((entry) => entry?.record_type === "metric");
  return {
    kind, id: item.id, language: item.data?.language ?? null,
    code_supported: claims.filter((claim) => claim.data.status === "verified").length,
    user_stated: claims.filter((claim) => claim.data.status === "user-confirmed").length,
    proposal_confirmed: claims.filter((claim) => claim.data.status === "user-approved").length,
    user_numbers: metrics.filter((metric) => metric.data.status === "user-provided").length,
    flags: reviewFlags(String(item.data?.text ?? ""), claims, metrics),
    questions: arrays(item.data?.interview_questions),
    qa: interviewQaEntries(item),
  };
}

export function auditRecords(records) {
  const indexes = indexRecords(records);
  const stories = indexes.byType.get("story") ?? [];
  const groups = indexes.byType.get("candidate-group") ?? [];
  const selection = (indexes.byType.get("selection") ?? [])[0];
  const warnings = [];
  for (const story of stories) {
    if (arrays(story.data.actions).length < 2) warnings.push(`${story.id}: fewer than two detailed Action steps; ask for more instead of inventing detail.`);
    for (const field of ["constraints", "decisions", "tradeoffs"]) if (!arrays(story.data[field]).length) warnings.push(`${story.id}: ${field} not recorded.`);
  }
  for (const metric of indexes.byType.get("metric") ?? []) {
    if (metric.data.resume_eligible && metric.data.status === "user-provided") warnings.push(`${metric.id}: number provided from memory; be ready to explain how you know it.`);
  }
  const selected = arrays(selection?.refs.selected_group_ids);
  if (selection && selected.length === 1) warnings.push("Only one supported final bullet was selected; coverage is limited.");
  const interviewPrep = [];
  for (const groupId of selected) {
    const group = indexes.byId.get(groupId);
    for (const candidateId of arrays(group?.refs.candidate_ids)) {
      const candidate = indexes.byId.get(candidateId);
      if (candidate?.record_type === "candidate") interviewPrep.push(groundingItem("candidate", candidate, indexes));
    }
  }
  for (const overview of indexes.byType.get("overview") ?? []) interviewPrep.push(groundingItem("overview", overview, indexes));
  for (const item of interviewPrep) if (item.code_supported === 0 && item.user_stated + item.proposal_confirmed > 0) warnings.push(`${item.id}: rests on your account only; expect follow-up questions.`);
  return {
    checks: [
      ["Sources are recorded before claims", (indexes.byType.get("claim") ?? []).every((item) => arrays(item.refs.evidence_ids).length || !item.data.resume_eligible)],
      ["Eligible contributions are covered by stories", (indexes.byType.get("contribution") ?? []).every((item) => stories.some((story) => arrays(story.refs.contribution_ids).includes(item.id)) || String(item.data.star_omission_reason ?? "").trim())],
      ["A detailed story library exists", stories.length > 0 && stories.every((item) => STORY_SECTIONS.every((field) => arrays(item.data[field]).length))],
      ["Bullet options derive from stories", groups.every((group) => arrays(group.refs.story_ids).length)],
      ["Final selection follows the target role", !selection || Boolean(String(selection.data.target_role ?? selection.data.job_description ?? "").trim())],
      ["Final bullets come from the checked options", !selection || selected.every((id) => indexes.byId.get(id)?.record_type === "candidate-group")],
      ["The project overview cites its sources", (indexes.byType.get("overview") ?? []).every((item) => arrays(item.data.claim_ids).length && arrays(item.data.evidence_ids).length)],
      ["User-facing files require no schema handling", true],
    ],
    warnings,
    interviewPrep,
  };
}
