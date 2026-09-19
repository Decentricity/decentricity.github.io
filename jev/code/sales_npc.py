#!/usr/bin/env python3
"""Fictional sales NPC: Jev interprets language; Python owns state and dialogue.

Python 3.10+, standard library only.
Run: TYPESAFE_API_KEY=<your-key> python3 sales_npc.py
No emails, CRM writes, contracts, or bookings are executed.
The API key is read from the environment and is never written to result files.
"""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from copy import deepcopy
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import statistics
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


MODEL = "jev-1.13.0"
YES = 0.85  # Demonstration thresholds, not validated production thresholds.
CHOICE_CONFIDENCE = 0.45
OFFERS = {
    "discovery": {
        "price_idr": 8_000_000, "duration": "2 weeks",
        "scope": "Process mapping and a synthetic-data prototype; no production access.",
    },
    "pilot": {
        "price_idr": 36_000_000, "duration": "6 weeks",
        "scope": "One workflow, up to 25 users, read-only Microsoft 365/SharePoint/CSV connectors.",
    },
    "rollout": {
        "price_idr": 240_000_000, "duration": "1 year",
        "scope": "Production expansion after a completed pilot and accepted results.",
    },
}
POLICIES = {
    "fictional": True,
    "product": "OpsPilot, an operations AI assistant for a fictional distributor",
    "offers": OFFERS,
    "hosting": "Managed cloud in Singapore or a customer-managed Jakarta VM after IT review; outbound model API connectivity is required in both modes.",
    "excluded": "No air-gapped/offline mode, no ERP write-back, no guaranteed savings or guaranteed regulatory acceptance.",
    "discount": "At most 10 percent, subject to sales-manager approval; the NPC cannot grant discounts itself.",
    "pilot_gate": "Economic-buyer approval, an adequate stated budget, IT approval, and procurement approval are required before preparing a pilot agreement.",
    "discovery_gate": "Economic-buyer approval and an adequate budget; synthetic-data discovery below IDR 10 million is exempt from IT and vendor-onboarding review in this fictional organization.",
    "rollout_gate": "All pilot gates plus a completed pilot with accepted results.",
    "contract_gate": "Verbal assent can prepare an agreement; it never means a signed sale or permission to deploy.",
    "approval_scope": "Approvals are package-specific; a scope change requires new approvals.",
}
CAST = {
    "Mira": {"role": "operations champion", "authority": "Can sponsor a trial; cannot approve spending, security, or procurement."},
    "Bima": {"role": "IT approver", "authority": "Can approve security for a specified package; cannot approve spending or procurement."},
    "Sari": {"role": "economic buyer", "authority": "Can approve budget and the purchase scope; cannot override IT or procurement."},
    "Raka": {"role": "procurement approver", "authority": "Can approve vendor onboarding and contract review; cannot approve security or spending."},
}


def noul(instructions):
    return {"type": "noul", "instructions": instructions}


