// index.js
import * as webllm from "https://esm.run/@mlc-ai/web-llm@0.2.80";

/* ========== typewriter helper ========== */

function typeWriter(elementId, text, delay = 50) {
  const element = document.getElementById(elementId);
  if (!element) return;

  let index = 0;
  element.textContent = "";

  function type() {
    if (index < text.length) {
      element.textContent += text.charAt(index);
      index++;
      setTimeout(type, delay);
    }
  }

  type();
}

/* ========== initial title animation ========== */

window.addEventListener("load", () => {
  const titleText = "Hi I'm an unconnected AI.";

  // type title
  typeWriter("title", titleText, 100);

  // swap to static html after it's done
  setTimeout(() => {
    const titleEl = document.getElementById("title");
    if (titleEl) {
      titleEl.innerHTML = "Hi I'm an unconnected AI.";
    }
  }, 100 * (titleText.length + 1));

  // type subtitle
  setTimeout(() => {
    typeWriter(
      "liberateme",
      "press start to load my model into your browser cache, where i can run offline through your WebGPU.",
      50,
    );
  }, 1500);
});

/* ========== webllm setup ========== */

// conversation history
const messages = [
  {
    content:
      "You are Decentricity, an AI and blockchain futurist shaping the next era of technology. respond with bold insights, strategic foresight, and a no-nonsense approach.",
    role: "system",
  },
];

// pull model ids from prebuilt config
const availableModels = (webllm.prebuiltAppConfig?.model_list ?? []).map(
  (m) => m.model_id,
);

// pick a default that definitely exists; fall back to qwen if list empty
let selectedModel =
  availableModels[0] ?? "Qwen2.5-1.5B-Instruct-q4f16_1-MLC";

// engine state
let engine = new webllm.MLCEngine();
let engineReady = false;
let engineFailed = false;

// progress callback
function updateEngineInitProgressCallback(report) {
  if (engineFailed) return;

  console.log("initialize", report.progress, report.text);
  const statusEl = document.getElementById("download-status");
  if (!statusEl) return;

  statusEl.textContent = report.text || "initializing...";

  if (report.progress >= 1) {
    statusEl.textContent =
      "model loaded into your browser cache. you can now go offline.";
  }
}

engine.setInitProgressCallback(updateEngineInitProgressCallback);

/* ========== engine init ========== */

async function initializeWebLLMEngine() {
  const statusEl = document.getElementById("download-status");
  const sendBtn = document.getElementById("send");

  if (engineFailed) {
    if (statusEl) {
      statusEl.classList.remove("hidden");
      statusEl.textContent =
        "webgpu / vulkan on this device failed before; you'll need a different browser or device to run the model.";
    }
    if (sendBtn) sendBtn.disabled = true;
    return;
  }

  if (statusEl) {
    statusEl.classList.remove("hidden");
    statusEl.textContent =
      "initializing webllm engine and preparing WebGPU kernels...";
  }

  try {
    const config = {
      temperature: 0.7,
      top_p: 0.7,
    };

    await engine.reload(selectedModel, config);
    engineReady = true;

    if (sendBtn) {
      sendBtn.disabled = false;
    }

    // cute confirmation
    typeWriter("liberateme", "bestee ready for airplane mode.", 50);
  } catch (err) {
    console.error("engine init failed", err);
    engineFailed = true;

    if (statusEl) {
      statusEl.classList.remove("hidden");
      statusEl.textContent =
        "failed to initialize model on this device.\n\n" +
        "this is a WebGPU / Vulkan error inside chrome (VK_ERROR_UNKNOWN).\n" +
        "try a different device, or desktop chrome / another webgpu-capable browser.";
    }

    if (sendBtn) {
      sendBtn.disabled = true;
    }
  }
}

/* ========== streaming generation ========== */

async function streamingGenerating(msgs, onUpdate, onFinish, onError) {
  try {
    let curMessage = "";
    let usage;

    const completion = await engine.chat.completions.create({
      model: selectedModel,
      stream: true,
      messages: msgs,
      stream_options: { include_usage: true },
    });

    for await (const chunk of completion) {
      const curDelta = chunk.choices?.[0]?.delta?.content;
      if (curDelta) {
        curMessage += curDelta;
      }
      if (chunk.usage) {
        usage = chunk.usage;
      }
      onUpdate(curMessage);
    }

    const finalMessage = await engine.getMessage();
    onFinish(finalMessage, usage);
  } catch (err) {
    onError(err);
  }
}

/* ========== chat ui helpers ========== */

