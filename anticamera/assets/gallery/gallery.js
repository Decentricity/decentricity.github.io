export class Gallery {
    strip;
    exportButton;
    storage;
    items = [];
    retryListener = null;
    constructor(strip, exportButton, storage) {
        this.strip = strip;
        this.exportButton = exportButton;
        this.storage = storage;
        this.exportButton.addEventListener("click", () => this.exportJson());
        this.strip.addEventListener("click", (event) => {
            const target = event.target instanceof Element ? event.target.closest("[data-retry-job]") : null;
            if (target instanceof HTMLElement) {
                this.retryListener?.(target.dataset.retryJob ?? "");
            }
        });
    }
    async load() {
        this.items = (await this.storage.loadFrames()).map((frame) => ({ kind: "frame", frame }));
        this.render();
    }
    onRetry(listener) {
        this.retryListener = listener;
    }
    async add(frame) {
        this.items.unshift({ kind: "frame", frame });
        await this.storage.saveFrame(frame);
        this.render(frame.id);
    }
    addPlaceholder(placeholder) {
        this.items.unshift({ kind: "placeholder", placeholder });
        this.render(placeholder.id);
    }
    updatePlaceholder(id, patch) {
        const item = this.items.find((candidate) => candidate.kind === "placeholder" && candidate.placeholder.id === id);
        if (!item || item.kind !== "placeholder") {
            return;
        }
        item.placeholder = {
            ...item.placeholder,
            ...patch
        };
        this.render();
    }
    async completePlaceholder(frame) {
        const index = this.items.findIndex((item) => item.kind === "placeholder" && item.placeholder.id === frame.id);
        if (index === -1) {
            this.items.unshift({ kind: "frame", frame });
        }
        else {
            this.items[index] = { kind: "frame", frame };
        }
        this.render(frame.id);
        await this.storage.saveFrame(frame);
    }
    failPlaceholder(id, error) {
        this.updatePlaceholder(id, {
            status: "error",
            error
        });
    }
    frameOrder() {
        return this.items.map((item) => item.kind === "frame" ? item.frame.id : item.placeholder.id);
    }
    render(newId) {
        this.strip.replaceChildren();
        const frames = this.frames();
        this.exportButton.disabled = frames.length === 0;
        for (const item of this.items) {
            if (item.kind === "placeholder") {
                this.strip.append(this.renderPlaceholder(item.placeholder, newId));
            }
            else {
                this.strip.append(this.renderFrame(item.frame, newId));
            }
        }
    }
    renderFrame(frame, newId) {
        const item = document.createElement("li");
        item.className = `film-frame${frame.id === newId ? " new" : ""}`;
        item.title = `${frame.context.location.label} | ${frame.context.weather.description} | ${frame.context.audio.descriptor}`;
        const image = document.createElement("img");
        image.src = frame.imageDataUrl;
        image.alt = "Anti-Camera generated frame";
        image.loading = "lazy";
        const timestamp = document.createElement("time");
        timestamp.dateTime = frame.timestamp;
        timestamp.textContent = formatTimestamp(frame.timestamp);
        item.append(image, timestamp);
        return item;
    }
    renderPlaceholder(placeholder, newId) {
        const item = document.createElement("li");
        item.className = `film-frame film-frame-pending${placeholder.status === "error" ? " error" : ""}${placeholder.id === newId ? " new" : ""}`;
        item.title = placeholder.status === "error" ? placeholder.error ?? "Exposure failed" : "Developing";
        const panel = placeholder.status === "error" ? document.createElement("button") : document.createElement("div");
        panel.className = "film-placeholder";
        if (placeholder.status === "error") {
            panel.setAttribute("type", "button");
            panel.dataset.retryJob = placeholder.id;
            panel.setAttribute("aria-label", "Exposure failed. Tap to retry.");
            panel.textContent = "EXPOSURE FAILED\nTAP TO RETRY";
        }
        else {
            panel.textContent = "DEVELOPING";
        }
        const timestamp = document.createElement("time");
        timestamp.dateTime = placeholder.timestamp;
        timestamp.textContent = formatTimestamp(placeholder.timestamp);
        item.append(panel, timestamp);
        return item;
    }
    exportJson() {
        const blob = this.storage.exportMetadata(this.frames());
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `anti-camera-metadata-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.append(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }
    frames() {
        return this.items.flatMap((item) => item.kind === "frame" ? [item.frame] : []);
    }
}
function formatTimestamp(timestamp) {
    return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    }).format(new Date(timestamp));
}
