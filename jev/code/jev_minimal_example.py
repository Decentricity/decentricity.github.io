# Install: pip install typesafe-sdk
# Set TYPESAFE_API_KEY in your environment before running.

from typesafe_sdk import Noul, TypeSafeClient

with TypeSafeClient() as client:
    result = client.system_one(
        model="jev-latest",
        state="It arrived smashed. Can you reverse the charge?",
        questions={
            "refund": Noul(instructions="Is the customer asking for their money back?")
        },
    )

probability = result.nouls["refund"].noul  # A number from 0 to 1

if probability >= 0.8:  # Example threshold for this demo
    print("Route to refunds")
else:
    print("Review manually")