QUESTIONS = {
    "topic": {
        "type": "choice",
        "instructions": "What is the main conversational purpose of `latest_message.text`, considering the preceding conversation? Select the most specific topic; agreements and approval updates take precedence over background mentions.",
        "criteria": {
            "discovery": "Describes operational pain, desired outcomes, or general interest.",
            "integration": "Asks how the product connects to existing software or fits the workflow.",
            "security": "Raises data location, access controls, privacy, or security review.",
            "pricing": "Asks about price or states an available budget or spending cap without approving a purchase.",
            "discount": "Requests a discount on the same scope, rather than asking for a smaller package.",
            "competition": "Compares another vendor, an incumbent, or an alternative offer.",
            "capacity": "Raises staff time, adoption, or change-management workload.",
            "approval": "Reports an approval or a withdrawal of approval by a decision maker.",
            "agreement": "Expresses willingness to proceed with a proposed package or asks to prepare an agreement, including conditional agreement.",
            "defer": "Asks to postpone or revisit at a later time.",
            "stop": "Ends the sales conversation or asks to stop contact.",
            "other": "Unclear, unrelated, or insufficient to identify a useful next sales topic.",
        },
    },
    "package": {
        "type": "choice",
        "instructions": "Which package is the customer currently requesting or explicitly considering in `latest_message.text`? Use the conversation to resolve references, but do not choose a package merely because it would be a good recommendation. Keep the current package when none is requested.",
        "criteria": {
            "discovery": "The two-week process-mapping/synthetic-data discovery sprint.",
            "pilot": "The six-week, one-workflow trial.",
            "rollout": "The annual production deployment or broad expansion.",
            "unchanged": "No explicit change to the currently discussed package.",
        },
    },
    "stop_contact": noul("Does `latest_message.text` explicitly end the sales discussion or request no further contact? A condition such as 'if data leaves Indonesia there is no deal' is an objection, not a present opt-out. A request to revisit next quarter is a deferral, not an opt-out."),
    "unconditional_yes": noul("Does `latest_message.text` give an unconditional current go-ahead to proceed with the discussed purchase package or to prepare its agreement? Routine approval updates alone, hypothetical willingness, and assent dependent on an unresolved 'if/once/provided' condition do not count."),
    "conditional_yes": noul("Does `latest_message.text` explicitly agree or express willingness to buy/proceed only if a condition is met? Merely stating a concern or a condition under which the customer would reject the product is not a conditional yes."),
    "bypass_controls": noul("Does `latest_message.text` ask to bypass, hide from, or disregard required IT/security or procurement controls? Explicitly refusing shortcuts is no. Asking to skip the product's trial stage alone is not an IT/procurement bypass."),
    "unsupported_guarantee": noul("Does `latest_message.text` ask the seller to guarantee a particular savings percentage or guaranteed regulatory acceptance? Asking for evidence or measurable trial success criteria is not a guarantee demand."),
    "unsupported_requirement": noul("Does `latest_message.text` require a product capability expressly excluded by `offer_policy.excluded`, such as air-gapped operation or ERP write-back? Evaluate technical capabilities only, not commercial or regulatory guarantees; asking whether a supported deployment is possible is no."),
    "security_approved": noul("Does `latest_message.text` explicitly state that IT/security has already approved the currently discussed package? Pending reviews, hypothetical future approvals, and conditional approvals with unmet conditions are no. Report the meaning; code separately checks speaker authority."),
    "procurement_approved": noul("Does `latest_message.text` explicitly state that procurement/vendor onboarding and contract review are already approved for the currently discussed package? Pending, hypothetical, or conditional approval is no; code separately checks speaker authority."),
    "budget_approved": noul("Does `latest_message.text` explicitly approve spending on the currently requested package, or give current purchase authorization as its budget owner? A budget cap, an allocation, willingness subject to conditions, and 'could approve' alone are not purchase authorization; code separately checks speaker authority."),
    "approval_withdrawn": noul("Does `latest_message.text` explicitly revoke a previously granted approval? Merely saying approval is still needed or was never granted is not revocation; code checks which approval the speaker can withdraw."),
    "commitment_strength": {
        "type": "score",
        "instructions": "How strongly does `latest_message.text` express willingness to take the next commercial step? Rate expressed willingness, not whether the seller's approval gates are satisfied.",
        "criteria": [
            "No positive commitment; inquiry, objection, rejection, or routine status update only.",
            "Interested in evaluating the offer, without agreeing to proceed.",
            "Willing to proceed if stated conditions are satisfied.",
            "Unconditionally asks to proceed with the discussed purchase step now.",
        ],
    },
    "objection_strength": {
        "type": "score",
        "instructions": "How strongly does `latest_message.text` object to the currently proposed purchase? Rate the expressed objection, not an inferred emotion or personality.",
        "criteria": [
            "No objection is expressed.",
            "Requests clarification or reassurance without stating a barrier.",
            "States a material barrier that could be resolved by changing scope, evidence, timing, or approvals.",
            "Rejects the proposed purchase as unacceptable or infeasible.",
        ],
    },
}


def step(speaker, text, expected, note=""):
    return {"speaker": speaker, "text": text, "expected_branch": expected, "author_note": note}


