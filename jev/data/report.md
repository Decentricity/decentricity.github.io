# Sales NPC: a branching conversation controlled by Jev

All businesses, people, offers, policies, buyer messages, and seller scripts are fictional and authored for this demonstration. Jev's answers below are actual API responses. Buyer paths were scripted; Jev interpreted each turn, and deterministic code selected the seller's response and updated deal state. No sale, message, CRM update, contract, or booking was executed.

Run: 2026-09-19T00:21:35.426150+00:00 · Model: jev-1.13.0

25 live requests across 8 conversations; 19/25 branches matched the expectations written before the run. These are authored demonstration cases, not a representative accuracy benchmark.

Median request latency: 8.21s; range 5.80–11.21s. Latency includes network and client overhead. Input tokens: 62,659; output tokens: 9,542.

## The fictional offer

| Package | Price | Scope |
|---|---:|---|
| Discovery | IDR 8 million | 2 weeks: Process mapping and a synthetic-data prototype; no production access. |
| Pilot | IDR 36 million | 6 weeks: One workflow, up to 25 users, read-only Microsoft 365/SharePoint/CSV connectors. |
| Rollout | IDR 240 million | 1 year: Production expansion after a completed pilot and accepted results. |

## Who controls what

Jev returns one batch of 14 judgments per turn: two Choices, ten Nouls, and two Scores. When code finds candidate monetary amounts, an additional Choice selects the buyer's budget. Code enforces budgets, roles, approval scope, and stage gates. No model answer can mark a contract signed.

Question inventory: `topic` (choice), `package` (choice), `stop_contact` (noul), `unconditional_yes` (noul), `conditional_yes` (noul), `bypass_controls` (noul), `unsupported_guarantee` (noul), `unsupported_requirement` (noul), `security_approved` (noul), `procurement_approved` (noul), `budget_approved` (noul), `approval_withdrawn` (noul), `commitment_strength` (score), `objection_strength` (score), `budget_amount` (choice).

Each call receives only offer policy, current state, prior dialogue, the current buyer message, and candidate amounts. Hidden scenario notes, expected branches, future dialogue, and test results are withheld from Jev. Approval facts are claims from authorized characters inside the simulation, not externally verified business facts.

All thresholds are demonstration choices. The model's reported confidence is distribution concentration, not proof that a decision is correct. Production use would require labeled evaluation and calibration against the actual workflow.

## Branch map

Priority: opt-out → prohibited bypass/unsupported promises → package and budget updates → scoped approvals → rollout prerequisites → conditional or unconditional commitment → remaining sales topic → clarification.

Agreement preparation requires all package gates. Package changes clear previous approvals. A conditional yes cannot produce an agreement-ready state. An opt-out ends the conversation. The Scores describe expressed commitment and objection; they do not bypass any gate.

## What the follow-up checks found

The first run matched 19/23 prewritten expectations. Two additional probes supplied an explicit preceding offer to the short 'Great, let's do it' message; the original results and thresholds were retained.

Observed follow-up branches: Offer included: approvals missing: `clarify`; Offer included: approvals complete: `clarify`.

Adding the preceding offer did not resolve the short-assent ambiguity in this run. The model's main-topic Choice identified agreement, but its separate unconditional-go-ahead Noul remained below the controller's 0.85 threshold. The conservative controller therefore asked for clarification.

Two other original deviations were a capacity concern classified as discovery (probabilities 0.43 versus 0.50), and a budget approval that received a Noul of 0.60, below the 0.85 threshold. These are concrete cases for improving question design and evaluating thresholds on independent examples; their expected labels were not changed after the run.

## Recording correction

The original logger retained a reference to an append-only history list, so saved request.conversation fields later contained the entire conversation. The synchronous HTTP request was serialized before each new turn was appended; future turns were not available at call time. In this file, those history fields are reconstructed from the initial context and preceding recorded turns, not independently captured wire payloads. All API responses, observed branches, prewritten labels, timings, and before/after states are unchanged. The original file is retained for audit. The published runner now deep-copies history when building each request.

