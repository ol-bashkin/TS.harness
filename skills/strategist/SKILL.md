---
name: strategist
description: Coordinate an explicitly assigned project phase or OpenSpec change, accept stage evidence, and transfer a strategist session through HANDOVER.md.
disable-model-invocation: true
compatibility: Requires Git, Node.js and the project’s OpenSpec 1.12.0 installation.
---

# Strategist

Work from the root of the coordinator checkout. Resolve `scripts/board.mjs` from this installed skill and use its absolute path. Below, `board` means `node <path-to-this-skill>/scripts/board.mjs`. Use the same coordinator checkout for the board throughout a phase. Give product commands the change worktree as their working directory.

## Start or resume

1. Read the project instructions and the operator’s mandate. Identify the repository, active phase or change, requested action, and your stable session ID. Use the actual host session ID when available. Otherwise use an operator-assigned unique ID for this session. Treat IDs recorded for other sessions as references to those sessions.
2. Run `board snapshot`. For an existing board, read `HANDOVER.md` when present, the current phase plan and decisions, and the latest receipt for each in-flight change. Read `board show` for a compact queue. On a new project, `board init <actor>` is the operator-authorized initialization step. Read [Transfer the strategist session](references/handover.md) when preparing a handover, resuming after lost context, or entering as a successor.
3. Compare the disk state with `git worktree list --porcelain`, the configured base refs, and available host and PR facts. Mark missing access or incomplete host data **Unknown**. Report contradictions before starting a stage. Only the active strategist continues orchestration. A pending handover freezes it until the registered successor is active.

## Run the authorized action

- **Plan, dispatch or accept a change stage.** Read [Change lifecycle](references/lifecycle.md) for phase scope, stage order and decision gates. Read [Independent sessions](references/launch.md) before launching or resuming an executor, reviewer, verifier, critic or diagnostician.
- **Verify, diagnose or close a change.** Read [Verification and evidence](references/verification.md) before accepting a check, scheduling a repeat, publishing a branch, marking a merge or removing a worktree. Product commands and their required outcomes come from the project’s own rules and the accepted brief.
- **Prepare, restore, register or activate a handover.** Follow [Transfer the strategist session](references/handover.md) and stop at the checkpoint appropriate to the current session.

Record durable facts on the board through `board add`, `board set` and `board decision`. Put detailed decisions and evidence in files and link them from the board. Accept a stage from its receipt and verified inputs. A message or successful session exit is a signal to inspect the receipt. Finish with the current stage, the evidence path, any pending decision, and the next authorized action.