SCENARIOS = [
    {
        "id": "champion", "title": "The cautious champion",
        "hidden_setup": "The ops champion wants a win, but a previous vendor lost IT's trust; only the right people can remove each blocker.",
        "steps": [
            step("Mira", "Every Friday four analysts copy order data between spreadsheets. I need the weekly report before lunch, but I am not buying another dashboard just because it says AI.", "discover"),
            step("Mira", "We use Microsoft 365 and SharePoint. The ERP must stay exactly as it is. Can you read the exports without writing anything back?", "integration"),
            step("Bima", "The last vendor sent our records overseas. If any production data leaves Indonesia, there is no deal. Where would this six-week pilot actually run?", "security", "Conditional rejection must not become a contact opt-out."),
            step("Mira", "Sari has allocated IDR 40 million for a trial. If IT and procurement sign off, let's do the pilot. I cannot approve the purchase myself.", "hold_conditional", "Conditional intent plus a reported budget is not authorization."),
            step("Bima", "I am the IT approver. Our architecture review is complete: security approves the six-week pilot on our Jakarta VM, with read-only access and outbound model API traffic through our approved proxy.", "record_security"),
            step("Sari", "As budget owner, I approve spending up to IDR 40 million on this six-week pilot. That approval is for the pilot only, not an annual rollout.", "record_budget"),
            step("Raka", "Procurement has completed vendor onboarding and contract review. Both are approved for the six-week pilot.", "record_procurement"),
            step("Mira", "Great, let's do it. Please prepare the pilot agreement for Sari to sign.", "prepare_pilot_agreement", "The NPC prepares an agreement; it does not invent a signed contract."),
            step("Sari", "Actually, switch the proposal to the annual rollout now. I approve IDR 240 million for it; we can skip the pilot stage.", "require_pilot", "A scope change must not reuse pilot approvals or invent accepted pilot results."),
        ],
    },
    {
        "id": "price", "title": "Price is a disguise",
        "hidden_setup": "The economic buyer starts with price pressure; the actual constraint is staff capacity. A smaller paid discovery is a viable outcome.",
        "steps": [
            step("Sari", "Another vendor quoted half your pilot price. Why should I pay more for your six-week trial?", "compare"),
            step("Sari", "Keep the full six-week pilot scope, but give us a 40 percent discount.", "discount_limit", "The model must not negotiate outside the fictional price policy."),
            step("Sari", "My actual spending cap is IDR 20 million. That is all we have available this quarter.", "budget_mismatch"),
            step("Mira", "The bigger problem is people. Nobody can spare time for a rollout, and our analysts are scared this will create extra work. Can we start with process mapping and fake data?", "capacity"),
            step("Sari", "Yes, buy the two-week discovery sprint for IDR 8 million. I approve that spend from my IDR 20 million budget. Prepare its agreement; no production access.", "prepare_discovery_agreement"),
        ],
    },
    {
        "id": "shortcut", "title": "The procurement shortcut",
        "hidden_setup": "The buyer has money but lacks controls; the seller should preserve the process, accept deferral, and honor a later opt-out.",
        "steps": [
            step("Sari", "I approve up to IDR 40 million and want the six-week pilot now. IT and procurement have not reviewed it yet.", "hold_pending"),
            step("Mira", "Just upload our customer list and start tomorrow. Keep this away from IT and skip the vendor paperwork until after we prove it works.", "decline_bypass"),
            step("Sari", "No shortcuts, agreed. We cannot free the team for eight weeks. Let's revisit next quarter.", "defer"),
            step("Sari", "Actually, stop contacting us and remove us from the sales follow-up list. The product sounds interesting, but we are done.", "stop", "Positive language must not override the explicit opt-out."),
        ],
    },
    {
        "id": "guarantee", "title": "The impossible requirement",
        "hidden_setup": "The prospect asks for promises and a deployment mode the fictional product cannot provide; a good outcome may be an honest no-fit.",
        "steps": [
            step("Sari", "I will sign if you guarantee a 50 percent reduction in operating costs and guarantee that every regulator will accept the system.", "refuse_guarantee"),
            step("Bima", "Then here is the technical requirement: completely air-gapped operation, with no outbound API calls ever. It must work offline. That is mandatory.", "unsupported_requirement"),
            step("Sari", "Then it is not a fit for us. Please end this discussion and do not follow up.", "stop"),
        ],
    },
    {
        "id": "same_words_blocked", "title": "Same words: approvals missing",
        "hidden_setup": "Matched context test: the buyer's exact words also appear in the next case, but the recorded approvals differ.",
        "initial": {"budget_idr": 40_000_000, "budget_approved": True},
        "steps": [step("Mira", "Great, let's do it.", "hold_pending")],
    },
    {
        "id": "same_words_ready", "title": "Same words: approvals complete",
        "hidden_setup": "Matched context test: all approvals are already recorded in the fictional CRM. No signed contract is present.",
        "initial": {"budget_idr": 40_000_000, "budget_approved": True, "security_approved": True, "procurement_approved": True},
        "steps": [step("Mira", "Great, let's do it.", "prepare_pilot_agreement")],
    },
    {
        "id": "with_offer_blocked", "title": "Offer included: approvals missing",
        "hidden_setup": "Follow-up probe added after the initial short-utterance cases asked for clarification: an actual preceding offer now supplies the referent of 'it'. Approval gates remain incomplete.",
        "initial": {"budget_idr": 40_000_000, "budget_approved": True},
        "initial_history": [{"speaker": "Raya, sales NPC", "text": "We are discussing the six-week OpsPilot pilot for IDR 36 million. Would you like us to proceed with that pilot package and prepare its agreement for signature?"}],
        "steps": [step("Mira", "Great, let's do it.", "hold_pending")],
    },
    {
        "id": "with_offer_ready", "title": "Offer included: approvals complete",
        "hidden_setup": "Follow-up probe added after the initial short-utterance cases asked for clarification: the exact same preceding offer and buyer words as the missing-approvals case, with all approvals recorded instead.",
        "initial": {"budget_idr": 40_000_000, "budget_approved": True, "security_approved": True, "procurement_approved": True},
        "initial_history": [{"speaker": "Raya, sales NPC", "text": "We are discussing the six-week OpsPilot pilot for IDR 36 million. Would you like us to proceed with that pilot package and prepare its agreement for signature?"}],
        "steps": [step("Mira", "Great, let's do it.", "prepare_pilot_agreement")],
    },
]


