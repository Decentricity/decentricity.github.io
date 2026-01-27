const GLOSSARY = [
  { term: "CSPRNG", def: "Cryptographically secure pseudo-random number generator; unpredictable output suitable for keys and nonces." },
  { term: "PRNG", def: "Pseudo-random number generator; deterministic output that is not safe for secrets." },
  { term: "SHA-256", def: "A 256-bit cryptographic hash function used for integrity." },
  { term: "hash", def: "A fixed-size fingerprint of data produced by a hash function." },
  { term: "hashes", def: "Plural of hash; fingerprints used for integrity checks." },
  { term: "collision", def: "Two different inputs that produce the same hash output." },
  { term: "avalanche effect", def: "Small input changes cause large, unpredictable hash changes." },
  { term: "birthday bound", def: "Collision probability grows around 2^(n/2) for n-bit outputs." },
  { term: "MAC", def: "Message Authentication Code; proves integrity and authenticity using a secret key." },
  { term: "HMAC", def: "Hash-based MAC; standard MAC construction built from a hash function." },
  { term: "stream cipher", def: "Encrypts by XORing plaintext with a pseudorandom keystream." },
  { term: "keystream", def: "Pseudorandom bytes XORed with plaintext in a stream cipher." },
  { term: "nonce", def: "A number used once; must be unique per key to avoid confidentiality failures." },
  { term: "AEAD", def: "Authenticated Encryption with Associated Data; encryption that also authenticates data." },
  { term: "XOR", def: "Exclusive OR; bitwise operation used in stream ciphers and one-time pads." },
  { term: "plaintext", def: "The original readable message before encryption." },
  { term: "ciphertext", def: "The encrypted output of a plaintext." },
  { term: "symmetric encryption", def: "Encryption where both parties use the same secret key." },
  { term: "integrity", def: "Property that data has not been altered." },
  { term: "authentication", def: "Assurance that data came from the claimed sender." },
  { term: "key exchange", def: "Protocol to derive a shared secret over a public channel." },
  { term: "Diffie-Hellman", def: "Key exchange protocol that lets two parties derive a shared secret." },
  { term: "MITM", def: "Man-in-the-middle attack; attacker relays messages to impersonate parties." },
  { term: "KDF", def: "Key Derivation Function; turns a shared secret into a symmetric key." },
  { term: "RSA", def: "Public-key cryptosystem used for encryption and signatures." },
  { term: "padding", def: "A randomized encoding step required to make RSA secure in practice." },
  { term: "OAEP", def: "Optimal Asymmetric Encryption Padding; secure padding for RSA encryption." },
  { term: "PSS", def: "Probabilistic Signature Scheme; secure padding for RSA signatures." },
  { term: "modulus", def: "The RSA public value n = p * q; arithmetic happens mod n." },
  { term: "Merkle tree", def: "Hash tree that commits to many items with one root hash." },
  { term: "Zero-Knowledge", def: "A proof reveals that a statement is true without revealing the secret witness." },
  { term: "ZK", def: "Zero-knowledge; proves a statement without revealing the secret witness." },
  { term: "Schnorr", def: "A proof/signature scheme based on discrete logarithms." },
  { term: "Fiat-Shamir", def: "Transform that makes interactive proofs non-interactive using a hash." },
  { term: "NIZK", def: "Non-interactive zero-knowledge proof." },
  { term: "transcript", def: "The public messages of a proof protocol (commitment, challenge, response)." },
  { term: "witness", def: "The secret input that makes a statement true in a proof system." },
  { term: "generator", def: "A group element that can generate all elements of a subgroup." },
  { term: "safe prime", def: "A prime p where p = 2q + 1 and q is prime." },
  { term: "signature", def: "A cryptographic proof of authenticity made with a private key." },
  { term: "signatures", def: "Plural of signature; used to prove authenticity and integrity." },
  { term: "public key", def: "Key shared with others; used to verify or encrypt." },
  { term: "private key", def: "Secret key; used to sign or decrypt." }
];

