# Change lifecycle

## Phase and mandate

Use the project’s existing phase and backlog files. When the project has none, keep a short `phase.md` under `.harness/` with the goal, approved change IDs and order, dependencies, parallel slots, exit checks and unresolved decisions. A single authorized change is enough for a phase. Get the operator’s agreement to the scope and any standing mandate before filling slots. A standing mandate can cover successive worker sessions, review, verification, fix and archive for the named changes. Record its actual limits, including branch and publication permissions. A package install grants no project authority.

Use one worktree per change. Default to one implementation slot unless the phase permits parallel, disjoint work. An earlier change must merge before another implementation starts in overlapping paths. A bounded proposal for the later change may run in its own slot if the phase authorizes it. A waiting decision blocks its dependent work. Keep independent authorized work moving.

Record the change with `board add <actor> <change> field=value...`. Use `board set <actor> <change> field=value...` for current status, stage, branch, base, worktree, session, receipt, PR and next action. Use `board decision <actor> <change> <text>` to record a decision with its authority and a link to the full record. Keep the current receipt path and exact subject in the record. Keep owner decisions attributable to the owner and project interpretations attributable to the strategist.

## Decisions and stopping points

The operator decides changes to approved scope, public contracts, user-visible behavior outside the brief, new dependencies, reduced guarantees, unresolved disputes and external actions outside the mandate. Put the user impact, viable options, recommendation and cost in a compact decision record. A pending decision stays pending until the operator settles it. An approved stage may complete independent work within its scope and stop before dependent work. Explicit stop conditions and test limits carry through every handoff.

## Stage sequence

| Stage | Strategist acceptance |
| --- | --- |
| Brief | Record the goal, scope and excluded paths, base, applicable specifications, observable acceptance checks, any project adapters and known decisions. Resolve ambiguities that would change scope before dispatch. |
| Propose | Assign `opsx propose <change>` in a fresh executor session. The executor stops at `pause1.md`. Read the receipt and the full proposed artifacts. Check the artifact graph and snapshot, strict validation, scope, scenarios and open decisions. Record acceptance of that exact proposal before `apply`. |
| Apply | Assign `opsx apply <change>` in a fresh executor session with the accepted proposal and scope. Recheck base and overlap before changes. The executor stops at `pause2.md`. Read the receipt and confirm the actual candidate, implementation scope, tests and open conditions. Record the exact base, head and tree. |
| Critique and verification | For a material contract, ownership or architecture change, ask a fresh critic to assess the implementation before expensive runs. Use the project’s required independent verification on the candidate. See [Verification and evidence](verification.md). |
| Independent review | Assign `opsx-review` in a fresh session on the exact candidate with the accepted plan and evidence. Review project standards and specification separately. Use the security scope when applicable. Accept only a matching `review.md` verdict. |
| Fix | For findings, assign `opsx fix <change>`. Receive `pauseR.md` with dispositions before edits. Approve the agreed dispositions within the mandate or obtain the operator’s decision. Route substantive specification changes through `update` and a new pause 1. After edits, obtain a fresh independent review of the revised candidate. |
| Archive | After independent acceptance and all conditional checks, authorize `opsx archive <change>` within the mandate. Verify the archive receipt, exact intended canonical changes and strict validation. Rerun affected checks if the archive changed their subject. |
| Ready and merged | Verify the final candidate and required gates. If the project uses a PR, verify its actual draft and merge status through the project’s service. Treat merge and release as operator actions unless explicitly delegated. Confirm the integrated revision and any required external checks before closing the row. |

For a receipt, distinguish **passed**, **failed**, **not run** and **Unknown**. A missing gate blocks acceptance. Keep source, candidate, environment and scope tied to their own results. Reuse accepted evidence only when its covered tree or verified byte set, environment, dependency inputs and gate are equivalent.

## Close a phase

Check its exit conditions against current evidence and the integration state. Record compact outcomes and follow-ups in the project’s backlog. File newly discovered work outside the accepted scope in the inbox or backlog. Convert a recurring lesson into a project rule, template or check where it can change behavior. Preserve needed primary evidence before cleanup. If the operator transfers the project to another strategist, follow [Transfer the strategist session](handover.md).
