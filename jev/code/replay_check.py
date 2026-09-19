#!/usr/bin/env python3
"""Offline verification of the recorded results; no API call or credential required."""
from copy import deepcopy
import json
from pathlib import Path
import sys
import unittest

import sales_npc as npc

DATA = Path(__file__).resolve().parents[1] / "data" / "results.json"


class RecordingTests(unittest.TestCase):
    def test_request_history_is_a_snapshot(self):
        scenario = npc.SCENARIOS[0]
        history = []
        request = npc.build_request(npc.initial_state(scenario), history, scenario["steps"][0])
        history.append({"speaker": "future", "text": "This was not available yet."})
        self.assertEqual(request["state"]["conversation"], [])

    def test_replay_matches_every_recorded_controller_decision(self):
        results = json.loads(DATA.read_text())
        specs = {s["id"]: s for s in npc.SCENARIOS}
        count = 0
        for scenario in results["conversations"]:
            spec = specs[scenario["id"]]
            history = deepcopy(spec.get("initial_history", []))
            for turn in scenario["turns"]:
                with self.subTest(scenario=scenario["id"], turn=turn["number"]):
                    utterance = spec["steps"][turn["number"] - 1]
                    request = npc.build_request(deepcopy(turn["before"]), history, utterance)
                    self.assertEqual(request, turn["request"])
                    state, branch, reply, events = npc.route(
                        turn["before"], utterance, turn["response"], request, turn["number"]
                    )
                    self.assertEqual((state, branch, reply, events),
                                     (turn["after"], turn["branch"], turn["seller_reply"], turn["events"]))
                    self.assertFalse(state["contract_signed"])
                    if branch.startswith("prepare_"):
                        self.assertEqual(npc.missing_gates(state), [])
                    if branch == "stop":
                        self.assertFalse(state["contact_allowed"])
                    self.assertTrue(all(e["scope"] == state["package"] for e in state["approval_evidence"].values()))
                    history.extend([
                        {"speaker": turn["buyer"]["name"], "text": turn["buyer"]["text"]},
                        {"speaker": "Raya, sales NPC", "text": turn["seller_reply"]},
                    ])
                    count += 1
        self.assertEqual(count, 25)
        self.assertEqual(results["summary"]["branch_matches"], 19)
        self.assertEqual(results["summary"]["invariant_failures"], [])


def summary():
    data = json.loads(DATA.read_text())
    print("JEV / RECORDED SALES NPC EXPERIMENT")
    print("Offline replay audit -- no new inference")
    print("Model: " + ", ".join(data["summary"]["models"]))
    print()
    for scenario in data["conversations"]:
        matched = sum(t["checks"]["matches_predeclared_branch"] for t in scenario["turns"])
        print(f"{scenario['id']:<23} {matched}/{len(scenario['turns'])} expected branches")
    s = data["summary"]
    print(f"\nTOTAL: {s['branch_matches']}/{s['turns']} prewritten branch expectations")
    print(f"Invariant failures in recorded cases: {len(s['invariant_failures'])}")
    print(f"Recorded request latency: median {s['median_seconds']:.3f}s")
    print(f"Input / output tokens: {s['input_tokens']:,} / {s['output_tokens']:,}")
    print("\nThis is a small authored demo, not an accuracy benchmark.")


if __name__ == "__main__":
    if "--summary" in sys.argv:
        summary()
    else:
        unittest.main(verbosity=2)
