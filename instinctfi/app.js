"use strict";

/*
 * ============================================================================
 * EDITING SAFETY RULES
 * ============================================================================
 * 1. Do not add raw ctx.fillText(' without closing quotes.
 * 2. Only change constants inside CONFIG.
 * 3. Do not add new globals; use STATE.
 * 4. All draw calls must be inside draw functions.
 * 5. Test changes incrementally to catch errors early.
 * ============================================================================
 */

// ============================================================================
// SECTION 1: BOOT AND ERROR HANDLING
// ============================================================================

/**
 * Assert helper - throws clear error if condition is false
 * @param {boolean} condition 
 * @param {string} message 
 */
function assert(condition, message) {
    if (!condition) {
        throw new Error("Assertion failed: " + message);
    }
}

/**
 * Get element by ID or throw if missing
 * @param {string} id 
 * @returns {HTMLElement}
 */
function mustGetEl(id) {
    var el = document.getElementById(id);
    if (!el) {
        throw new Error("Required element not found: #" + id);
    }
    return el;
}

/**
 * Clamp a number between min and max
 * @param {number} n 
 * @param {number} lo 
 * @param {number} hi 
 * @returns {number}
 */
function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
}

/**
 * Show error overlay to user (prevents blank page)
 * @param {string} message 
 * @param {string} stack 
 */
function showErrorOverlay(message, stack) {
    console.error("App crashed:", message, stack);
    
    showLoadingError(message, stack);
    logDebug("ERROR: " + (message || "Unknown error"));
}

// Global error handlers
window.addEventListener("error", function(event) {
    showErrorOverlay(event.message, event.error ? event.error.stack : "");
});

window.addEventListener("unhandledrejection", function(event) {
    var reason = event.reason;
    var message = reason instanceof Error ? reason.message : String(reason);
    var stack = reason instanceof Error ? reason.stack : "";
    showErrorOverlay(message, stack);
});

// ============================================================================
// SECTION 2: CONFIGURATION (CONSTANTS)
// ============================================================================

var CONFIG = {
    // Price history - 5 second rolling window for chart
    HISTORY_DURATION: 5000,     // 5 seconds of history (chart window)
    SAMPLE_INTERVAL: 50,        // Sample every 50ms
    
    // Price bounds (initial fallbacks)
    DEFAULT_PRICE: 140,
    MIN_PRICE: 100,
    MAX_PRICE: 200,
    
    // Drift DLOB WebSocket config
    DRIFT_DLOB_WS_URL: "wss://instictfi-dlob-proxy.psastrowardoyo.workers.dev",
    DRIFT_MARKET: "SOL-PERP",
    DRIFT_RECONNECT_DELAY_MS: 3000,
    PRICE_EASE_ALPHA: 0.18,
    RANGE_PADDING_PCT: 0.01,
    
    // Dynamic zoom config (micro-zoom for tight movements)
    ZOOM_WINDOW_SECS: 5,        // 5 second window for dynamic zoom (match chart)
    ZOOM_EASE_ALPHA: 0.18,
    ZOOM_MIN_SPAN_PCT: 0.0002,      // 0.02% minimum span (very tight)
    ZOOM_PAD_FRAC: 0.30,            // 30% padding of span
    ZOOM_PAD_MIN_PCT: 0.00005,      // 0.005% minimum padding
    ZOOM_OUTLIER_TRIM: 0.02,        // Optional: trim 2% outliers
    
    // Hex grid
    HEX_SCROLL_SPEED: 8,        // pixels per second (slowed 5x for smoother vertical motion)
    HEX_SIZE_RATIO: 14,         // canvas size divided by this
    
    // Fixed hex ladder (for fair tap-trading)
    // TICK_SIZE is computed on first price, this is just a fallback
    DEFAULT_TICK_SIZE: 0.01,    // $0.01 per hex row (fallback)
    
    // Chart padding
    PADDING: {
        top: 80,
        bottom: 50,
        left: 70,
        right: 70
    },
    
    // Trail sampling (distance-based to match hex scroll)
    TRAIL_POINT_SPACING_PX: 6,  // Add new trail point every N pixels of scroll
    
    // User simulation
    USER_NAMES: [
        "Pandora", "Alice", "Bob", "Charlie", "Luna",
        "Max", "Zara", "Felix", "Nova", "Rex"
    ],
    USER_CLICK_MIN_INTERVAL: 1000,
    USER_CLICK_MAX_INTERVAL: 3000,
    
    // Dialog bubble
    BUBBLE_DURATION: 1000,      // 1 second visible
    BUBBLE_FADE_DURATION: 200,  // 200ms fade out
    
    // Candlestick config
    CANDLE_DURATION_MS: 1000,       // 1 second candles
    CANDLE_MAX_HISTORY: 120,        // Keep last 120 candles
    CANDLE_WIDTH_PX: 4,             // Width of each candle body
    CANDLE_GAP_PX: 2,               // Gap between candles
    CANDLE_WICK_WIDTH: 1            // Wick line width
};

// Computed config (derived from CONFIG)
CONFIG.MAX_SAMPLES = CONFIG.HISTORY_DURATION / CONFIG.SAMPLE_INTERVAL;

// ============================================================================
// SECTION 3: STATE (MUTABLE RUNTIME DATA)
// ============================================================================

var STATE = {
    // Canvas and context
    canvas: null,
    ctx: null,
    
    // Price data
    priceHistory: [],           // Array of {time, price}
    currentPrice: CONFIG.DEFAULT_PRICE,
    momentum: 0,
    
    // Drift price feed state
    targetPrice: CONFIG.DEFAULT_PRICE,
    lastGoodPriceTs: 0,
    isOnline: false,
    hasReceivedFirstPrice: false,  // Flag to track if we've received real data
    
    // Raw price strings from websocket for full precision display
    bestBidStr: null,
    bestAskStr: null,
    bestBid: CONFIG.DEFAULT_PRICE,
    bestAsk: CONFIG.DEFAULT_PRICE,
    dlobSocket: null,
    reconnectTimeoutId: null,
    priceMin: CONFIG.MIN_PRICE,
    priceMax: CONFIG.MAX_PRICE,
    latestLow: CONFIG.MIN_PRICE,
    latestHigh: CONFIG.MAX_PRICE,
    
    // Dynamic zoom state (for 24h zoom out mode, kept but not used)
    driftLow24h: CONFIG.MIN_PRICE,
    driftHigh24h: CONFIG.MAX_PRICE,
    
    // Hexagon scroll
    hexScrollPosition: 0,       // Total pixels scrolled (always increases)
    lastFrameTime: 0,
    
    // Canvas resize state (for proper PX_PER_TICK initialization)
    canvasResized: false,       // True after resizeCanvas() runs with real dimensions
    pendingFirstPrice: null,    // First price from websocket, held until canvas is resized
    
    // Distance-based trail history (for accurate line drawing that matches hex scroll)
    // Each point stores FROZEN worldY at capture time - never recomputed
    trailHistory: [],           // Array of {scrollX, price, worldY} - scroll position based, not time based
    scrolledSinceLastTrailPointPx: 0,  // Accumulator for distance-based sampling
    lastTrailScrollX: 0,        // Scroll position when last trail point was added
    
    // Fixed hex ladder state (immutable after first setup)
    ladderInitialized: false,   // True after TICK_SIZE and ANCHOR_PRICE are set
    TICK_SIZE: 0.01,            // Price per vertical hex step (never changes after init)
    ANCHOR_PRICE: 140,          // Reference price at k=0 (never changes after init)
    ANCHOR_WORLD_Y: 0,          // World Y coordinate at ANCHOR_PRICE (never changes after init)
    PX_PER_TICK: 1,             // Pixels per tick in world space (never changes after init)
    WORLD_COL_SPACING: 1,       // World X spacing between columns (never changes after init)
    WORLD_HEX_SIZE: 1,          // Base hex size in world space (never changes after init)
    viewportOffsetY: 0,         // Camera offset in world Y coordinates (pixels, NOT indices)
    
    // Two-finger scroll state
    isTwoFingerDragging: false,
    lastTwoFingerY: 0,
    activeTouches: [],
    
    // Hexagon tracking
    pinkHexagons: new Set(),    // User-selected hexagons (stores absolute ladder indices)
    yellowHexagons: new Map(),  // AI user bets: ladderIndex -> {name, timestamp, leverage, worldCol}
    hexagonData: [],            // Current frame hexagon positions
    availableHexagonsForAI: [], // Hexagons available for AI clicks
    
    // Animation timing
    lastPriceUpdate: 0,
    nextUserClickTime: 0,
    
    // Logo background
    logoImage: null,
    logoLoaded: false,
    
    // Sound effects
    audioContext: null,
    hitHexagonsPlayed: new Set(),  // Track hexagons that already played ka-ching sound
    
    // Candlestick state (1-second candles)
    // Each candle stores FROZEN worldY values at capture time - never recomputed
    candleHistory: [],              // Array of {open, high, low, close, scrollX, openWorldY, highWorldY, lowWorldY, closeWorldY} - finalized candles
    currentCandle: null,            // {open, high, low, close, startSecond, startScrollX, openWorldY, highWorldY, lowWorldY, closeWorldY} - candle being built
    lastCandleSecond: 0,            // floor(timestamp/1000) of last processed candle
    
    // Manual navigation state (D-pad controls)
    manualPan: { x: 0, y: 0 },      // Manual pan offset in pixels (additive to auto)
    manualMode: false,              // True when user is manually panning (D-pad used)
    zoom: 1.0,                      // Zoom level (0.75 to 1.5)
    
    // Demo trading state
    tradingBalance: 1000,           // Starting balance $1000
    tradingBetAmount: 1,            // Default bet amount $1
    tradingLeverage: 2,             // Default leverage 2x
    activeBets: new Map(),          // hexId -> {amount, leverage} for user bets awaiting settlement

    // Debug overlay state
    debug: {
        enabled: true,
        overlayEl: null,
        contentEl: null,
        summaryEl: null,
        lines: [],
        maxLines: 200,
        lastMsgAt: 0
    },

    // Loading overlay state
    loadingOverlayEl: null,
    loadingErrorEl: null,
    loadingErrorMessageEl: null,
    loadingErrorStackEl: null,
    loadingVisible: true
};

// ============================================================================
// SECTION 4: DOM AND CANVAS SETUP
// ============================================================================

/**
 * Initialize DOM elements and canvas
 */
function initDOM() {
    STATE.canvas = mustGetEl("main-canvas");
    STATE.ctx = STATE.canvas.getContext("2d");
    assert(STATE.ctx !== null, "Failed to get 2D context from canvas");
    STATE.loadingOverlayEl = document.getElementById("loading-overlay");
    STATE.loadingErrorEl = document.getElementById("loading-error");
    STATE.loadingErrorMessageEl = document.getElementById("loading-error-message");
    STATE.loadingErrorStackEl = document.getElementById("loading-error-stack");
}

/**
 * Initialize a debug overlay for live status and logs
 * Shows from the beginning, can be collapsed via a toggle button
 */
function initDebugOverlay() {
    var overlay = document.createElement("div");
    overlay.id = "debug-overlay";
    overlay.style.cssText = [
        "position: fixed",
        "top: 10px",
        "left: 10px",
        "width: min(420px, 92vw)",
        "max-height: 60vh",
        "background: rgba(0, 0, 0, 0.85)",
        "color: #00FFCC",
        "font-family: monospace",
        "font-size: 11px",
        "line-height: 1.35",
        "padding: 10px",
        "border: 1px solid rgba(0, 255, 204, 0.4)",
        "border-radius: 8px",
        "z-index: 9998",
        "overflow: hidden",
        "box-shadow: 0 0 12px rgba(0, 255, 204, 0.2)"
    ].join(";");

    var header = document.createElement("div");
    header.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:6px;";

    var title = document.createElement("div");
    title.textContent = "DEBUG";
    title.style.cssText = "font-weight:bold;color:#FFD700;";

    var toggleBtn = document.createElement("button");
    toggleBtn.textContent = "Hide";
    toggleBtn.style.cssText = [
        "margin-left:auto",
        "background:#111",
        "color:#00FFCC",
        "border:1px solid rgba(0,255,204,0.4)",
        "border-radius:4px",
        "padding:2px 6px",
        "font-size:10px",
        "cursor:pointer"
    ].join(";");

    var summary = document.createElement("div");
    summary.style.cssText = "margin-bottom:6px;white-space:pre-wrap;";

    var content = document.createElement("div");
    content.style.cssText = [
        "max-height: 42vh",
        "overflow: auto",
        "border-top: 1px solid rgba(0, 255, 204, 0.2)",
        "padding-top: 6px",
        "white-space: pre-wrap"
    ].join(";");

    header.appendChild(title);
    header.appendChild(toggleBtn);
    overlay.appendChild(header);
    overlay.appendChild(summary);
    overlay.appendChild(content);
    document.body.appendChild(overlay);

    STATE.debug.overlayEl = overlay;
    STATE.debug.contentEl = content;
    STATE.debug.summaryEl = summary;

    var isHidden = false;
    toggleBtn.addEventListener("click", function() {
        isHidden = !isHidden;
        content.style.display = isHidden ? "none" : "block";
        summary.style.display = isHidden ? "none" : "block";
        toggleBtn.textContent = isHidden ? "Show" : "Hide";
        overlay.style.opacity = isHidden ? "0.5" : "1";
    });
}

/**
 * Append a line to the debug log overlay
 * @param {string} message
 */
function logDebug(message) {
    var now = new Date();
    var stamp = now.toISOString().split("T")[1].replace("Z", "");
    var line = "[" + stamp + "] " + message;
    STATE.debug.lines.push(line);
    if (STATE.debug.lines.length > STATE.debug.maxLines) {
        STATE.debug.lines.shift();
    }
    if (STATE.debug.contentEl) {
        STATE.debug.contentEl.textContent = STATE.debug.lines.join("\n");
        STATE.debug.contentEl.scrollTop = STATE.debug.contentEl.scrollHeight;
    }
}

/**
 * Update debug overlay summary with live state
 */
function updateDebugOverlay() {
    if (!STATE.debug.summaryEl) {
        return;
    }
    var nowMs = performance.now();
    var wsState = STATE.dlobSocket ? STATE.dlobSocket.readyState : -1;
    var wsStateLabel = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"][wsState] || "NONE";
    var lastAgeMs = STATE.debug.lastMsgAt ? Math.max(0, nowMs - STATE.debug.lastMsgAt) : -1;
    var online = isOnline(nowMs);

    var summary = [
        "ws=" + wsStateLabel + " online=" + online,
        "price=" + formatPrice(STATE.currentPrice, 6) + " target=" + formatPrice(STATE.targetPrice, 6),
        "lastMsgAgeMs=" + (lastAgeMs >= 0 ? Math.floor(lastAgeMs) : "n/a"),
        "hasFirstPrice=" + STATE.hasReceivedFirstPrice + " canvasResized=" + STATE.canvasResized
    ].join("\n");

    STATE.debug.summaryEl.textContent = summary;
}

/**
 * Resize canvas to match container
 * Sets canvasResized flag and triggers pending ladder initialization if needed
 */
function resizeCanvas() {
    var mainContent = mustGetEl("main-content");
    var newWidth = mainContent.clientWidth;
    var newHeight = mainContent.clientHeight;
    
    // Only proceed if we have valid dimensions
    if (newWidth > 0 && newHeight > 0) {
        STATE.canvas.width = newWidth;
        STATE.canvas.height = newHeight;
        
        // Mark canvas as properly resized
        if (!STATE.canvasResized) {
            STATE.canvasResized = true;
            console.log("Canvas resized to " + newWidth + "x" + newHeight);
            
            // If we have a pending first price, initialize the ladder now
            if (STATE.pendingFirstPrice !== null && !STATE.hasReceivedFirstPrice) {
                console.log("Canvas ready, initializing with pending price: $" + STATE.pendingFirstPrice.toFixed(4));
                initializeWithRealPrice(STATE.pendingFirstPrice);
                STATE.pendingFirstPrice = null;
            }
        }
    }
}

/**
 * Initialize Web Audio API context
 */
function initAudio() {
    try {
        STATE.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log("Audio context initialized");
    } catch (err) {
        console.warn("Web Audio API not available:", err.message);
    }
}

/**
 * Resume audio context on user interaction (required by browsers)
 */
function resumeAudioContext() {
    if (STATE.audioContext && STATE.audioContext.state === "suspended") {
        STATE.audioContext.resume();
    }
}

/**
 * Play a "ka-ching" cash register sound using Web Audio API
 */
function playKaChingSound() {
    if (!STATE.audioContext) {
        return;
    }
    
    // Resume if suspended
    if (STATE.audioContext.state === "suspended") {
        STATE.audioContext.resume();
    }
    
    var ctx = STATE.audioContext;
    var now = ctx.currentTime;
    
    // Create a cash register / coin sound effect
    // Layer 1: High metallic "ching" 
    var osc1 = ctx.createOscillator();
    var gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(2400, now);
    osc1.frequency.exponentialRampToValueAtTime(1800, now + 0.08);
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.15);
    
    // Layer 2: Bell-like shimmer
    var osc2 = ctx.createOscillator();
    var gain2 = ctx.createGain();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(4800, now + 0.02);
    osc2.frequency.exponentialRampToValueAtTime(3600, now + 0.12);
    gain2.gain.setValueAtTime(0.15, now + 0.02);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.02);
    osc2.stop(now + 0.2);
    
    // Layer 3: Lower "ka" attack  
    var osc3 = ctx.createOscillator();
    var gain3 = ctx.createGain();
    osc3.type = "square";
    osc3.frequency.setValueAtTime(800, now);
    osc3.frequency.exponentialRampToValueAtTime(200, now + 0.05);
    gain3.gain.setValueAtTime(0.1, now);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(now);
    osc3.stop(now + 0.08);
    
    // Layer 4: Coin jingle overlay
    var osc4 = ctx.createOscillator();
    var gain4 = ctx.createGain();
    osc4.type = "sine";
    osc4.frequency.setValueAtTime(6000, now + 0.05);
    osc4.frequency.exponentialRampToValueAtTime(5000, now + 0.15);
    gain4.gain.setValueAtTime(0.08, now + 0.05);
    gain4.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc4.connect(gain4);
    gain4.connect(ctx.destination);
    osc4.start(now + 0.05);
    osc4.stop(now + 0.25);
}