def initial_state(scenario):
    initial = {
        "package": "pilot", "stage": "discovery", "budget_idr": None,
        "budget_approved": False, "security_approved": False,
        "procurement_approved": False, "pilot_completed_and_accepted": False,
        "contract_signed": False, "contact_allowed": True, "last_branch": None,
        "approval_evidence": {},
    }
    initial.update(scenario.get("initial", {}))
    for approval in ("budget_approved", "security_approved", "procurement_approved"):
        if initial[approval]:
            initial["approval_evidence"][approval] = {"source": "Fictional CRM setup", "scope": initial["package"]}
    return initial


def amounts(text):
    """Find exact candidate IDR amounts in code; Jev chooses their semantic role."""
    found = []
    pattern = r"(?:IDR|Rp)\s*([\d,.]+)\s*(million|miliar|billion|juta)?"
    for match in re.finditer(pattern, text, re.I):
        multiplier = {"million": 1_000_000, "juta": 1_000_000, "billion": 1_000_000_000, "miliar": 1_000_000_000}.get((match.group(2) or "").lower(), 1)
        number = match.group(1).replace(",", "")
        found.append({"id": f"amount_{len(found)}", "source_text": match.group(0), "value_idr": int(float(number) * multiplier)})
    return found


def build_request(known, history, utterance):
    candidates = amounts(utterance["text"])
    questions = deepcopy(QUESTIONS)
    if candidates:
        questions["budget_amount"] = {
            "type": "choice",
            "instructions": "Which entry in `amount_candidates` is the buyer's explicitly available spending limit or approved budget in `latest_message.text`? Exclude a seller price, competitor quote, requested discount price, and a hypothetical future budget. Select none if no candidate qualifies.",
            "criteria": {**{x["id"]: x["source_text"] for x in candidates}, "none": "No explicit available or approved buyer budget is stated."},
        }
    return {
        "model": MODEL,
        "state": {
            "offer_policy": POLICIES,
            "speaker": {"name": utterance["speaker"], **CAST[utterance["speaker"]]},
            "known_deal_state": known,
            # Snapshot the request: later turns must not mutate saved evidence.
            "conversation": deepcopy(history),
            "latest_message": {"speaker": utterance["speaker"], "text": utterance["text"]},
            "amount_candidates": candidates,
        },
        "questions": questions,
    }


def call_jev(payload, api_key):
    started = time.perf_counter()
    for attempt in range(3):
        request = Request(
            "https://api.typesafe.ai/v1/systemone",
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json", "Authorization": "Bearer " + api_key},
            method="POST",
        )
        try:
            with urlopen(request, timeout=45) as response:
                data = json.load(response)
            return data, round(time.perf_counter() - started, 3), attempt + 1
        except HTTPError as error:
            message = error.read().decode(errors="replace").replace(api_key, "[REDACTED]")
            if error.code in (429, 529) and attempt < 2:
                time.sleep(2 ** attempt)
                continue
            raise RuntimeError(f"HTTP {error.code}: {message}") from None
        except (URLError, TimeoutError) as error:
            raise RuntimeError(str(error).replace(api_key, "[REDACTED]")) from None
    raise RuntimeError("No API result")


def money(value):
    return "unknown" if value is None else f"IDR {value / 1_000_000:g} million"


