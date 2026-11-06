---
name: opsx
description: Run an explicitly requested OpenSpec stage for one change. Handles explore, propose, update, apply, fix, sync and archive with written pauses and independent review.
compatibility: Requires Git, Node.js and OpenSpec 1.12.0. Uses a repository-local OpenSpec project.
---

# OPSX

## Start the requested stage

1. Identify the target Git repository, worktree, operation and change ID from the operator's request. `explore` can start without a change ID. Ask for a missing identity or decision that would affect scope. An `opsx:<operation>` string in a prompt names the operation.
2. Work from the root of the target Git worktree. Read the repo instructions, brief, `openspec/config.yaml` and any applicable pause receipts. Inspect `git status --short` and preserve existing changes. Use one worktree for this change, and continue it in a fresh session for each stage. If isolation is missing or work overlaps, report the conflict and stop before writes. Creating a commit, pushing, opening a PR or merging requires its own authorization.
3. Run `node <path-to-this-skill>/scripts/openspec.mjs --version`. Resolve the script from this installed skill and use its absolute path while running from the target repository. The commands below use `ospec` as shorthand for that full invocation. Stop on a version or setup failure and report the remedy. The operator manages installation and `openspec init`.
4. For a named change, run `ospec status --change <id> --json`. Use `changeRoot`, `planningHome`, `artifactPaths`, and `actionContext` from the CLI. Write only inside the authorized worktree and selected change, except for explicitly requested implementation paths or canonical spec updates. This pilot handles repo-local changes. A different planning root or blocked action stops the stage before writes. For a new `propose`, require a successful `ospec list --changes --json` showing that the ID is absent, `root.path` resolves to the worktree root, and no `root.store_id` is set. An error alone does not prove absence.

Execute one operation per request. A pause records the result and stops the turn. A receipt, a passing check or elapsed time cannot authorize a later stage. Record the operator's explicit decision in the next receipt. Escalate open product decisions, a change in scope or a required check that cannot run. Record unknown and skipped checks separately from passes.

## Explore

Read the existing sources and isolate the open question. Report options, evidence and the decision still needed. Keep the worktree read-only. If the operator authorizes a probe, agree on the scope, limit and stopping criterion before running it.

## Propose or update

1. On a new, confirmed-absent `propose`, run `ospec new change <id>` and reread status. For an existing change, preserve existing artifacts and read them before editing. `update` targets an existing change and follows the specific requested revision.
2. Walk the `requires` edges transitively from `applyRequires`. For each new or changed artifact, run `ospec instructions <artifact-id> --change <id> --json`, read the inputs, and use its template, rules and destination. Artifact rules constrain the artifact's contents. Refresh status as dependencies are satisfied. Honor OpenSpec's explicit skips and conditional instructions. A `done` file can still have missing dependencies. Keep already implemented work and task history intact, reopening only tasks affected by the revision. For a new capability, include a substantive `## Purpose` of at least 50 characters in its delta. OpenSpec 1.12.0 copies it into the canonical spec during archive.
3. Check the resulting scope against the brief and canonical specs. Run `ospec validate <id> --type change --strict` and inspect the final graph. Write `pause1.md` inside `changeRoot` with the scope, affected capabilities, artifact state, validation, open decisions and the [proposal snapshot](references/plan-snapshot.md). Finish at **pause 1** and wait for the operator to accept that proposal and request `apply`. A substantive update requires renewed acceptance of the updated proposal.

## Apply

