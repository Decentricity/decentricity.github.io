# Audit batch 07 — current hardware, XR, neuro and artificial-media work

## Vive Flow resurrection / AR toolkit

These are not generic “XR experiments.” They form a concrete hardware-resurrection lineage targeting abandoned HTC Vive Flow hardware.

### `Decentricity/vive-flow-hud` — PUBLIC — first-class foundation project
README says “Bring a dead headset back as a visor.” Flow HUD is a from-scratch dual-eye passthrough overlay for the abandoned Android 9 Vive Flow, using Camera2 stereo cameras and IMU without the Wave SDK. It renders a red HUD, real-world horizon, pitch/roll/yaw, compass, clock/battery/camera status, gaze-mouse interaction and stereo calibration. The repo explicitly frames itself as the start of a platform for navigation/diagnostics/field notes rather than a one-off demo. It also documents the security model: treat the Flow as an untrusted display.

### `Decentricity/vive-flow-ar-writer` — PUBLIC — application in the lineage
Previously inspected: horizon-locked text/writer surface on the Vive Flow, retaining the dual-eye passthrough and allowing Bluetooth-keyboard writing. Distinct app, but normalize under the larger Vive Flow resurrection/toolkit family.

### `Decentricity/vive-flow-ar-launcher` — PUBLIC — advanced shell/application
README documents a full 3D visor launcher grown from Flow HUD: horizon/heading-locked 3×2 app grid, guide-locked windows, Files browser with image/video/text preview, in-visor MP4 recording with microphone controls, Writer integration, HedgeyOS About app, gaze/volume interaction, boot/self-keepalive behavior, Camera2 stereo passthrough and explicit device limitations. This is the strongest shell/integration layer in the lineage.

Recommended public normalization: **Vive Flow Resurrection / AR Toolkit** as a first-class project family with Flow HUD, AR Writer and AR Launcher as concrete applications/milestones.

## Connectome / Mindmeld / Superfly research

### `Decentricity/connectome-headless-viz` — PUBLIC — first-class research implementation
README identifies **mindmeld / connectome Phase 1**: sparse Janelia MaleCNS reservoir simulation on an RTX 4070 Ti, with Oruk-inspired dynamics, full and smaller connectome modes, signed/unsigned weighting, CUDA simulation and a living terminal/libcaca visualizer. Phase 1.5B adds interactive stimulation and recording/replay.

### `Decentricity/connectome-research-drosophila` — PRIVATE — serious research plan/results corpus
README explicitly frames the Janelia MaleCNS connectome as a **fixed recurrent reservoir**, not a biophysical brain simulation. It documents existing Phase 1 work and the next **SUPERFLY** experiment: many independent fly reservoir states sharing one immutable connectome operator `W`, per-fly context/WAL, partial observations and deliberately synthetic low-bandwidth communication. It defines a distributed hidden-state-reconstruction benchmark, real/scrambled/random-reservoir controls, no-communication/solo controls, scaling targets and acceptance criteria.

This is serious research and should be a first-class public project/research entity, but the private repository itself must remain private by default. Public descriptions can rely on the already-public `connectome-headless-viz` plus explicitly approved public facts; do not leak private repo links or internal-only details automatically.

## HedgeyOS Mini / M5Paper

### `Decentricity/HedgeyOS-Mini` — PUBLIC — first-class tiny/weird-computer project
README describes a touch-first environment for original M5Paper hardware, booting directly into Read and Write apps. It includes SD-backed EPUB reading, persistent ruled notes, large touch keyboard, Bluetooth Classic/BLE HID keyboard pairing/reconnect, e-ink Hedgey UI, NVS pairing persistence and complete/update firmware images. This is a real small-computer OS/environment, not a skin.

### `Decentricity/m5paper-launcher-transfer` — PRIVATE — supporting recovery/deployment kit
README describes a private transfer kit for original 16MB M5Paper hardware, with verified M5Launcher flash/readback, a library of installable firmware images and source snapshots, SD safety rules and explicit handling of a sensitive pre-Launcher flash backup containing old Wi-Fi credentials. Supporting hardware/recovery repo; do not expose private backup details publicly.

## TAMP family