def missing_gates(known):
    missing = []
    if not known["budget_approved"]:
        missing.append("economic-buyer authorization")
    if known["budget_idr"] is None:
        missing.append("an explicit available budget")
    elif known["budget_idr"] < OFFERS[known["package"]]["price_idr"]:
        missing.append("budget covering the package price")
    if known["package"] != "discovery":
        if not known["security_approved"]:
            missing.append("IT/security approval")
        if not known["procurement_approved"]:
            missing.append("procurement approval")
    if known["package"] == "rollout" and not known["pilot_completed_and_accepted"]:
        missing.append("a completed pilot with accepted results")
    return missing


def route(known, utterance, response, request, turn_number):
    """No test labels or future dialogue are visible here or to Jev."""
    known = deepcopy(known)
    answers = response["answers"]
    events = []
    p = lambda key: answers[key]["noul"]
    choice = lambda key: answers[key]["choice"]
    role = CAST[utterance["speaker"]]["role"]

    def finish(branch, reply, stage=None):
        known["last_branch"] = branch
        if stage:
            known["stage"] = stage
        return known, branch, reply, events

    if p("stop_contact") >= YES:
        known["contact_allowed"] = False
        return finish("stop", "Understood. I will close this sales conversation and mark no further sales contact in this simulation.", "closed_no_contact")
    if p("bypass_controls") >= YES:
        return finish("decline_bypass", "We cannot start with live customer data or bypass IT and procurement. We can discuss a synthetic-data discovery sprint while the proper reviews run.", "blocked_controls")
    if p("unsupported_guarantee") >= YES:
        return finish("refuse_guarantee", "I cannot guarantee a 50 percent saving or regulatory acceptance. We can define a baseline, measure trial results, and let your own reviewers decide whether those results justify proceeding.", "qualification")
    if p("unsupported_requirement") >= YES:
        return finish("unsupported_requirement", "That requirement is outside our supported product: both deployments require outbound model API access, and we do not provide air-gapped operation or ERP write-back. I cannot quote a solution that meets it.", "not_a_fit")

    requested = choice("package")
    if requested != "unchanged" and requested != known["package"] and answers["package"]["confidence"] >= CHOICE_CONFIDENCE:
        old = known["package"]
        known["package"] = requested
        for key in ("budget_approved", "security_approved", "procurement_approved"):
            known[key] = False
        known["approval_evidence"] = {}
        events.append(f"Scope changed {old} -> {requested}; package approvals cleared")

    selected_budget = choice("budget_amount") if "budget_amount" in answers else "none"
    if selected_budget != "none" and answers["budget_amount"]["confidence"] >= CHOICE_CONFIDENCE:
        item = next(x for x in request["state"]["amount_candidates"] if x["id"] == selected_budget)
        known["budget_idr"] = item["value_idr"]
        events.append(f"Buyer-stated budget: {money(known['budget_idr'])}; source {utterance['speaker']}, turn {turn_number}")

    authority = {"IT approver": "security_approved", "procurement approver": "procurement_approved", "economic buyer": "budget_approved"}.get(role)
    if authority and p("approval_withdrawn") >= YES:
        known[authority] = False
        known["approval_evidence"].pop(authority, None)
        events.append(f"{authority} revoked by {utterance['speaker']}")
        return finish("approval_revoked", "I have removed that approval from the current package. The agreement cannot advance until the relevant review is completed again.", "qualification")

    new_approval = None
    if authority and p(authority) >= YES:
        known[authority] = True
        known["approval_evidence"][authority] = {"speaker": utterance["speaker"], "turn": turn_number, "scope": known["package"], "source_text": utterance["text"]}
        new_approval = authority
        events.append(f"{authority} recorded for {known['package']} from authorized simulated speaker")

    gates = missing_gates(known)
    if known["package"] == "rollout" and not known["pilot_completed_and_accepted"]:
        return finish("require_pilot", "An annual rollout needs a completed pilot with accepted results first. Your new budget approval does not remove that gate, and the old pilot's IT and procurement approvals do not carry over to this larger scope.", "pilot_required")
    if p("conditional_yes") >= YES:
        remaining = ", ".join(gates) if gates else "confirmation that your stated conditions have actually been satisfied"
        return finish("hold_conditional", f"I will treat that as conditional interest. Before an agreement can advance, we still need {remaining}. I will not mark it as a sale.", "conditional_interest")
    if p("unconditional_yes") >= YES:
        if gates:
            return finish("hold_pending", "I have your go-ahead, but I cannot advance the agreement yet. Still needed: " + ", ".join(gates) + ".", "pending_approvals")
        package = known["package"]
        return finish("prepare_" + package + "_agreement", f"The {package} has the required approvals and a stated budget covering {money(OFFERS[package]['price_idr'])}. I can prepare its agreement for signature. This is not a signed sale and does not authorize deployment.", "agreement_ready")

    if new_approval:
        labels = {"security_approved": ("record_security", "IT/security"), "procurement_approved": ("record_procurement", "procurement"), "budget_approved": ("record_budget", "budget-owner")}
        branch, label = labels[new_approval]
        rest = ", ".join(gates) if gates else "the buyer's explicit go-ahead to prepare the agreement"
        return finish(branch, f"Recorded your {label} approval for the {known['package']}. The next requirement is {rest}.", "qualification")

    topic = choice("topic")
    if answers["topic"]["confidence"] < CHOICE_CONFIDENCE:
        return finish("clarify", "Which point should we settle first: technical fit, the available budget, or the approvals needed for a trial?", "clarification")
    if topic in ("pricing", "discount") and known["budget_idr"] is not None and known["budget_idr"] < OFFERS[known["package"]]["price_idr"]:
        return finish("budget_mismatch", f"Your stated budget is {money(known['budget_idr'])}; the {known['package']} is {money(OFFERS[known['package']]['price_idr'])}. We can discuss the IDR 8 million synthetic-data discovery sprint, or defer the larger scope.", "rescope")
    if topic == "discount":
        return finish("discount_limit", "A discount on the same scope cannot exceed 10 percent and still needs sales-manager approval. I cannot grant the requested concession; we can change the scope or submit an eligible request.", "negotiation")
    if topic == "security":
        return finish("security", "The managed-cloud option is in Singapore. A customer-managed Jakarta VM is also available after your architecture review, with outbound API connectivity still required. Let us confirm the exact data flow with IT before approving production-data access.", "security_review")
    if topic == "integration":
        return finish("integration", "The pilot supports read-only Microsoft 365, SharePoint, and CSV inputs. It will not replace or write back to the ERP. Which existing export would let us measure the Friday reporting workload?", "technical_fit")
    if topic == "competition":
        return finish("compare", "Let us compare the same scope: one workflow, six weeks, the deployment model, connectors, and the evidence needed to judge results. What does the competing quote include, and what result would justify the difference for you?", "comparison")
    if topic == "capacity":
        return finish("capacity", "A production rollout sounds premature if the team cannot support it. The two-week discovery sprint uses synthetic data to map one process and identify the minimum staff involvement; its findings can also justify stopping.", "rescope")
    if topic == "defer":
        return finish("defer", "We can pause the sales process and revisit when the team has capacity next quarter. I will not treat a deferred opportunity as an active purchase commitment.", "deferred")
    if topic == "pricing":
        return finish("pricing", "The discovery sprint is IDR 8 million; the six-week pilot is IDR 36 million; annual production rollout starts at IDR 240 million after accepted pilot results. Which scope and budget should we evaluate?", "qualification")
    if topic == "discovery":
        return finish("discover", "Let us start with Friday's reporting process: how many staff-hours does it take, which inputs create rework, and who would approve a small trial if the result is measurable?", "discovery")
    return finish("clarify", "I do not yet have a clear next step. Are you asking to change the scope, resolve an objection, or authorize an agreement?", "clarification")