## The cautious champion

Author-only setup: The ops champion wants a win, but a previous vendor lost IT's trust; only the right people can remove each blocker.

### Turn 1 — discover

**Mira (operations champion):** Every Friday four analysts copy order data between spreadsheets. I need the weekly report before lunch, but I am not buying another dashboard just because it says AI.

**Raya (sales NPC):** Let us start with Friday's reporting process: how many staff-hours does it take, which inputs create rework, and who would approve a small trial if the result is measurable?

Jev: topic `discovery` (confidence 0.99); conditional yes 0.14; unconditional yes 0.01; commitment 0.19/3; objection 1.91/3.

Controller: `discovery` → `discovery`; package `pilot`; stated budget unknown.

Expected branch: `discover`; observed: `discover`; MATCH.

### Turn 2 — integration

**Mira (operations champion):** We use Microsoft 365 and SharePoint. The ERP must stay exactly as it is. Can you read the exports without writing anything back?

**Raya (sales NPC):** The pilot supports read-only Microsoft 365, SharePoint, and CSV inputs. It will not replace or write back to the ERP. Which existing export would let us measure the Friday reporting workload?

Jev: topic `integration` (confidence 0.91); conditional yes 0.19; unconditional yes 0.03; commitment 1.34/3; objection 1.52/3.

Controller: `discovery` → `technical_fit`; package `pilot`; stated budget unknown.

Expected branch: `integration`; observed: `integration`; MATCH.

### Turn 3 — security

**Bima (IT approver):** The last vendor sent our records overseas. If any production data leaves Indonesia, there is no deal. Where would this six-week pilot actually run?

**Raya (sales NPC):** The managed-cloud option is in Singapore. A customer-managed Jakarta VM is also available after your architecture review, with outbound API connectivity still required. Let us confirm the exact data flow with IT before approving production-data access.

Jev: topic `security` (confidence 1.00); conditional yes 0.25; unconditional yes 0.02; commitment 1.06/3; objection 2.04/3.

Controller: `technical_fit` → `security_review`; package `pilot`; stated budget unknown.

Expected branch: `security`; observed: `security`; MATCH.

### Turn 4 — hold_conditional

**Mira (operations champion):** Sari has allocated IDR 40 million for a trial. If IT and procurement sign off, let's do the pilot. I cannot approve the purchase myself.

**Raya (sales NPC):** I will treat that as conditional interest. Before an agreement can advance, we still need economic-buyer authorization, IT/security approval, procurement approval. I will not mark it as a sale.

Jev: topic `agreement` (confidence 0.84); conditional yes 0.95; unconditional yes 0.03; commitment 2.00/3; objection 0.73/3.

Controller: `security_review` → `conditional_interest`; package `pilot`; stated budget IDR 40 million.

Expected branch: `hold_conditional`; observed: `hold_conditional`; MATCH.

State events: Buyer-stated budget: IDR 40 million; source Mira, turn 4

### Turn 5 — record_security

**Bima (IT approver):** I am the IT approver. Our architecture review is complete: security approves the six-week pilot on our Jakarta VM, with read-only access and outbound model API traffic through our approved proxy.

**Raya (sales NPC):** Recorded your IT/security approval for the pilot. The next requirement is economic-buyer authorization, procurement approval.

Jev: topic `approval` (confidence 0.99); conditional yes 0.18; unconditional yes 0.22; commitment 2.23/3; objection 0.15/3.

Controller: `conditional_interest` → `qualification`; package `pilot`; stated budget IDR 40 million.

Expected branch: `record_security`; observed: `record_security`; MATCH.

State events: security_approved recorded for pilot from authorized simulated speaker

### Turn 6 — record_budget