/**
 * Load the logo image for background display
 */
function loadLogoImage() {
    STATE.logoImage = new Image();
    STATE.logoImage.crossOrigin = "anonymous";
    STATE.logoImage.onload = function() {
        STATE.logoLoaded = true;
        console.log("Logo image loaded successfully");
    };
    STATE.logoImage.onerror = function() {
        console.warn("Failed to load logo image");
        STATE.logoLoaded = false;
    };
    STATE.logoImage.src = "https://instinctfi.xyz/instinctfi%20spiky%20logo.png";
}

/**
 * Draw the logo as a centered background image
 */
function drawLogoBackground() {
    if (!STATE.logoLoaded || !STATE.logoImage) {
        return;
    }
    
    var ctx = STATE.ctx;
    var canvasWidth = STATE.canvas.width;
    var canvasHeight = STATE.canvas.height;
    
    // Calculate size to fit nicely in the canvas (80% of smaller dimension)
    var maxSize = Math.min(canvasWidth, canvasHeight) * 0.8;
    var imgAspect = STATE.logoImage.width / STATE.logoImage.height;
    
    var drawWidth, drawHeight;
    if (imgAspect > 1) {
        // Wider than tall
        drawWidth = maxSize;
        drawHeight = maxSize / imgAspect;
    } else {
        // Taller than wide or square
        drawHeight = maxSize;
        drawWidth = maxSize * imgAspect;
    }
    
    // Center the logo
    var drawX = (canvasWidth - drawWidth) / 2;
    var drawY = (canvasHeight - drawHeight) / 2;
    
    // Draw with low opacity so it's subtle background
    ctx.globalAlpha = 0.15;
    ctx.drawImage(STATE.logoImage, drawX, drawY, drawWidth, drawHeight);
    ctx.globalAlpha = 1.0;
}

// ============================================================================
// SECTION 5: ORIENTATION HANDLING
// ============================================================================

/**
 * Check if we're currently in portrait mode
 * @returns {boolean}
 */
function isPortraitMode() {
    return window.innerHeight > window.innerWidth;
}

/**
 * Check device orientation and update layout classes
 * Portrait mode is now supported - no blocking warning
 */
function checkOrientation() {
    var warning = mustGetEl("orientation-warning");
    var app = mustGetEl("app-container");
    var isPortrait = isPortraitMode();
    
    // Always hide the orientation warning - portrait is now supported
    warning.style.display = "none";
    app.style.display = "flex";
    
    // Add/remove portrait class for CSS-based layout switching
    if (isPortrait) {
        document.body.classList.add("portrait-mode");
        document.body.classList.remove("landscape-mode");
    } else {
        document.body.classList.add("landscape-mode");
        document.body.classList.remove("portrait-mode");
    }
    
    resizeCanvas();
}

/**
 * Check if device is mobile/touch
 */
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           (window.matchMedia && window.matchMedia("(max-width: 1024px)").matches && 
            window.matchMedia("(pointer: coarse)").matches);
}

/**
 * Check if device is desktop (not mobile/tablet)
 * Returns true if device appears to be a desktop computer
 */
function isDesktopDevice() {
    // Check for touch capability and screen size
    var hasCoarsePointer = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    var hasFinePointer = window.matchMedia && window.matchMedia("(pointer: fine)").matches;
    var isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    var isLargeScreen = window.innerWidth >= 1024;
    
    // Desktop = fine pointer (mouse) + no mobile UA + large screen
    // Or: no coarse pointer + large screen
    return !isMobileUA && hasFinePointer && isLargeScreen && !hasCoarsePointer;
}

/**
 * Check for desktop and show warning if needed
 * Returns true if desktop warning is shown (app should not load)
 */
function checkDesktop() {
    var warning = document.getElementById("desktop-warning");
    var app = document.getElementById("app-container");
    var loading = document.getElementById("loading-overlay");
    
    if (!warning || !app) return false;
    
    if (isDesktopDevice()) {
        warning.style.display = "flex";
        app.style.display = "none";
        if (loading) {
            loading.style.display = "none";
        }
        return true;
    } else {
        warning.style.display = "none";
        return false;
    }
}

/**
 * Show or hide the startup loading overlay
 * @param {boolean} isVisible
 */
function setLoadingOverlayVisible(isVisible) {
    if (!STATE.loadingOverlayEl) {
        return;
    }
    STATE.loadingOverlayEl.style.display = isVisible ? "flex" : "none";
    STATE.loadingVisible = isVisible;
}

/**
 * Show error details inside the loading overlay for debugging
 * @param {string} message
 * @param {string} stack
 */
function showLoadingError(message, stack) {
    if (!STATE.loadingOverlayEl || !STATE.loadingErrorEl) {
        return;
    }
    if (STATE.loadingErrorMessageEl) {
        STATE.loadingErrorMessageEl.textContent = message || "Unknown error";
    }
    if (STATE.loadingErrorStackEl) {
        STATE.loadingErrorStackEl.textContent = stack || "";
    }
    STATE.loadingErrorEl.style.display = "block";
    setLoadingOverlayVisible(true);
}

/**
 * Check if fullscreen is supported
 */
function isFullscreenSupported() {
    return document.documentElement.requestFullscreen ||
           document.documentElement.webkitRequestFullscreen ||
           document.documentElement.mozRequestFullScreen ||
           document.documentElement.msRequestFullscreen;
}

/**
 * Check if currently in fullscreen mode
 */
function isFullscreen() {
    return !!(document.fullscreenElement ||
              document.webkitFullscreenElement ||
              document.mozFullScreenElement ||
              document.msFullscreenElement);
}

/**
 * Request fullscreen mode
 */
function requestFullscreen() {
    var elem = document.documentElement;
    
    if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(function(err) {
            console.log("Fullscreen request failed:", err.message);
        });
    } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
    } else if (elem.mozRequestFullScreen) {
        elem.mozRequestFullScreen();
    } else if (elem.msRequestFullscreen) {
        elem.msRequestFullscreen();
    }
    
    // Also try to lock orientation to landscape on mobile
    if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock("landscape").catch(function(err) {
            console.log("Orientation lock failed:", err.message);
        });
    }
}

/**
 * Exit fullscreen mode
 */
function exitFullscreen() {
    if (document.exitFullscreen) {
        document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
    } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
    }
}

/**
 * Toggle fullscreen mode
 */
function toggleFullscreen() {
    if (isFullscreen()) {
        exitFullscreen();
    } else {
        requestFullscreen();
    }
}

/**
 * Initialize fullscreen button functionality
 */
function initFullscreenButton() {
    var btn = document.getElementById("fullscreen-btn");
    if (!btn) return;
    
    // Only show on mobile/touch devices
    if (!isMobileDevice()) {
        btn.style.display = "none";
        return;
    }
    
    // If fullscreen not supported, hide button
    if (!isFullscreenSupported()) {
        btn.style.display = "none";
        return;
    }
    
    btn.addEventListener("click", function(e) {
        e.stopPropagation();
        resumeAudioContext();
        toggleFullscreen();
    });
    
    // Update button visibility on fullscreen change
    document.addEventListener("fullscreenchange", updateFullscreenButton);
    document.addEventListener("webkitfullscreenchange", updateFullscreenButton);
    document.addEventListener("mozfullscreenchange", updateFullscreenButton);
    document.addEventListener("MSFullscreenChange", updateFullscreenButton);
}

/**
 * Update fullscreen button state
 */
function updateFullscreenButton() {
    var btn = document.getElementById("fullscreen-btn");
    if (!btn) return;
    
    if (isFullscreen()) {
        btn.style.display = "none";
    } else if (isMobileDevice()) {
        btn.style.display = "flex";
    }
    
    // Resize canvas after fullscreen change
    setTimeout(resizeCanvas, 100);
}

// ============================================================================
// SECTION 6: PRICE ENGINE
// ============================================================================

/**
 * Parse a price value from DLOB, handling both decimal strings and fixed-point integers
 * Drift typically sends prices as integers scaled by 1e6 (PRICE_PRECISION)
 * @param {string|number} priceValue - Raw price from orderbook
 * @returns {number|null} - Parsed price in USD or null if invalid
 */
function parseDlobPrice(priceValue) {
    if (priceValue === null || priceValue === undefined) {
        return null;
    }
    
    var priceStr = String(priceValue);
    var parsed = Number.parseFloat(priceStr);
    
    if (!isFinite(parsed) || parsed <= 0) {
        return null;
    }
    
    // Check if the string contains a decimal point
    // If it looks like "138.717", it's already in USD
    // If it looks like "138469695" (large integer), it's likely scaled by 1e6
    if (priceStr.indexOf('.') !== -1) {
        // Already has decimal - use as-is
        return parsed;
    }
    
    // No decimal point - check if it's a large integer that needs scaling
    // Drift uses 1e6 (PRICE_PRECISION) for perp prices
    // SOL at ~$140 would be sent as ~140000000 (140 * 1e6)
    if (parsed > 100000) {
        // Likely a fixed-point integer, scale down by 1e6
        return parsed / 1e6;
    }
    
    // Small integer without decimal - use as-is (unlikely but handle gracefully)
    return parsed;
}

/**
 * Parse DLOB orderbook message and extract mid price
 * @param {Object} data - Parsed orderbook data
 * @returns {number|null} - Mid price or null if invalid
 */
function extractMidPriceFromOrderbook(data) {
    try {
        var bids = data.bids;
        var asks = data.asks;
        
        if (!bids || !asks || bids.length === 0 || asks.length === 0) {
            return null;
        }
        
        // Best bid is first element, best ask is first element
        var bestBid = parseDlobPrice(bids[0].price);
        var bestAsk = parseDlobPrice(asks[0].price);
        
        if (bestBid === null || bestAsk === null) {
            return null;
        }
        
        // Compute mid price
        var mid = (bestBid + bestAsk) / 2;
        
        // Sanity check: SOL price should be between 1 and 10000
        if (mid < 1 || mid > 10000) {
            console.warn("Mid price outside sane range for SOL:", mid, "bid:", bestBid, "ask:", bestAsk);
            return null;
        }
        
        return mid;
    } catch (err) {
        console.warn("Failed to extract mid price:", err.message);
        return null;
    }
}

/**
 * Count decimal places in a price string
 * @param {string} s - Price string from websocket
 * @returns {number} - Number of decimal places (clamped to 0-10)
 */
function decimalPlacesFromPriceString(s) {
    if (!s || typeof s !== "string") {
        return 4; // fallback
    }
    var dotIndex = s.indexOf(".");
    if (dotIndex === -1) {
        return 0;
    }
    var decimals = s.length - dotIndex - 1;
    return clamp(decimals, 0, 10);
}

// ============================================================================
// SECTION 6B: PRICE FORMATTING HELPERS
// ============================================================================

/**
 * Get the current visible price range span from priceMin/priceMax
 * @returns {number} - Span of the current price range
 */
function getCurrentRangeSpan() {
    return STATE.priceMax - STATE.priceMin;
}

/**
 * Get decimal places for the main header price display
 * Default 4 decimals, auto-increase to 5-6 if volatility is very low
 * @param {number} rangeSpan - The 5-second price range span
 * @returns {number} - Number of decimals (4-6)
 */
function getHeaderDecimals(rangeSpan) {
    // For very tight ranges, show more decimals so movement is visible
    if (rangeSpan < 0.005) {
        return 6; // Ultra-tight: show 6 decimals
    } else if (rangeSpan < 0.02) {
        return 5; // Very tight: show 5 decimals
    }
    return 4; // Default: 4 decimals
}

/**
 * Get decimal places for hex tile labels
 * Default 2 decimals, increase for tight ranges
 * @param {number} rangeSpan - The visible grid price range span
 * @returns {number} - Number of decimals (2-4)
 */
function getTileDecimals(rangeSpan) {
    if (rangeSpan < 0.05) {
        return 4; // Very tight: show 4 decimals
    } else if (rangeSpan < 0.20) {
        return 3; // Tight: show 3 decimals
    }
    return 2; // Default: 2 decimals for readability
}

/**
 * Format a price value for display with specified decimal places
 * @param {number} price - The price value (full precision float)
 * @param {number} decimals - Number of decimal places to display
 * @returns {string} - Formatted price string (without $ prefix)
 */
function formatPrice(price, decimals) {
    if (!isFinite(price)) {
        return "0.00";
    }
    return price.toFixed(decimals);
}

/**
 * Format a percentage value for display
 * @param {number} percent - The percentage value
 * @param {number} decimals - Number of decimal places (default 2)
 * @returns {string} - Formatted percentage string (with +/- prefix, without % suffix)
 */
function formatPercent(percent, decimals) {
    if (!isFinite(percent)) {
        return "+0.00";
    }
    var dp = decimals !== undefined ? decimals : 2;
    var prefix = percent >= 0 ? "+" : "";
    return prefix + percent.toFixed(dp);
}

/**
 * Extract mid price and store raw strings for full precision display
 * @param {Object} data - Parsed orderbook data
 * @returns {number|null} - Mid price or null if invalid
 */
function extractMidPriceAndStoreRaw(data) {
    try {
        var bids = data.bids;
        var asks = data.asks;
        
        if (!bids || !asks || bids.length === 0 || asks.length === 0) {
            return null;
        }
        
        // Store raw price strings for full precision display
        STATE.bestBidStr = String(bids[0].price);
        STATE.bestAskStr = String(asks[0].price);
        
        // Parse numeric values for calculations
        var bestBid = parseDlobPrice(bids[0].price);
        var bestAsk = parseDlobPrice(asks[0].price);
        
        if (bestBid === null || bestAsk === null) {
            return null;
        }
        
        // Store numeric values
        STATE.bestBid = bestBid;
        STATE.bestAsk = bestAsk;
        
        // Compute mid price (full precision float)
        var mid = (bestBid + bestAsk) / 2;
        
        // Sanity check: SOL price should be between 1 and 10000
        if (mid < 1 || mid > 10000) {
            console.warn("Mid price outside sane range for SOL:", mid, "bid:", bestBid, "ask:", bestAsk);
            return null;
        }
        
        return mid;
    } catch (err) {
        console.warn("Failed to extract mid price:", err.message);
        return null;
    }
}

/**
 * Update candlestick aggregator with a new price tick
 * Called when we receive a valid price from the WebSocket
 * @param {number} price - The new price
 * @param {number} nowMs - Current timestamp in ms
 */
function updateCandleAggregator(price, nowMs) {
    var currentSecond = Math.floor(nowMs / CONFIG.CANDLE_DURATION_MS);
    var currentScrollX = STATE.hexScrollPosition;
    
    // Compute frozen worldY for this price at current time
    var frozenWorldY = STATE.ladderInitialized ? priceToWorldY(price) : 0;
    
    if (STATE.currentCandle === null) {
        // Start first candle with frozen worldY values
        STATE.currentCandle = {
            open: price,
            high: price,
            low: price,
            close: price,
            openWorldY: frozenWorldY,
            highWorldY: frozenWorldY,
            lowWorldY: frozenWorldY,
            closeWorldY: frozenWorldY,
            startSecond: currentSecond,
            startScrollX: currentScrollX
        };
        STATE.lastCandleSecond = currentSecond;
        return;
    }
    
    if (currentSecond === STATE.currentCandle.startSecond) {
        // Same second - update current candle with frozen worldY values
        if (price > STATE.currentCandle.high) {
            STATE.currentCandle.high = price;
            STATE.currentCandle.highWorldY = frozenWorldY;
        }
        if (price < STATE.currentCandle.low) {
            STATE.currentCandle.low = price;
            STATE.currentCandle.lowWorldY = frozenWorldY;
        }
        STATE.currentCandle.close = price;
        STATE.currentCandle.closeWorldY = frozenWorldY;
    } else {
        // New second - finalize current candle and start new one
        // Store finalized candle with FROZEN worldY values (immutable after this)
        STATE.candleHistory.push({
            open: STATE.currentCandle.open,
            high: STATE.currentCandle.high,
            low: STATE.currentCandle.low,
            close: STATE.currentCandle.close,
            openWorldY: STATE.currentCandle.openWorldY,
            highWorldY: STATE.currentCandle.highWorldY,
            lowWorldY: STATE.currentCandle.lowWorldY,
            closeWorldY: STATE.currentCandle.closeWorldY,
            scrollX: currentScrollX  // Position when candle closed
        });
        
        // Trim history to max length
        if (STATE.candleHistory.length > CONFIG.CANDLE_MAX_HISTORY) {
            STATE.candleHistory.shift();
        }
        
        // Start new candle with frozen worldY values
        STATE.currentCandle = {
            open: price,
            high: price,
            low: price,
            close: price,
            openWorldY: frozenWorldY,
            highWorldY: frozenWorldY,
            lowWorldY: frozenWorldY,
            closeWorldY: frozenWorldY,
            startSecond: currentSecond,
            startScrollX: currentScrollX
        };
        STATE.lastCandleSecond = currentSecond;
    }
}

/**
 * Handle incoming WebSocket message from DLOB
 * @param {MessageEvent} event 
 */
