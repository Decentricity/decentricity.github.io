const GLOSSARY = [
  { term: "Zero-Knowledge", def: "A proof that convinces a verifier without revealing the secret witness." },
  { term: "ZK", def: "Zero-knowledge; proves a statement without revealing the secret witness." },
  { term: "prover", def: "The party who knows the secret and produces a proof." },
  { term: "verifier", def: "The party who checks the proof." },
  { term: "witness", def: "The secret input that makes a statement true." },
  { term: "statement", def: "The claim the prover wants to convince the verifier of." },
  { term: "soundness", def: "Cheaters are caught with high probability." },
  { term: "zero-knowledge", def: "Verifier learns nothing beyond validity." },
  { term: "challenge", def: "Verifier’s random question used to test honesty." },
  { term: "commitment", def: "A sealed value: binding and hiding." },
  { term: "cut-and-choose", def: "Verifier audits random commitments to force honesty." }
];

const TOPICS = [
  {
    id: "zk-vibe",
    title: "ZK in One Sentence",
    subtitle: "Prove you know it, without showing it.",
    overview:
      "A zero-knowledge proof convinces a verifier that a statement is true, without revealing the secret witness.",
    points: [
      "You reveal only validity, not the underlying data.",
      "In practice, ZK uses commitments, challenges, and math to make cheating unlikely.",
    ],
    code: `import hashlib
import secrets


def commit(secret: bytes, nonce: bytes) -> str:
    return hashlib.sha256(nonce + secret).hexdigest()


def verify(commitment: str, secret: bytes, nonce: bytes) -> bool:
    return commitment == hashlib.sha256(nonce + secret).hexdigest()


def main():
    secret = b"my hidden value"
    nonce = secrets.token_bytes(16)

    c = commit(secret, nonce)
    print("Commitment:", c)

    print("Verifier learns only the commitment.")
    print("Reveal secret + nonce to verify:")
    print("Valid?", verify(c, secret, nonce))

    print("\nTakeaway:")
    print("- Prove knowledge without revealing the secret itself")


if __name__ == "__main__":
    main()
`,
  },
  {
    id: "cave",
    title: "The ZK Cave",
    subtitle: "Challenge/response and repetition.",
    overview:
      "A prover claims she can open a magic door. The verifier challenges her to exit a chosen path.",
    points: [
      "If the prover knows the secret, she always succeeds.",
      "If she is faking, she succeeds with 50% probability per round.",
    ],
    code: `import random


def run_round(knows_secret: bool) -> bool:
    challenge = random.choice(["left", "right"])
    if knows_secret:
        return True
    entry = random.choice(["left", "right"])
    return entry == challenge


def simulate(rounds: int, knows_secret: bool) -> int:
    wins = 0
    for _ in range(rounds):
        if run_round(knows_secret):
            wins += 1
        else:
            break
    return wins


def main():
    rounds = 10
    honest = simulate(rounds, True)
    cheater = simulate(rounds, False)

    print("Rounds:", rounds)
    print("Honest prover wins:", honest, "rounds")
    print("Cheater wins:", cheater, "rounds")

    print("\nTakeaway:")
    print("- Challenge randomness makes cheating hard")


if __name__ == "__main__":
    main()
`,
  },
  {
    id: "repetition",
    title: "Repetition Lowers Cheating Odds",
    subtitle: "Cheat probability shrinks exponentially.",
    overview:
      "Repeat the cave game n times. A cheater succeeds with probability (1/2)^n.",
    points: [
      "Each round halves the cheating probability.",
      "A few rounds make cheating very unlikely.",
    ],
    code: `import math


def cheat_probability(rounds: int) -> float:
    return 0.5 ** rounds


def main():
    for rounds in [1, 2, 5, 10, 20]:
        p = cheat_probability(rounds)
        print(f"Rounds={rounds:2d}  cheat prob={p:.6f}")

    print("\nTakeaway:")
    print("- Repetition drives cheating probability toward zero")


if __name__ == "__main__":
    main()
`,
  },
  {
    id: "waldo-mask",
    title: "Where's Waldo (Mask)",
    subtitle: "Reveal only what is needed.",
    overview:
      "Prover reveals only a small window around Waldo, hiding the rest of the page.",
    points: [
      "Verifier sees Waldo clearly.",
      "Verifier learns nothing about the rest of the page.",
    ],
    code: `import random


def make_grid(w: int, h: int):
    return [["."] * w for _ in range(h)]


def place_waldo(grid):
    h = len(grid)
    w = len(grid[0])
    x = random.randint(0, w - 1)
    y = random.randint(0, h - 1)
    grid[y][x] = "W"
    return x, y


def reveal_window(grid, x, y, r=1):
    h = len(grid)
    w = len(grid[0])
    out = [["#"] * w for _ in range(h)]
    for yy in range(max(0, y - r), min(h, y + r + 1)):
        for xx in range(max(0, x - r), min(w, x + r + 1)):
            out[yy][xx] = grid[yy][xx]
    return out


def print_grid(grid):
    for row in grid:
        print(" ".join(row))


def main():
    grid = make_grid(8, 6)
    x, y = place_waldo(grid)

    print("Masked reveal (only a tiny window):")
    masked = reveal_window(grid, x, y, r=1)
    print_grid(masked)

    print("\nTakeaway:")
    print("- Selective reveal proves knowledge without showing everything")


if __name__ == "__main__":
    main()
`,
  },
  {
    id: "waldo-rerand",
    title: "Waldo B1: Secret Re-randomization",
    subtitle: "Hide coordinates with a secret transform.",
    overview:
      "Prover applies a secret rotation + shift to the page, then reveals Waldo in the transformed page.",
    points: [
      "Verifier can confirm Waldo, but cannot map back to original coordinates.",
      "The hidden transform preserves zero-knowledge.",
    ],
    code: `import random


def rotate_point(x, y, w, h, rot):
    if rot == 0:
        return x, y
    if rot == 1:
        return h - 1 - y, x
    if rot == 2:
        return w - 1 - x, h - 1 - y
    return y, w - 1 - x


def transform_point(x, y, w, h, rot, dx, dy):
    rx, ry = rotate_point(x, y, w, h, rot)
    return (rx + dx) % w, (ry + dy) % h


def main():
    w, h = 8, 6
    waldo = (2, 4)

    rot = random.choice([0, 1, 2, 3])
    dx = random.randint(0, w - 1)
    dy = random.randint(0, h - 1)

    tx, ty = transform_point(waldo[0], waldo[1], w, h, rot, dx, dy)

    print("Original waldo:", waldo)
    print("Secret transform: rot=", rot * 90, "deg, shift=", (dx, dy))
    print("Transformed waldo (what verifier sees):", (tx, ty))

    print("\nTakeaway:")
    print("- Verifier confirms Waldo in the transformed page")
    print("- Original coordinates stay hidden without the secret transform")


if __name__ == "__main__":
    main()
`,
  },
  {
    id: "cut-choose",
    title: "Waldo B2: Cut-and-Choose",
    subtitle: "Audit one, prove with another.",
    overview:
      "Prover prepares multiple sealed setups. Verifier opens a random one to check honesty.",
    points: [
      "Random inspection forces the prover to commit before the challenge.",
      "Cheating probability drops quickly with more rounds.",
    ],
    code: `import random


def cheating_probability(rounds: int) -> float:
    return 0.5 ** rounds


def simulate(rounds: int) -> bool:
    for _ in range(rounds):
        pick = random.choice([0, 1])
        cheating_setup = random.choice([0, 1])
        if pick == cheating_setup:
            return False
    return True


def main():
    rounds = 5
    p = cheating_probability(rounds)
    outcome = simulate(rounds)

    print("Rounds:", rounds)
    print("Theoretical cheat probability:", p)
    print("Simulated cheater success:", outcome)

    print("\nTakeaway:")
    print("- Random audits make cheating unlikely")


if __name__ == "__main__":
    main()
`,
  },
  {
    id: "wrap",
    title: "What the Analogies Teach",
    subtitle: "Soundness, zero-knowledge, and verifier randomness.",
    overview:
      "All the stories map to three key properties of a ZK proof: soundness, zero-knowledge, and randomness.",
    points: [
      "Soundness: cheaters get caught with high probability.",
      "Zero-knowledge: verifier learns nothing but validity.",
      "Random challenges stop adaptive cheating.",
    ],
    code: `import math


def cheat_probability(rounds: int) -> float:
    return 0.5 ** rounds


def main():
    for rounds in [3, 5, 10]:
        p = cheat_probability(rounds)
        print(f"Rounds={rounds} -> cheat prob ~ {p:.6f}")

    print("\nChecklist:")
    print("- Soundness: cheating is unlikely")
    print("- Zero-knowledge: no secret leakage")
    print("- Verifier randomness: prevents adaptive cheating")


if __name__ == "__main__":
    main()
`,
  },
];
