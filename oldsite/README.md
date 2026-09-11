# Decentri.city legacy migration map

Rebuilt content-first archive at `/oldsite/`.

## Original Google Sites top-level map

| Original page | Surviving content | Migration status |
| --- | --- | --- |
| `/` Welcome | NearCon DeBio/Myriad decks; Myriad, DeBio, UniqueOne, ABI and Blocksphere role/project links; metaverse locations; media appearances; RobotPuisi memorials; links into reviews/transhumanism/videos; large press/archive list | Restored into `oldsite/index.html` |
| `/cv` | Surviving Google Sites page is primarily an embedded/empty wrapper | Preserved as original link; current main site has newer biographical material |
| `/360` | Embedded-media shell | Preserved as original link |
| `/photos` | Photo / embedded-media page | Preserved as original link |
| `/blog` | “Bringing the World to Life Through Art: The Blockchain Metaverse” | Core thesis + original link restored on archive map; this article did not exist in the dormant `_posts` set |
| `/r` / `/home` Decent Reviews | Long-form reviews of PirateBox, Iris, Commotion Wireless, OpenSimulator, Nextcloud, Meething; decentralized tool list; reading list | Full text already existed in dormant repo sources; rendered by the new archive UI |
| `/o` Decent Transhumanism | “The Recentralization Cycle and the Decentralized Bastion of Liberty” | Full text already existed in dormant repo source; rendered by archive UI |
| `/v` Decent Videos | English and Indonesian embedded-video collections | Legacy repo source rendered; original embed page linked |

## Dormant legacy sources already in this repository

These were present on `gh-pages` but were not exposed by the current `index.html` experience:

- `_posts/2000-01-01-intro.md` — original Decentri.city introduction / manifesto
- `_posts/2000-01-02-quotes.md` — decentralization quote material
- `_posts/2000-01-03-reviews.md` — the full technology review corpus
- `_posts/2000-01-05-tools.md` — GUN, IPFS, OpenWRT, LibreMesh, KadNode, Sovereign and reading notes
- `_posts/2000-01-06-essay.md` — Recentralization Cycle / decentralized transhumanism essay
- `_posts/2000-01-07-video.md` — legacy video source

`oldsite/app.js` fetches those files directly and renders them inside the new reading layout, keeping one canonical copy of the long-form text.

## Material absent from the current homepage experience

The current homepage is a compact interactive bio. It does not expose the old decentralization review corpus, the Recentralization Cycle essay, the original manifesto, the old tools catalog, the RobotPuisi memorial links, NearCon presentations, old metaverse locations, the historical press list, or the old media/video archive.

## Design approach

The rebuild intentionally avoids reproducing the old Google Sites layout. It uses a plain editorial archive: serif long-form reading typography, sticky section navigation, clear historical/archive labeling, responsive single-column behavior on small screens, and no attempt to silently modernize old project statuses, ratings, predictions, or opinions.
