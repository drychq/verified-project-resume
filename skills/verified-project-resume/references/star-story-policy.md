# STAR story quality and coverage policy

## Contents

- Story unit
- Detail standard
- Coverage
- Evidence gaps

## Story unit

Create one story for one defensible contribution theme or engineering decision. Combine changes only when they address the same problem through a coherent method and result. Split independent problems even when they belong to one subsystem.

Do not target a fixed count. A small project may support one story; a rich project may support many.

## Detail standard

Each story must contain sourced Situation, Task, Action, and Result sections.

- Situation explains the verified context, prior state, or failure without inventing stakes.
- Task records the user's bounded responsibility, constraints, and success condition.
- Action normally contains two to five steps: what changed, how it worked, why the method was chosen, relevant alternatives or trade-offs, and how it was verified. Include only supported dimensions.
- Result records measurements, tests, corrected behavior, or bounded capabilities and always states the evidence boundary.

Also record constraints, decisions, trade-offs, interview questions, risk flags, and open questions. Empty decision/trade-off fields should trigger a review warning, not invented content.

## Coverage

Map every admissible contribution to at least one story. A contribution may be omitted only with a specific reason such as duplication, insufficient ownership evidence, or irrelevance to the project story—not merely to keep output short.

Generate at least one guarded candidate group for every resume-eligible story. Final role tailoring may select only a subset of that pool.

## Evidence gaps

When a potentially useful story lacks responsibility, method, or outcome evidence, create focused open questions. Never ask the user to approve a prewritten strong claim. Capture their answer verbatim as confirmation evidence, then derive the narrowest supported statement.
