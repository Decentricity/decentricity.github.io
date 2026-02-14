/**
 * embedify.js
 * Convert common media URLs into iframe-embed endpoints.
 *
 * Works in browser or Node (Node 18+ for URL).
 *
 * Usage:
 *   const r = toEmbedUrl("https://youtu.be/Oq9JXXrhOt8?si=xxx");
 *   if (r.ok) iframe.src = r.embedUrl;
 */

function safeURL(input) {
  try {
    // Allow bare domains like "youtube.com/watch?v=..." by forcing scheme
    const trimmed = String(input || "").trim();
    if (!trimmed) return null;

    // If it already looks like a URL but missing scheme, prepend https://
    const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed);
    const maybeUrl = hasScheme ? trimmed : `https://${trimmed}`;
    return new URL(maybeUrl);
  } catch {
    return null;
  }
}

function normHost(hostname) {
  return hostname.toLowerCase().replace(/^www\./, "");
}

function pickFirstNonEmpty(...vals) {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

/**
 * Extract YouTube video id from multiple URL formats.
 */
function parseYouTube(u) {
  const host = normHost(u.hostname);
  const path = u.pathname;

  // youtu.be/<id>
  if (host === "youtu.be") {
    const id = path.split("/").filter(Boolean)[0] || "";
    return id ? { id } : null;
  }

  // youtube.com/watch?v=<id>
  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    const v = u.searchParams.get("v");
    if (v) return { id: v };

    // youtube.com/embed/<id>
    if (path.startsWith("/embed/")) {
      const id = path.split("/")[2] || "";
      return id ? { id } : null;
    }

    // youtube.com/shorts/<id>
    if (path.startsWith("/shorts/")) {
      const id = path.split("/")[2] || "";
      return id ? { id } : null;
    }

    // youtube.com/live/<id>
    if (path.startsWith("/live/")) {
      const id = path.split("/")[2] || "";
      return id ? { id } : null;
    }
  }

  return null;
}

/**
 * Extract Vimeo id from vimeo.com/<id> or player.vimeo.com/video/<id>.
 */
function parseVimeo(u) {
  const host = normHost(u.hostname);
  const parts = u.pathname.split("/").filter(Boolean);

  if (host === "vimeo.com") {
    // vimeo.com/<id>
    const id = parts[0] || "";
    return /^\d+$/.test(id) ? { id } : null;
  }

  if (host === "player.vimeo.com") {
    // player.vimeo.com/video/<id>
    if (parts[0] === "video" && /^\d+$/.test(parts[1] || "")) {
      return { id: parts[1] };
    }
  }

  return null;
}

/**
 * Spotify: supports track/album/playlist/episode/show
 * Examples:
 *  https://open.spotify.com/track/<id>
 *  spotify:track:<id>
 */
function parseSpotify(input, u) {
  const raw = String(input || "").trim();

  // spotify URI form
  if (raw.toLowerCase().startsWith("spotify:")) {
    // spotify:track:<id>
    const parts = raw.split(":");
    if (parts.length >= 3) {
      const type = parts[1];
      const id = parts[2];
      if (type && id) return { type, id };
    }
    return null;
  }

  const host = normHost(u.hostname);
  if (host !== "open.spotify.com") return null;

  const parts = u.pathname.split("/").filter(Boolean);
  const type = parts[0] || "";
  const id = parts[1] || "";
  if (!type || !id) return null;

  const allowed = new Set(["track", "album", "playlist", "episode", "show", "artist"]);
  if (!allowed.has(type)) return null;

  return { type, id };
}

/**
 * SoundCloud: official embed is via w.soundcloud.com/player?url=<encoded original url>
 * We'll accept soundcloud.com/* and on.soundcloud.com/*
 */
function parseSoundCloud(u) {
  const host = normHost(u.hostname);
  if (host === "soundcloud.com" || host === "on.soundcloud.com") {
    return { original: u.toString() };
  }
  return null;
}

/**
 * Twitch:
 * - Clips: https://clips.twitch.tv/<slug>
 * - Videos: https://www.twitch.tv/videos/<id>
 * - Channels: https://www.twitch.tv/<channel>
 * Embed requires a "parent" domain param. Caller must supply.
 */
function parseTwitch(u) {
  const host = normHost(u.hostname);
  const parts = u.pathname.split("/").filter(Boolean);

  if (host === "clips.twitch.tv") {
    const slug = parts[0] || "";
    return slug ? { kind: "clip", slug } : null;
  }

  if (host === "twitch.tv" || host === "www.twitch.tv" || host === "m.twitch.tv") {
    if (parts[0] === "videos" && parts[1]) {
      return { kind: "video", id: parts[1] };
    }
    // channel
    if (parts[0]) return { kind: "channel", channel: parts[0] };
  }

  return null;
}

/**
 * Loom:
 * https://www.loom.com/share/<id> -> https://www.loom.com/embed/<id>
 */
function parseLoom(u) {
  const host = normHost(u.hostname);
  const parts = u.pathname.split("/").filter(Boolean);
  if (host !== "loom.com") return null;

  if (parts[0] === "share" && parts[1]) return { id: parts[1] };
  if (parts[0] === "embed" && parts[1]) return { id: parts[1] };
  return null;
}

/**
 * Google Drive file:
 * https://drive.google.com/file/d/<id>/view -> https://drive.google.com/file/d/<id>/preview
 * Also accepts /open?id=<id>
 */