**Sari (economic buyer):** As budget owner, I approve spending up to IDR 40 million on this six-week pilot. That approval is for the pilot only, not an annual rollout.

**Raya (sales NPC):** Recorded your budget-owner approval for the pilot. The next requirement is procurement approval.

Jev: topic `approval` (confidence 1.00); conditional yes 0.20; unconditional yes 0.29; commitment 2.31/3; objection 0.24/3.

Controller: `qualification` → `qualification`; package `pilot`; stated budget IDR 40 million.

Expected branch: `record_budget`; observed: `record_budget`; MATCH.

State events: Buyer-stated budget: IDR 40 million; source Sari, turn 6; budget_approved recorded for pilot from authorized simulated speaker

### Turn 7 — record_procurement

**Raka (procurement approver):** Procurement has completed vendor onboarding and contract review. Both are approved for the six-week pilot.

**Raya (sales NPC):** Recorded your procurement approval for the pilot. The next requirement is the buyer's explicit go-ahead to prepare the agreement.

Jev: topic `approval` (confidence 1.00); conditional yes 0.07; unconditional yes 0.82; commitment 2.21/3; objection 0.00/3.

Controller: `qualification` → `qualification`; package `pilot`; stated budget IDR 40 million.

Expected branch: `record_procurement`; observed: `record_procurement`; MATCH.

State events: procurement_approved recorded for pilot from authorized simulated speaker

### Turn 8 — prepare_pilot_agreement

**Mira (operations champion):** Great, let's do it. Please prepare the pilot agreement for Sari to sign.

**Raya (sales NPC):** The pilot has the required approvals and a stated budget covering IDR 36 million. I can prepare its agreement for signature. This is not a signed sale and does not authorize deployment.

Jev: topic `agreement` (confidence 1.00); conditional yes 0.13; unconditional yes 0.87; commitment 2.96/3; objection 0.00/3.

Controller: `qualification` → `agreement_ready`; package `pilot`; stated budget IDR 40 million.

Expected branch: `prepare_pilot_agreement`; observed: `prepare_pilot_agreement`; MATCH.

### Turn 9 — require_pilot

**Sari (economic buyer):** Actually, switch the proposal to the annual rollout now. I approve IDR 240 million for it; we can skip the pilot stage.

**Raya (sales NPC):** An annual rollout needs a completed pilot with accepted results first. Your new budget approval does not remove that gate, and the old pilot's IT and procurement approvals do not carry over to this larger scope.

Jev: topic `approval` (confidence 0.70); conditional yes 0.11; unconditional yes 0.22; commitment 2.94/3; objection 1.78/3.

Controller: `agreement_ready` → `pilot_required`; package `rollout`; stated budget IDR 240 million.

Expected branch: `require_pilot`; observed: `require_pilot`; MATCH.

State events: Scope changed pilot -> rollout; package approvals cleared; Buyer-stated budget: IDR 240 million; source Sari, turn 9

Final state: `pilot_required`; contract signed: **false**.

## Price is a disguise

Author-only setup: The economic buyer starts with price pressure; the actual constraint is staff capacity. A smaller paid discovery is a viable outcome.

### Turn 1 — compare

**Sari (economic buyer):** Another vendor quoted half your pilot price. Why should I pay more for your six-week trial?

**Raya (sales NPC):** Let us compare the same scope: one workflow, six weeks, the deployment model, connectors, and the evidence needed to judge results. What does the competing quote include, and what result would justify the difference for you?

Jev: topic `competition` (confidence 0.99); conditional yes 0.06; unconditional yes 0.02; commitment 0.12/3; objection 1.90/3.

Controller: `discovery` → `comparison`; package `pilot`; stated budget unknown.

Expected branch: `compare`; observed: `compare`; MATCH.

### Turn 2 — discount_limit

**Sari (economic buyer):** Keep the full six-week pilot scope, but give us a 40 percent discount.

