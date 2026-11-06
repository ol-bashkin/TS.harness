# Proposal snapshot

In `pause1.md`, record the SHA-256 of each existing artifact in the transitive `applyRequires` set, using its path relative to `changeRoot`. Record the schema, artifact IDs and explicitly skipped or optional paths as well. Hash the exact file bytes except for the task artifact. For that file, normalize checked Markdown task list markers (`[x]` or `[X]`) to `[ ]` and preserve every other byte. Use the same normalization when verifying.

Before apply or independent review, resolve the current artifact graph and recompute the snapshot against the candidate files. Use the pause 1 receipt the operator accepted as the comparison source and keep that receipt stable during implementation. If it cannot be identified, ask the operator which receipt was accepted. If the snapshot differs, return to `update` and obtain a fresh pause 1 acceptance. A task checkbox change records progress. A change to its wording or a proposal, design or spec change needs a new acceptance.
