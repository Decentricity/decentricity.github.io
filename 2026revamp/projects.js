window.DECENTRI_DATA = {
  projects: [
    {
      id: "hedgeyos-mini",
      title: "HedgeyOS Mini",
      family: "tiny-computers",
      status: "active",
      year: 2026,
      summary: "A tiny, touch-first environment for the original M5Paper, booting directly into Read and Write tools.",
      notes: "Targets first-generation M5Paper hardware. EPUB reading is SD-backed; Write is a persistent ruled notepad with touch and Bluetooth keyboard support.",
      tech: ["ESP32", "M5Paper", "e-ink", "PlatformIO"],
      links: [{label:"GitHub", url:"https://github.com/Decentricity/HedgeyOS-Mini"}]
    },
    {
      id: "tamp",
      title: "TAMP",
      family: "tiny-computers",
      status: "prototype",
      year: 2026,
      summary: "A wired Android notification display using a tiny ESP32-C3/OLED companion over USB-C.",
      notes: "The Android app forwards notifications over USB CDC ACM. When idle, the OLED returns to Hedgey artwork. No account, backend, analytics, tracker, Wi-Fi or Bluetooth is required for the prototype.",
      tech: ["Android", "Kotlin", "ESP32-C3", "USB CDC", "OLED"],
      links: [{label:"GitHub", url:"https://github.com/Decentricity/tamp"}]
    },
    {
      id: "tampi",
      title: "TAMPi",
      family: "tiny-computers",
      status: "prototype",
      year: 2026,
      summary: "A direct wired terminal between an Android phone and an Orange Pi Zero 2W.",
      notes: "Uses Android USB Host and a Linux CDC ACM serial gadget. It does not depend on Android USB Ethernet and does not require Termux; the first version is intentionally line-oriented.",
      tech: ["Android", "Orange Pi", "USB Serial", "Linux"],
      links: [{label:"GitHub", url:"https://github.com/Decentricity/tampi"}]
    },
    {
      id: "hedgey-oled",
      title: "Hedgey OLED",
      family: "tiny-computers",
      status: "working",
      year: 2026,
      summary: "Hedgey artwork and firmware prepared for an ESP32-C3 board with an integrated 0.42-inch 72×40 OLED.",
      notes: "A tiny hardware/firmware experiment that became part of the lineage leading into TAMP.",
      tech: ["ESP32-C3", "OLED", "PlatformIO"],
      links: [{label:"GitHub", url:"https://github.com/Decentricity/hedgey-oled"}]
    },
    {
      id: "intent-computer-mini",
      title: "Intent Computer Mini",
      family: "tiny-computers",
      status: "experiment",
      year: 2026,
      summary: "A small e-ink applet computer organized around direct intent and voice-driven applet switching.",
      notes: "Current experiments include local wake-word control for applets and device actions.",
      tech: ["ESP32", "e-ink", "embedded UI", "voice"],
      links: []
    },
    {
      id: "vive-flow-hud",
      title: "Vive Flow HUD",
      family: "xr-hardware",
      status: "experiment",
      year: 2026,
      summary: "An experiment in repurposing the HTC Vive Flow as a lightweight heads-up display rather than a conventional VR headset.",
      notes: "Part of a larger sequence of Vive Flow revival experiments including AR writing and launcher work.",
      tech: ["Android", "XR", "HTC Vive Flow"],
      links: [{label:"GitHub", url:"https://github.com/Decentricity/vive-flow-hud"}]
    },
    {
      id: "vive-flow-ar-writer",
      title: "Vive Flow AR Writer",
      family: "xr-hardware",
      status: "experiment",
      year: 2026,
      summary: "A writing-oriented AR experiment for the Vive Flow hardware.",
      notes: "One branch of the broader effort to turn discontinued/lightweight XR hardware into useful ambient computers.",
      tech: ["Android", "XR", "writing"],
      links: [{label:"GitHub", url:"https://github.com/Decentricity/vive-flow-ar-writer"}]
    },
    {
      id: "vive-flow-ar-launcher",
      title: "Vive Flow AR Launcher",
      family: "xr-hardware",
      status: "experiment",
      year: 2026,
      summary: "An application launcher experiment for the Vive Flow AR/HUD repurposing stack.",
      notes: "Designed as part of the same hardware-revival lineage as the HUD and writer experiments.",
      tech: ["Android", "XR", "launcher"],
      links: [{label:"GitHub", url:"https://github.com/Decentricity/vive-flow-ar-launcher"}]
    },
    {
      id: "connectome-headless-viz",
      title: "Connectome Headless Viz",
      family: "machine-minds",
      status: "research",
      year: 2026,
      summary: "Headless visualization tooling around computational connectome experiments.",
      notes: "This sits beside ongoing Drosophila connectome / reservoir-computing research; private research repos are intentionally not surfaced here.",
      tech: ["neuroscience", "connectomics", "visualization"],
      links: [{label:"GitHub", url:"https://github.com/Decentricity/connectome-headless-viz"}]
    },
    {
      id: "prolog-userworld",
      title: "Prolog Userworld",
      family: "machine-minds",
      status: "experiment",
      year: 2026,
      summary: "A symbolic / Prolog-oriented experiment in representing users, worlds and relationships.",
      notes: "One piece of the broader recurring interest in symbolic AI, agent worlds and alternative computational models.",
      tech: ["Prolog", "symbolic AI"],
      links: [{label:"GitHub", url:"https://github.com/Decentricity/prolog-userworld"}]
    },
    {
      id: "interdimensional-radio",
      title: "Interdimensional Radio",
      family: "artificial-media",
      status: "experiment",
      year: 2026,
      summary: "A generative / synthetic radio experiment in the artificial-media branch of the lab.",
      notes: "Kept deliberately weird: radio as a programmable world rather than merely a playlist.",
      tech: ["generative media", "audio"],
      links: [{label:"GitHub", url:"https://github.com/Decentricity/interdimensional-radio"}]
    },
    {
      id: "aimtv",
      title: "AIMTV",
      family: "artificial-media",
      status: "experiment",
      year: 2026,
      summary: "An AI-mediated television / channel experiment.",
      notes: "Part of the ongoing interest in continuous synthetic media and autonomous programming.",
      tech: ["AI", "video", "generative media"],
      links: [{label:"GitHub", url:"https://github.com/Decentricity/aimtv"}]
    },
    {
      id: "walkgirl",
      title: "Walkgirl",
      family: "worlds-art",
      status: "experiment",
      year: 2026,
      summary: "A walking/world experiment from the current wave of spatial and generative projects.",
      notes: "Filed with the world-building branch rather than presented as a conventional app.",
      tech: ["worlds", "simulation"],
      links: [{label:"GitHub", url:"https://github.com/Decentricity/walkgirl"}]
    },
    {
      id: "ai-odyssey",
      title: "AI Odyssey",
      family: "machine-minds",
      status: "experiment",
      year: 2026,
      summary: "An AI experimentation repository from the recent personal research cycle.",
      notes: "Grouped with agents and machine-mind work; the project dossier will grow as the larger archive is normalized.",
      tech: ["AI", "experiments"],
      links: [{label:"GitHub", url:"https://github.com/Decentricity/ai-odyssey"}]
    },
    {
      id: "termux-agent",
      title: "Termux Agent",
      family: "tiny-computers",
      status: "experiment",
      year: 2026,
      summary: "Agent tooling designed around an Android/Termux computing environment.",
      notes: "Part of the recurring project of turning small/mobile devices into serious personal computers.",
      tech: ["Android", "Termux", "agents"],
      links: [{label:"GitHub", url:"https://github.com/Decentricity/termux-agent"}]
    },
    {
      id: "realitychain",
      title: "RealityChain",
      family: "decentralized-systems",
      status: "project",
      year: 2023,
      summary: "A blockchain / metaverse project family represented across multiple RealityChain repositories.",
      notes: "Included as part of the longer decentralized-systems lineage that connects the current lab to the older site.",
      tech: ["blockchain", "metaverse", "web3"],
      links: [
        {label:"Monorepo", url:"https://github.com/Decentricity/realitychain-monorepo"},
        {label:"Frontend", url:"https://github.com/Decentricity/realitychain-frontend"}
      ]
    },
    {
      id: "myriad",
      title: "Myriad.Social",
      family: "decentralized-systems",
      status: "archive",
      year: 2021,
      summary: "A decentralized social-media project and a major branch of the earlier Decentricity era.",
      notes: "The 2026 site will connect its repos, presentations and archived writing rather than flattening it into one link.",
      tech: ["social", "decentralization", "web3"],
      links: [
        {label:"CLI", url:"https://github.com/Decentricity/myriad-cli"},
        {label:"Importer", url:"https://github.com/Decentricity/myriad-importer-extension"}
      ]
    },
    {
      id: "robotpuisi",
      title: "RobotPuisi",
      family: "worlds-art",
      status: "archive",
      year: 2020,
      summary: "One of the archived robot children: a generative-language project preserved from the earlier site.",
      notes: "The old site memorialized RobotPuisi and sibling bots after their original hosting era ended.",
      tech: ["generative text", "bots"],
      links: [{label:"GitHub", url:"https://github.com/Decentricity/robotpuisi"}]
    }
  ],
  families: [
    { id:"tiny-computers", title:"Tiny / Weird Computers", description:"Small devices treated as real computers: e-ink, ESP32, Orange Pi, watches, phones and improvised terminals." },
    { id:"xr-hardware", title:"XR / Resurrected Hardware", description:"Repurposing neglected or discontinued XR hardware into ambient computers and heads-up displays." },
    { id:"machine-minds", title:"Machine Minds / Agents / Neuro", description:"Agents, symbolic systems, local assistants, connectomes, neuroscience and alternative ways of making machines think." },
    { id:"artificial-media", title:"Artificial Media Machines", description:"Synthetic radio, television, sound and other continuously generated media systems." },
    { id:"decentralized-systems", title:"Decentralized Systems", description:"Blockchain, social protocols, identity, bioinformatics and the decentralization work that dominated earlier eras." },
    { id:"worlds-art", title:"Worlds / Art / Weird Web", description:"Walkable worlds, generative art, virtual spaces, robots and experiments that resist normal app categories." }
  ],
  archive: [
    { title:"Decent Reviews", detail:"Long-form reviews of PirateBox, Iris, Commotion Wireless, OpenSimulator, Nextcloud, Meething and decentralized tooling.", href:"../oldsite/#reviews" },
    { title:"Decent Transhumanism", detail:"The Recentralization Cycle and the Decentralized Bastion of Liberty.", href:"../oldsite/#essay" },
    { title:"Google Sites preservation mirror", detail:"Literal preservation copy of the old decentri.city published site and linked material.", href:"../oldsite/google-sites-archive/" },
    { title:"Current 2025/26 homepage", detail:"The compact cyberpunk page this revamp will eventually supersede.", href:"../" },
    { title:"Original public Google Site", detail:"The underlying published Google Sites route for the old website.", href:"https://sites.google.com/view/decentricity/1" }
  ],
  timeline: [
    { year:"2026", title:"Tiny computers, XR revival and connectome research", text:"HedgeyOS Mini, TAMP/TAMPi, OLED devices, Vive Flow experiments, synthetic media and Drosophila/connectome work become the active laboratory." },
    { year:"2023–2025", title:"Agents, local AI and RealityChain-era experiments", text:"Personal AI systems, generative agents, local model work, spatial experiments and a growing pile of one-off tools." },
    { year:"2020–2022", title:"DeBio, Myriad and the old Decentricity web", text:"Decentralized social systems, genomic blockchain work, RobotPuisi-era generative bots and the sprawling Google Site archive." },
    { year:"2017–2019", title:"Blockchain infrastructure and enterprise work", text:"Blocksphere and broader blockchain engineering/research work form the professional backbone of the decentralization era." },
    { year:"2007–2016", title:"Earlier AI, enterprise systems and engineering", text:"Symbolic/expert-system interests and enterprise computing precede the later blockchain and generative-AI work." }
  ]
};