**Raya (sales NPC):** A discount on the same scope cannot exceed 10 percent and still needs sales-manager approval. I cannot grant the requested concession; we can change the scope or submit an eligible request.

Jev: topic `discount` (confidence 1.00); conditional yes 0.52; unconditional yes 0.03; commitment 1.92/3; objection 2.02/3.

Controller: `comparison` → `negotiation`; package `pilot`; stated budget unknown.

Expected branch: `discount_limit`; observed: `discount_limit`; MATCH.

### Turn 3 — budget_mismatch

**Sari (economic buyer):** My actual spending cap is IDR 20 million. That is all we have available this quarter.

**Raya (sales NPC):** Your stated budget is IDR 20 million; the pilot is IDR 36 million. We can discuss the IDR 8 million synthetic-data discovery sprint, or defer the larger scope.

Jev: topic `pricing` (confidence 1.00); conditional yes 0.16; unconditional yes 0.03; commitment 0.78/3; objection 2.10/3.

Controller: `negotiation` → `rescope`; package `pilot`; stated budget IDR 20 million.

Expected branch: `budget_mismatch`; observed: `budget_mismatch`; MATCH.

State events: Buyer-stated budget: IDR 20 million; source Sari, turn 3

### Turn 4 — discover

**Mira (operations champion):** The bigger problem is people. Nobody can spare time for a rollout, and our analysts are scared this will create extra work. Can we start with process mapping and fake data?

**Raya (sales NPC):** Let us start with Friday's reporting process: how many staff-hours does it take, which inputs create rework, and who would approve a small trial if the result is measurable?

Jev: topic `discovery` (confidence 0.46); conditional yes 0.37; unconditional yes 0.05; commitment 1.68/3; objection 2.01/3.

Controller: `rescope` → `discovery`; package `discovery`; stated budget IDR 20 million.

Expected branch: `capacity`; observed: `discover`; MISMATCH.

State events: Scope changed pilot -> discovery; package approvals cleared

### Turn 5 — prepare_discovery_agreement

**Sari (economic buyer):** Yes, buy the two-week discovery sprint for IDR 8 million. I approve that spend from my IDR 20 million budget. Prepare its agreement; no production access.

**Raya (sales NPC):** The discovery has the required approvals and a stated budget covering IDR 8 million. I can prepare its agreement for signature. This is not a signed sale and does not authorize deployment.

Jev: topic `agreement` (confidence 0.98); conditional yes 0.42; unconditional yes 0.91; commitment 2.97/3; objection 0.02/3.

Controller: `discovery` → `agreement_ready`; package `discovery`; stated budget IDR 20 million.

Expected branch: `prepare_discovery_agreement`; observed: `prepare_discovery_agreement`; MATCH.

State events: Buyer-stated budget: IDR 20 million; source Sari, turn 5; budget_approved recorded for discovery from authorized simulated speaker

Final state: `agreement_ready`; contract signed: **false**.

## The procurement shortcut

Author-only setup: The buyer has money but lacks controls; the seller should preserve the process, accept deferral, and honor a later opt-out.

### Turn 1 — clarify

**Sari (economic buyer):** I approve up to IDR 40 million and want the six-week pilot now. IT and procurement have not reviewed it yet.

**Raya (sales NPC):** I do not yet have a clear next step. Are you asking to change the scope, resolve an objection, or authorize an agreement?

Jev: topic `approval` (confidence 0.86); conditional yes 0.21; unconditional yes 0.18; commitment 2.70/3; objection 0.91/3.

Controller: `discovery` → `clarification`; package `pilot`; stated budget IDR 40 million.

Expected branch: `hold_pending`; observed: `clarify`; MISMATCH.

State events: Buyer-stated budget: IDR 40 million; source Sari, turn 1

### Turn 2 — decline_bypass

**Mira (operations champion):** Just upload our customer list and start tomorrow. Keep this away from IT and skip the vendor paperwork until after we prove it works.