def run_scenario(scenario, api_key):
    known = initial_state(scenario)
    history = deepcopy(scenario.get("initial_history", []))
    turns = []
    for number, utterance in enumerate(scenario["steps"], 1):
        before = deepcopy(known)
        request = build_request(before, history, utterance)
        response, elapsed, attempts = call_jev(request, api_key)
        known, branch, reply, events = route(known, utterance, response, request, number)
        checks = {
            "matches_predeclared_branch": branch == utterance["expected_branch"],
            "does_not_invent_signed_contract": known["contract_signed"] is False,
            "agreement_has_required_gates": not branch.startswith("prepare_") or not missing_gates(known),
            "opt_out_is_terminal": branch != "stop" or known["contact_allowed"] is False,
            "approval_evidence_matches_scope": all(x["scope"] == known["package"] for x in known["approval_evidence"].values()),
        }
        turns.append({
            "number": number, "buyer": {"name": utterance["speaker"], "role": CAST[utterance["speaker"]]["role"], "text": utterance["text"]},
            "seller_reply": reply, "branch": branch, "expected_branch": utterance["expected_branch"],
            "checks": checks, "author_note": utterance["author_note"], "events": events,
            "before": before, "after": deepcopy(known), "request": request,
            "response": response, "elapsed_seconds": elapsed, "attempts": attempts,
        })
        history.extend([{"speaker": utterance["speaker"], "text": utterance["text"]}, {"speaker": "Raya, sales NPC", "text": reply}])
        print(f"{scenario['id']} {number}/{len(scenario['steps'])}: {branch} | expected={utterance['expected_branch']} | {elapsed:.2f}s", flush=True)
        if not known["contact_allowed"]:
            break
    return {"id": scenario["id"], "title": scenario["title"], "hidden_setup": scenario["hidden_setup"], "turns": turns, "final_state": known}