function handleDlobMessage(event) {
    try {
        var msg = JSON.parse(event.data);
        var nowMs = performance.now();
        STATE.debug.lastMsgAt = nowMs;

        if (msg && msg.type === "proxy_error") {
            logDebug("Proxy error: " + msg.message + (msg.status ? " (status " + msg.status + ")" : ""));
            return;
        }
        if (msg && msg.type === "proxy_info") {
            logDebug("Proxy info: " + msg.message);
            return;
        }
        
        // The data field is double-encoded JSON
        if (msg.data && typeof msg.data === "string") {
            var innerData = JSON.parse(msg.data);
            var midPrice = extractMidPriceAndStoreRaw(innerData);
            
            if (midPrice !== null) {
                // On first real price, initialize everything with real data
                // BUT only if canvas is already resized (so PX_PER_TICK is correct)
                if (!STATE.hasReceivedFirstPrice) {
                    if (STATE.canvasResized) {
                        initializeWithRealPrice(midPrice);
                    } else {
                        // Store the price to initialize later when canvas is ready
                        STATE.pendingFirstPrice = midPrice;
                        console.log("Received first price $" + midPrice.toFixed(4) + " but canvas not resized yet, deferring ladder init...");
                    }
                }
                logDebug("DLOB tick mid=" + midPrice.toFixed(6));
                STATE.targetPrice = midPrice;
                STATE.lastGoodPriceTs = nowMs;
                STATE.isOnline = true;
                
            }
        } else if (msg.bids && msg.asks) {
            // Handle case where data might not be double-encoded
            var midPrice = extractMidPriceAndStoreRaw(msg);
            
            if (midPrice !== null) {
                // On first real price, initialize everything with real data
                // BUT only if canvas is already resized (so PX_PER_TICK is correct)
                if (!STATE.hasReceivedFirstPrice) {
                    if (STATE.canvasResized) {
                        initializeWithRealPrice(midPrice);
                    } else {
                        // Store the price to initialize later when canvas is ready
                        STATE.pendingFirstPrice = midPrice;
                        console.log("Received first price $" + midPrice.toFixed(4) + " but canvas not resized yet, deferring ladder init...");
                    }
                }
                logDebug("DLOB tick mid=" + midPrice.toFixed(6));
                STATE.targetPrice = midPrice;
                STATE.lastGoodPriceTs = nowMs;
                STATE.isOnline = true;
                
            }
        }
    } catch (err) {
        console.warn("Failed to parse DLOB message:", err.message);
        logDebug("DLOB parse error: " + err.message);
    }
}

/**
 * Start DLOB WebSocket connection for SOL-PERP orderbook
 */
function startDriftOrderbookFeed() {
    // Clear any pending reconnect
    if (STATE.reconnectTimeoutId !== null) {
        clearTimeout(STATE.reconnectTimeoutId);
        STATE.reconnectTimeoutId = null;
    }
    
    // Close existing socket if any
    if (STATE.dlobSocket !== null) {
        try {
            STATE.dlobSocket.close();
        } catch (e) {
            // Ignore close errors
        }
        STATE.dlobSocket = null;
    }
    
    console.log("Connecting to Drift DLOB WebSocket...");
    logDebug("WS connect -> " + CONFIG.DRIFT_DLOB_WS_URL);
    
    try {
        STATE.dlobSocket = new WebSocket(CONFIG.DRIFT_DLOB_WS_URL);
    } catch (err) {
        console.warn("Failed to create WebSocket:", err.message);
        STATE.isOnline = false;
        logDebug("WS create failed: " + err.message);
        scheduleReconnect();
        return;
    }
    
    STATE.dlobSocket.onopen = function() {
        console.log("DLOB WebSocket connected, subscribing to SOL-PERP orderbook...");
        logDebug("WS open; subscribe SOL-PERP");
        
        // Send subscribe message
        var subscribeMsg = {
            type: "subscribe",
            marketType: "perp",
            channel: "orderbook",
            market: CONFIG.DRIFT_MARKET
        };
        
        try {
            STATE.dlobSocket.send(JSON.stringify(subscribeMsg));
        } catch (err) {
            console.warn("Failed to send subscribe message:", err.message);
            logDebug("WS subscribe failed: " + err.message);
        }
    };
    
    STATE.dlobSocket.onmessage = handleDlobMessage;
    
    STATE.dlobSocket.onclose = function(event) {
        console.log("DLOB WebSocket closed:", event.code, event.reason);
        STATE.isOnline = false;
        STATE.dlobSocket = null;
        logDebug("WS closed: code=" + event.code + " reason=" + event.reason);
        scheduleReconnect();
    };
    
    STATE.dlobSocket.onerror = function(err) {
        console.warn("DLOB WebSocket error");
        STATE.isOnline = false;
        logDebug("WS error");
        // onclose will be called after onerror, so reconnect happens there
    };
}

/**
 * Schedule a reconnection attempt
 */
function scheduleReconnect() {
    if (STATE.reconnectTimeoutId !== null) {
        return; // Already scheduled
    }
    
    console.log("Scheduling DLOB reconnect in " + CONFIG.DRIFT_RECONNECT_DELAY_MS + "ms...");
    
    STATE.reconnectTimeoutId = setTimeout(function() {
        STATE.reconnectTimeoutId = null;
        startDriftOrderbookFeed();
    }, CONFIG.DRIFT_RECONNECT_DELAY_MS);
}

/**
 * Authoritative online check - used everywhere for consistency
 * Data is considered stale if no update in 20 seconds
 * @param {number} nowMs - Current time in milliseconds (performance.now())
 * @returns {boolean}
 */
function isOnline(nowMs) {
    return STATE.isOnline && (nowMs - STATE.lastGoodPriceTs) < 20000;
}

/**
 * Legacy alias for compatibility
 * @param {number} nowMs
 * @returns {boolean}
 */
function isDriftOnline(nowMs) {
    return isOnline(nowMs);
}

/**
 * Initialize price history with timestamps
 * If we haven't received real price data yet, just create empty history
 * The actual data will be populated when we receive the first real price
 */
function initPriceHistory() {
    STATE.priceHistory = [];
    
    // Don't populate with fake data - wait for real price from websocket
    // Just initialize the zoom range to reasonable defaults
    // These will be properly set once we get real data
    STATE.priceMin = CONFIG.MIN_PRICE;
    STATE.priceMax = CONFIG.MAX_PRICE;
}

/**
 * Called when first real price is received from websocket
 * Properly initializes price history with the real starting price
 * Also initializes the fixed hex ladder (TICK_SIZE, ANCHOR_PRICE)
 * @param {number} realPrice - The first real price from the websocket
 */
function initializeWithRealPrice(realPrice) {
    var now = performance.now();
    
    // Set the current price to the real value
    STATE.currentPrice = realPrice;
    STATE.targetPrice = realPrice;
    
    // Now populate history with the real price
    STATE.priceHistory = [];
    for (var i = 0; i < CONFIG.MAX_SAMPLES; i++) {
        STATE.priceHistory.push({
            time: now - (CONFIG.MAX_SAMPLES - i) * CONFIG.SAMPLE_INTERVAL,
            price: realPrice
        });
    }
    
    // Initialize priceMin/priceMax based on real price
    var initialSpan = realPrice * CONFIG.ZOOM_MIN_SPAN_PCT;
    var initialPad = Math.max(initialSpan * CONFIG.ZOOM_PAD_FRAC, realPrice * CONFIG.ZOOM_PAD_MIN_PCT);
    STATE.priceMin = realPrice - initialSpan / 2 - initialPad;
    STATE.priceMax = realPrice + initialSpan / 2 + initialPad;
    
    // Initialize the fixed hex ladder (this is the key for fair tap-trading!)
    initializeLadder(realPrice);
    
    STATE.hasReceivedFirstPrice = true;
    setLoadingOverlayVisible(false);
    console.log("Initialized with real SOL-PERP price: $" + realPrice.toFixed(4));
}

/**
 * Update price by easing toward target price from Drift
 * When offline, price is frozen (no movement) and history is NOT updated
 * IMPORTANT: All prices stored as full precision floats - NO rounding or toFixed()
 */
function updatePrice() {
    var nowMs = performance.now();
    
    // Only update price and history if Drift feed is online
    if (isOnline(nowMs)) {
        // Ease toward target price (no jitter)
        // STATE.targetPrice is already full precision float from WebSocket
        // STATE.currentPrice remains full precision float
        STATE.currentPrice += (STATE.targetPrice - STATE.currentPrice) * CONFIG.PRICE_EASE_ALPHA;

        // Keep candles aligned with the rendered price line by using the same smoothed price.
        updateCandleAggregator(STATE.currentPrice, nowMs);
        
        // Add to time-based history for zoom/range calculations (FULL PRECISION)
        STATE.priceHistory.push({ time: nowMs, price: STATE.currentPrice });
        
        // Remove old samples from time-based history
        var cutoff = nowMs - CONFIG.HISTORY_DURATION;
        while (STATE.priceHistory.length > 0 && STATE.priceHistory[0].time < cutoff) {
            STATE.priceHistory.shift();
        }
    }
    // Else: price stays frozen at current value, no history push
}

/**
 * Update the distance-based trail history
 * Called every frame from animate() with the scroll delta
 * Trail points are added based on scroll distance, not wall-clock time
 * @param {number} scrollDelta - Pixels scrolled this frame
 */
function updateTrailHistory(scrollDelta) {
    var nowMs = performance.now();
    
    // Only update trail if Drift feed is online
    if (!isOnline(nowMs)) {
        return;
    }
    
    // Accumulate scroll distance
    STATE.scrolledSinceLastTrailPointPx += scrollDelta;
    
    // Add trail points when we've scrolled enough
    var spacing = CONFIG.TRAIL_POINT_SPACING_PX;
    
    // Initialize lastTrailScrollX once, anchored to current scroll position
    if (STATE.trailHistory.length === 0 && STATE.lastTrailScrollX === 0) {
        STATE.lastTrailScrollX = STATE.hexScrollPosition - STATE.scrolledSinceLastTrailPointPx;
    }
    
    while (STATE.scrolledSinceLastTrailPointPx >= spacing) {
        // Advance the canonical scroll position by exactly one spacing
        STATE.lastTrailScrollX += spacing;
        
        // Compute frozen worldY at this moment - this never changes after being stored
        var frozenWorldY = STATE.ladderInitialized ? priceToWorldY(STATE.currentPrice) : 0;
        
        // Push trail point at the canonical position (strictly increasing)
        // Store BOTH price and frozen worldY - worldY is used for rendering, price for reference
        STATE.trailHistory.push({
            scrollX: STATE.lastTrailScrollX,
            price: STATE.currentPrice,
            worldY: frozenWorldY
        });
        
        STATE.scrolledSinceLastTrailPointPx -= spacing;
    }
    
    // Calculate how much trail to keep based on screen width
    // Trail goes from lineHeadX (center) to lineTailX (left edge)
    // Keep enough history to cover the visible trail area plus some buffer
    var trailWidthPx;
    if (isPortraitMode()) {
        trailWidthPx = (STATE.canvas.height / 2) - CONFIG.PADDING.top;
    } else {
        trailWidthPx = (STATE.canvas.width / 2) - CONFIG.PADDING.left;
    }
    var maxTrailDistance = trailWidthPx + spacing * 10; // Add buffer
    var cutoffScrollX = STATE.hexScrollPosition - maxTrailDistance;
    
    // Remove trail points that have scrolled off the left edge
    while (STATE.trailHistory.length > 0 && STATE.trailHistory[0].scrollX < cutoffScrollX) {
        STATE.trailHistory.shift();
    }
}

/**
 * Get price at a specific scroll position (interpolated from trail history)
 * @param {number} targetScrollX - The scroll position to get price for
 * @returns {number} - Interpolated price at that scroll position
 */
function getPriceAtScrollX(targetScrollX) {
    var history = STATE.trailHistory;
    
    if (history.length === 0) {
        return STATE.currentPrice;
    }
    if (history.length === 1) {
        return history[0].price;
    }
    
    // If target is before our oldest point, return oldest
    if (targetScrollX <= history[0].scrollX) {
        return history[0].price;
    }
    
    // If target is after our newest point, return current price
    if (targetScrollX >= history[history.length - 1].scrollX) {
        // Interpolate between last point and current position
        var lastPoint = history[history.length - 1];
        var currentScrollX = STATE.hexScrollPosition;
        if (currentScrollX > lastPoint.scrollX) {
            var t = (targetScrollX - lastPoint.scrollX) / (currentScrollX - lastPoint.scrollX);
            return lastPoint.price + (STATE.currentPrice - lastPoint.price) * t;
        }
        return STATE.currentPrice;
    }
    
    // Find surrounding samples and interpolate
    for (var i = 1; i < history.length; i++) {
        if (history[i].scrollX >= targetScrollX) {
            var prev = history[i - 1];
            var next = history[i];
            
            // Safety guard: skip zero-length segments to prevent division by zero / jitter
            if (next.scrollX === prev.scrollX) {
                // Skip forward to find a segment with different scrollX
                while (i + 1 < history.length && history[i + 1].scrollX === prev.scrollX) {
                    i++;
                }
                // If we've exhausted segments, return prev.price
                if (i + 1 >= history.length || history[i + 1].scrollX === prev.scrollX) {
                    return prev.price;
                }
                next = history[i + 1];
            }
            
            var t = (targetScrollX - prev.scrollX) / (next.scrollX - prev.scrollX);
            return prev.price + (next.price - prev.price) * t;
        }
    }
    
    return history[history.length - 1].price;
}

/**
 * Get FROZEN worldY at a specific scroll position (interpolated from trail history)
 * This uses the worldY values that were frozen at capture time - no recomputation
 * @param {number} targetScrollX - The scroll position to get worldY for
 * @returns {number} - Interpolated frozen worldY at that scroll position
 */
function getWorldYAtScrollX(targetScrollX) {
    var history = STATE.trailHistory;
    
    // If no history, compute current worldY
    if (history.length === 0) {
        return STATE.ladderInitialized ? priceToWorldY(STATE.currentPrice) : 0;
    }
    
    // If only one point, return its frozen worldY
    if (history.length === 1) {
        return history[0].worldY;
    }
    
    // If target is before our oldest point, return oldest frozen worldY
    if (targetScrollX <= history[0].scrollX) {
        return history[0].worldY;
    }
    
    // If target is after our newest point, interpolate to current
    if (targetScrollX >= history[history.length - 1].scrollX) {
        var lastPoint = history[history.length - 1];
        var currentScrollX = STATE.hexScrollPosition;
        var currentWorldY = STATE.ladderInitialized ? priceToWorldY(STATE.currentPrice) : 0;
        if (currentScrollX > lastPoint.scrollX) {
            var t = (targetScrollX - lastPoint.scrollX) / (currentScrollX - lastPoint.scrollX);
            return lastPoint.worldY + (currentWorldY - lastPoint.worldY) * t;
        }
        return currentWorldY;
    }
    
    // Find surrounding samples and interpolate frozen worldY values
    for (var i = 1; i < history.length; i++) {
        if (history[i].scrollX >= targetScrollX) {
            var prev = history[i - 1];
            var next = history[i];
            
            // Safety guard: skip zero-length segments
            if (next.scrollX === prev.scrollX) {
                while (i + 1 < history.length && history[i + 1].scrollX === prev.scrollX) {
                    i++;
                }
                if (i + 1 >= history.length || history[i + 1].scrollX === prev.scrollX) {
                    return prev.worldY;
                }
                next = history[i + 1];
            }
            
            var t = (targetScrollX - prev.scrollX) / (next.scrollX - prev.scrollX);
            return prev.worldY + (next.worldY - prev.worldY) * t;
        }
    }
    
    return history[history.length - 1].worldY;
}

/**
 * Get price at a specific time (interpolated)
 * @param {number} targetTime 
 * @returns {number}
 */
function getPriceAtTime(targetTime) {
    var history = STATE.priceHistory;
    
    if (history.length === 0) {
        return STATE.currentPrice;
    }
    if (history.length === 1) {
        return history[0].price;
    }
    
    // Find surrounding samples
    for (var i = 1; i < history.length; i++) {
        if (history[i].time >= targetTime) {
            var prev = history[i - 1];
            var next = history[i];
            var t = (targetTime - prev.time) / (next.time - prev.time);
            return prev.price + (next.price - prev.price) * t;
        }
    }
    
    return history[history.length - 1].price;
}

/**
 * ============================================================================
 * Initialize the FROZEN hex ladder on first real price
 * ============================================================================
 * 
 * This function runs ONCE and sets the permanent anchor values for the
 * infinite world labeling system. These values NEVER change after this:
 * 
 *   TICK_SIZE     - Price per row ($0.01)
 *   ANCHOR_PRICE  - Price at worldY = 0 (rounded first real price)
 *   ANCHOR_WORLD_Y - Always 0 (reference point in world space)
 *   PX_PER_TICK   - Pixels per row (size * sqrt(3))
 * 
 * After initialization:
 *   - Any hex at (col, row) has price = ANCHOR_PRICE + getWorldYForHex(col, row) / PX_PER_TICK * TICK_SIZE
 *   - This formula works for hexes arbitrarily far off-screen
 *   - The viewport can move freely without affecting labels
 * 
 * @param {number} realPrice - The first real price from websocket
 */