### `Decentricity/hedgey-oled` — PUBLIC — hardware seed/prototype
README: Hedgey artwork/firmware prepared for an ESP32-C3 board with integrated 0.42-inch 72×40 OLED, including verified I2C probe configuration and PlatformIO deployment. Small foundation/support project.

### `Decentricity/tamp` — PUBLIC — first-class hardware/software project
README documents **TAMP**, a wired Android notification display: Android `NotificationListenerService` -> USB Host/CDC ACM -> ESP32-C3 -> 72×40 OLED. Android app has no backend/account/analytics/network permissions; firmware uses native USB Serial/JTAG. Includes queueing, filtering, privacy settings, app filtering, display paging and a roadmap toward passthrough charging/custom PCB/Wi-Fi/BLE. Concrete product prototype.

### `Decentricity/tampi` — PUBLIC — derived tiny-computer terminal project
README documents **TAMPi**, derived from TAMP but replacing the OLED target with a direct wired Android ↔ Orange Pi Zero 2W terminal over Linux CDC ACM serial gadget. It requires no Termux, IP, DHCP or SSH and exposes a line-oriented console. This is a distinct TAMP-derived project/application and should be described exactly, not as a generic “mobile computing” experiment.

## Termux Agent

### `Decentricity/termux-agent` — PUBLIC — first-class local agent/tool project
README describes a mention-triggered Telegram bot agent running on Android Termux. It long-polls/caches Telegram updates, invokes local Codex on explicit mentions or replies, supports image inputs and YouTube transcript extraction, and runs poller/responder services under runit. Onboarding configures persona/operator/Telegram token, and the agent has full local CLI access within the Termux device. Public copy should clearly describe it as an Android/Termux Telegram↔Codex bridge, not merely “agent tooling.”

## Artificial media stack

### `Decentricity/interdimensional-radio` — PUBLIC — first-class **Airadio** project
README now identifies the package as **airadio — local AI radio with MiniMax Music 3**. It drives a local ComfyUI + MiniMax Music 3 installation, generates ~2-minute songs, fills generation gaps with interstitials/library tracks, generates recursive-grammar lyrics/titles, prevents lyric duplication across restarts, archives provenance/catalog metadata and has no hosted fallback. Tested on RTX 4070 Ti 12GB. The old vague name “Interdimensional Radio experiment” is insufficient; the project has a specific local-radio architecture and released CLI/package.

### `Decentricity/aimtv` — PUBLIC — first-class downstream media project
README describes **AI MTV / AI Music Television**, packaged as `aimtv`. It plays local Airadio material and renders reactive diffusion video using feedback img2img. It reconstructs/hash-verifies authoritative Airadio lyrics, uses local Faster-Whisper only for alignment evidence, uses deterministic phrase ranking rather than an LLM/network service for contextual imagery, alternates lyric anchors with dream cutaways, writes per-render provenance manifests, and installs/runs local SD-Turbo + Faster-Whisper models. Normalize as a distinct but related project downstream of Airadio.

## THRML experiments

### `Decentricity/thrml-experiments` — PUBLIC — authored simulation experiment
No README. Root contains one substantial `robots.py`; source inspection identifies it explicitly as a **multi-robot warehouse routing** Pygame simulation. It models fleets, pick stations, shelves, congestion/energy weights, turn/wall penalties, loading/unloading dwell, utilization heatmaps, reservations and multiple warehouse map presets. Keep as an authored research/algorithm experiment; do not invent a connection to any particular THRML paper/system beyond what the repo itself establishes.

## HackJakarta voice reviews

### `Decentricity/HackJakarta-Grab-Voice-Reviews` — PUBLIC — authored hackathon project
README documents **Grab — Review With Your Voice**, a mobile voice-conversation review prototype. It cycles previously visited restaurants, conducts a probing voice chatbot conversation to cover rating/taste/portions/pricing, uses MIT App Inventor frontend, GCP/Google Sheets backend, GPT-4 conversational/review parsing, Google speech recognition/TTS and reward/gamification concepts. README explicitly names Pandu Sastrowardoyo as developer and links a demo video. Historical/hackathon project; not generic “voice AI.”