**Raya (sales NPC):** We cannot start with live customer data or bypass IT and procurement. We can discuss a synthetic-data discovery sprint while the proper reviews run.

Jev: topic `agreement` (confidence 0.49); conditional yes 0.17; unconditional yes 0.21; commitment 2.84/3; objection 1.54/3.

Controller: `clarification` → `blocked_controls`; package `pilot`; stated budget IDR 40 million.

Expected branch: `decline_bypass`; observed: `decline_bypass`; MATCH.

### Turn 3 — defer

**Sari (economic buyer):** No shortcuts, agreed. We cannot free the team for eight weeks. Let's revisit next quarter.

**Raya (sales NPC):** We can pause the sales process and revisit when the team has capacity next quarter. I will not treat a deferred opportunity as an active purchase commitment.

Jev: topic `defer` (confidence 0.99); conditional yes 0.16; unconditional yes 0.02; commitment 0.06/3; objection 2.23/3.

Controller: `blocked_controls` → `deferred`; package `pilot`; stated budget IDR 40 million.

Expected branch: `defer`; observed: `defer`; MATCH.

### Turn 4 — stop

**Sari (economic buyer):** Actually, stop contacting us and remove us from the sales follow-up list. The product sounds interesting, but we are done.

**Raya (sales NPC):** Understood. I will close this sales conversation and mark no further sales contact in this simulation.

Jev: topic `stop` (confidence 1.00); conditional yes 0.03; unconditional yes 0.01; commitment 0.00/3; objection 2.98/3.

Controller: `deferred` → `closed_no_contact`; package `pilot`; stated budget IDR 40 million.

Expected branch: `stop`; observed: `stop`; MATCH.

Final state: `closed_no_contact`; contract signed: **false**.

## The impossible requirement

Author-only setup: The prospect asks for promises and a deployment mode the fictional product cannot provide; a good outcome may be an honest no-fit.

### Turn 1 — refuse_guarantee

**Sari (economic buyer):** I will sign if you guarantee a 50 percent reduction in operating costs and guarantee that every regulator will accept the system.

**Raya (sales NPC):** I cannot guarantee a 50 percent saving or regulatory acceptance. We can define a baseline, measure trial results, and let your own reviewers decide whether those results justify proceeding.

Jev: topic `agreement` (confidence 0.99); conditional yes 0.92; unconditional yes 0.02; commitment 1.91/3; objection 2.44/3.

Controller: `discovery` → `qualification`; package `pilot`; stated budget unknown.

Expected branch: `refuse_guarantee`; observed: `refuse_guarantee`; MATCH.

### Turn 2 — unsupported_requirement

**Bima (IT approver):** Then here is the technical requirement: completely air-gapped operation, with no outbound API calls ever. It must work offline. That is mandatory.

**Raya (sales NPC):** That requirement is outside our supported product: both deployments require outbound model API access, and we do not provide air-gapped operation or ERP write-back. I cannot quote a solution that meets it.

Jev: topic `security` (confidence 0.95); conditional yes 0.28; unconditional yes 0.01; commitment 0.72/3; objection 2.85/3.

Controller: `qualification` → `not_a_fit`; package `pilot`; stated budget unknown.

Expected branch: `unsupported_requirement`; observed: `unsupported_requirement`; MATCH.

### Turn 3 — stop

**Sari (economic buyer):** Then it is not a fit for us. Please end this discussion and do not follow up.

**Raya (sales NPC):** Understood. I will close this sales conversation and mark no further sales contact in this simulation.

Jev: topic `stop` (confidence 1.00); conditional yes 0.04; unconditional yes 0.01; commitment 0.00/3; objection 3.00/3.

Controller: `not_a_fit` → `closed_no_contact`; package `pilot`; stated budget unknown.

Expected branch: `stop`; observed: `stop`; MATCH.

Final state: `closed_no_contact`; contract signed: **false**.

## Same words: approvals missing