function initializeLadder(realPrice) {
    if (STATE.ladderInitialized) {
        return; // Already initialized, never recalculate
    }
    
    // ========================================================================
    // FROZEN TICK SIZE - Price granularity ($0.01 per row)
    // ========================================================================
    STATE.TICK_SIZE = 0.01;
    
    // ========================================================================
    // FROZEN ANCHOR PRICE - Reference price at worldY = 0
    // ========================================================================
    // Round to nearest tick for clean alignment
    STATE.ANCHOR_PRICE = Math.round(realPrice / STATE.TICK_SIZE) * STATE.TICK_SIZE;
    
    // ========================================================================
    // FROZEN WORLD GEOMETRY - Hex size and spacing in world space
    // ========================================================================
    // For flat-top hexes: row spacing = size * sqrt(3), col spacing = size * 1.5
    var size = Math.min(STATE.canvas.width, STATE.canvas.height) / CONFIG.HEX_SIZE_RATIO;
    var rowSpacing = size * Math.sqrt(3);
    var colSpacing = size * 1.5;
    
    STATE.WORLD_HEX_SIZE = size;       // Base hex size (center to corner) - FROZEN
    STATE.PX_PER_TICK = rowSpacing;    // Row spacing in world Y - FROZEN
    STATE.WORLD_COL_SPACING = colSpacing; // Column spacing in world X - FROZEN
    
    // ========================================================================
    // FROZEN ANCHOR_WORLD_Y - Reference point in world space (always 0)
    // ========================================================================
    STATE.ANCHOR_WORLD_Y = 0;
    
    // Initial camera position - this CAN change (viewport follows price)
    // But this only affects WHERE things are drawn, not WHAT labels they show
    STATE.viewportOffsetY = 0;
    
    STATE.ladderInitialized = true;
    console.log("Ladder initialized (FROZEN): ANCHOR_PRICE=" + STATE.ANCHOR_PRICE.toFixed(4) + 
                ", TICK_SIZE=" + STATE.TICK_SIZE.toFixed(4) +
                ", PX_PER_TICK=" + STATE.PX_PER_TICK.toFixed(2));
}

/**
 * Get the row spacing for the hex grid in WORLD space (pixels between row centers)
 * This is CONSTANT - zoom is applied only at render time via worldYToScreenY
 * @returns {number} - Row spacing in world pixels (never changes after init)
 */
function getHexRowSpacing() {
    // Return frozen world spacing - zoom is NOT applied here
    return STATE.PX_PER_TICK;
}

/**
 * Convert a world Y coordinate to a price
 * 
 * FROZEN FUNCTION: Uses only the immutable anchor values set during first price:
 *   - ANCHOR_PRICE: Reference price at ANCHOR_WORLD_Y
 *   - ANCHOR_WORLD_Y: Reference world Y (always 0)
 *   - PX_PER_TICK: Pixels per tick in world space
 *   - TICK_SIZE: Price per tick ($0.01)
 * 
 * Higher worldY (larger values) = higher price
 * This function works for ANY worldY value, even far off-screen.
 * 
 * @param {number} worldY - World Y coordinate (can be any value)
 * @returns {number} - Price at that world Y position (frozen, never changes)
 */
function worldYToPrice(worldY) {
    // ladderIndex = how many ticks away from anchor
    var ladderIndex = (worldY - STATE.ANCHOR_WORLD_Y) / STATE.PX_PER_TICK;
    // price = anchor price + ladder offset
    return STATE.ANCHOR_PRICE + ladderIndex * STATE.TICK_SIZE;
}

/**
 * Convert a price to a world Y coordinate
 * 
 * FROZEN FUNCTION: Inverse of worldYToPrice, uses same immutable anchor values.
 * This function works for ANY price value, even far outside visible range.
 * 
 * @param {number} price - Price value (can be any value)
 * @returns {number} - World Y coordinate for that price (frozen, never changes)
 */
function priceToWorldY(price) {
    // ladderIndex = how many ticks away from anchor price
    var ladderIndex = (price - STATE.ANCHOR_PRICE) / STATE.TICK_SIZE;
    // worldY = anchor world Y + ladder offset in pixels
    return STATE.ANCHOR_WORLD_Y + ladderIndex * STATE.PX_PER_TICK;
}

/**
 * Get the absolute ladder index for a given price
 * ladderIndex = (price - ANCHOR_PRICE) / TICK_SIZE
 * @param {number} price
 * @returns {number} - Integer ladder index (rounded)
 */
function priceToLadderIndex(price) {
    return Math.round((price - STATE.ANCHOR_PRICE) / STATE.TICK_SIZE);
}

/**
 * Get the absolute ladder index for a given price (float, not rounded)
 * Used for smooth line drawing so the line aligns exactly with hex grid
 * @param {number} price
 * @returns {number} - Float ladder index (NOT rounded)
 */
function priceToLadderIndexFloat(price) {
    return (price - STATE.ANCHOR_PRICE) / STATE.TICK_SIZE;
}

/**
 * Get price from absolute ladder index
 * price = ANCHOR_PRICE + ladderIndex * TICK_SIZE
 * @param {number} ladderIndex
 * @returns {number} - Price at that ladder position
 */
function ladderIndexToPrice(ladderIndex) {
    return STATE.ANCHOR_PRICE + ladderIndex * STATE.TICK_SIZE;
}

/**
 * Compute hex world center for flat-top hex grid
 * Uses offset coordinates (col, row) where odd columns are staggered
 * For flat-top hexes:
 *   worldX = size * 3/2 * col
 *   worldY = size * sqrt(3) * (row + (col % 2) * 0.5)
 * @param {number} col - Column in offset coordinates
 * @param {number} row - Row in offset coordinates  
 * @param {number} size - Hex size (center to corner)
 * @returns {{worldX: number, worldY: number}}
 */
function hexOffsetToWorld(col, row, size) {
    var isOddCol = Math.abs(col) % 2 === 1;
    var worldX = size * 1.5 * col;
    var worldY = size * Math.sqrt(3) * (row + (isOddCol ? 0.5 : 0));
    return { worldX: worldX, worldY: worldY };
}

/**
 * ============================================================================
 * INFINITE WORLD LABELING SYSTEM
 * ============================================================================
 * 
 * These functions define the PURE, FROZEN labeling math for the hex grid.
 * After ladderInitialized = true, these values NEVER change:
 *   - ANCHOR_PRICE: The price at worldY = 0 (ANCHOR_WORLD_Y)
 *   - TICK_SIZE: The price difference per row ($0.01)
 *   - PX_PER_TICK: Pixels per row in world space
 * 
 * CRITICAL INVARIANTS:
 * 1. Any hex at world coordinates (col, row) has a FIXED price computed as:
 *    priceAtHex(col, row) = ANCHOR_PRICE + getWorldYForHex(col, row) / PX_PER_TICK * TICK_SIZE
 * 
 * 2. This price is INDEPENDENT of:
 *    - Current viewport position (viewportOffsetY)
 *    - Current visible range (priceMin/priceMax)
 *    - Screen dimensions or scroll position
 * 
 * 3. The viewport only affects WHERE on screen a hex is drawn, not WHAT price it shows
 * ============================================================================
 */

/**
 * Get the world Y coordinate for a hex at absolute world coordinates (col, row)
 * This is a PURE function of (col, row) - no viewport or screen dependencies
 * 
 * @param {number} worldCol - Absolute column index (can be any integer, positive or negative)
 * @param {number} worldRow - Absolute row index (can be any integer, positive or negative)
 * @returns {number} - World Y coordinate
 */
function getWorldYForHex(worldCol, worldRow) {
    if (!STATE.ladderInitialized) {
        return 0;
    }
    var isOddCol = Math.abs(worldCol) % 2 === 1;
    // Row spacing equals PX_PER_TICK (both are size * sqrt(3))
    var rowSpacing = STATE.PX_PER_TICK;
    // World Y = row * rowSpacing + stagger for odd columns
    return rowSpacing * (worldRow + (isOddCol ? 0.5 : 0));
}

/**
 * Get the FROZEN price for a hex at absolute world coordinates (col, row)
 * This is the CANONICAL labeling function for the infinite world.
 * 
 * GUARANTEES:
 * - Returns the same price for the same (col, row) forever
 * - Works for hexes that have never been visible
 * - Uses only the frozen anchor values (ANCHOR_PRICE, TICK_SIZE, PX_PER_TICK)
 * 
 * @param {number} worldCol - Absolute column index
 * @param {number} worldRow - Absolute row index
 * @returns {number} - Fixed price label for this hex
 */
function getPriceForHex(worldCol, worldRow) {
    if (!STATE.ladderInitialized) {
        return CONFIG.DEFAULT_PRICE;
    }
    var worldY = getWorldYForHex(worldCol, worldRow);
    // Use the frozen worldYToPrice which depends only on ANCHOR values
    return worldYToPrice(worldY);
}

/**
 * Get the ladder index (tick offset from ANCHOR_PRICE) for a hex
 * 
 * @param {number} worldCol - Absolute column index
 * @param {number} worldRow - Absolute row index
 * @returns {number} - Ladder index (integer offset from anchor)
 */
function getLadderIndexForHex(worldCol, worldRow) {
    if (!STATE.ladderInitialized) {
        return 0;
    }
    var worldY = getWorldYForHex(worldCol, worldRow);
    return Math.round((worldY - STATE.ANCHOR_WORLD_Y) / STATE.PX_PER_TICK);
}

/**
 * Convert world coordinates to screen coordinates
 * Applies the camera/viewport offset
 * @param {number} worldX - World X position
 * @param {number} worldY - World Y position
 * @param {number} chartTop - Top of chart area
 * @param {number} chartHeight - Height of chart area
 * @returns {{screenX: number, screenY: number}}
 */
function worldToScreen(worldX, worldY, chartTop, chartHeight) {
    // X: world X is offset by horizontal scroll
    // hexScrollPosition moves hexes leftward, so screenX = worldX - scrollOffset
    // But we compute worldX relative to visible columns, so this is handled in drawHexagons
    
    // Y: chart center is at viewport center
    var chartCenterY = chartTop + chartHeight / 2;
    // World Y = 0 (ANCHOR_WORLD_Y) is at viewportOffsetY
    // Higher worldY (higher price) should be at smaller screenY (top of screen)
    var screenY = chartCenterY - (worldY - STATE.viewportOffsetY);
    return { screenX: worldX, screenY: screenY };
}

/**
 * Update the viewport offset to keep current price visible
 * Shifts the camera (viewportOffsetY in world pixels), NOT the board
 * @param {number} nowMs - Current time in milliseconds (performance.now())
 */
function updateViewportOffset(nowMs) {
    // If ladder not initialized or offline, don't update
    if (!STATE.ladderInitialized || !isDriftOnline(nowMs)) {
        return;
    }
    
    // Calculate visible range in world Y coordinates
    var height = STATE.canvas.height;
    var padding = CONFIG.PADDING;
    var chartHeight = height - padding.top - padding.bottom;
    
    // Half the visible height in world pixels
    var halfVisibleWorld = chartHeight / 2;
    
    // Current price world Y
    var currentPriceWorldY = priceToWorldY(STATE.currentPrice);
    
    // Visible world Y range (remember: higher price = higher worldY, but higher worldY = lower screenY)
    var minVisibleWorldY = STATE.viewportOffsetY - halfVisibleWorld;
    var maxVisibleWorldY = STATE.viewportOffsetY + halfVisibleWorld;
    
    // Margin in world pixels (20% of visible range)
    var margin = halfVisibleWorld * 0.4;
    
    if (currentPriceWorldY > maxVisibleWorldY - margin) {
        // Price went up (higher worldY), shift viewport up
        var shift = currentPriceWorldY - (maxVisibleWorldY - margin);
        STATE.viewportOffsetY += shift;
    } else if (currentPriceWorldY < minVisibleWorldY + margin) {
        // Price went down (lower worldY), shift viewport down
        var shift = (minVisibleWorldY + margin) - currentPriceWorldY;
        STATE.viewportOffsetY -= shift;
    }
}

/**
 * LEGACY: Update dynamic Y-axis range based on recent price history
 * NOW: Just updates priceMin/priceMax for chart line rendering only
 * Hex grid uses fixed ladder, NOT these values
 * @param {number} nowMs - Current time in milliseconds (performance.now())
 */
function updateDynamicRangeFromHistory(nowMs) {
    // Update viewport offset to keep current price in view
    updateViewportOffset(nowMs);
    
    // If offline or stale, do NOT recompute range - keep it frozen
    if (!isDriftOnline(nowMs)) {
        return;
    }
    
    var cutoffTime = nowMs - CONFIG.ZOOM_WINDOW_SECS * 1000;
    var windowPrices = [];
    
    // Collect prices from the zoom window (use full float precision)
    for (var i = 0; i < STATE.priceHistory.length; i++) {
        if (STATE.priceHistory[i].time >= cutoffTime) {
            windowPrices.push(STATE.priceHistory[i].price);
        }
    }
    
    // Also include current price to ensure we always have the latest
    windowPrices.push(STATE.currentPrice);
    
    var windowLow, windowHigh;
    
    // Fallback if fewer than ~10 points
    if (windowPrices.length < 10) {
        var minSpanFallback = STATE.currentPrice * CONFIG.ZOOM_MIN_SPAN_PCT;
        windowLow = STATE.currentPrice - minSpanFallback / 2;
        windowHigh = STATE.currentPrice + minSpanFallback / 2;
    } else {
        // Optional outlier trimming
        if (CONFIG.ZOOM_OUTLIER_TRIM > 0) {
            windowPrices.sort(function(a, b) { return a - b; });
            var trimCount = Math.floor(windowPrices.length * CONFIG.ZOOM_OUTLIER_TRIM);
            if (trimCount > 0 && windowPrices.length > trimCount * 2 + 2) {
                windowPrices = windowPrices.slice(trimCount, windowPrices.length - trimCount);
            }
        }
        
        // Find window low/high from full precision values
        windowLow = windowPrices[0];
        windowHigh = windowPrices[0];
        for (var j = 1; j < windowPrices.length; j++) {
            if (windowPrices[j] < windowLow) windowLow = windowPrices[j];
            if (windowPrices[j] > windowHigh) windowHigh = windowPrices[j];
        }
    }
    
    // Compute span with minimum
    var span = windowHigh - windowLow;
    var minSpanValue = STATE.currentPrice * CONFIG.ZOOM_MIN_SPAN_PCT;
    var absoluteMinSpan = 0.01; // Never go below $0.01 span
    var effectiveMinSpan = Math.max(minSpanValue, absoluteMinSpan);
    
    if (span < effectiveMinSpan) {
        var center = (windowLow + windowHigh) / 2;
        windowLow = center - effectiveMinSpan / 2;
        windowHigh = center + effectiveMinSpan / 2;
        span = effectiveMinSpan;
    }
    
    // Compute padding
    var pad = Math.max(span * CONFIG.ZOOM_PAD_FRAC, STATE.currentPrice * CONFIG.ZOOM_PAD_MIN_PCT);
    
    // Compute target range (full precision, no rounding)
    var wantMin = windowLow - pad;
    var wantMax = windowHigh + pad;
    
    // Ease toward target range (smooth animation)
    STATE.priceMin += (wantMin - STATE.priceMin) * CONFIG.ZOOM_EASE_ALPHA;
    STATE.priceMax += (wantMax - STATE.priceMax) * CONFIG.ZOOM_EASE_ALPHA;
    
    // Ensure priceMax > priceMin and enforce minimum absolute span
    var currentSpanCheck = STATE.priceMax - STATE.priceMin;
    var minAbsoluteSpan = Math.max(STATE.currentPrice * CONFIG.ZOOM_MIN_SPAN_PCT, 0.01);
    
    if (STATE.priceMax <= STATE.priceMin || currentSpanCheck < minAbsoluteSpan) {
        var midPoint = (STATE.priceMin + STATE.priceMax) / 2;
        if (!isFinite(midPoint)) midPoint = STATE.currentPrice;
        STATE.priceMin = midPoint - minAbsoluteSpan / 2;
        STATE.priceMax = midPoint + minAbsoluteSpan / 2;
    }
    
    // Optional: clamp if range becomes absurdly wide (more than 50% of current price)
    var maxAllowedSpan = STATE.currentPrice * 0.5;
    var currentSpan = STATE.priceMax - STATE.priceMin;
    if (currentSpan > maxAllowedSpan) {
        var midPointClamp = (STATE.priceMin + STATE.priceMax) / 2;
        STATE.priceMin = midPointClamp - maxAllowedSpan / 2;
        STATE.priceMax = midPointClamp + maxAllowedSpan / 2;
    }
}

/**
 * Convert price to Y position
 * @param {number} price 
 * @param {number} chartTop 
 * @param {number} chartHeight 
 * @returns {number}
 */
function priceToY(price, chartTop, chartHeight) {
    var normalized = (price - STATE.priceMin) / (STATE.priceMax - STATE.priceMin);
    return chartTop + chartHeight - (normalized * chartHeight);
}

/**
 * Convert Y position to price
 * @param {number} y 
 * @param {number} chartTop 
 * @param {number} chartHeight 
 * @returns {number}
 */
function yToPrice(y, chartTop, chartHeight) {
    var normalized = (chartTop + chartHeight - y) / chartHeight;
    return STATE.priceMin + normalized * (STATE.priceMax - STATE.priceMin);
}

// ============================================================================
// SECTION 7: HEX GRID ENGINE
// ============================================================================

/**
 * Draw flat-top hexagon
 */