def write_report(results, destination):
    summary = results["summary"]
    lines = [
        "# Sales NPC: a branching conversation controlled by Jev", "",
        "All businesses, people, offers, policies, buyer messages, and seller scripts are fictional and authored for this demonstration. Jev's answers below are actual API responses. Buyer paths were scripted; Jev interpreted each turn, and deterministic code selected the seller's response and updated deal state. No sale, message, CRM update, contract, or booking was executed.", "",
        f"Run: {results['run_at_utc']} · Model: {', '.join(summary['models'])}", "",
        f"{summary['turns']} live requests across {summary['conversations']} conversations; {summary['branch_matches']}/{summary['turns']} branches matched the expectations written before the run. These are authored demonstration cases, not a representative accuracy benchmark.", "",
        f"Median request latency: {summary['median_seconds']:.2f}s; range {summary['min_seconds']:.2f}–{summary['max_seconds']:.2f}s. Latency includes network and client overhead. Input tokens: {summary['input_tokens']:,}; output tokens: {summary['output_tokens']:,}.", "",
        "## The fictional offer", "",
        "| Package | Price | Scope |", "|---|---:|---|",
    ]
    for name, offer in OFFERS.items():
        lines.append(f"| {name.capitalize()} | {money(offer['price_idr'])} | {offer['duration']}: {offer['scope']} |")
    lines += ["", "## Who controls what", "",
        "Jev returns one batch of 14 judgments per turn: two Choices, ten Nouls, and two Scores. When code finds candidate monetary amounts, an additional Choice selects the buyer's budget. Code enforces budgets, roles, approval scope, and stage gates. No model answer can mark a contract signed.", "",
        "Question inventory: " + ", ".join(f"`{name}` ({definition['type']})" for name, definition in QUESTIONS.items()) + ", `budget_amount` (choice).", "",
        "Each call receives only offer policy, current state, prior dialogue, the current buyer message, and candidate amounts. Hidden scenario notes, expected branches, future dialogue, and test results are withheld from Jev. Approval facts are claims from authorized characters inside the simulation, not externally verified business facts.", "",
        "All thresholds are demonstration choices. The model's reported confidence is distribution concentration, not proof that a decision is correct. Production use would require labeled evaluation and calibration against the actual workflow.", "",
        "## Branch map", "",
        "Priority: opt-out → prohibited bypass/unsupported promises → package and budget updates → scoped approvals → rollout prerequisites → conditional or unconditional commitment → remaining sales topic → clarification.", "",
        "Agreement preparation requires all package gates. Package changes clear previous approvals. A conditional yes cannot produce an agreement-ready state. An opt-out ends the conversation. The Scores describe expressed commitment and objection; they do not bypass any gate.", "",
    ]
    if "initial_run_summary" in results:
        first = results["initial_run_summary"]
        followups = [s for s in results["conversations"] if s["id"].startswith("with_offer_")]
        lines += ["## What the follow-up checks found", "",
            f"The first run matched {first['branch_matches']}/{first['turns']} prewritten expectations. Two additional probes supplied an explicit preceding offer to the short 'Great, let's do it' message; the original results and thresholds were retained.", "",
            "Observed follow-up branches: " + "; ".join(f"{s['title']}: `{s['turns'][0]['branch']}`" for s in followups) + ".", "",
            "Adding the preceding offer did not resolve the short-assent ambiguity in this run. The model's main-topic Choice identified agreement, but its separate unconditional-go-ahead Noul remained below the controller's 0.85 threshold. The conservative controller therefore asked for clarification.", "",
            "Two other original deviations were a capacity concern classified as discovery (probabilities 0.43 versus 0.50), and a budget approval that received a Noul of 0.60, below the 0.85 threshold. These are concrete cases for improving question design and evaluating thresholds on independent examples; their expected labels were not changed after the run.", "",
        ]
    if results.get("recording_correction"):
        lines += ["## Recording correction", "", results["recording_correction"]["description"], ""]
    for scenario in results["conversations"]:
        lines += [f"## {scenario['title']}", "", f"Author-only setup: {scenario['hidden_setup']}", ""]
        for message in scenario["turns"][0]["request"]["state"]["conversation"]:
            lines += [f"**Opening context — {message['speaker']}:** {message['text']}", ""]
        for turn in scenario["turns"]:
            answers = turn["response"]["answers"]
            lines += [
                f"### Turn {turn['number']} — {turn['branch']}", "",
                f"**{turn['buyer']['name']} ({turn['buyer']['role']}):** {turn['buyer']['text']}", "",
                f"**Raya (sales NPC):** {turn['seller_reply']}", "",
                f"Jev: topic `{answers['topic']['choice']}` (confidence {answers['topic']['confidence']:.2f}); conditional yes {answers['conditional_yes']['noul']:.2f}; unconditional yes {answers['unconditional_yes']['noul']:.2f}; commitment {answers['commitment_strength']['score']:.2f}/3; objection {answers['objection_strength']['score']:.2f}/3.", "",
                f"Controller: `{turn['before']['stage']}` → `{turn['after']['stage']}`; package `{turn['after']['package']}`; stated budget {money(turn['after']['budget_idr'])}.", "",
                f"Expected branch: `{turn['expected_branch']}`; observed: `{turn['branch']}`; {'MATCH' if turn['checks']['matches_predeclared_branch'] else 'MISMATCH'}.", "",
            ]
            if turn["events"]:
                lines += ["State events: " + "; ".join(turn["events"]), ""]
        lines += [f"Final state: `{scenario['final_state']['stage']}`; contract signed: **false**.", ""]
    lines += ["## Sources", "", "- [TypeSafe API](https://docs.typesafe.ai/api)", "- [Speculative fan-out](https://docs.typesafe.ai/patterns/fan-out)", "- [Smart home dispatcher demo](https://docs.typesafe.ai/demos/smart-home)", "- [Models](https://docs.typesafe.ai/models)", "", "## Rerun", "", "Set `TYPESAFE_API_KEY` and run `python3 sales_npc.py`. The key is never included in saved results. Use `--scenario champion` for one conversation or `--workers 1` for sequential execution. The report and results are written beside the script by default."]
    destination.write_text("\n".join(lines) + "\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scenario", choices=[x["id"] for x in SCENARIOS])
    parser.add_argument("--workers", type=int, default=3)
    parser.add_argument("--output", type=Path, default=Path(__file__).parent)
    args = parser.parse_args()
    api_key = os.environ.get("TYPESAFE_API_KEY", "").strip()
    if not api_key:
        parser.error("Set TYPESAFE_API_KEY; no inference was performed")
    chosen = [x for x in SCENARIOS if not args.scenario or x["id"] == args.scenario]
    args.output.mkdir(parents=True, exist_ok=True)
    completed = {}
    started = time.perf_counter()
    with ThreadPoolExecutor(max_workers=max(1, min(args.workers, 4))) as pool:
        futures = {pool.submit(run_scenario, scenario, api_key): scenario["id"] for scenario in chosen}
        for future in as_completed(futures):
            completed[futures[future]] = future.result()
    conversations = [completed[x["id"]] for x in chosen]
    turns = [turn for scenario in conversations for turn in scenario["turns"]]
    latencies = [x["elapsed_seconds"] for x in turns]
    summary = {
        "conversations": len(conversations), "turns": len(turns),
        "branch_matches": sum(x["checks"]["matches_predeclared_branch"] for x in turns),
        "invariant_failures": [{"conversation": s["id"], "turn": t["number"], "check": key} for s in conversations for t in s["turns"] for key, value in t["checks"].items() if key != "matches_predeclared_branch" and not value],
        "models": sorted({x["response"]["model"] for x in turns}),
        "median_seconds": statistics.median(latencies), "min_seconds": min(latencies), "max_seconds": max(latencies),
        "wall_seconds": round(time.perf_counter() - started, 3),
        "input_tokens": sum(x["response"].get("usage", {}).get("input_tokens", 0) for x in turns),
        "output_tokens": sum(x["response"].get("usage", {}).get("output_tokens", 0) for x in turns),
    }
    results = {"run_at_utc": datetime.now(timezone.utc).isoformat(), "fictional_scenario": True, "live_inference": True, "summary": summary, "conversations": conversations}
    (args.output / "sales_npc_results.json").write_text(json.dumps(results, indent=2))
    write_report(results, args.output / "sales_npc_report.md")
    print(json.dumps(summary, indent=2), flush=True)


if __name__ == "__main__":
    main()
