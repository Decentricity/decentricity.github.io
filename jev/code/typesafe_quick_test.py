#!/usr/bin/env python3
"""Test three TypeSafe primitives in one request; Python standard library only.

Set TYPESAFE_API_KEY in the environment, then run:
    python3 typesafe_quick_test.py

API reference: https://docs.typesafe.ai/api
Without a key, the request is sent without authentication and may be rejected.
"""

import json
import os
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


# Synthetic input: no customer data is used.
STATE = {
    "message": (
        "I was charged twice for one month. Please refund the extra charge today. "
        "This is really frustrating."
    )
}

QUESTIONS = {
    "requests_refund": {
        "type": "noul",
        "instructions": "Does the customer in `message` ask for money to be refunded?",
    },
    "frustration": {
        "type": "score",
        "instructions": "How much frustration does the customer express in `message`?",
        "criteria": [
            "The customer states facts or asks for help without expressing annoyance.",
            "The customer expresses annoyance or dissatisfaction while remaining civil.",
            "The customer expresses intense anger through insults, abuse, or explicit rage.",
        ],
    },
    "department": {
        "type": "choice",
        "instructions": "Which department best matches the main request in `message`?",
        "criteria": {
            "billing": "Charges, invoices, payments, or monetary refunds.",
            "technical": "Software failures, login problems, or integrations.",
            "sales": "Buying a product, pricing inquiries, or upgrades.",
            "other": "The request is outside those categories or lacks enough context.",
        },
    },
}


def main():
    payload = {"model": "jev-latest", "state": STATE, "questions": QUESTIONS}
    api_key = os.environ.get("TYPESAFE_API_KEY", "").strip()
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    request = Request(
        "https://api.typesafe.ai/v1/systemone",
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    print(json.dumps({"request": payload}, indent=2), flush=True)
    started = time.perf_counter()
    try:
        with urlopen(request, timeout=20) as response:
            result = {
                "ok": True,
                "http_status": response.status,
                "response": json.load(response),
            }
    except HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        try:
            body = json.loads(body)
        except ValueError:
            pass
        result = {"ok": False, "http_status": error.code, "error": body}
    except (URLError, TimeoutError) as error:
        result = {"ok": False, "error": str(error)}
    result["api_key_configured"] = bool(api_key)
    result["elapsed_seconds"] = round(time.perf_counter() - started, 3)
    print(json.dumps(result, indent=2))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
