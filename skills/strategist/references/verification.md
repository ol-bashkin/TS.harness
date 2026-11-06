# Verification and evidence

## Candidate checks

Derive checks from the project’s local instructions and the brief. Before dispatch, identify the candidate base, head and tree, relevant toolchain and dependency inputs, required checks, and already accepted evidence. Use a separate verifier for expensive or long-running checks. Run required commands in a clean checkout of the candidate with the project’s normal timeouts and isolation. Use the project’s shared resource lock where applicable. Record an unavailable environment or lock as a distinct blocker.

Keep standards, spec, security and runtime conclusions separate. Review security when the diff crosses a trust boundary, for example input, permissions, network, persistence or devices. Use a critic for material public contracts, architecture, dependencies or state ownership. The critic inspects the whole solution read-only before expensive checks. It leaves an actionable finding or a pass. The independent reviewer still covers the final diff.

The verifier’s receipt contains every required gate, its exact command, exit, result, counts, skips, subject and environment. Preserve primary logs locally and reference them from the receipt. The strategist reads the entire receipt and verifies scope, coverage and evidence availability. Reuse a passing result only for the exact tree or equivalent covered bytes and inputs, including environment and required gates. Record the reason for a repeat. Report missing historical evidence as **Missing** even when a new run passes.

## Bounded investigations

For `propose`, name the uncertainty, minimal probe, observable answer, cumulative spend and stop point. Default research limits across all continuations are 60 active minutes, 24 scenario executions, 50 new evidence files and 20 MiB. Count each scenario, control and retry. Preserve the same totals when a session or role changes. Project limits or an explicit operator limit take precedence. Stop once the question is answered or before exceeding any limit. Keep required implementation and acceptance gates separate from research limits.

On a failure, record the command, subject, environment, native exit, original error, timeout boundary and whether tests started. Classify it as setup, assertion, timeout, environment or unknown. A known defect gets a scoped fix and affected checks. An unknown cause gets two distinct executor cycles at most, with a limit of 15 active minutes and four executions. Each cycle needs a hypothesis, one changing factor, expected outcomes, exact subject and stopping criterion. Preserve capacity for cleanup and the result receipt.

At the executor’s limit, pass the receipts and cumulative spend to a fresh read-only diagnostician. The diagnostician starts from code and existing evidence and gets up to three discriminating cycles and 45 active minutes within the remaining shared limits. Assign the actual checks to a verifier. Identical retries and broad reruns with an unknown cause stop until a new discriminating plan exists. Escalate a documented dead end or a decision that belongs to the operator. A local role limit triggers handoff within the existing budget.

## Git and evidence

Keep raw logs, traces, dumps and generated diagnostics in local evidence storage. Record compact results, exact revision, environment, hash or path and open limitations in project reports. Check the allowed paths before staging, the staged diff before committing, and the outgoing objects before pushing. Use the project’s gate if available. Where the project has no size policy, apply a default ceiling of 5 MiB per file and 20 MiB per outgoing batch. Larger files need an explicit, recorded exception before publication. Use an explicitly named working branch and verified remote. Keep the branch and PR operations within the approved mandate.

## After merge

Read the actual integrated revision. Compare its tree, base, inputs and required checks to the accepted final candidate. Reuse equivalent evidence, or run the necessary checks on the integrated subject. For required downstream work, follow the project’s adapter, for example design-library synchronization or device acceptance. Track it as a separate outcome with its own permissions and proof. A merged PR can still have external acceptance pending.

Before removing worktrees, sessions or evidence, record the outcome and verify that needed receipts and primary logs remain accessible. Preserve work in progress and unresolved evidence. Keep only scoped, durable references in the board and handover.