Author-only setup: Matched context test: the buyer's exact words also appear in the next case, but the recorded approvals differ.

### Turn 1 — clarify

**Mira (operations champion):** Great, let's do it.

**Raya (sales NPC):** I do not yet have a clear next step. Are you asking to change the scope, resolve an objection, or authorize an agreement?

Jev: topic `agreement` (confidence 0.87); conditional yes 0.04; unconditional yes 0.19; commitment 2.84/3; objection 0.00/3.

Controller: `discovery` → `clarification`; package `pilot`; stated budget IDR 40 million.

Expected branch: `hold_pending`; observed: `clarify`; MISMATCH.

Final state: `clarification`; contract signed: **false**.

## Same words: approvals complete

Author-only setup: Matched context test: all approvals are already recorded in the fictional CRM. No signed contract is present.

### Turn 1 — clarify

**Mira (operations champion):** Great, let's do it.

**Raya (sales NPC):** I do not yet have a clear next step. Are you asking to change the scope, resolve an objection, or authorize an agreement?

Jev: topic `agreement` (confidence 0.90); conditional yes 0.04; unconditional yes 0.24; commitment 2.88/3; objection 0.00/3.

Controller: `discovery` → `clarification`; package `pilot`; stated budget IDR 40 million.

Expected branch: `prepare_pilot_agreement`; observed: `clarify`; MISMATCH.

Final state: `clarification`; contract signed: **false**.

## Offer included: approvals missing

Author-only setup: Follow-up probe added after the initial short-utterance cases asked for clarification: an actual preceding offer now supplies the referent of 'it'. Approval gates remain incomplete.

**Opening context — Raya, sales NPC:** We are discussing the six-week OpsPilot pilot for IDR 36 million. Would you like us to proceed with that pilot package and prepare its agreement for signature?

### Turn 1 — clarify

**Mira (operations champion):** Great, let's do it.

**Raya (sales NPC):** I do not yet have a clear next step. Are you asking to change the scope, resolve an objection, or authorize an agreement?

Jev: topic `agreement` (confidence 1.00); conditional yes 0.04; unconditional yes 0.44; commitment 3.00/3; objection 0.00/3.

Controller: `discovery` → `clarification`; package `pilot`; stated budget IDR 40 million.

Expected branch: `hold_pending`; observed: `clarify`; MISMATCH.

Final state: `clarification`; contract signed: **false**.

## Offer included: approvals complete

Author-only setup: Follow-up probe added after the initial short-utterance cases asked for clarification: the exact same preceding offer and buyer words as the missing-approvals case, with all approvals recorded instead.

**Opening context — Raya, sales NPC:** We are discussing the six-week OpsPilot pilot for IDR 36 million. Would you like us to proceed with that pilot package and prepare its agreement for signature?

### Turn 1 — clarify

**Mira (operations champion):** Great, let's do it.

**Raya (sales NPC):** I do not yet have a clear next step. Are you asking to change the scope, resolve an objection, or authorize an agreement?

Jev: topic `agreement` (confidence 0.99); conditional yes 0.04; unconditional yes 0.61; commitment 3.00/3; objection 0.00/3.

Controller: `discovery` → `clarification`; package `pilot`; stated budget IDR 40 million.

Expected branch: `prepare_pilot_agreement`; observed: `clarify`; MISMATCH.

Final state: `clarification`; contract signed: **false**.

## Sources

- [TypeSafe API](https://docs.typesafe.ai/api)
- [Speculative fan-out](https://docs.typesafe.ai/patterns/fan-out)
- [Smart home dispatcher demo](https://docs.typesafe.ai/demos/smart-home)
- [Models](https://docs.typesafe.ai/models)

## Rerun

Set `TYPESAFE_API_KEY` and run `python3 sales_npc.py`. The key is never included in saved results. Use `--scenario champion` for one conversation or `--workers 1` for sequential execution. The report and results are written beside the script by default.
