/** Import of the retired schema_version 1.0.0 two-skill archive into fresh ledger records. */

import { utcNow } from "./common.mjs";
import { CONTEXT_SCOPES, USER_SCOPES, arrays, intersects, isObject, record, union, unique } from "./ledger.mjs";

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

  const projectClaims = arrays(archive.claims).filter((item) => CONTEXT_SCOPES.includes(item.scope) && item.status === "verified");
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