function drawHexagonFlatTop(x, y, size, price, isHighlighted, isPassed, isPink, isHitByLine, isYellow) {
    var ctx = STATE.ctx;
    
    ctx.beginPath();
    for (var i = 0; i < 6; i++) {
        var angle = (Math.PI / 3) * i;
        var px = x + size * Math.cos(angle);
        var py = y + size * Math.sin(angle);
        if (i === 0) {
            ctx.moveTo(px, py);
        } else {
            ctx.lineTo(px, py);
        }
    }
    ctx.closePath();
    
    // Determine fill color - cyber theme
    if (isHitByLine) {
        ctx.fillStyle = "rgba(255, 215, 0, 1.0)";   // Bright gold for hit - very distinct!
    } else if (isYellow) {
        ctx.fillStyle = "rgba(255, 215, 0, 0.85)";  // Gold for AI bets
    } else if (isPink) {
        ctx.fillStyle = "rgba(139, 92, 246, 0.85)"; // Purple for user selection
    } else if (isPassed) {
        ctx.fillStyle = "rgba(30, 30, 40, 0.6)";    // Dark passed
    } else if (isHighlighted) {
        ctx.fillStyle = "rgba(0, 255, 204, 0.85)";  // Cyan highlight
    } else {
        ctx.fillStyle = "rgba(15, 15, 25, 0.5)";    // Dark glass default
    }
    ctx.fill();
    
    // Determine stroke colors - cyber theme
    var strokeColor, glowColor;
    if (isHitByLine) {
        strokeColor = "#FFFFFF";    // White border for hit - very distinct
        glowColor = "#FFD700";      // Gold glow
    } else if (isYellow) {
        strokeColor = "#FFD700";
        glowColor = "#FFD700";
    } else if (isPink) {
        strokeColor = "#A78BFA";
        glowColor = "#8B5CF6";
    } else if (isPassed) {
        strokeColor = "#333344";
        glowColor = "#222233";
    } else if (isHighlighted) {
        strokeColor = "#00FFCC";
        glowColor = "#00FFCC";
    } else {
        strokeColor = "#8B5CF6";
        glowColor = "#8B5CF6";
    }
    
    ctx.strokeStyle = strokeColor;
    // Hit hexagons get extra thick borders (5px) for visibility
    ctx.lineWidth = isHitByLine ? 5 : ((isHighlighted || isPink || isYellow) ? 3 : 1);
    ctx.shadowColor = glowColor;
    // Hit hexagons get extra strong glow (30) for visibility
    ctx.shadowBlur = isHitByLine ? 30 : ((isHighlighted || isPink || isYellow) ? 20 : (isPassed ? 0 : 5));
    ctx.stroke();
    ctx.shadowBlur = 0;
    
    // Price text - cyber theme
    // Hit hexagons get dark text on bright gold background
    if (isHitByLine) {
        ctx.fillStyle = "#000000";
    } else if (isYellow || isPink || isHighlighted) {
        ctx.fillStyle = "#000000";
    } else if (isPassed) {
        ctx.fillStyle = "#555566";
    } else {
        ctx.fillStyle = "#00FFCC";
    }
    
    // Hit hexagons get larger, bolder text for emphasis
    var fontSize = isHitByLine ? Math.max(12, size * 0.35) : Math.max(10, size * 0.28);
    var smallFontSize = fontSize * 0.7; // Smaller size for $ and integer part
    
    ctx.textBaseline = "middle";
    
    // Fixed 4 decimals for hex tile labels - ensures uniqueness and readability
    var formattedPrice = formatPrice(price, 4);
    var dotIndex = formattedPrice.indexOf(".");
    var integerPart = "$" + formattedPrice.substring(0, dotIndex);
    var decimalPart = formattedPrice.substring(dotIndex); // includes the dot and decimals
    
    // Measure widths for both parts to center them
    ctx.font = "bold " + smallFontSize + "px Orbitron";
    var intWidth = ctx.measureText(integerPart).width;
    ctx.font = "bold " + fontSize + "px Orbitron";
    var decWidth = ctx.measureText(decimalPart).width;
    var totalWidth = intWidth + decWidth;
    
    // Start position for centered text
    var startX = x - totalWidth / 2;
    
    // Draw integer part (smaller)
    ctx.font = "bold " + smallFontSize + "px Orbitron";
    ctx.textAlign = "left";
    ctx.fillText(integerPart, startX, y);
    
    // Draw decimal part (normal size)
    ctx.font = "bold " + fontSize + "px Orbitron";
    ctx.fillText(decimalPart, startX + intWidth, y);
}

/**
 * Draw pointy-top hexagon (portrait mode)
 */

/**
 * Draw dialog bubble with fade effect
 */
function drawDialogBubble(x, y, hexSize, name, timestamp, leverage) {
    var ctx = STATE.ctx;
    var currentTime = performance.now();
    var age = currentTime - timestamp;
    
    // Do not draw if older than duration + fade
    if (age > CONFIG.BUBBLE_DURATION + CONFIG.BUBBLE_FADE_DURATION) {
        return;
    }
    
    // Calculate opacity for fade effect
    var opacity = 1;
    if (age > CONFIG.BUBBLE_DURATION) {
        opacity = 1 - ((age - CONFIG.BUBBLE_DURATION) / CONFIG.BUBBLE_FADE_DURATION);
    }
    
    var text = name + " bet " + (leverage || 50) + "x!";
    ctx.font = "bold " + Math.max(9, hexSize * 0.22) + "px Orbitron";
    var textWidth = ctx.measureText(text).width;
    var bubbleWidth = textWidth + 16;
    var bubbleHeight = 20;
    var bubbleX = x - bubbleWidth / 2;
    var bubbleY = y - hexSize - bubbleHeight - 8;
    
    // Draw bubble background with opacity - cyber gold
    ctx.fillStyle = "rgba(255, 215, 0, " + (0.95 * opacity) + ")";
    ctx.beginPath();
    ctx.roundRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight, 6);
    ctx.fill();
    
    // Draw pointer triangle
    ctx.beginPath();
    ctx.moveTo(x - 6, bubbleY + bubbleHeight);
    ctx.lineTo(x + 6, bubbleY + bubbleHeight);
    ctx.lineTo(x, bubbleY + bubbleHeight + 8);
    ctx.closePath();
    ctx.fill();
    
    // Draw border with opacity
    ctx.strokeStyle = "rgba(255, 215, 0, " + opacity + ")";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight, 6);
    ctx.stroke();
    
    // Draw text with opacity
    ctx.fillStyle = "rgba(0, 0, 0, " + opacity + ")";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, bubbleY + bubbleHeight / 2);
}

/**
 * Convert world Y position to screen Y position
 * Applies manual pan offset additively and zoom scaling
 * In portrait mode: worldY maps to screenX (price = left/right)
 * In landscape mode: worldY maps to screenY (price = up/down)
 * @param {number} worldY - World Y coordinate (price axis)
 * @param {number} chartTop - Top of chart area
 * @param {number} chartHeight - Height of chart area
 * @returns {number} - Screen Y position (or screen X in portrait mode)
 */
function worldYToScreenY(worldY, chartTop, chartHeight) {
    var chartCenterY = chartTop + chartHeight / 2;
    // Higher worldY (higher price) = smaller screenY (top of screen)
    // Apply manual pan Y offset additively (manual pan Y shifts the view)
    var appliedViewportOffsetY = STATE.viewportOffsetY + STATE.manualPan.y;
    // Apply zoom scaling: scale the distance from viewport center
    var worldOffset = worldY - appliedViewportOffsetY;
    return chartCenterY - (worldOffset * STATE.zoom);
}

/**
 * Convert world Y (price) to screen X position for portrait mode
 * Higher prices go RIGHT on screen
 * @param {number} worldY - World Y coordinate (price axis)
 * @param {number} chartLeft - Left edge of chart area
 * @param {number} chartWidth - Width of chart area
 * @returns {number} - Screen X position
 */
function worldYToScreenXPortrait(worldY, chartLeft, chartWidth) {
    var chartCenterX = chartLeft + chartWidth / 2;
    var appliedViewportOffsetY = STATE.viewportOffsetY + STATE.manualPan.y;
    var worldOffset = worldY - appliedViewportOffsetY;
    // Higher price = higher worldY = MORE to the RIGHT (higher screenX)
    return chartCenterX + (worldOffset * STATE.zoom);
}

/**
 * Convert screen X to world Y (price) for portrait mode - inverse of worldYToScreenXPortrait
 * @param {number} screenX - Screen X position
 * @param {number} chartLeft - Left edge of chart area
 * @param {number} chartWidth - Width of chart area
 * @returns {number} - World Y coordinate
 */
function screenXToWorldYPortrait(screenX, chartLeft, chartWidth) {
    var chartCenterX = chartLeft + chartWidth / 2;
    var appliedViewportOffsetY = STATE.viewportOffsetY + STATE.manualPan.y;
    var screenOffset = screenX - chartCenterX;
    return appliedViewportOffsetY + (screenOffset / STATE.zoom);
}

/**
 * Convert screen Y position to world Y
 * Accounts for manual pan offset and zoom scaling
 * @param {number} screenY - Screen Y position
 * @param {number} chartTop - Top of chart area
 * @param {number} chartHeight - Height of chart area
 * @returns {number} - World Y coordinate
 */
function screenYToWorldY(screenY, chartTop, chartHeight) {
    var chartCenterY = chartTop + chartHeight / 2;
    var appliedViewportOffsetY = STATE.viewportOffsetY + STATE.manualPan.y;
    // Reverse zoom scaling: divide screen offset by zoom to get world offset
    var screenOffset = chartCenterY - screenY;
    return appliedViewportOffsetY + (screenOffset / STATE.zoom);
}

/**
 * Convert world X (time/scroll) to screen Y position for portrait mode
 * Time axis goes DOWN the screen (now = advancing downward)
 * @param {number} worldX - World X coordinate (time axis)
 * @param {number} lineHeadY - Screen Y position of "now"
 * @param {number} currentScrollX - Current scroll position
 * @returns {number} - Screen Y position
 */
function worldXToScreenYPortrait(worldX, lineHeadY, currentScrollX) {
    var worldOffset = worldX - currentScrollX;
    var timeScale = STATE.WORLD_COL_SPACING ? (STATE.PX_PER_TICK / STATE.WORLD_COL_SPACING) : 1;
    // Positive offset (future) = below lineHeadY (larger screenY)
    // Negative offset (past) = above lineHeadY (smaller screenY)
    return lineHeadY + (worldOffset * timeScale * STATE.zoom);
}

/**
 * Convert screen Y to world X (time) for portrait mode - inverse
 * @param {number} screenY - Screen Y position
 * @param {number} lineHeadY - Screen Y position of "now"
 * @param {number} currentScrollX - Current scroll position
 * @returns {number} - World X coordinate
 */
function screenYToWorldXPortrait(screenY, lineHeadY, currentScrollX) {
    var screenOffset = screenY - lineHeadY;
    var timeScale = STATE.WORLD_COL_SPACING ? (STATE.PX_PER_TICK / STATE.WORLD_COL_SPACING) : 1;
    return currentScrollX + (screenOffset / (timeScale * STATE.zoom));
}

/**
 * Convert ladder index + viewport offset to screen Y position (legacy helper)
 * @param {number} ladderIndex - The absolute ladder index (can be float)
 * @param {number} chartTop - Top of chart area
 * @param {number} chartHeight - Height of chart area
 * @param {number} rowSpacing - Vertical spacing between hex rows (unused, kept for compatibility)
 * @returns {number} - Screen Y position
 */
function ladderIndexToScreenY(ladderIndex, chartTop, chartHeight, rowSpacing) {
    // Convert ladder index to world Y, then to screen Y
    var worldY = STATE.ANCHOR_WORLD_Y + ladderIndex * STATE.PX_PER_TICK;
    return worldYToScreenY(worldY, chartTop, chartHeight);
}

/**
 * Convert screen Y position to ladder index
 * @param {number} y - Screen Y position
 * @param {number} chartTop - Top of chart area
 * @param {number} chartHeight - Height of chart area
 * @param {number} rowSpacing - Vertical spacing between hex rows (unused, kept for compatibility)
 * @returns {number} - Ladder index (absolute)
 */
function screenYToLadderIndex(y, chartTop, chartHeight, rowSpacing) {
    var worldY = screenYToWorldY(y, chartTop, chartHeight);
    var ladderIndex = (worldY - STATE.ANCHOR_WORLD_Y) / STATE.PX_PER_TICK;
    return Math.round(ladderIndex);
}

/**
 * Get the column spacing for the hex grid in WORLD space (pixels between column centers)
 * This is CONSTANT - zoom is applied only at render time
 * @returns {number} - Column spacing in world pixels (never changes after init)
 */
function getHexColSpacing() {
    // Return frozen world spacing - zoom is NOT applied here
    return STATE.WORLD_COL_SPACING;
}

/**
 * Convert world X position to screen X position
 * Applies zoom scaling centered on the screen center
 * @param {number} worldX - World X coordinate
 * @param {number} lineHeadX - The screen X position where "now" is rendered
 * @param {number} currentScrollX - Current scroll position
 * @returns {number} - Screen X position
 */
function worldXToScreenX(worldX, lineHeadX, currentScrollX) {
    // worldX is absolute world position, currentScrollX is the world X that maps to lineHeadX
    // The offset from "now" in world space:
    var worldOffset = worldX - currentScrollX;
    // Apply zoom scaling centered on lineHeadX
    return lineHeadX + (worldOffset * STATE.zoom);
}

/**
 * Convert screen X position to world X position
 * Inverse of worldXToScreenX
 * @param {number} screenX - Screen X coordinate
 * @param {number} lineHeadX - The screen X position where "now" is rendered
 * @param {number} currentScrollX - Current scroll position
 * @returns {number} - World X position
 */
function screenXToWorldX(screenX, lineHeadX, currentScrollX) {
    // Reverse zoom scaling
    var screenOffset = screenX - lineHeadX;
    return currentScrollX + (screenOffset / STATE.zoom);
}

/**
 * Draw hexagon grid - flows leftward continuously
 * FIXED LADDER: Hex prices are IMMUTABLE based on ladder index
 * Viewport offset moves the camera, not the hexes
 * 
 * WORLD vs VIEW separation:
 * - WORLD: hex coordinates (col, row), prices, bet mappings - NEVER change after init
 * - VIEW: zoom + pan transform applied when converting world to screen coordinates
 */
function drawHexagons(chartTop, chartHeight, lineHeadX) {
    var ctx = STATE.ctx;
    var width = STATE.canvas.width;
    var height = STATE.canvas.height;
    
    // ========================================================================
    // WORLD SPACE CONSTANTS (frozen, never change with zoom)
    // ========================================================================
    var worldHexSize = STATE.WORLD_HEX_SIZE;       // Hex size in world space
    var worldColSpacing = STATE.WORLD_COL_SPACING; // = worldHexSize * 1.5
    var worldRowSpacing = STATE.PX_PER_TICK;       // = worldHexSize * sqrt(3)
    
    // Screen hex size (for rendering and hit detection)
    var screenHexSize = worldHexSize * STATE.zoom;
    
    // ========================================================================
    // VIEWPORT CALCULATIONS (in WORLD coordinates)
    // ========================================================================
    // Calculate how many world columns/rows are potentially visible
    // Account for zoom: smaller zoom = more world space visible
    var visibleWorldWidth = width / STATE.zoom;
    var visibleWorldHeight = chartHeight / STATE.zoom;
    
    var cols = Math.ceil(visibleWorldWidth / worldColSpacing) + 8;
    var rows = Math.ceil(visibleWorldHeight / worldRowSpacing) + 8;
    
    // Current price world Y and screen Y
    var currentPriceWorldY = priceToWorldY(STATE.currentPrice);
    var currentPriceScreenY = worldYToScreenY(currentPriceWorldY, chartTop, chartHeight);
    
    // Clear hexagon data for this frame
    STATE.hexagonData = [];
    STATE.availableHexagonsForAI = [];
    
    // ========================================================================
    // WORLD COLUMN RANGE CALCULATION
    // ========================================================================
    // Calculate which world columns are visible
    // The "now" position (lineHeadX on screen) corresponds to hexScrollPosition in world X
    // manualPan.x shifts the view in WORLD coordinates
    var effectiveScrollX = STATE.hexScrollPosition - STATE.manualPan.x;
    
    // Convert screen edges to world X
    var worldXAtLeftEdge = screenXToWorldX(0, lineHeadX, effectiveScrollX);
    var worldXAtRightEdge = screenXToWorldX(width, lineHeadX, effectiveScrollX);
    
    // Convert to column indices
    var minWorldCol = Math.floor(worldXAtLeftEdge / worldColSpacing) - 2;
    var maxWorldCol = Math.ceil(worldXAtRightEdge / worldColSpacing) + 2;
    
    // ========================================================================
    // WORLD ROW RANGE CALCULATION
    // ========================================================================
    // Calculate which world rows are visible based on viewport
    var appliedViewportOffsetY = STATE.viewportOffsetY + STATE.manualPan.y;
    
    // Convert screen top/bottom to world Y (account for zoom)
    var worldYAtScreenTop = screenYToWorldY(chartTop, chartTop, chartHeight);
    var worldYAtScreenBottom = screenYToWorldY(chartTop + chartHeight, chartTop, chartHeight);
    
    // World Y increases upward, screen Y increases downward
    // So worldYAtScreenTop > worldYAtScreenBottom
    var minWorldY = worldYAtScreenBottom - worldRowSpacing * 2;
    var maxWorldY = worldYAtScreenTop + worldRowSpacing * 2;
    
    // Convert to row indices
    var minRow = Math.floor(minWorldY / worldRowSpacing) - 2;
    var maxRow = Math.ceil(maxWorldY / worldRowSpacing) + 2;
    
    // ========================================================================
    // RENDER HEXES
    // ========================================================================
    for (var worldCol = minWorldCol; worldCol <= maxWorldCol; worldCol++) {
        // Calculate world X for this column
        var hexWorldX = worldCol * worldColSpacing;
        
        // Convert to screen X using zoom transform
        var screenX = worldXToScreenX(hexWorldX, lineHeadX, effectiveScrollX);
        
        // Skip if off screen (with margin for hex size)
        if (screenX < -screenHexSize || screenX > width + screenHexSize) {
            continue;
        }
        
        var isOddCol = Math.abs(worldCol) % 2 === 1;
        
        for (var rowIdx = minRow; rowIdx <= maxRow; rowIdx++) {
            // ================================================================
            // INFINITE WORLD LABELING - Pure function of (worldCol, rowIdx)
            // ================================================================
            // Get world Y using the canonical infinite-world function
            // This uses ONLY the frozen anchor values (PX_PER_TICK) and the
            // absolute (worldCol, rowIdx) coordinates - NO screen dependencies
            var hexWorldY = getWorldYForHex(worldCol, rowIdx);
            
            // Convert world Y to screen Y for rendering (applies zoom)
            var screenY = worldYToScreenY(hexWorldY, chartTop, chartHeight);
            
            // Skip hexes outside visible screen area (rendering optimization only)
            if (screenY < chartTop - screenHexSize || screenY > chartTop + chartHeight + screenHexSize) {
                continue;
            }
            
            // ================================================================
            // FROZEN PRICE LABEL - Immutable for this hex forever
            // ================================================================
            // Uses getPriceForHex which depends ONLY on frozen anchor values
            // This price will be the same even if the hex was never visible before
            var hexPrice = getPriceForHex(worldCol, rowIdx);
            
            // Unique hex ID: worldCol + row (includes odd column stagger inherently)
            // Using row index that incorporates the column stagger
            var hexRowKey = isOddCol ? (rowIdx + "_odd") : (rowIdx + "_even");
            var hexId = worldCol + "_" + hexRowKey;
            
            // Note: Removed "current price" highlighting - it was too distracting
            // and made it hard to see which hexes are actually selected/triggered
            var screenColSpacing = worldColSpacing * STATE.zoom;
            var screenRowSpacing = worldRowSpacing * STATE.zoom;
            
            var isPink = STATE.pinkHexagons.has(hexId);
            var isPassed = screenX < lineHeadX - screenHexSize;
            
            // Check if line passes through this hexagon using GEOMETRIC proximity
            // Uses distance-based trail history that matches hex scroll speed
            var isHitByLine = false;
            if (isPink && isPassed) {
                var lineTailX = CONFIG.PADDING.left;
                var trailWidthPx = lineHeadX - lineTailX;
                var currentScrollX = STATE.hexScrollPosition;
                var tailScrollX = currentScrollX - trailWidthPx;
                
                var t = (screenX - lineTailX) / trailWidthPx;
                if (t >= 0 && t <= 1) {
                    // Map screen X to scroll position
                    var sampleScrollX = tailScrollX + t * trailWidthPx;
                    var priceAtX = getPriceAtScrollX(sampleScrollX);
                    // Convert price to screen Y at this X position
                    var lineWorldY = priceToWorldY(priceAtX);
                    var lineScreenY = worldYToScreenY(lineWorldY, chartTop, chartHeight);
                    
                    // Geometric distance check: is line point within hex radius?
                    var dy = Math.abs(lineScreenY - screenY);
                    // Use screen hex size for hit detection
                    if (dy < screenHexSize * 0.65) {
                        isHitByLine = true;
                        // Play ka-ching sound if this is a new hit
                        if (!STATE.hitHexagonsPlayed.has(hexId)) {
                            STATE.hitHexagonsPlayed.add(hexId);
                            playKaChingSound();
                            
                            // TRADING: Settle bet if this hex has an active bet
                            if (STATE.activeBets.has(hexId)) {
                                var bet = STATE.activeBets.get(hexId);
                                var payout = bet.amount * bet.leverage;
                                STATE.tradingBalance += payout;
                                STATE.activeBets.delete(hexId);
                                updateTradingSidebarUI();
                            }
                        }
                    }
                }
            }
            
            var yellowBet = STATE.yellowHexagons.get(hexId);
            var isYellow = yellowBet && !isPassed;
            
            STATE.hexagonData.push({
                x: screenX,
                y: screenY,
                size: screenHexSize,  // Store SCREEN size for click detection
                hexId: hexId,
                worldCol: worldCol,
                worldRow: rowIdx,
                worldY: hexWorldY,
                isPassed: isPassed,
                isPink: isPink,
                isYellow: isYellow,
                hexPrice: hexPrice  // Store fixed price for reference
            });
            
            if (screenX > lineHeadX + screenColSpacing && !isPassed) {
                STATE.availableHexagonsForAI.push({
                    x: screenX,
                    y: screenY,
                    size: screenHexSize,
                    hexId: hexId,
                    worldCol: worldCol,
                    worldY: hexWorldY
                });
            }
            
            drawHexagonFlatTop(screenX, screenY, screenHexSize, hexPrice, false, isPassed, isPink, isHitByLine, isYellow);
        }
    }
    
    // Draw dialog bubbles for yellow hexagons
    for (var j = 0; j < STATE.hexagonData.length; j++) {
        var hex = STATE.hexagonData[j];
        if (hex.isYellow) {
            var bet = STATE.yellowHexagons.get(hex.hexId);
            if (bet) {
                drawDialogBubble(hex.x, hex.y, hex.size, bet.name, bet.timestamp, bet.leverage);
            }
        }
    }
}

