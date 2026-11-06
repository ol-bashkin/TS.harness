# Independent sessions

The strategist owns the board. A worker executes one named stage and writes one receipt. Use a new session for each stage and a fresh reviewer who did not implement the change. Reopen the same session only for an authorized continuation of its current stage. An explicit request or recorded standing mandate must cover the launch. Respect host and project permissions.

## Before launch

1. Check the board, current worktree branch and base, approved stage, active sessions and unresolved decisions. Create a dedicated Git worktree from the approved base if the mandate covers it. Keep its branch separate from the integration branch and check it for overlapping edits. For review, freeze the candidate and allow the reviewer to write only the review receipt. A separate detached checkout at the candidate is suitable if the required receipts are available there and the host adapter supports it.
2. Write one stage prompt and name the skill or role. Put the full paths of the worktree, brief, accepted artifacts, applicable project instructions and input receipts in the prompt. Verify the receiving session can read them. Workers must be able to resolve the same version of the installed plugin.
3. Set the board’s stage, exact branch and worktree, expected receipt, and an active dispatch status (`dispatched`, `applying`, `review` or `fixing`). Preserve a recorded `session` until the previous run is reconciled. On an authorized new stage, clear the previous run’s session only after recording its result and keeping its receipt available.

## Launch using the available host

- **Independent chat.** Where the host exposes independent local chats, reserve the stage with `board claim <actor> <change> <stage> <unique-run-id>` before starting a fresh local session at the assigned worktree. Pass the stage prompt, then update the board with the actual session ID when the host confirms it. A queued or provisional ID is pending. Use bounded waits or the host’s completion signal. Record unavailable session visibility as **Unknown**. Require the disk receipt before accepting the stage.
- **CLI worker.** Resolve `scripts/launch.mjs` from this installed skill. From the coordinator root, run `node <path-to-this-skill>/scripts/launch.mjs <actor> <change> <codex|claude> <prompt-file>`. Use a separate registered worktree of the same repository on the recorded branch. Supply the full base commit ID and a prompt file of at most 64 KiB in either checkout. The launcher reserves the available slot and runs one foreground worker. Keep the resulting run ID on the board. Inspect `.harness/runs/` for the native session and process result, then inspect the worker’s stage receipt. A launch receipt proves dispatch and process facts. Stage acceptance uses its own evidence.
- **Operator starts the session.** If the required host tool or permission is unavailable, hand the operator the prepared prompt, worktree and expected receipt. Record the actual session ID when provided. Continue from the same receipt-based checkpoint.

Use host-selected model settings and normal permission enforcement. A CLI permission block may require an interactive operator-started session. If a worker or run is unobservable, check its receipt, exact candidate and host facts before declaring it missing, clearing its session or launching a replacement. A failure in one optional notification channel does not establish a failed stage.

On an unsuccessful CLI run, inspect the bounded stderr file referenced in the run receipt. Keep it in local evidence storage.

## Stage prompt

Use these fields. Keep approval terms explicit and give the worker only one stage.

| Field | Content |
| --- | --- |
| Identity | Change ID, stage, assigned worktree, branch, base and candidate head/tree when applicable |
| Authority | Accepted stage, approval reference, authorized paths and actions, and any explicit limits |
| Inputs | Brief, project rules, OpenSpec artifact paths, previous receipt and relevant checks |
| Role | `opsx` with the named operation, `opsx-review` on a fixed candidate, or a bounded verification, critique or diagnosis assignment |
| Outcome | Required receipt path, success criterion, requested checks and stop point |

For verification, identify precisely which gates are missing and which already have applicable accepted evidence. For critique, ask for the violated rule, location, effect, priority and smallest correction. For diagnosis, ask for competing explanations and the next discriminating check, with the remaining budget. Assign runtime verification to the verifier and permanent fixes to the executor.

The worker’s final update gives the status and path to its receipt. The strategist reads the receipt in full, checks the evidence and records the next decision on the board. Batch follow-up findings for a stage into one instruction.
