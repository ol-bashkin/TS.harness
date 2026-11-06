# Transfer the strategist session

Use a handover at a phase boundary, at the operator’s request, or when a fresh session is needed after context loss. The disk record is authoritative. Chat summaries help navigate it. A restore is a read-only reconciliation. Registration and activation are separate actions.

## Predecessor

1. Finish the nearest safe checkpoint. Reconcile the current board with running work, latest receipts and exact repository facts. Preserve active workers and their worktrees. Keep unresolved questions and evidence as they stand.
2. Write a compact notes file inside the coordinator checkout, separate from `HANDOVER.md` and within 12 KiB. Include the phase and goal, what changed since the last handover, pending decisions, relevant receipts and local evidence paths, next authorized action, and known hazards. Include worker session identifiers, worktrees and PR references where the board lacks them. Record each Unknown explicitly. Keep secrets and raw transcripts out of the notes.
3. Run `board prepare <actor> <notes-file>`. This archives the previous `HANDOVER.md` when present, writes the new one and freezes board mutations. Read back the result with `board restore`. Record its digest and the expected successor session. Use a fresh independent session when the operator authorizes it. Pass the coordinator path, the handover path and the expected digest. Instruct the successor to restore first.

## Successor

1. Start from the same coordinator checkout. Run `board restore` and read the complete `HANDOVER.md`, current phase plan, project rules, and latest relevant receipts. Confirm the digest matches the handover being transferred. A null digest means no handover is pending. If output is too large, read the complete numbered parts of one file snapshot and verify its digest. A truncated reading is incomplete.
2. Compare the snapshot with `git worktree list --porcelain`, actual branch and candidate facts, and available live host and PR records. Report what is confirmed, what differs, which actors are still active or Unknown, what waits for the operator, and the next action. Preserve the identity of in-flight workers and the scope of unfinished work.
3. After successful reconciliation and within the operator’s mandate, run `board register <successor> <digest>` with this session’s distinct stable ID. Read back registration. Orchestration stays frozen while registered.
4. After registration is confirmed and the transfer is authorized, run `board activate <successor> <digest>`. Read back `board snapshot` and confirm that this session is active. Only then take the next authorized action. The predecessor ends its coordinator work once activation is confirmed.

If registration or activation cannot be verified, leave the handover pending and report the exact missing fact. A dropped connection or another context loss does not create a new handover. Reconcile the existing handover from disk. Continue the same in-flight worker or wait for its receipt. Start a replacement only after verifying that the recorded worker can no longer complete its assigned stage and recording that decision.

If the registered successor cannot activate and the operator approves a replacement, the predecessor runs `board unregister <predecessor> <successor> <digest>`. The board remains frozen at the same handover. The replacement restores, registers and activates using its own ID.