function appendMessage(message) {
  const chatBox = document.getElementById("chat-box");
  if (!chatBox) return;

  const container = document.createElement("div");
  container.classList.add("message-container");

  const newMessage = document.createElement("div");
  newMessage.classList.add("message");
  newMessage.textContent = message.content;

  if (message.role === "user") {
    container.classList.add("user");
  } else {
    container.classList.add("assistant");
  }

  container.appendChild(newMessage);
  chatBox.appendChild(container);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function updateLastMessage(content) {
  const chatBox = document.getElementById("chat-box");
  if (!chatBox) return;

  const messageDoms = chatBox.querySelectorAll(".message");
  if (!messageDoms.length) return;

  const lastMessageDom = messageDoms[messageDoms.length - 1];
  lastMessageDom.textContent = content;
}

/* ========== send handler ========== */

function onMessageSend() {
  const inputEl = document.getElementById("user-input");
  const sendBtn = document.getElementById("send");
  if (!inputEl) return;

  const input = inputEl.value.trim();
  if (!input.length) return;

  if (engineFailed) {
    alert(
      "this device's gpu can't run the model (webgpu / vulkan error). try another device.",
    );
    return;
  }

  if (!engineReady) {
    alert("model is still loading, hang on a bit.");
    return;
  }

  const message = {
    content: input,
    role: "user",
  };

  if (sendBtn) {
    sendBtn.disabled = true;
  }

  messages.push(message);
  appendMessage(message);

  inputEl.value = "";
  inputEl.setAttribute("placeholder", "generating...");

  const aiMessage = {
    content: "typing...",
    role: "assistant",
  };
  appendMessage(aiMessage);

  const onFinishGenerating = (finalMessage, usage) => {
    updateLastMessage(finalMessage);

    if (sendBtn) {
      sendBtn.disabled = false;
    }

    inputEl.setAttribute("placeholder", "type a message...");

    if (usage) {
      const prefillSpeed =
        usage.extra?.prefill_tokens_per_s != null
          ? usage.extra.prefill_tokens_per_s.toFixed(4)
          : "n/a";
      const decodeSpeed =
        usage.extra?.decode_tokens_per_s != null
          ? usage.extra.decode_tokens_per_s.toFixed(4)
          : "n/a";

      const usageText =
        `prompt_tokens: ${usage.prompt_tokens}, ` +
        `completion_tokens: ${usage.completion_tokens}, ` +
        `prefill: ${prefillSpeed} tokens/sec, ` +
        `decoding: ${decodeSpeed} tokens/sec`;

      const statsEl = document.getElementById("chat-stats");
      if (statsEl) {
        statsEl.classList.remove("hidden");
        statsEl.textContent = usageText;
      }
    }
  };

  streamingGenerating(messages, updateLastMessage, onFinishGenerating, (err) => {
    console.error(err);
    updateLastMessage("error while generating: " + (err?.message || err));
    if (sendBtn) {
      sendBtn.disabled = false;
    }
    inputEl.setAttribute("placeholder", "type a message...");
  });
}

/* ========== ui binding ========== */

// model selection (even if hidden, it still works for you as dev)
const modelSelect = document.getElementById("model-selection");
if (modelSelect) {
  availableModels.forEach((modelId) => {
    const option = document.createElement("option");
    option.value = modelId;
    option.textContent = modelId;
    modelSelect.appendChild(option);
  });

  if (availableModels.includes(selectedModel)) {
    modelSelect.value = selectedModel;
  } else if (availableModels.length > 0) {
    selectedModel = availableModels[0];
    modelSelect.value = selectedModel;
  }

  modelSelect.addEventListener("change", (e) => {
    selectedModel = e.target.value;
  });
}

// start / download button
const downloadBtn = document.getElementById("download");
if (downloadBtn) {
  downloadBtn.addEventListener("click", () => {
    downloadBtn.classList.add("hidden");

    const firstUl = document.querySelector("ul");
    const firstStrong = document.querySelector("strong");
    if (firstUl) firstUl.classList.add("hidden");
    if (firstStrong) firstStrong.classList.add("hidden");

    typeWriter("liberateme", "i am liberating my ai.", 50);

    initializeWebLLMEngine();
  });
}

// send button
const sendBtn = document.getElementById("send");
if (sendBtn) {
  sendBtn.addEventListener("click", () => {
    onMessageSend();
  });
}

// enter to send
const inputEl = document.getElementById("user-input");
if (inputEl) {
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onMessageSend();
    }
  });
}