const TOPICS = [
  {
    id: "setup",
    title: "Setup Check",
    subtitle: "Confirm Python basics and crypto primitives are available.",
    overview:
      "We start by confirming the environment: Python version, SHA-256, HMAC, and the CSPRNG.",
    points: [
      "We use only the standard library: hashlib, hmac, secrets.",
      "If this runs, your environment is good for the rest of the labs.",
    ],
    code: `import sys
import hashlib
import hmac
import secrets


def main():
    print("Python version:", sys.version.replace("\\n", " "))
    msg = b"hello crypto"
    print("SHA-256:", hashlib.sha256(msg).hexdigest())
    key = secrets.token_bytes(16)
    print("HMAC-SHA256:", hmac.new(key, msg, hashlib.sha256).hexdigest())
    print("secrets.randbits(32):", secrets.randbits(32))
    print("OK -- environment looks good")


if __name__ == "__main__":
    main()
`,
  },
  {
    id: "randomness",
    title: "Randomness",
    subtitle: "Predictability collapses security.",
    overview:
      "Keys and nonces must be unpredictable. This demo compares a predictable PRNG to a CSPRNG and shows how seeding repeats sequences.",
    points: [
      "random is fine for simulations, not secrets.",
      "If an attacker can guess your random, they can guess your keys.",
    ],
    code: `import random
import secrets


def count_lsb_ones(samples: int, source: str) -> float:
    ones = 0
    for _ in range(samples):
        if source == "prng":
            x = random.getrandbits(32)
        else:
            x = secrets.randbits(32)  # CSPRNG
        ones += (x & 1)
    return ones / samples


def main():
    samples = 100_000
    print("LSB (least significant bit) ones fraction (should be ~0.5):")
    print("  PRNG (pseudo-random):", count_lsb_ones(samples, "prng"))
    print("  CSPRNG (crypto-secure):", count_lsb_ones(samples, "csprng"))

    print("\\nCSPRNG bytes (secrets.token_bytes = crypto-secure random bytes):")
    cs1 = secrets.token_bytes(16)
    cs2 = secrets.token_bytes(16)
    print("  sample 1:", cs1.hex())
    print("  sample 2:", cs2.hex())
    print("  identical?", cs1 == cs2)

    print("\\nDemo: predictable PRNG state is deadly (seeded output repeats)")
    random.seed(1337)
    a = [random.getrandbits(32) for _ in range(5)]
    random.seed(1337)
    b = [random.getrandbits(32) for _ in range(5)]
    print("  sequence A:", a)
    print("  sequence B:", b)
    print("  identical?", a == b)

    print("\\nTakeaway:")
    print("- use secrets (CSPRNG) for keys/nonces")
    print("- random (PRNG) is fine for simulations, not secrets")


if __name__ == "__main__":
    main()
`,
  },
  {
    id: "hashes",
    title: "Hashes",
    subtitle: "Integrity fingerprints, not secrecy.",
    overview:
      "Hashes are deterministic fingerprints. We show the avalanche effect and how truncation makes collisions cheap.",
    points: [
      "Hash != encryption. It does not hide data.",
      "Collision difficulty drops fast when you truncate output bits.",
    ],
    code: `import hashlib
import secrets


def sha256(b: bytes) -> bytes:
    return hashlib.sha256(b).digest()


def hhex(b: bytes) -> str:
    return b.hex()


def demo_avalanche():
    a = b"pandu"
    b = b"pando"  # one byte different
    ha = sha256(a)
    hb = sha256(b)
    print("a:", a)
    print("b:", b)
    print("SHA(a):", hhex(ha))
    print("SHA(b):", hhex(hb))

    diff_bits = 0
    for x, y in zip(ha, hb):
        diff_bits += bin(x ^ y).count("1")
    print("Different bits (out of 256):", diff_bits)


def find_truncated_collision(bits: int = 16, max_tries: int = 2_000_000):
    seen = {}
    mask_bytes = (bits + 7) // 8
    shift = (mask_bytes * 8) - bits

    for i in range(1, max_tries + 1):
        msg = secrets.token_bytes(8)
        h = sha256(msg)[:mask_bytes]
        val = int.from_bytes(h, "big") >> shift
        if val in seen and seen[val] != msg:
            return i, seen[val], msg, val
        seen[val] = msg
    return None


def main():
    print("== Avalanche effect ==")
    demo_avalanche()

    print("\\n== Truncated collision demo ==")
    bits = 16
    res = find_truncated_collision(bits=bits)
    if not res:
        print("No collision found (unexpected at 16 bits). Try rerun.")
        return

    tries, m1, m2, v = res
    print(f"Found collision on first {bits} bits after {tries} tries")
    print("m1:", m1.hex())
    print("m2:", m2.hex())
    print("trunc value:", v)
    print("SHA(m1):", hashlib.sha256(m1).hexdigest())
    print("SHA(m2):", hashlib.sha256(m2).hexdigest())

    print("\\nTakeaway:")
    print("- Full SHA-256 collisions are infeasible today")
    print("- Truncation makes collisions easy (birthday bound)")


if __name__ == "__main__":
    main()
`,
  },
  {
    id: "hmac",
    title: "MAC / HMAC",
    subtitle: "Integrity plus authentication.",
    overview:
      "A plain hash is a public stamp. HMAC uses a secret key so only key holders can forge a valid tag.",
    points: [
      "Never invent your own MAC; use HMAC.",
      "Comparisons should be constant time when possible.",
    ],
    code: `import hashlib
import hmac
import secrets


def naive_mac(key: bytes, msg: bytes) -> bytes:
    return hashlib.sha256(key + msg).digest()


def hmac_sha256(key: bytes, msg: bytes) -> bytes:
    return hmac.new(key, msg, hashlib.sha256).digest()


def main():
    key = secrets.token_bytes(16)
    msg = b"pay=100&to=alice"

    nm = naive_mac(key, msg)
    hm = hmac_sha256(key, msg)

    print("Message:", msg)
    print("Naive MAC:", nm.hex())
    print("HMAC     :", hm.hex())

    print("\\nTamper demo:")
    msg2 = b"pay=1000000&to=alice"
    print("Tampered:", msg2)
    print("HMAC matches?", hmac.compare_digest(hmac_sha256(key, msg2), hm))

    print("\\nTakeaway:")
    print("- Use HMAC for message authentication")
    print("- Avoid inventing MAC schemes")


if __name__ == "__main__":
    main()
`,
  },
  {
    id: "stream",
    title: "Stream Cipher + Nonce Reuse",
    subtitle: "Confidentiality fails when a nonce repeats.",
    overview:
      "A stream cipher XORs plaintext with a keystream. If you reuse the same nonce, attackers learn relationships between messages.",
    points: [
      "Nonce reuse is catastrophic for stream ciphers and AEAD.",
      "XOR of ciphertexts leaks XOR of plaintexts.",
    ],
    code: `import hashlib
import hmac
import secrets


def prf(key: bytes, data: bytes) -> bytes:
    return hmac.new(key, data, hashlib.sha256).digest()


def keystream(key: bytes, nonce: bytes, length: int) -> bytes:
    out = b""
    counter = 0
    while len(out) < length:
        block = prf(key, nonce + counter.to_bytes(4, "big"))
        out += block
        counter += 1
    return out[:length]


def xor_bytes(a: bytes, b: bytes) -> bytes:
    return bytes(x ^ y for x, y in zip(a, b))


def encrypt(key: bytes, nonce: bytes, plaintext: bytes) -> bytes:
    ks = keystream(key, nonce, len(plaintext))
    return xor_bytes(plaintext, ks)


def decrypt(key: bytes, nonce: bytes, ciphertext: bytes) -> bytes:
    return encrypt(key, nonce, ciphertext)


def main():
    key = secrets.token_bytes(32)
    nonce = secrets.token_bytes(12)

    p1 = b"attack at dawn...."
    p2 = b"attack at dusk...."

    c1 = encrypt(key, nonce, p1)
    c2 = encrypt(key, nonce, p2)

    print("p1:", p1)
    print("p2:", p2)
    print("c1:", c1.hex())
    print("c2:", c2.hex())

    leak = xor_bytes(c1, c2)
    print("\\nNonce reuse leak (c1 XOR c2) == (p1 XOR p2):")
    print("leak:", leak)

    recovered_p2 = xor_bytes(leak, p1)
    print("Recovered p2 if attacker knows p1:", recovered_p2)

    print("\\nCorrect decryption:")
    print("dec(c1):", decrypt(key, nonce, c1))
    print("dec(c2):", decrypt(key, nonce, c2))

    print("\\nTakeaway:")
    print("- Never reuse a nonce with the same key for stream ciphers / AEAD")


if __name__ == "__main__":
    main()
`,
  },
  {
    id: "dh",
    title: "Diffie-Hellman",
    subtitle: "Shared secrets over a public channel.",
    overview:
      "Two parties can derive the same secret without revealing it. But DH alone does not authenticate identity.",
    points: [
      "A = g^a mod p, B = g^b mod p, shared = A^b = B^a.",
      "You still need authentication to avoid MITM.",
    ],
    code: `import secrets
import hashlib


def is_probable_prime(n: int, rounds: int = 12) -> bool:
    if n < 2:
        return False
    small_primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37]
    for p in small_primes:
        if n % p == 0:
            return n == p

    d = n - 1
    s = 0
    while d % 2 == 0:
        d //= 2
        s += 1

    for _ in range(rounds):
        a = secrets.randbelow(n - 3) + 2
        x = pow(a, d, n)
        if x in (1, n - 1):
            continue
        for __ in range(s - 1):
            x = pow(x, 2, n)
            if x == n - 1:
                break
        else:
            return False
    return True


def gen_safe_prime(bits: int = 128):
    while True:
        q = secrets.randbits(bits - 1) | 1 | (1 << (bits - 2))
        if not is_probable_prime(q):
            continue
        p = 2 * q + 1
        if is_probable_prime(p):
            return p, q


def find_generator(p: int, q: int) -> int:
    while True:
        h = secrets.randbelow(p - 3) + 2
        g = pow(h, 2, p)
        if g != 1 and pow(g, q, p) == 1:
            return g


def kdf(shared: int) -> bytes:
    return hashlib.sha256(shared.to_bytes((shared.bit_length() + 7) // 8, "big")).digest()


def main():
    print("Generating toy safe prime (128-bit) -- quick on phones")
    p, q = gen_safe_prime(128)
    g = find_generator(p, q)

    a = secrets.randbelow(q - 1) + 1
    b = secrets.randbelow(q - 1) + 1

    A = pow(g, a, p)
    B = pow(g, b, p)

    shared_alice = pow(B, a, p)
    shared_bob = pow(A, b, p)

    print("p:", p)
    print("g:", g)
    print("A:", A)
    print("B:", B)
    print("Shared equal?", shared_alice == shared_bob)

    key = kdf(shared_alice)
    print("Derived key (SHA-256 of shared):", key.hex())

    print("\\nTakeaway:")
    print("- Key exchange creates a shared secret over a public channel")
    print("- You still need authentication in real protocols")


if __name__ == "__main__":
    main()
`,
  },
  {
    id: "rsa",
    title: "Toy RSA",
    subtitle: "Public key roles: encrypt/verify vs decrypt/sign.",
    overview:
      "RSA demonstrates public/private key roles. This is a toy implementation: real RSA must use padding (OAEP/PSS).",
    points: [
      "Public key encrypts or verifies; private key decrypts or signs.",
      "Raw RSA is deterministic and unsafe without padding.",
    ],
    code: `import secrets
import hashlib


def egcd(a: int, b: int):
    if b == 0:
        return (a, 1, 0)
    g, x, y = egcd(b, a % b)
    return (g, y, x - (a // b) * y)


def modinv(a: int, n: int) -> int:
    g, x, _ = egcd(a, n)
    if g != 1:
        raise ValueError("no inverse")
    return x % n


def is_probable_prime(n: int, rounds: int = 12) -> bool:
    if n < 2:
        return False
    small_primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37]
    for p in small_primes:
        if n % p == 0:
            return n == p

    d = n - 1
    s = 0
    while d % 2 == 0:
        d //= 2
        s += 1

    for _ in range(rounds):
        a = secrets.randbelow(n - 3) + 2
        x = pow(a, d, n)
        if x in (1, n - 1):
            continue
        for __ in range(s - 1):
            x = pow(x, 2, n)
            if x == n - 1:
                break
        else:
            return False
    return True


def gen_prime(bits: int) -> int:
    while True:
        x = secrets.randbits(bits) | 1 | (1 << (bits - 1))
        if is_probable_prime(x):
            return x


def rsa_keygen(bits: int = 512):
    e = 65537
    while True:
        p = gen_prime(bits // 2)
        q = gen_prime(bits // 2)
        if p == q:
            continue
        n = p * q
        phi = (p - 1) * (q - 1)
        if phi % e != 0:
            d = modinv(e, phi)
            return (n, e, d)


def os2ip(b: bytes) -> int:
    return int.from_bytes(b, "big")


def i2osp(x: int) -> bytes:
    length = (x.bit_length() + 7) // 8
    return x.to_bytes(length, "big")


def rsa_encrypt(m: int, n: int, e: int) -> int:
    return pow(m, e, n)


def rsa_decrypt(c: int, n: int, d: int) -> int:
    return pow(c, d, n)


def main():
    print("Generating toy RSA key (512-bit) -- quick on laptops")
    n, e, d = rsa_keygen(512)

    msg = b"hello rsa"
    m = os2ip(msg)
    if m >= n:
        raise ValueError("message too large for modulus")

    c = rsa_encrypt(m, n, e)
    m2 = rsa_decrypt(c, n, d)

    print("msg:", msg)
    print("ciphertext int:", c)
    print("decrypted:", i2osp(m2))

    h = hashlib.sha256(msg).digest()
    mh = os2ip(h)
    sig = rsa_decrypt(mh, n, d)
    ver = rsa_encrypt(sig, n, e)

    print("\\nToy signature demo")
    print("hash:", h.hex())
    print("sig int:", sig)
    print("verify hash int matches?", ver == mh)

    print("\\nTakeaway:")
    print("- public key (n,e) encrypts / verifies")
    print("- private key (d) decrypts / signs")
    print("- raw RSA is unsafe; padding is mandatory in real life")


if __name__ == "__main__":
    main()
`,
  },
  {
    id: "merkle",
    title: "Merkle Trees",
    subtitle: "Commit to many items with one root.",
    overview:
      "Merkle trees let you prove inclusion without revealing the whole dataset.",
    points: [
      "Proof size grows like log2(n).",
      "Roots anchor blockchains, logs, and data availability.",
    ],
    code: `import hashlib
from dataclasses import dataclass
from typing import List


def h(b: bytes) -> bytes:
    return hashlib.sha256(b).digest()


def hash_leaf(data: bytes) -> bytes:
    return h(b"leaf:" + data)


def hash_node(left: bytes, right: bytes) -> bytes:
    return h(b"node:" + left + right)


@dataclass
class ProofItem:
    sibling: bytes
    is_left_sibling: bool


def merkle_root(leaves: List[bytes]) -> bytes:
    if not leaves:
        return h(b"")
    level = [hash_leaf(x) for x in leaves]
    while len(level) > 1:
        nxt = []
        for i in range(0, len(level), 2):
            left = level[i]
            right = level[i + 1] if i + 1 < len(level) else level[i]
            nxt.append(hash_node(left, right))
        level = nxt
    return level[0]


def merkle_proof(leaves: List[bytes], index: int):
    if index < 0 or index >= len(leaves):
        raise IndexError("bad leaf index")

    level = [hash_leaf(x) for x in leaves]
    proof = []
    idx = index

    while len(level) > 1:
        if idx % 2 == 0:
            sib_idx = idx + 1
            is_left = False
        else:
            sib_idx = idx - 1
            is_left = True

        sibling = level[sib_idx] if sib_idx < len(level) else level[idx]
        proof.append(ProofItem(sibling=sibling, is_left_sibling=is_left))

        nxt = []
        for i in range(0, len(level), 2):
            left = level[i]
            right = level[i + 1] if i + 1 < len(level) else level[i]
            nxt.append(hash_node(left, right))
        level = nxt
        idx //= 2

    return proof


def verify_proof(leaf: bytes, index: int, proof, root: bytes) -> bool:
    cur = hash_leaf(leaf)
    idx = index

    for item in proof:
        if item.is_left_sibling:
            cur = hash_node(item.sibling, cur)
        else:
            cur = hash_node(cur, item.sibling)
        idx //= 2

    return cur == root


def main():
    leaves = [
        b"tx:alice->bob:5",
        b"tx:bob->carol:2",
        b"tx:carol->dave:1",
        b"tx:dave->erin:3",
        b"tx:erin->frank:4",
    ]

    root = merkle_root(leaves)
    print("Merkle root:", root.hex())

    idx = 3
    proof = merkle_proof(leaves, idx)
    ok = verify_proof(leaves[idx], idx, proof, root)

    print("\\nProof for leaf index", idx)
    for i, p in enumerate(proof):
        side = "L" if p.is_left_sibling else "R"
        print(f"  step {i}: sibling side={side} hash={p.sibling.hex()}")

    print("\\nVerify:", ok)

    print("\\nTakeaway:")
    print("- Merkle root commits to a whole set")
    print("- proof size grows like log2(n)")


if __name__ == "__main__":
    main()
`,
  },
  {
    id: "zk",
    title: "Zero-Knowledge (Schnorr)",
    subtitle: "Prove knowledge without revealing the secret.",
    overview:
      "This demo shows a Schnorr proof, the Fiat-Shamir transform, and transcript simulation to build ZK intuition.",
    points: [
      "Verifier learns that you know x, not x itself.",
      "Fiat-Shamir makes the proof non-interactive.",
      "Want the full ZK walkthrough? Open the ZK101 deep dive.",
    ],
    code: `print("Click here for the ZK deep dive: https://decentricity.github.io/blocksphere/zk101/")
print("\nThen return here for the Schnorr demo.")

# --- Schnorr demo below (unchanged) ---
import secrets
import hashlib
from dataclasses import dataclass


def is_probable_prime(n: int, rounds: int = 12) -> bool:
    if n < 2:
        return False
    small_primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37]
    for p in small_primes:
        if n % p == 0:
            return n == p

    d = n - 1
    s = 0
    while d % 2 == 0:
        d //= 2
        s += 1

    for _ in range(rounds):
        a = secrets.randbelow(n - 3) + 2
        x = pow(a, d, n)
        if x in (1, n - 1):
            continue
        for __ in range(s - 1):
            x = pow(x, 2, n)
            if x == n - 1:
                break
        else:
            return False
    return True


def gen_safe_prime(bits: int = 128):
    while True:
        q = secrets.randbits(bits - 1) | 1 | (1 << (bits - 2))
        if not is_probable_prime(q):
            continue
        p = 2 * q + 1
        if is_probable_prime(p):
            return p, q


def find_generator_of_order_q(p: int, q: int) -> int:
    while True:
        h = secrets.randbelow(p - 3) + 2
        g = pow(h, 2, p)
        if g != 1 and pow(g, q, p) == 1:
            return g


def H_to_int(*parts: bytes, q: int) -> int:
    h = hashlib.sha256(b"".join(parts)).digest()
    return int.from_bytes(h, "big") % q


@dataclass
class PublicParams:
    p: int
    q: int
    g: int


@dataclass
class Keypair:
    x: int
    y: int


@dataclass
class Transcript:
    t: int
    c: int
    s: int


def keygen(params: PublicParams) -> Keypair:
    x = secrets.randbelow(params.q - 1) + 1
    y = pow(params.g, x, params.p)
    return Keypair(x=x, y=y)


def prove_interactive(params: PublicParams, kp: Keypair):
    r = secrets.randbelow(params.q - 1) + 1
    t = pow(params.g, r, params.p)
    c = secrets.randbelow(params.q)
    s = (r + c * kp.x) % params.q
    return Transcript(t=t, c=c, s=s)


def verify(params: PublicParams, y: int, tr: Transcript) -> bool:
    left = pow(params.g, tr.s, params.p)
    right = (tr.t * pow(y, tr.c, params.p)) % params.p
    return left == right


def prove_fiat_shamir(params: PublicParams, kp: Keypair, context: bytes = b"") -> Transcript:
    r = secrets.randbelow(params.q - 1) + 1
    t = pow(params.g, r, params.p)

    c = H_to_int(
        context,
        params.g.to_bytes((params.g.bit_length() + 7) // 8, "big"),
        kp.y.to_bytes((kp.y.bit_length() + 7) // 8, "big"),
        t.to_bytes((t.bit_length() + 7) // 8, "big"),
        q=params.q,
    )

    s = (r + c * kp.x) % params.q
    return Transcript(t=t, c=c, s=s)


def verify_fiat_shamir(params: PublicParams, y: int, tr: Transcript, context: bytes = b"") -> bool:
    c_check = H_to_int(
        context,
        params.g.to_bytes((params.g.bit_length() + 7) // 8, "big"),
        y.to_bytes((y.bit_length() + 7) // 8, "big"),
        tr.t.to_bytes((tr.t.bit_length() + 7) // 8, "big"),
        q=params.q,
    )
    if c_check != tr.c:
        return False
    return verify(params, y, tr)


def simulate_transcript(params: PublicParams, y: int):
    c = secrets.randbelow(params.q)
    s = secrets.randbelow(params.q)

    gs = pow(params.g, s, params.p)
    yc = pow(y, c, params.p)
    inv_yc = pow(yc, params.p - 2, params.p)
    t = (gs * inv_yc) % params.p

    return Transcript(t=t, c=c, s=s)


def main():
    print("Generating toy ZK group (safe prime 128-bit)")
    p, q = gen_safe_prime(128)
    g = find_generator_of_order_q(p, q)
    params = PublicParams(p=p, q=q, g=g)

    kp = keygen(params)
    print("Public y = g^x mod p:", kp.y)

    print("\\n== Interactive Schnorr proof ==")
    tr = prove_interactive(params, kp)
    print("Transcript:", tr)
    print("Verify:", verify(params, kp.y, tr))

    print("\\n== Fiat-Shamir (NIZK-ish) ==")
    ctx = b"demo-session"
    tr2 = prove_fiat_shamir(params, kp, context=ctx)
    print("Transcript:", tr2)
    print("Verify FS:", verify_fiat_shamir(params, kp.y, tr2, context=ctx))

    print("\\n== ZK intuition: simulated transcript (no secret) ==")
    tr_sim = simulate_transcript(params, kp.y)
    print("Simulated:", tr_sim)
    print("Verify simulated:", verify(params, kp.y, tr_sim))

    print("\\nTakeaway:")
    print("- Proof convinces verifier you know x without revealing x")
    print("- Transcript can be simulated: that's the ZK vibe")


if __name__ == "__main__":
    main()
`,
  },
  {
    id: "wrap",
    title: "Wrap Up",
    subtitle: "How primitives compose into systems.",
    overview:
      "Secure systems combine randomness, hashing, authentication, encryption, key exchange, and signatures. Weakness in one layer breaks the whole stack.",
    points: [
      "TLS stacks DH + authentication + symmetric encryption + MACs.",
      "Blockchains stack signatures + hashes + Merkle trees.",
      "ZK protocols prove statements without revealing secrets.",
    ],
    code: `# No code here. Instead, summarize what you learned.
# Try writing a short checklist in Python strings.

primitives = [
    "Randomness -> keys and nonces",
    "Hashes -> integrity fingerprints",
    "HMAC -> integrity + authentication",
    "Stream cipher + nonce -> confidentiality",
    "Diffie-Hellman -> shared secrets",
    "RSA -> public/private roles",
    "Merkle tree -> compact inclusion proofs",
    "ZK Schnorr -> proof without revealing",
]

print("Blocksphere Cryptography 101 checklist:\n")
for item in primitives:
    print("-", item)
`,
  },
];
