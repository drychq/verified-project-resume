/** Deterministic Markdown rendering of the four user-facing workspace artifacts. */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { arrays, indexLedger } from "./ledger.mjs";
import { auditLedger, validateLedger } from "./validate.mjs";

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
  lines.push(`- Target role: ${selection.data.target_role ?? "not specified"}`, `- Focus: ${selection.data.focus ?? "best-supported evidence"}`);
  const overviews = (indexes.byType.get("overview") ?? []).filter((item) => arrays(selection.data.languages).includes(item.data.language));
  if (overviews.length) {
    lines.push("", "## Project overview", "");
    for (const overview of overviews) lines.push(`- **${overview.data.language}**: ${overview.data.text}`, `  - Claims: ${arrays(overview.data.claim_ids).map((id) => `\`${id}\``).join(", ") || "none"}; Evidence: ${arrays(overview.data.evidence_ids).map((id) => `\`${id}\``).join(", ") || "none"}`);
  }
  lines.push("", "## Selected bullets", "");
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
  const errors = await validateLedger(records, { stage, verifyFiles: true });
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