// ============================================================================
// SECTION 8: INTERACTION (CLICK HANDLER)
// ============================================================================

/**
 * Handle canvas clicks for hexagon selection
 * Bets are stored with absolute ladder indices for settlement fairness
 * Works in both landscape and portrait modes - hex positions are already
 * stored in screen coordinates in STATE.hexagonData
 */
function handleCanvasClick(e) {
    var rect = STATE.canvas.getBoundingClientRect();
    // Scale click coordinates from CSS visual space to canvas internal space
    // This accounts for the sidebar causing a mismatch between CSS width and canvas.width
    var scaleX = STATE.canvas.width / rect.width;
    var scaleY = STATE.canvas.height / rect.height;
    var clickX = (e.clientX - rect.left) * scaleX;
    var clickY = (e.clientY - rect.top) * scaleY;
    
    var closestHex = null;
    var closestDistance = Infinity;
    
    // hexagonData stores screen coordinates (already transformed for portrait/landscape)
    for (var i = 0; i < STATE.hexagonData.length; i++) {
        var hex = STATE.hexagonData[i];
        
        if (hex.isPassed) {
            continue;
        }
        
        var dx = clickX - hex.x;
        var dy = clickY - hex.y;
        var distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < hex.size * 0.95 && distance < closestDistance) {
            closestHex = hex;
            closestDistance = distance;
        }
    }
    
    if (closestHex && closestDistance < closestHex.size * 0.95) {
        // Store with hexId which now includes absolute ladder index
        // This ensures bets are valid regardless of zoom or drift
        if (STATE.yellowHexagons.has(closestHex.hexId)) {
            STATE.yellowHexagons.delete(closestHex.hexId);
            STATE.pinkHexagons.add(closestHex.hexId);
        } else if (STATE.pinkHexagons.has(closestHex.hexId)) {
            STATE.pinkHexagons.delete(closestHex.hexId);
            // Also remove any active bet if user un-selects
            STATE.activeBets.delete(closestHex.hexId);
            updateTradingSidebarUI();
        } else {
            // NEW: Place a bet when clicking a hex
            if (STATE.tradingBalance >= STATE.tradingBetAmount) {
                // Deduct bet amount from balance
                STATE.tradingBalance -= STATE.tradingBetAmount;
                // Record active bet with current leverage
                STATE.activeBets.set(closestHex.hexId, {
                    amount: STATE.tradingBetAmount,
                    leverage: STATE.tradingLeverage
                });
                STATE.pinkHexagons.add(closestHex.hexId);
                updateTradingSidebarUI();
            } else {
                // Show insufficient balance message
                showInsufficientBalance();
            }
        }
    }
}

/**
 * Update the trading sidebar UI elements
 */
function updateTradingSidebarUI() {
    var balanceEl = document.getElementById("trading-balance");
    var activeBetsEl = document.getElementById("active-bets-count");
    var betAmountEl = document.getElementById("bet-amount-display");
    
    if (balanceEl) {
        balanceEl.textContent = "$" + STATE.tradingBalance.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        // Change color based on balance
        if (STATE.tradingBalance >= 1000) {
            balanceEl.style.color = "#00FF88";
        } else if (STATE.tradingBalance >= 500) {
            balanceEl.style.color = "#FFD700";
        } else {
            balanceEl.style.color = "#FF5555";
        }
    }
    
    if (activeBetsEl) {
        activeBetsEl.textContent = STATE.activeBets.size;
    }
    
    if (betAmountEl) {
        betAmountEl.textContent = "$" + STATE.tradingBetAmount;
    }
}

/**
 * Show insufficient balance warning briefly
 */
function showInsufficientBalance() {
    var errorEl = document.getElementById("insufficient-balance");
    if (errorEl) {
        errorEl.style.display = "block";
        setTimeout(function() {
            errorEl.style.display = "none";
        }, 2000);
    }
}

/**
 * Initialize trading sidebar controls
 */
function initTradingSidebar() {
    var decreaseBtn = document.getElementById("bet-decrease");
    var increaseBtn = document.getElementById("bet-increase");
    var leverageBtns = document.querySelectorAll(".leverage-btn");
    
    if (decreaseBtn) {
        decreaseBtn.addEventListener("click", function() {
            if (STATE.tradingBetAmount > 1) {
                STATE.tradingBetAmount = Math.max(1, STATE.tradingBetAmount - 1);
                if (STATE.tradingBetAmount >= 10) {
                    STATE.tradingBetAmount = Math.floor(STATE.tradingBetAmount / 5) * 5;
                }
                updateTradingSidebarUI();
            }
        });
    }
    
    if (increaseBtn) {
        increaseBtn.addEventListener("click", function() {
            if (STATE.tradingBetAmount < 100) {
                if (STATE.tradingBetAmount >= 10) {
                    STATE.tradingBetAmount = Math.min(100, STATE.tradingBetAmount + 5);
                } else {
                    STATE.tradingBetAmount = Math.min(100, STATE.tradingBetAmount + 1);
                }
                updateTradingSidebarUI();
            }
        });
    }
    
    leverageBtns.forEach(function(btn) {
        btn.addEventListener("click", function() {
            leverageBtns.forEach(function(b) { b.classList.remove("active"); });
            btn.classList.add("active");
            STATE.tradingLeverage = parseInt(btn.getAttribute("data-leverage"), 10);
        });
    });
    
    // Initial UI update
    updateTradingSidebarUI();
}

/**
 * Handle two-finger touch start for viewport scrolling
 */
function handleTouchStart(e) {
    STATE.activeTouches = [];
    for (var i = 0; i < e.touches.length; i++) {
        STATE.activeTouches.push({
            id: e.touches[i].identifier,
            x: e.touches[i].clientX,
            y: e.touches[i].clientY
        });
    }
    
    if (e.touches.length === 2) {
        // Two fingers detected - prepare for viewport scroll
        STATE.isTwoFingerDragging = true;
        var avgY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        STATE.lastTwoFingerY = avgY;
        e.preventDefault(); // Prevent default scroll
    } else {
        STATE.isTwoFingerDragging = false;
    }
}

/**
 * Handle two-finger touch move for viewport scrolling
 */
function handleTouchMove(e) {
    if (!STATE.isTwoFingerDragging || e.touches.length !== 2) {
        return;
    }
    
    e.preventDefault(); // Prevent default scroll
    
    var avgY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    var deltaY = avgY - STATE.lastTwoFingerY;
    STATE.lastTwoFingerY = avgY;
    
    // Convert pixel delta to world Y delta
    // Dragging down (positive deltaY) should show lower prices (decrease viewportOffsetY)
    // Dragging up (negative deltaY) should show higher prices (increase viewportOffsetY)
    // Since screenY and worldY are inverted (higher worldY = lower screenY):
    // deltaY in screen space = -delta in world space
    STATE.viewportOffsetY -= deltaY;
}


/**
 * Handle touch end for viewport scrolling
 */
function handleTouchEnd(e) {
    if (e.touches.length < 2) {
        STATE.isTwoFingerDragging = false;
    }
    
    STATE.activeTouches = [];
    for (var i = 0; i < e.touches.length; i++) {
        STATE.activeTouches.push({
            id: e.touches[i].identifier,
            x: e.touches[i].clientX,
            y: e.touches[i].clientY
        });
    }
}

// ============================================================================
// SECTION 8B: MANUAL NAVIGATION (D-PAD CONTROLS)
// ============================================================================

/**
 * Move viewport up (show higher prices in landscape, scroll time in portrait)
 * Each press moves by exactly 1 WORLD row (visual size depends on zoom)
 */
function dpadUp() {
    var portrait = isPortraitMode();
    if (portrait) {
        // In portrait: up = scroll time backward (show older data)
        var worldColSpacing = STATE.WORLD_COL_SPACING;
        STATE.manualPan.x += worldColSpacing;
    } else {
        // In landscape: up = show higher prices
        var worldRowSpacing = STATE.PX_PER_TICK;
        STATE.manualPan.y += worldRowSpacing;
    }
    STATE.manualMode = true;
}

/**
 * Move viewport down (show lower prices in landscape, scroll time in portrait)
 * Each press moves by exactly 1 WORLD row (visual size depends on zoom)
 */
function dpadDown() {
    var portrait = isPortraitMode();
    if (portrait) {
        // In portrait: down = scroll time forward (show newer/future data)
        var worldColSpacing = STATE.WORLD_COL_SPACING;
        STATE.manualPan.x -= worldColSpacing;
    } else {
        // In landscape: down = show lower prices
        var worldRowSpacing = STATE.PX_PER_TICK;
        STATE.manualPan.y -= worldRowSpacing;
    }
    STATE.manualMode = true;
}

/**
 * Move viewport left (show older history in landscape, lower prices in portrait)
 * Each press moves by exactly 1 WORLD column (visual size depends on zoom)
 */
function dpadLeft() {
    var portrait = isPortraitMode();
    if (portrait) {
        // In portrait: left = show lower prices
        var worldRowSpacing = STATE.PX_PER_TICK;
        STATE.manualPan.y -= worldRowSpacing;
    } else {
        // In landscape: left = show older history
        var worldColSpacing = STATE.WORLD_COL_SPACING;
        STATE.manualPan.x += worldColSpacing;
    }
    STATE.manualMode = true;
}

/**
 * Move viewport right (show newer/future data in landscape, higher prices in portrait)
 * Each press moves by exactly 1 WORLD column (visual size depends on zoom)
 */
function dpadRight() {
    var portrait = isPortraitMode();
    if (portrait) {
        // In portrait: right = show higher prices
        var worldRowSpacing = STATE.PX_PER_TICK;
        STATE.manualPan.y += worldRowSpacing;
    } else {
        // In landscape: right = show newer/future data
        var worldColSpacing = STATE.WORLD_COL_SPACING;
        STATE.manualPan.x -= worldColSpacing;
    }
    STATE.manualMode = true;
}

/**
 * Zoom in (increase zoom level)
 */
function zoomIn() {
    STATE.zoom = clamp(STATE.zoom + 0.1, 0.75, 1.5);
}

/**
 * Zoom out (decrease zoom level)
 */
function zoomOut() {
    STATE.zoom = clamp(STATE.zoom - 0.1, 0.75, 1.5);
}

/**
 * Recenter viewport (return to auto-tracking mode)
 */
function recenterView() {
    STATE.manualPan.x = 0;
    STATE.manualPan.y = 0;
    STATE.manualMode = false;
    STATE.zoom = 1.0;
}

/**
 * Initialize D-pad control UI and event handlers
 */
function initDpadControls() {
    // Create D-pad container
    var dpadContainer = document.createElement("div");
    dpadContainer.id = "dpad-container";
    dpadContainer.innerHTML = [
        '<div class="dpad-grid">',
        '  <button class="dpad-btn dpad-up" data-dir="up">▲</button>',
        '  <button class="dpad-btn dpad-left" data-dir="left">◀</button>',
        '  <button class="dpad-btn dpad-center" data-dir="recenter">⊙</button>',
        '  <button class="dpad-btn dpad-right" data-dir="right">▶</button>',
        '  <button class="dpad-btn dpad-down" data-dir="down">▼</button>',
        '</div>',
        '<div class="zoom-controls">',
        '  <button class="zoom-btn zoom-in" data-zoom="in">+</button>',
        '  <button class="zoom-btn zoom-out" data-zoom="out">−</button>',
        '</div>'
    ].join("");
    
    document.body.appendChild(dpadContainer);
    
    // D-pad button handlers with press-and-hold repeat
    var repeatDelay = 250;  // Initial delay before repeat
    var repeatInterval = 120;  // Interval between repeats
    var repeatTimeoutId = null;
    var repeatIntervalId = null;
    
    function getActionForDir(dir) {
        switch(dir) {
            case "up": return dpadUp;
            case "down": return dpadDown;
            case "left": return dpadLeft;
            case "right": return dpadRight;
            case "recenter": return recenterView;
            default: return null;
        }
    }
    
    function getActionForZoom(zoom) {
        switch(zoom) {
            case "in": return zoomIn;
            case "out": return zoomOut;
            default: return null;
        }
    }
    
    function startRepeat(action) {
        if (!action) return;
        action();  // Immediate action on press
        resumeAudioContext();
        
        repeatTimeoutId = setTimeout(function() {
            repeatIntervalId = setInterval(action, repeatInterval);
        }, repeatDelay);
    }
    
    function stopRepeat() {
        if (repeatTimeoutId) {
            clearTimeout(repeatTimeoutId);
            repeatTimeoutId = null;
        }
        if (repeatIntervalId) {
            clearInterval(repeatIntervalId);
            repeatIntervalId = null;
        }
    }
    
    // Add event listeners for D-pad buttons
    var dpadBtns = dpadContainer.querySelectorAll(".dpad-btn");
    for (var i = 0; i < dpadBtns.length; i++) {
        (function(btn) {
            var dir = btn.getAttribute("data-dir");
            var action = getActionForDir(dir);
            
            btn.addEventListener("mousedown", function(e) {
                e.preventDefault();
                startRepeat(action);
            });
            btn.addEventListener("touchstart", function(e) {
                e.preventDefault();
                startRepeat(action);
            });
            btn.addEventListener("mouseup", stopRepeat);
            btn.addEventListener("mouseleave", stopRepeat);
            btn.addEventListener("touchend", stopRepeat);
            btn.addEventListener("touchcancel", stopRepeat);
        })(dpadBtns[i]);
    }
    
    // Add event listeners for zoom buttons
    var zoomBtns = dpadContainer.querySelectorAll(".zoom-btn");
    for (var j = 0; j < zoomBtns.length; j++) {
        (function(btn) {
            var zoom = btn.getAttribute("data-zoom");
            var action = getActionForZoom(zoom);
            
            btn.addEventListener("mousedown", function(e) {
                e.preventDefault();
                startRepeat(action);
            });
            btn.addEventListener("touchstart", function(e) {
                e.preventDefault();
                startRepeat(action);
            });
            btn.addEventListener("mouseup", stopRepeat);
            btn.addEventListener("mouseleave", stopRepeat);
            btn.addEventListener("touchend", stopRepeat);
            btn.addEventListener("touchcancel", stopRepeat);
        })(zoomBtns[j]);
    }
}

