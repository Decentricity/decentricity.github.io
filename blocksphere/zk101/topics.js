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
  { term: "Sigma protocol", def: "A 3-move challenge-response proof (commit, challenge, respond)." },
  { term: "Fiat-Shamir", def: "Transform that makes interactive proofs non-interactive using a hash." },
  { term: "cut-and-choose", def: "Verifier audits random commitments to force honesty." }
];

const TOPICS = [
  {
    id: "zk-vibe",
    title: "Zero-Knowledge Proofs (ZKPs)",
    subtitle: "The 1-sentence vibe.",
    overview:
      "Prove you know something or did something correctly without revealing the secret or underlying data.",
    points: [
      "Verifier learns only: the statement is true.",
      "Cheating becomes unlikely through challenges and repetition.",
    ],
    code: `import hashlib
import secrets


def commit(secret: bytes, nonce: bytes) -> str:
    return hashlib.sha256(nonce + secret).hexdigest()


def verify(commitment: str, secret: bytes, nonce: bytes) -> bool:
    return commitment == hashlib.sha256(nonce + secret).hexdigest()


def main():
    secret = b"i know the secret"
    nonce = secrets.token_bytes(16)

    c = commit(secret, nonce)
    print("Commitment (proof blob):", c)

    print("")
    print("Reveal secret + nonce to verify:")
    print("Valid?", verify(c, secret, nonce))

    print("")
    print("Takeaway:")
    print("- Prove knowledge without exposing the secret itself")


if __name__ == "__main__":
    main()
`,
  },
  {
    id: "cave",
    title: "The ZK Cave (Ali Baba)",
    subtitle: "Challenge-response and repetition.",
    overview:
      "Cave has two paths. The verifier challenges the prover to exit Left or Right.",
    points: [
      "If the prover knows the secret door, she always succeeds.",
      "If she is faking, she succeeds with 50% probability per round.",
      "Repeating rounds amplifies soundness (cheating probability drops as (1/2)^n).",
      "Concept mapping: Sigma protocol / Schnorr-family proofs.",
    ],
    code: `import random


def run_round(knows_secret: bool) -> bool:
    challenge = random.choice(["left", "right"])
    if knows_secret:
        return True
    entry = random.choice(["left", "right"])
    return entry == challenge


def cheat_probability(rounds: int) -> float:
    return 0.5 ** rounds


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
    print("Cheat probability after", rounds, "rounds:", cheat_probability(rounds))

    print("")
    print("Takeaway:")
    print("- Random challenges + repetition make cheating unlikely")


if __name__ == "__main__":
    main()
`,
  },
  {
    id: "waldo-mask",
    title: "Where's Waldo (Mask)",
    subtitle: "Show only Waldo.",
    overview:
      "Prover covers the page with a mask that reveals only Waldo.",
    points: [
      "Verifier sees Waldo clearly but learns nothing about the rest.",
      "Concept mapping: commitments + selective disclosure.",
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

    print("")
    print("Takeaway:")
    print("- Selective reveal proves knowledge without leaking the rest")


if __name__ == "__main__":
    main()
`,
  },
  {
    id: "waldo-rerand",
    title: "Waldo B1: Secret Re-randomization",
    subtitle: "Hide the coordinates.",
    overview:
      "Prover makes a secretly transformed copy of the page and reveals Waldo only there.",
    points: [
      "Verifier confirms Waldo but can’t map back to the original page.",
      "Concept mapping: blinding/randomization + commitments.",
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

    print("")
    print("Takeaway:")
    print("- Verifier confirms Waldo in transformed space")
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
      "Prover prepares multiple sealed setups; verifier opens one at random to audit honesty.",
    points: [
      "Random inspection forces the prover to commit before the challenge.",
      "Cheating probability drops quickly with more rounds.",
      "Concept mapping: cut-and-choose auditing.",
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

    print("")
    print("Takeaway:")
    print("- Random audits make cheating unlikely")


if __name__ == "__main__":
    main()
`,
  },
  {
    id: "wrap",
    title: "What These Analogies Are Teaching",
    subtitle: "Soundness, zero-knowledge, verifier randomness.",
    overview:
      "All the stories map to three core ZK properties and to real-world proof systems.",
    points: [
      "Soundness: fakers get caught with high probability.",
      "Zero-knowledge: verifier learns nothing beyond validity.",
      "Verifier randomness prevents adaptive cheating.",
      "Mapping examples: cave -> Sigma protocols/Schnorr, offline cave -> Fiat-Shamir, Waldo mask -> selective disclosure, secret shift -> blinding, cut-and-choose -> audit-based security.",
    ],
    code: `import math


def cheat_probability(rounds: int) -> float:
    return 0.5 ** rounds


def main():
    for rounds in [3, 5, 10]:
        p = cheat_probability(rounds)
        print(f"Rounds={rounds} -> cheat prob ~ {p:.6f}")

    print("")
    print("Checklist:")
    print("- Soundness: cheating is unlikely")
    print("- Zero-knowledge: no secret leakage")
    print("- Verifier randomness: prevents adaptive cheating")


if __name__ == "__main__":
    main()
`,
  },
];
