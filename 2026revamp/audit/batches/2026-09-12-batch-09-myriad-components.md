# Audit batch 09 — Myriad.Social supporting components and experiments

The serious public project remains **Myriad.Social**. These repositories document the breadth of its client surfaces, import bridges, auth tooling and AI experiments; they should roll up beneath Myriad rather than becoming separate public project cards.

## `Decentricity/myriad-importer-extension` — PUBLIC — browser-extension component
README says the extension was live at Myriad's extension page and Chrome Web Store. `manifest.json` confirms the product name **Myriad Extension**, description “Import and Post to Myriad,” permissions targeting Twitter, Reddit, Twitch and YouTube, and API access to `api.myriad.social`. This is a real browser import/post client surface for Myriad.

## `Decentricity/myriad-cli` — PUBLIC — first-party CLI client
README says “i made dis lil CLI client for www.myriad.social.” It supports anonymous login, reading/filtering/writing posts, Twitter imports, monochrome ASCII image rendering and simplified console text. It also documents an optional self-hosted Myriad AI install. Treat as a substantial alternate Myriad client, but still a component/extension of the Myriad project.

## `Decentricity/MyriadTelegramBots` — PUBLIC — Telegram bridge/client tooling
No README. Root has two Python programs. `PostOnMyriadFromTelegram.py` was manually inspected: it authenticates Myriad users through Telegram-linked state, creates/lists/chooses Myriad Experiences/timelines, calls the Myriad API and builds Telegram inline UI around Myriad functions. The second file is named `UpdateTelegramWithMyriadPosts.py`, strongly indicating reverse synchronization from Myriad to Telegram. This is a Myriad↔Telegram integration surface, not a separate product.

## `Decentricity/myriadtel` — PUBLIC — earlier official Telegram bot
README title is **MyriadTelBot — The official Myriad.Social Telegram bot**, marked under construction. Treat as an earlier Telegram-bot implementation/support repo in the same lineage as `MyriadTelegramBots`.

## `Decentricity/Myriad-OpenAI` — PUBLIC — historical Lina/Myriad AI bot experiment
No README. `myriadlina.py` was inspected. The script polls Myriad posts, calls OpenAI ChatCompletion with a hard-coded fictional Lina persona, records dedupe state and posts generated comments back to Myriad. This is a historical synthetic-person/AI interaction experiment built on Myriad, not core Myriad platform architecture and not evidence of the operator's personal beliefs. Group under Myriad/Lina experimentation.

## `Decentricity/LinaMistral` — PUBLIC — later local-model Lina/Myriad experiment
Previously inspected. Uses local Ollama Mistral and the Myriad API for autonomous posting/commenting with a Lina/Myriad persona. Normalize as the local-model successor/parallel to the OpenAI experiment rather than a generic Mistral project.

## `Decentricity/myriad_PAT` — PUBLIC — personal-access-token API test/tooling
No README. Root contains a zip and `python/pat.py`. The Python script targets Myriad testnet APIs for personal admin/access token generation, PAT login and token revocation, then verifies that revoked login fails. This is authentication/API development tooling, not a user-facing project.

## `Decentricity/myrtwitter.com` — PUBLIC — Twitter-import lookup utility
No README. Single `myrtwitter.py` accepts a Twitter status URL, extracts its post ID, queries Myriad's Twitter importer/search endpoints and prints the corresponding Myriad post link if imported. Supporting import/debug utility.

## Previously audited supporting Myriad repositories

- `Decentricity/marauder` — Linux installer/orchestrator for Myriad infrastructure: Docker/Compose/zrok, MinIO, MongoDB, Myriad service.
- `Decentricity/myrst` — web instructions/helper for deploying a Myriad social token on NEAR.
- `Decentricity/socialtokens` — script deploying Myriad social-token FT infrastructure on NEAR.
- `Decentricity/myriad-importer-extension` — browser import/post client (expanded above).
- `Decentricity/myriad-cli` — alternate terminal client (expanded above).
- `Decentricity/LinaMistral`, `Myriad-OpenAI` — AI-persona experiments attached to the network.

## Public normalization

Public project entry should describe **Myriad.Social** as a decentralized social/interaction platform with multiple user/client surfaces and experiments, while the repo list can expose selected public evidence beneath it. Strong evidence supports:
- decentralized/cross-network social thesis from the org concept repository
- remixable/user-selectable feed experiences
- cross-network import/discovery
- browser extension for importing/posting from mainstream platforms
- CLI client
- Telegram bridges
- self-hosting/infrastructure scripts
- NEAR/social-token experiments
- AI/Lina experiments

Do not create separate showcase cards for each helper repo. Do not turn the hard-coded fictional persona in an experiment into a biographical claim about Pandu.