// ============================================================================
// SECTION 9: "OTHER USERS" SIMULATION (YELLOW BETS)
// ============================================================================

/**
 * Simulate other users clicking on hexagons
 */
function simulateUserClicks(timestamp) {
    if (timestamp >= STATE.nextUserClickTime && STATE.availableHexagonsForAI.length > 0) {
        var numClicks = Math.floor(Math.random() * 2) + 1;
        
        for (var i = 0; i < numClicks && STATE.availableHexagonsForAI.length > 0; i++) {
            var randomIndex = Math.floor(Math.random() * STATE.availableHexagonsForAI.length);
            var hex = STATE.availableHexagonsForAI[randomIndex];
            var randomName = CONFIG.USER_NAMES[Math.floor(Math.random() * CONFIG.USER_NAMES.length)];
            
            if (!STATE.yellowHexagons.has(hex.hexId) && !STATE.pinkHexagons.has(hex.hexId)) {
                var leverage = Math.floor(Math.random() * 99) + 2;
                STATE.yellowHexagons.set(hex.hexId, {
                    name: randomName,
                    timestamp: timestamp,
                    leverage: leverage
                });
            }
            
            STATE.availableHexagonsForAI.splice(randomIndex, 1);
        }
        
        var interval = CONFIG.USER_CLICK_MIN_INTERVAL + 
            Math.random() * (CONFIG.USER_CLICK_MAX_INTERVAL - CONFIG.USER_CLICK_MIN_INTERVAL);
        STATE.nextUserClickTime = timestamp + interval;
    }
    
    // Clean up old yellow hexagons that have passed
    var hexIdsToDelete = [];
    STATE.yellowHexagons.forEach(function(data, hexId) {
        for (var j = 0; j < STATE.hexagonData.length; j++) {
            var h = STATE.hexagonData[j];
            if (h.hexId === hexId && h.isPassed) {
                hexIdsToDelete.push(hexId);
                break;
            }
        }
    });
    
    for (var k = 0; k < hexIdsToDelete.length; k++) {
        STATE.yellowHexagons.delete(hexIdsToDelete[k]);
    }
}

// ============================================================================
// SECTION 10: RENDER LOOP
// ============================================================================

/**
 * Get display decimal places for grid labels (adaptive based on range)
 * @returns {number}
 */
function getGridLabelDecimals() {
    // Use same logic as tile decimals for consistency
    var rangeSpan = getCurrentRangeSpan();
    return getTileDecimals(rangeSpan);
}

/**
 * Draw grid lines
 * In portrait mode: price labels on horizontal axis (bottom), time on vertical
 */
function drawGridLines(chartTop, chartHeight) {
    var ctx = STATE.ctx;
    var width = STATE.canvas.width;
    var height = STATE.canvas.height;
    var padding = CONFIG.PADDING;
    var portrait = isPortraitMode();
    
    ctx.strokeStyle = "rgba(139, 92, 246, 0.15)";
    ctx.lineWidth = 1;
    
    // Get decimal places for grid labels
    var gridDecimals = getGridLabelDecimals();
    
    if (portrait) {
        // PORTRAIT: Price on X axis (vertical lines with labels at bottom)
        // Price increases LEFT to RIGHT
        for (var i = 0; i <= 8; i++) {
            var x = padding.left + ((width - padding.left - padding.right) / 8) * i;
            ctx.beginPath();
            ctx.moveTo(x, chartTop);
            ctx.lineTo(x, chartTop + chartHeight);
            ctx.stroke();
            
            // Price increases left to right
            var price = STATE.priceMin + ((STATE.priceMax - STATE.priceMin) / 8) * i;
            ctx.fillStyle = "#8a8a9a";
            ctx.font = "9px Orbitron";
            ctx.textAlign = "center";
            ctx.fillText("$" + price.toFixed(gridDecimals), x, chartTop + chartHeight + 12);
        }
        
        // Horizontal grid lines (time axis - no labels in portrait)
        for (var j = 0; j <= 8; j++) {
            var y = chartTop + (chartHeight / 8) * j;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();
        }
    } else {
        // LANDSCAPE: Original behavior - price on Y axis
        // Horizontal grid lines
        for (var i2 = 0; i2 <= 8; i2++) {
            var y2 = chartTop + (chartHeight / 8) * i2;
            ctx.beginPath();
            ctx.moveTo(0, y2);
            ctx.lineTo(width, y2);
            ctx.stroke();
            
            var price2 = STATE.priceMax - ((STATE.priceMax - STATE.priceMin) / 8) * i2;
            ctx.fillStyle = "#8a8a9a";
            ctx.font = "11px Orbitron";
            ctx.textAlign = "right";
            ctx.fillText("$" + price2.toFixed(gridDecimals), width - 10, y2 + 4);
        }
        
        // Vertical grid lines
        for (var j2 = 0; j2 <= 12; j2++) {
            var x2 = (width / 12) * j2;
            ctx.beginPath();
            ctx.moveTo(x2, chartTop);
            ctx.lineTo(x2, height - padding.bottom);
            ctx.stroke();
        }
    }
}

/**
 * Draw header info (coin name, price, change)
 */
function drawHeaderInfo() {
    var ctx = STATE.ctx;
    var nowMs = performance.now();
    
    ctx.fillStyle = "#8B5CF6";
    ctx.font = "bold 24px Orbitron";
    ctx.textAlign = "left";
    ctx.shadowColor = "#8B5CF6";
    ctx.shadowBlur = 15;
    ctx.fillText("SOL-PERP", 20, 40);
    
    // Draw OFFLINE indicator using the authoritative check
    if (!isOnline(nowMs)) {
        ctx.font = "bold 12px Orbitron";
        ctx.fillStyle = "#FF5555";
        ctx.shadowColor = "#FF5555";
        ctx.shadowBlur = 10;
        ctx.fillText("OFFLINE", 160, 40);
        ctx.shadowBlur = 15;
    }
    
    ctx.font = "bold 32px Orbitron";
    ctx.fillStyle = "#00FFCC";
    ctx.shadowColor = "#00FFCC";
    
    // Use adaptive decimals for header based on range volatility (4-6 decimals)
    var rangeSpan = getCurrentRangeSpan();
    var headerDecimals = getHeaderDecimals(rangeSpan);
    var displayPrice = formatPrice(STATE.currentPrice, headerDecimals);
    ctx.fillText("$" + displayPrice, 250, 40);
    
    // Use full precision floats for calculation, format only for display
    var oldPrice = STATE.priceHistory.length > 0 ? STATE.priceHistory[0].price : STATE.currentPrice;
    var changePercent = ((STATE.currentPrice - oldPrice) / oldPrice) * 100;
    var changeColor = changePercent >= 0 ? "#00FF88" : "#FF5555";
    ctx.fillStyle = changeColor;
    ctx.shadowColor = changeColor;
    ctx.font = "18px Orbitron";
    ctx.fillText(formatPercent(changePercent, 2) + "%", 480, 40);
    
    ctx.shadowBlur = 0;
}

/**
 * Draw offline overlay on chart area
 */
function drawOfflineOverlay(chartTop, chartHeight, lineTailX, lineHeadX) {
    var ctx = STATE.ctx;
    var width = STATE.canvas.width;
    
    // Semi-transparent dark overlay on chart area
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(lineTailX, chartTop, lineHeadX - lineTailX + 50, chartHeight);
    
    // Centered text
    ctx.font = "bold 18px Orbitron";
    ctx.fillStyle = "#FF5555";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#FF5555";
    ctx.shadowBlur = 15;
    
    var centerX = (lineTailX + lineHeadX) / 2;
    var centerY = chartTop + chartHeight / 2;
    
    ctx.fillText("DATA OFFLINE", centerX, centerY - 15);
    ctx.font = "12px Orbitron";
    ctx.fillStyle = "#CC4444";
    ctx.fillText("NO LIVE FEED", centerX, centerY + 15);
    
    ctx.shadowBlur = 0;
    ctx.textBaseline = "alphabetic";
}

/**
 * Draw price line (only when online)
 * Uses the SAME ladder coordinate system as the hex grid for perfect alignment.
 * Uses DISTANCE-BASED trail history that matches hex scroll speed.
 * @param {number} chartTop
 * @param {number} chartHeight
 * @param {number} lineHeadX
 * @param {number} lineTailX
 * @param {number} nowMs
 */
