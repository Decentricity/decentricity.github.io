# Audit batch 08 — RealityChain lineage

RealityChain is clearly a serious multi-repository product/platform, not a generic “metaverse project” placeholder. The evidence below is sufficient to normalize it as one first-class project with multiple implementation surfaces.

## `Decentricity/rc-readme` — PUBLIC — authoritative project summary/history

The lowercase `readme.md` describes **RealityChain: A Multichain Metaverse for Everyone**. It says the design goal is casual, accessible, user-friendly virtual spaces, approached from a **2D-first** perspective so virtual spaces can be experienced in parallel with real life. RealityChain originally launched on NEAR and later became multichain across NEAR + Ethereum.

The same document says the platform hosts multiple metaverses/worlds, with `myriad.town` launched first and additional named worlds including `2d.miami`, `paras.city`, and `uniqueone.world`; integrates Zoom/Twitch/YouTube; has Android and Chrome-extension surfaces; and planned an open API for NPC control / AI integration plus a survival-adventure gamification layer.

It explicitly links the public blockchain monorepo and frontend repo, references an older hackathon-winning 2D City demo, and mentions a current private repository under NDA. This is the strongest project-level evidence and should drive public prose.

`update-0.9.6.md` confirms RealityChain was a functioning metaverse/social-hub engine undergoing iterative development, with push-to-talk audio chat, edit-mode/social-interaction UX, performance work and bug fixes.

## `Decentricity/realitychain-monorepo` — PUBLIC — core blockchain/full-stack monorepo

No root README. Root `package.json` and package tree were manually inspected.

The Lerna workspace contains:
- `realitychain-api-js` — package `@realitychain/api`, explicitly described as “Reality Chain SDK for Frontend Applications,” using `near-api-js`; keywords include web3/metaverse/NEAR.
- `realitychain-contracts`
  - `nft-parcels` — NEAR parcel/NFT contract package
  - `real-token-eth` — Ethereum REAL token contract package
  - `mock-ft` — test/support FT package
- `realitychain-webapp` — React frontend, depends on `@realitychain/api`, `near-api-js`, and DeBio's Pinata/IPFS package; keywords include Ethereum, Solidity, NEAR and metaverse.
- `realitychain-rest` — backend/REST package
- `realitychain-mvp` — MVP application package

Root scripts include mainnet/testnet deployment/population/init flows for NFT parcels and REAL token, frontend/backend starts, and full workspace build/test tasks. This is strong evidence of a real multi-chain full-stack system rather than a static concept site.

Important authorship nuance: package manifests name individual implementation authors (for example Theo on `@realitychain/api` and Imam Hermawan on webapp). Public site should represent Pandu's RealityChain founder/cofounder/project role rather than imply she personally wrote every package.

## `Decentricity/realitychain-frontend` — PUBLIC — later/parallel frontend monorepo

No README. Root is another Lerna workspace containing:
- `realitychain-contracts`
- `realitychain-sdk-js`
- `realitychain-webapp`

Treat as a supporting/parallel RealityChain implementation repo, not a separate project.

## `Decentricity/RealityChain-TemuJalar` — PRIVATE — Unity client / metaverse implementation

No README. Root is a Unity project (`Assets`, `Packages`, `ProjectSettings`, etc.). `ProjectSettings/ProjectSettings.asset` provides hard evidence:
- `companyName: RealityChain`
- `productName: RealityChain Metaverse`
- Android application id `io.realitychain.metaverse`
- WebGL application id `com.realitychain.twodverse.near`
- bundle version `1.2.20`

This private repo is clearly a RealityChain Unity/metaverse client lineage. Keep the repository itself and private implementation details out of the public graph by default; it is useful audit evidence that RealityChain had a native/Unity client beyond the public web/blockchain repos.

## `Decentricity/RealityChain-Readme` — PUBLIC — empty/placeholder docs repo

Contains only a 21-byte README heading. No independent project detail; supporting/abandoned docs artifact.

## Public normalization

Create ONE first-class **RealityChain** project entry, accurately described as a 2D-first, multichain metaverse/social-space platform originally on NEAR and later spanning NEAR + Ethereum, with multiple virtual worlds, parcel/token infrastructure, SDK/webapp/backend components and native/Unity client work.

Evidence supports mentioning:
- 2D-first accessibility thesis
- NEAR + Ethereum multichain architecture
- multiple hosted metaverses/worlds
- parcel/NFT and REAL-token contracts
- JS SDK, webapp, REST backend and MVP packages
- social/video integrations and push-to-talk
- Android/native client lineage
- planned NPC/AI control API (clearly label as planned if mentioned)

Do not describe planned NPC/survival features as shipped. Do not expose the private Unity repo link. Do not imply Pandu personally authored every implementation package.