function parseGDrive(u) {
  const host = normHost(u.hostname);
  if (host !== "drive.google.com") return null;

  const parts = u.pathname.split("/").filter(Boolean);
  // /file/d/<id>/...
  if (parts[0] === "file" && parts[1] === "d" && parts[2]) {
    return { id: parts[2] };
  }
  // /open?id=<id>
  const id = u.searchParams.get("id");
  if (id) return { id };
  return null;
}

/**
 * Google Docs/Slides embed-ish:
 * - Docs: /document/d/<id>/edit -> /document/d/<id>/preview
 * - Slides: /presentation/d/<id>/edit -> /presentation/d/<id>/embed
 * - Sheets: /spreadsheets/d/<id>/edit -> /spreadsheets/d/<id>/preview
 */
function parseGoogleDocs(u) {
  const host = normHost(u.hostname);
  if (host !== "docs.google.com") return null;

  const parts = u.pathname.split("/").filter(Boolean);
  // e.g. document/d/<id>/edit
  const kind = parts[0];
  if (!["document", "presentation", "spreadsheets", "forms"].includes(kind)) return null;
  if (parts[1] !== "d" || !parts[2]) return null;

  return { kind, id: parts[2] };
}

/**
 * Main converter.
 * Options:
 * - twitchParent: required by Twitch embed URLs. Example: "example.com"
 */
export function toEmbedUrl(entryText, options = {}) {
  const input = String(entryText || "").trim();
  if (!input) return { ok: false, reason: "empty" };

  const u = safeURL(input);
  if (!u) return { ok: false, reason: "not_a_url" };

  const host = normHost(u.hostname);

  // YouTube
  const yt = parseYouTube(u);
  if (yt) {
    // Preserve start time if present: t=123 or start=123
    const t = pickFirstNonEmpty(u.searchParams.get("start"), u.searchParams.get("t"));
    const start = t ? String(parseInt(t, 10) || "") : "";
    const embed = new URL(`https://www.youtube.com/embed/${yt.id}`);
    if (start) embed.searchParams.set("start", start);
    return { ok: true, provider: "youtube", embedUrl: embed.toString() };
  }

  // Vimeo
  const vm = parseVimeo(u);
  if (vm) {
    return { ok: true, provider: "vimeo", embedUrl: `https://player.vimeo.com/video/${vm.id}` };
  }

  // Spotify
  const sp = parseSpotify(input, u);
  if (sp) {
    return { ok: true, provider: "spotify", embedUrl: `https://open.spotify.com/embed/${sp.type}/${sp.id}` };
  }

  // SoundCloud
  const sc = parseSoundCloud(u);
  if (sc) {
    const embed = new URL("https://w.soundcloud.com/player/");
    embed.searchParams.set("url", sc.original);
    return { ok: true, provider: "soundcloud", embedUrl: embed.toString() };
  }

  // Twitch (needs parent)
  const tw = parseTwitch(u);
  if (tw) {
    const parent = String(options.twitchParent || "").trim();
    if (!parent) {
      return { ok: false, reason: "twitch_requires_parent", provider: "twitch" };
    }
    const embed = new URL("https://player.twitch.tv/");
    embed.searchParams.set("parent", parent);

    if (tw.kind === "clip") embed.searchParams.set("clip", tw.slug);
    if (tw.kind === "video") embed.searchParams.set("video", tw.id);
    if (tw.kind === "channel") embed.searchParams.set("channel", tw.channel);

    return { ok: true, provider: "twitch", embedUrl: embed.toString() };
  }

  // Loom
  const lo = parseLoom(u);
  if (lo) {
    return { ok: true, provider: "loom", embedUrl: `https://www.loom.com/embed/${lo.id}` };
  }

  // Google Drive file preview
  const gd = parseGDrive(u);
  if (gd) {
    return { ok: true, provider: "gdrive", embedUrl: `https://drive.google.com/file/d/${gd.id}/preview` };
  }

  // Google Docs/Slides/Sheets "preview/embed"
  const gdocs = parseGoogleDocs(u);
  if (gdocs) {
    if (gdocs.kind === "presentation") {
      return { ok: true, provider: "gslides", embedUrl: `https://docs.google.com/presentation/d/${gdocs.id}/embed` };
    }
    if (gdocs.kind === "document") {
      return { ok: true, provider: "gdocs", embedUrl: `https://docs.google.com/document/d/${gdocs.id}/preview` };
    }
    if (gdocs.kind === "spreadsheets") {
      return { ok: true, provider: "gsheets", embedUrl: `https://docs.google.com/spreadsheets/d/${gdocs.id}/preview` };
    }
    // Forms embedding is a different endpoint; keep as-is if already /viewform, else try /viewform
    if (gdocs.kind === "forms") {
      // Many forms already have /viewform; embed param is embedded=true
      const embed = new URL(`https://docs.google.com/forms/d/${gdocs.id}/viewform`);
      embed.searchParams.set("embedded", "true");
      return { ok: true, provider: "gforms", embedUrl: embed.toString() };
    }
  }

  return { ok: false, reason: "unsupported_host", host };
}

/**
 * Convenience: returns embedUrl string or null
 */
export function embedUrlOrNull(entryText, options = {}) {
  const r = toEmbedUrl(entryText, options);
  return r.ok ? r.embedUrl : null;
}