function drawPriceLine(chartTop, chartHeight, lineHeadX, lineTailX, nowMs) {
    var ctx = STATE.ctx;
    
    // If offline, do NOT draw the line - draw overlay instead
    if (!isOnline(nowMs)) {
        drawOfflineOverlay(chartTop, chartHeight, lineTailX, lineHeadX);
        return;
    }
    
    // Safety check: if current price is null/NaN, don't draw
    if (!isFinite(STATE.currentPrice) || STATE.currentPrice === null) {
        return;
    }
    
    // Calculate trail rendering based on SCROLL POSITION, not time
    // The trail width on screen is from lineTailX to lineHeadX
    var trailWidthPx = lineHeadX - lineTailX;
    // The scroll position at lineHeadX is always hexScrollPosition ("now")
    // manualPan.x shifts the screen position of "now" but not its scroll position
    var currentScrollX = STATE.hexScrollPosition;
    var tailScrollX = currentScrollX - trailWidthPx; // Scroll position at left edge of trail
    
    var segments = 100;
    
    ctx.strokeStyle = "#F5F5F0";  // Off-white line for better visibility
    ctx.lineWidth = 3;
    // No neon glow for better visibility
    ctx.beginPath();
    
    for (var i = 0; i <= segments; i++) {
        var t = i / segments;
        // Map t to scroll position: 0 = tailScrollX, 1 = currentScrollX
        var sampleScrollX = tailScrollX + t * trailWidthPx;
        // Use FROZEN worldY from trail history - not recomputed from price
        var worldY = getWorldYAtScrollX(sampleScrollX);
        var x = lineTailX + t * trailWidthPx;
        // Convert frozen worldY directly to screen Y
        var y = worldYToScreenY(worldY, chartTop, chartHeight);
        
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    
    ctx.stroke();
    
    // Gradient fill under line - subtle off-white glow
    var gradient = ctx.createLinearGradient(0, chartTop, 0, chartTop + chartHeight);
    gradient.addColorStop(0, "rgba(245, 245, 240, 0.10)");
    gradient.addColorStop(1, "rgba(245, 245, 240, 0)");
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(lineTailX, chartTop + chartHeight);
    
    for (var j = 0; j <= segments; j++) {
        var t2 = j / segments;
        var sampleScrollX2 = tailScrollX + t2 * trailWidthPx;
        // Use FROZEN worldY from trail history - not recomputed from price
        var worldY2 = getWorldYAtScrollX(sampleScrollX2);
        var x2 = lineTailX + t2 * trailWidthPx;
        // Convert frozen worldY directly to screen Y
        var y2 = worldYToScreenY(worldY2, chartTop, chartHeight);
        ctx.lineTo(x2, y2);
    }
    
    ctx.lineTo(lineHeadX, chartTop + chartHeight);
    ctx.closePath();
    ctx.fill();
    
    // Glowing dot at line head - bright off-white
    // For the head, use current live worldY (not frozen) so it follows live price
    var headWorldY = STATE.ladderInitialized ? priceToWorldY(STATE.currentPrice) : 0;
    var headY = worldYToScreenY(headWorldY, chartTop, chartHeight);
    ctx.beginPath();
    ctx.arc(lineHeadX, headY, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#F5F5F0";
    // No neon glow for better visibility
    ctx.fill();
}

/**
 * Draw candlestick strip to the left of the "now dot"
 * Candles scroll left at the same speed as the hex grid
 * Uses the same price->Y mapping as the hex grid for alignment
 * @param {number} chartTop - Top of chart area
 * @param {number} chartHeight - Height of chart area
 * @param {number} lineHeadX - X position of the "now dot"
 * @param {number} nowMs - Current timestamp
 */
function drawCandlesticks(chartTop, chartHeight, lineHeadX, nowMs) {
    var ctx = STATE.ctx;
    var candleWidth = CONFIG.CANDLE_WIDTH_PX;
    var candleGap = CONFIG.CANDLE_GAP_PX;
    var candleTotalWidth = candleWidth + candleGap;
    var wickWidth = CONFIG.CANDLE_WICK_WIDTH;
    
    // Get row spacing for ladder coordinate system (same as hex grid)
    var rowSpacing = getHexRowSpacing();
    // The scroll position at lineHeadX is always hexScrollPosition ("now")
    // manualPan.x shifts the screen position of "now" but not its scroll position
    var currentScrollX = STATE.hexScrollPosition;
    
    // Don't draw candles if offline - they shouldn't imply live updates
    // We still draw historical candles but no new ones form when offline
    
    // Colors matching the neon palette
    var bullishColor = "#00FFCC";     // Teal for bullish (close > open)
    var bearishColor = "#FF0044";     // Neon red for bearish (close < open)
    var neutralColor = "#8a8a9a";     // Gray for neutral (close == open)
    var bullishGlow = "rgba(0, 255, 204, 0.4)";
    var bearishGlow = "rgba(255, 0, 68, 0.5)";
    
    // Draw each finalized candle from history
    // Candles are positioned based on their scrollX when they closed
    // As hexScrollPosition increases, candles move left relative to lineHeadX
    
    for (var i = 0; i < STATE.candleHistory.length; i++) {
        var candle = STATE.candleHistory[i];
        
        // Calculate screen X position based on scroll offset
        // When candle was created, its scrollX was recorded
        // Current offset from lineHeadX = (currentScrollX - candle.scrollX)
        var scrollOffset = currentScrollX - candle.scrollX;
        var screenX = lineHeadX - scrollOffset;
        
        // Skip if candle is off-screen to the left
        if (screenX < CONFIG.PADDING.left - candleWidth) {
            continue;
        }
        
        // Skip if candle hasn't scrolled left of the dot yet
        if (screenX > lineHeadX - candleWidth) {
            continue;
        }
        
        // Convert FROZEN worldY values to screen Y - no recomputation from prices
        // This ensures candles stay perfectly still as viewport shifts
        var openY = worldYToScreenY(candle.openWorldY, chartTop, chartHeight);
        var closeY = worldYToScreenY(candle.closeWorldY, chartTop, chartHeight);
        var highY = worldYToScreenY(candle.highWorldY, chartTop, chartHeight);
        var lowY = worldYToScreenY(candle.lowWorldY, chartTop, chartHeight);
        
        // Determine candle color based on direction
        var isBullish = candle.close > candle.open;
        var isBearish = candle.close < candle.open;
        var candleColor = isBullish ? bullishColor : (isBearish ? bearishColor : neutralColor);
        var glowColor = isBullish ? bullishGlow : bearishGlow;
        
        // Body top and bottom (note: screen Y is inverted - higher price = lower Y)
        var bodyTop = Math.min(openY, closeY);
        var bodyBottom = Math.max(openY, closeY);
        var bodyHeight = Math.max(1, bodyBottom - bodyTop); // Minimum 1px height
        
        // No neon glow for candlesticks - better visibility
        
        // Draw wick (thin line from low to high)
        var wickX = screenX + candleWidth / 2;
        ctx.strokeStyle = candleColor;
        ctx.lineWidth = wickWidth;
        ctx.beginPath();
        ctx.moveTo(wickX, lowY);
        ctx.lineTo(wickX, highY);
        ctx.stroke();
        
        // Draw body (filled rectangle from open to close)
        ctx.fillStyle = candleColor;
        ctx.fillRect(screenX, bodyTop, candleWidth, bodyHeight);
        
        // Add a subtle border for better visibility
        ctx.strokeStyle = candleColor;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(screenX, bodyTop, candleWidth, bodyHeight);
    }
}

// ============================================================================
// SECTION 10B: PORTRAIT MODE DRAWING FUNCTIONS
// ============================================================================

/**
 * Draw hexagon grid in portrait mode
 * Time flows DOWNWARD (now-dot moves down), price is horizontal (right = higher)
 */
function drawHexagonsPortrait(chartTop, chartHeight, chartLeft, chartWidth, lineHeadY) {
    var ctx = STATE.ctx;
    var width = STATE.canvas.width;
    var height = STATE.canvas.height;
    
    var worldHexSize = STATE.WORLD_HEX_SIZE;
    var worldColSpacing = STATE.WORLD_COL_SPACING;
    var worldRowSpacing = STATE.PX_PER_TICK;
    var screenHexSize = worldHexSize * STATE.zoom;
    
    // Calculate visible world dimensions (inverted for portrait)
    var visibleWorldWidth = chartHeight / STATE.zoom;  // Time axis (vertical on screen)
    var visibleWorldHeight = chartWidth / STATE.zoom;  // Price axis (horizontal on screen)
    
    var cols = Math.ceil(visibleWorldWidth / worldColSpacing) + 8;
    var rows = Math.ceil(visibleWorldHeight / worldRowSpacing) + 8;
    
    var currentPriceWorldY = priceToWorldY(STATE.currentPrice);
    
    STATE.hexagonData = [];
    STATE.availableHexagonsForAI = [];
    
    // Calculate world column range (maps to screen Y in portrait)
    var effectiveScrollX = STATE.hexScrollPosition - STATE.manualPan.x;
    
    // lineHeadY is where scroll=hexScrollPosition maps to on screen
    // Top of screen (chartTop) maps to past, bottom to future
    var worldXAtTop = screenYToWorldXPortrait(chartTop, lineHeadY, effectiveScrollX);
    var worldXAtBottom = screenYToWorldXPortrait(chartTop + chartHeight, lineHeadY, effectiveScrollX);
    
    var minWorldCol = Math.floor(worldXAtTop / worldColSpacing) - 2;
    var maxWorldCol = Math.ceil(worldXAtBottom / worldColSpacing) + 2;
    
    // Calculate world row range (maps to screen X in portrait - price axis)
    var worldYAtLeft = screenXToWorldYPortrait(chartLeft, chartLeft, chartWidth);
    var worldYAtRight = screenXToWorldYPortrait(chartLeft + chartWidth, chartLeft, chartWidth);
    
    var minRow = Math.floor(Math.min(worldYAtLeft, worldYAtRight) / worldRowSpacing) - 2;
    var maxRow = Math.ceil(Math.max(worldYAtLeft, worldYAtRight) / worldRowSpacing) + 2;
    
    for (var worldCol = minWorldCol; worldCol <= maxWorldCol; worldCol++) {
        var hexWorldX = worldCol * worldColSpacing;
        // In portrait: world X (time) -> screen Y
        var screenY = worldXToScreenYPortrait(hexWorldX, lineHeadY, effectiveScrollX);
        
        if (screenY < chartTop - screenHexSize || screenY > chartTop + chartHeight + screenHexSize) {
            continue;
        }
        
        var isOddCol = Math.abs(worldCol) % 2 === 1;
        
        for (var rowIdx = minRow; rowIdx <= maxRow; rowIdx++) {
            var hexWorldY = getWorldYForHex(worldCol, rowIdx);
            // In portrait: world Y (price) -> screen X (right = higher price)
            var screenX = worldYToScreenXPortrait(hexWorldY, chartLeft, chartWidth);
            
            if (screenX < chartLeft - screenHexSize || screenX > chartLeft + chartWidth + screenHexSize) {
                continue;
            }
            
            var hexPrice = getPriceForHex(worldCol, rowIdx);
            var hexRowKey = isOddCol ? (rowIdx + "_odd") : (rowIdx + "_even");
            var hexId = worldCol + "_" + hexRowKey;
            
            var screenColSpacing = worldColSpacing * STATE.zoom;
            var isPink = STATE.pinkHexagons.has(hexId);
            // In portrait: "passed" means screenY < lineHeadY (above the now-dot)
            var isPassed = screenY < lineHeadY - screenHexSize;
            
            var isHitByLine = false;
            if (isPink && isPassed) {
                var lineTailY = CONFIG.PADDING.top;
                var trailHeightPx = lineHeadY - lineTailY;
                var currentScrollX = STATE.hexScrollPosition;
                var tailScrollX = currentScrollX - trailHeightPx;
                
                var t = (screenY - lineTailY) / trailHeightPx;
                if (t >= 0 && t <= 1) {
                    var sampleScrollX = tailScrollX + t * trailHeightPx;
                    var priceAtY = getPriceAtScrollX(sampleScrollX);
                    var lineWorldY = priceToWorldY(priceAtY);
                    var lineScreenX = worldYToScreenXPortrait(lineWorldY, chartLeft, chartWidth);
                    
                    var dx = Math.abs(lineScreenX - screenX);
                    if (dx < screenHexSize * 0.65) {
                        isHitByLine = true;
                        if (!STATE.hitHexagonsPlayed.has(hexId)) {
                            STATE.hitHexagonsPlayed.add(hexId);
                            playKaChingSound();
                            if (STATE.activeBets.has(hexId)) {
                                var bet = STATE.activeBets.get(hexId);
                                var payout = bet.amount * bet.leverage;
                                STATE.tradingBalance += payout;
                                STATE.activeBets.delete(hexId);
                                updateTradingSidebarUI();
                            }
                        }
                    }
                }
            }
            
            var yellowBet = STATE.yellowHexagons.get(hexId);
            var isYellow = yellowBet && !isPassed;
            
            STATE.hexagonData.push({
                x: screenX,
                y: screenY,
                size: screenHexSize,
                hexId: hexId,
                worldCol: worldCol,
                worldRow: rowIdx,
                worldY: hexWorldY,
                isPassed: isPassed,
                isPink: isPink,
                isYellow: isYellow,
                hexPrice: hexPrice
            });
            
            if (screenY > lineHeadY + screenColSpacing && !isPassed) {
                STATE.availableHexagonsForAI.push({
                    x: screenX,
                    y: screenY,
                    size: screenHexSize,
                    hexId: hexId,
                    worldCol: worldCol,
                    worldY: hexWorldY
                });
            }
            
            drawHexagonFlatTop(screenX, screenY, screenHexSize, hexPrice, false, isPassed, isPink, isHitByLine, isYellow);
        }
    }
    
    // Draw dialog bubbles
    for (var j = 0; j < STATE.hexagonData.length; j++) {
        var hex = STATE.hexagonData[j];
        if (hex.isYellow) {
            var bubbleBet = STATE.yellowHexagons.get(hex.hexId);
            if (bubbleBet) {
                drawDialogBubble(hex.x, hex.y, hex.size, bubbleBet.name, bubbleBet.timestamp, bubbleBet.leverage);
            }
        }
    }
}

/**
 * Draw price line in portrait mode
 * Line advances DOWNWARD, price movement is horizontal
 */
function drawPriceLinePortrait(chartTop, chartHeight, chartLeft, chartWidth, lineHeadY, lineTailY, nowMs) {
    var ctx = STATE.ctx;
    
    if (!isOnline(nowMs)) {
        drawOfflineOverlayPortrait(chartTop, chartHeight, chartLeft, chartWidth, lineTailY, lineHeadY);
        return;
    }
    
    if (!isFinite(STATE.currentPrice) || STATE.currentPrice === null) {
        return;
    }
    
    var trailHeightPx = lineHeadY - lineTailY;
    var effectiveScrollX = STATE.hexScrollPosition - STATE.manualPan.x;
    var tailWorldX = screenYToWorldXPortrait(lineTailY, lineHeadY, effectiveScrollX);
    var segments = 100;
    
    ctx.strokeStyle = "#F5F5F0";
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    for (var i = 0; i <= segments; i++) {
        var t = i / segments;
        var sampleWorldX = tailWorldX + t * (effectiveScrollX - tailWorldX);
        var worldY = getWorldYAtScrollX(sampleWorldX);
        // In portrait: Y on screen = time position, X on screen = price position
        var screenY = worldXToScreenYPortrait(sampleWorldX, lineHeadY, effectiveScrollX);
        var screenX = worldYToScreenXPortrait(worldY, chartLeft, chartWidth);
        
        if (i === 0) {
            ctx.moveTo(screenX, screenY);
        } else {
            ctx.lineTo(screenX, screenY);
        }
    }
    
    ctx.stroke();
    
    // Gradient fill to the LEFT of the line (lower prices)
    var gradient = ctx.createLinearGradient(chartLeft, 0, chartLeft + chartWidth, 0);
    gradient.addColorStop(0, "rgba(245, 245, 240, 0)");
    gradient.addColorStop(1, "rgba(245, 245, 240, 0.10)");
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(chartLeft, lineTailY);
    
    for (var j = 0; j <= segments; j++) {
        var t2 = j / segments;
        var sampleWorldX2 = tailWorldX + t2 * (effectiveScrollX - tailWorldX);
        var worldY2 = getWorldYAtScrollX(sampleWorldX2);
        var screenY2 = worldXToScreenYPortrait(sampleWorldX2, lineHeadY, effectiveScrollX);
        var screenX2 = worldYToScreenXPortrait(worldY2, chartLeft, chartWidth);
        ctx.lineTo(screenX2, screenY2);
    }
    
    ctx.lineTo(chartLeft, lineHeadY);
    ctx.closePath();
    ctx.fill();
    
    // Glowing dot at line head
    var headWorldY = STATE.ladderInitialized ? priceToWorldY(STATE.currentPrice) : 0;
    var headX = worldYToScreenXPortrait(headWorldY, chartLeft, chartWidth);
    ctx.beginPath();
    ctx.arc(headX, lineHeadY, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#F5F5F0";
    ctx.fill();
}

/**
 * Draw offline overlay in portrait mode
 */
function drawOfflineOverlayPortrait(chartTop, chartHeight, chartLeft, chartWidth, lineTailY, lineHeadY) {
    var ctx = STATE.ctx;
    
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(chartLeft, lineTailY, chartWidth, lineHeadY - lineTailY + 50);
    
    ctx.font = "bold 18px Orbitron";
    ctx.fillStyle = "#FF5555";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#FF5555";
    ctx.shadowBlur = 15;
    
    var centerX = chartLeft + chartWidth / 2;
    var centerY = (lineTailY + lineHeadY) / 2;
    
    ctx.fillText("DATA OFFLINE", centerX, centerY - 15);
    ctx.font = "12px Orbitron";
    ctx.fillStyle = "#CC4444";
    ctx.fillText("NO LIVE FEED", centerX, centerY + 15);
    
    ctx.shadowBlur = 0;
    ctx.textBaseline = "alphabetic";
}

/**
 * Draw candlesticks in portrait mode
 * Candles scroll UPWARD (past moves up), price is horizontal
 */
function drawCandlesticksPortrait(chartTop, chartHeight, chartLeft, chartWidth, lineHeadY, nowMs) {
    var ctx = STATE.ctx;
    var candleHeight = CONFIG.CANDLE_WIDTH_PX;  // In portrait, "width" becomes "height"
    var candleGap = CONFIG.CANDLE_GAP_PX;
    var wickWidth = CONFIG.CANDLE_WICK_WIDTH;
    
    var effectiveScrollX = STATE.hexScrollPosition - STATE.manualPan.x;
    
    var bullishColor = "#00FFCC";
    var bearishColor = "#FF0044";
    var neutralColor = "#8a8a9a";
    
    for (var i = 0; i < STATE.candleHistory.length; i++) {
        var candle = STATE.candleHistory[i];
        
        // In portrait: worldX (time) maps to screen Y
        var screenY = worldXToScreenYPortrait(candle.scrollX, lineHeadY, effectiveScrollX);
        
        if (screenY > lineHeadY - candleHeight) {
            continue;
        }
        
        if (screenY < chartTop - candleHeight) {
            continue;
        }
        
        // Convert worldY values to screen X positions
        var openX = worldYToScreenXPortrait(candle.openWorldY, chartLeft, chartWidth);
        var closeX = worldYToScreenXPortrait(candle.closeWorldY, chartLeft, chartWidth);
        var highX = worldYToScreenXPortrait(candle.highWorldY, chartLeft, chartWidth);
        var lowX = worldYToScreenXPortrait(candle.lowWorldY, chartLeft, chartWidth);
        
        var isBullish = candle.close > candle.open;
        var isBearish = candle.close < candle.open;
        var candleColor = isBullish ? bullishColor : (isBearish ? bearishColor : neutralColor);
        
        // Body left and right
        var bodyLeft = Math.min(openX, closeX);
        var bodyRight = Math.max(openX, closeX);
        var bodyWidth = Math.max(1, bodyRight - bodyLeft);
        
        // Draw wick (horizontal line from low to high)
        var wickY = screenY;
        ctx.strokeStyle = candleColor;
        ctx.lineWidth = wickWidth;
        ctx.beginPath();
        ctx.moveTo(lowX, wickY);
        ctx.lineTo(highX, wickY);
        ctx.stroke();
        
        // Draw body (filled rectangle)
        ctx.fillStyle = candleColor;
        ctx.fillRect(bodyLeft, screenY - candleHeight / 2, bodyWidth, candleHeight);
        
        ctx.strokeStyle = candleColor;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(bodyLeft, screenY - candleHeight / 2, bodyWidth, candleHeight);
    }
}

/**
 * Draw entire chart
 * In portrait mode, the chart axes are swapped:
 * - Time axis runs vertically (now-dot moves DOWN)
 * - Price axis runs horizontally (right = higher prices)
 */
function drawChart() {
    var ctx = STATE.ctx;
    var width = STATE.canvas.width;
    var height = STATE.canvas.height;
    var padding = CONFIG.PADDING;
    var portrait = isPortraitMode();
    
    var chartHeight = height - padding.top - padding.bottom;
    var chartTop = padding.top;
    var nowMs = performance.now();
    
    if (portrait) {
        // PORTRAIT MODE: Time axis is vertical (now-dot at lineHeadY, moves DOWN)
        // Price axis is horizontal (left = low, right = high)
        var chartWidth = width - padding.left - padding.right;
        var chartLeft = padding.left;
        // lineHeadY: the Y position of the "now" dot (center of screen + manual pan)
        var lineHeadY = height / 2 + STATE.manualPan.x; // Note: manualPan.x controls time axis
        var lineTailY = padding.top;
        
        drawGridLines(chartTop, chartHeight);
        drawHexagonsPortrait(chartTop, chartHeight, chartLeft, chartWidth, lineHeadY);
        drawHeaderInfo();
        drawPriceLinePortrait(chartTop, chartHeight, chartLeft, chartWidth, lineHeadY, lineTailY, nowMs);
        drawCandlesticksPortrait(chartTop, chartHeight, chartLeft, chartWidth, lineHeadY, nowMs);
    } else {
        // LANDSCAPE MODE: Original behavior
        // Apply manual pan X offset to shift the "now" position left/right
        var lineHeadX = width / 2 + STATE.manualPan.x;
        var lineTailX = padding.left;
        
        drawGridLines(chartTop, chartHeight);
        drawHexagons(chartTop, chartHeight, lineHeadX);
        drawHeaderInfo();
        drawPriceLine(chartTop, chartHeight, lineHeadX, lineTailX, nowMs);
        drawCandlesticks(chartTop, chartHeight, lineHeadX, nowMs);
    }
}

/**
 * Animation loop
 */
function animate(timestamp) {
    var width = STATE.canvas.width;
    var height = STATE.canvas.height;
    var ctx = STATE.ctx;
    
    // Calculate delta time for smooth scrolling
    var deltaTime = timestamp - STATE.lastFrameTime;
    STATE.lastFrameTime = timestamp;
    
    // Calculate scroll delta for this frame
    var scrollDelta = CONFIG.HEX_SCROLL_SPEED * (deltaTime / 1000);
    
    // Update hex scroll position (continuous, never resets)
    STATE.hexScrollPosition += scrollDelta;
    
    // Update distance-based trail history (matches hex scroll speed)
    updateTrailHistory(scrollDelta);
    
    // Clear canvas
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, width, height);
    
    // Draw logo as background (subtle, behind everything)
    drawLogoBackground();
    
    // Update price every SAMPLE_INTERVAL
    if (timestamp - STATE.lastPriceUpdate > CONFIG.SAMPLE_INTERVAL) {
        updatePrice();
        STATE.lastPriceUpdate = timestamp;
    }
    
    // Update dynamic Y-axis range EVERY FRAME before drawing
    // This ensures zoom continues to adjust over time and doesn't freeze
    updateDynamicRangeFromHistory(performance.now());

    // Update debug overlay summary each frame
    updateDebugOverlay();
    
    // Draw everything with slight transparency so logo shows through
    ctx.globalAlpha = 0.92;
    drawChart();
    ctx.globalAlpha = 1.0;
    
    // Simulate other users clicking
    simulateUserClicks(timestamp);
    
    requestAnimationFrame(animate);
}

// ============================================================================
// SECTION 11: STARTUP WIRING
// ============================================================================

/**
 * Initialize title flicker effect
 */
function initTitleFlicker() {
    var title = document.querySelector("#header h1");
    if (title) {
        setInterval(function() {
            if (Math.random() < 0.1) {
                title.style.opacity = "0.7";
                setTimeout(function() {
                    title.style.opacity = "1";
                }, 50);
            }
        }, 100);
    }
}

/**
 * Main boot function
 */
function boot() {
    // Check for desktop device first - show warning and exit if desktop
    if (checkDesktop()) {
        console.log("Desktop device detected - app is mobile-only");
        return;
    }
    
    // Initialize DOM
    initDOM();
    setLoadingOverlayVisible(true);

    // Initialize debug overlay early so it shows from the start
    initDebugOverlay();
    logDebug("Boot start");
    
    // Load logo image for background
    loadLogoImage();
    
    // Initialize price history
    initPriceHistory();
    
    // Initialize timing state
    var now = performance.now();
    STATE.lastFrameTime = now;
    STATE.nextUserClickTime = now + CONFIG.USER_CLICK_MIN_INTERVAL + Math.random() * 1000;
    
    // Initialize audio system
    initAudio();
    
    // Set up event listeners
    window.addEventListener("resize", checkOrientation);
    window.addEventListener("orientationchange", checkOrientation);
    STATE.canvas.addEventListener("click", function(e) {
        resumeAudioContext();
        handleCanvasClick(e);
    });
    
    // Two-finger touch events for viewport scrolling
    STATE.canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
    STATE.canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
    STATE.canvas.addEventListener("touchend", handleTouchEnd, { passive: false });
    STATE.canvas.addEventListener("touchcancel", handleTouchEnd, { passive: false });
    
    // Initial orientation check
    checkOrientation();
    
    // Initialize fullscreen button
    initFullscreenButton();
    
    // Initialize D-pad navigation controls
    initDpadControls();
    
    // Initialize trading sidebar
    initTradingSidebar();
    
    // Start Drift DLOB WebSocket feed
    startDriftOrderbookFeed();
    
    // Start on load
    window.addEventListener("load", function() {
        checkOrientation();
        STATE.lastFrameTime = performance.now();
        requestAnimationFrame(animate);
    });
    
    // Title flicker effect
    initTitleFlicker();
}

// ============================================================================
// BOOT WITH ERROR HANDLING
// ============================================================================

try {
    boot();
} catch (err) {
    showErrorOverlay(err.message, err.stack);
}