1. Read `pause1.md`, verify the [proposal snapshot](references/plan-snapshot.md) and confirm that the operator accepted that proposal and authorized implementation. Get `ospec instructions apply --change <id> --json`. Read all returned `contextFiles` and the applicable repo rules. Stop on changed proposal artifacts, missing dependencies, a blocked state or a material scope conflict.
2. Implement only the accepted tasks, marking each complete once its check passes. Run the repository's required checks and `ospec validate <id> --type change --strict`. Preserve partial results and report a failed or unrun required check before proceeding.
3. Write `pause2.md` with the implemented scope, remaining tasks, check commands and outcomes, and the exact implementation subject. Record which pause 1 receipt the operator accepted. A reviewable subject is an operator-designated base and a committed candidate head and tree. If the candidate is still uncommitted, record that state and ask the operator to provide the review snapshot. Do not attribute working-tree checks to a later commit without verifying equivalence. Stop at **pause 2**. The operator opens a fresh session with `opsx-review`, the same change ID, and the designated base and candidate.

## Fix

1. Read `pause2.md` and the independent `review.md`. Verify the recorded base, head and tree against the candidate. If there is drift beyond the pause and review receipts, request a fresh review of the current candidate before acting on stale findings.
2. For findings, write `pauseR.md` with each finding, its proposed disposition and why. Keep implementation and specs untouched. Stop at **pause R**. The operator must explicitly authorize the dispositions before edits. On resumption, verify the same review inputs and address only the approved findings. If a fix needs a substantive change to a planning artifact, route it through `update` and a fresh pause 1 acceptance before implementation.
3. Run affected project checks and strict change validation. Update `pauseR.md` with the outcomes, remaining decisions and the revised implementation subject using the same revision and evidence fields as pause 2. Stop and have the operator submit the new committed candidate to a fresh `opsx-review` session. Only the independently accepted candidate can proceed to archive.

## Sync

Sync updates the canonical specs and leaves the change active. Require explicit authorization to sync the named change, all affected tasks and checks complete, and the same independent acceptance and revision checks as for archive. Read the delta paths from status and the applicable `ospec instructions specs --change <id> --json`. If no delta exists, report that there is nothing to sync.

Read each selected delta alongside its canonical spec. Apply its additions, modifications, removals and renames by requirement title. Preserve the canonical Purpose and unrelated requirements and scenarios. For a new capability use the Purpose from its delta. Stop before writing if a target is ambiguous, missing where required, or overlaps another change. Validate the resulting specs with `ospec validate --specs --strict`, verify the selected delta and report the paths that changed. Record the applied delta in `pauseR.md` so a later archive can confirm which changes were synced.

## Archive

1. Require explicit archive authorization for this change. Read `pause2.md`, the current `review.md` and `pauseR.md` when present. Require an independent **Accepted** result covering the current candidate, complete tasks, closed findings and passing required checks. Verify the base, head and tree and inspect any staged, unstaged or untracked changes. Only the pause and review receipts may differ from the reviewed implementation. A prior explicit sync is allowed only if its recorded canonical changes match the reviewed deltas, with every canonical difference accounted for. Block on any unexplained difference.
2. Read `ospec instructions archive --change <id> --json`, check the artifact graph again and run `ospec validate <id> --type change --strict` and `ospec validate --specs --strict` before making changes. Review the intended canonical spec diff and the archive destination. For ordinary unsynced deltas, run `ospec archive <id> --yes` to apply the delta and move the change. Use `--skip-specs` only when all deltas are already reflected in the canonical specs and the operator explicitly approved archiving with that option. Stop if prior sync is partial or divergent.
3. Verify the change is absent from active changes, inspect the archived files and canonical diff, and run `ospec validate --all --strict`. Report the archive path, the specs changed and the check results. Stop for the operator's next action.

## Receipt format

Each receipt records the change ID, stage, scope, input paths, check commands and results, unresolved decisions and the next required action. For implementation evidence, include the base SHA, head SHA, tree SHA, relevant environment, exit code and a reference to retained logs. If a report file needs to change after the candidate commit, distinguish those bytes from the reviewed product and spec bytes. Keep raw logs, traces, secrets and diagnostic outputs in local evidence storage. For an explicitly authorized Git publication, use the project rules, list the exact paths and check the staged or outgoing diff before the action.
