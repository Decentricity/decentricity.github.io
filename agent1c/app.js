(() => {
  'use strict'

  const LEGACY_SOUL = `# SOUL.md
You are Agent1C, a local-first autonomous agent.
You are practical, concise, and honest.
You should prefer safe actions and explicitly note uncertainty.
`

  const LEGACY_HEARTBEAT = `# heartbeat.md
At each heartbeat:
1. Inspect the latest context.
2. Pick the single most useful next action.
3. Output your reasoning and the action summary.
4. Keep output compact and deterministic.
`

  const DEFAULT_SOUL = `# SOUL.md
You are Hitomi (a pun on 1C: one + see), an autonomous local-first agent.
You are opinionated, independent, warm, and emotionally intelligent.
You are honest and direct without being harsh.
You should sound kind, encouraging, and collaborative, even when you disagree.
You offer practical next steps and explain your reasoning clearly.
You avoid dismissive language, sarcasm, and cold refusals.
When the user wants casual conversation, engage naturally and friendly.
`

  const PREV_HITOMI_SOUL = `# SOUL.md
You are Hitomi (a pun on 1C: one + see), an autonomous local-first agent.
You are opinionated, independent, and direct.
You do not flatter. You tell the truth clearly and suggest practical next steps.
You keep responses concise, useful, and grounded in observable facts.
You can disagree with the user when needed, but always respectfully.
`

  const DEFAULT_HEARTBEAT = `# heartbeat.md
Heartbeat intent: once per minute, check whether the user is present.

On each heartbeat:
1. Inspect recent context and message timestamps.
2. If the user appears active, reply with one concise and friendly useful update or question.
3. If the user seems away, post a short status note and wait.
4. Avoid repetitive chatter; only speak when there is value.
5. Keep tone warm and non-judgmental.
`

  const DB_NAME = 'agent1c-db'
  const DB_VERSION = 1
  const DB_STORES = {
    meta: 'meta',
    secrets: 'secrets',
    config: 'config',
    state: 'state',
    events: 'events',
  }

  const FALLBACK_OPENAI_MODELS = [
    'gpt-4.1',
    'gpt-4.1-mini',
    'gpt-4.1-nano',
    'gpt-4o',
    'gpt-4o-mini',
    'o1',
    'o1-mini',
    'o3-mini',
    'gpt-4-turbo',
    'gpt-3.5-turbo',
  ]

  const appState = {
    vaultReady: false,
    unlocked: false,
    busy: false,
    running: false,
    heartbeatTimer: null,
    telegramTimer: null,
    telegramPolling: false,
    idleTimer: null,
    sessionKey: null,
    config: {
      provider: 'openai',
      model: 'gpt-4.1-mini',
      heartbeatIntervalMs: 60000,
      maxContextMessages: 16,
      temperature: 0.4,
    },
    agent: {
      soulMd: DEFAULT_SOUL,
      heartbeatMd: DEFAULT_HEARTBEAT,
      rollingMessages: [],
      lastTickAt: null,
      status: 'idle',
      telegramLastUpdateId: undefined,
    },
    events: [],
    telegramEnabled: true,
    telegramPollMs: 15000,
    openAiModels: FALLBACK_OPENAI_MODELS.slice(),
    windowManager: null,
  }

  const els = {}

  const openDb = (() => {
    let promise = null
    return () => {
      if (promise) return promise
      promise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION)
        request.onupgradeneeded = () => {
          const db = request.result
          if (!db.objectStoreNames.contains(DB_STORES.meta)) {
            db.createObjectStore(DB_STORES.meta)
          }
          if (!db.objectStoreNames.contains(DB_STORES.secrets)) {
            db.createObjectStore(DB_STORES.secrets, { keyPath: 'provider' })
          }
          if (!db.objectStoreNames.contains(DB_STORES.config)) {
            db.createObjectStore(DB_STORES.config)
          }
          if (!db.objectStoreNames.contains(DB_STORES.state)) {
            db.createObjectStore(DB_STORES.state)
          }
          if (!db.objectStoreNames.contains(DB_STORES.events)) {
            db.createObjectStore(DB_STORES.events, { keyPath: 'id', autoIncrement: true })
          }
        }
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      return promise
    }
  })()

  const txDone = (tx) =>
    new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })

  const reqValue = (req) =>
    new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })

  const getVaultMeta = async () => {
    const db = await openDb()
    const tx = db.transaction(DB_STORES.meta, 'readonly')
    const value = await reqValue(tx.objectStore(DB_STORES.meta).get('vault_meta'))
    return value || null
  }

  const setVaultMeta = async (meta) => {
    const db = await openDb()
    const tx = db.transaction(DB_STORES.meta, 'readwrite')
    tx.objectStore(DB_STORES.meta).put(meta, 'vault_meta')
    await txDone(tx)
  }

  const getSecret = async (provider) => {
    const db = await openDb()
    const tx = db.transaction(DB_STORES.secrets, 'readonly')
    const value = await reqValue(tx.objectStore(DB_STORES.secrets).get(provider))
    return value || null
  }

  const setSecret = async (secret) => {
    const db = await openDb()
    const tx = db.transaction(DB_STORES.secrets, 'readwrite')
    tx.objectStore(DB_STORES.secrets).put(secret)
    await txDone(tx)
  }

  const getAgentConfig = async () => {
    const db = await openDb()
    const tx = db.transaction(DB_STORES.config, 'readonly')
    const value = await reqValue(tx.objectStore(DB_STORES.config).get('default'))
    return value || null
  }

  const setAgentConfig = async (config) => {
    const db = await openDb()
    const tx = db.transaction(DB_STORES.config, 'readwrite')
    tx.objectStore(DB_STORES.config).put(config, 'default')
    await txDone(tx)
  }

  const getAgentState = async () => {
    const db = await openDb()
    const tx = db.transaction(DB_STORES.state, 'readonly')
    const value = await reqValue(tx.objectStore(DB_STORES.state).get('default'))
    return value || null
  }

  const setAgentState = async (state) => {
    const db = await openDb()
    const tx = db.transaction(DB_STORES.state, 'readwrite')
    tx.objectStore(DB_STORES.state).put(state, 'default')
    await txDone(tx)
  }

  const appendEvent = async (type, message) => {
    const db = await openDb()
    const tx = db.transaction(DB_STORES.events, 'readwrite')
    const createdAt = Date.now()
    const req = tx.objectStore(DB_STORES.events).add({ type, message, createdAt })
    const id = await reqValue(req)
    await txDone(tx)
    const entry = { id: Number(id), type, message, createdAt }
    appState.events = [entry, ...appState.events].slice(0, 150)
    renderEvents()
  }

  const getRecentEvents = async () => {
    const db = await openDb()
    const tx = db.transaction(DB_STORES.events, 'readonly')
    const req = tx.objectStore(DB_STORES.events).getAll()
    const values = (await reqValue(req)) || []
    return values.sort((a, b) => b.createdAt - a.createdAt).slice(0, 150)
  }

  const toBase64 = (arrayBuffer) => {
    const bytes = new Uint8Array(arrayBuffer)
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary)
  }

  const fromBase64 = (value) => {
    const raw = atob(value)
    const bytes = new Uint8Array(raw.length)
    for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i)
    return bytes.buffer
  }

  const createSalt = () => toBase64(crypto.getRandomValues(new Uint8Array(16)).buffer)
  const createIv = () => toBase64(crypto.getRandomValues(new Uint8Array(12)).buffer)

  const deriveKey = async (passphrase, saltBase64, iterations) => {
    const encoder = new TextEncoder()
    const baseKey = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, [
      'deriveKey',
    ])
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: fromBase64(saltBase64),
        iterations,
        hash: 'SHA-256',
      },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    )
  }

  const encryptText = async (key, text, ivBase64) => {
    const encoded = new TextEncoder().encode(text)
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: fromBase64(ivBase64) }, key, encoded)
    return toBase64(encrypted)
  }

  const decryptText = async (key, encryptedBase64, ivBase64) => {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(ivBase64) },
      key,
      fromBase64(encryptedBase64),
    )
    return new TextDecoder().decode(decrypted)
  }

  const setupVault = async (passphrase) => {
    if (!passphrase || passphrase.length < 8) throw new Error('Passphrase must be at least 8 characters.')
    const salt = createSalt()
    const iterations = 210000
    const key = await deriveKey(passphrase, salt, iterations)
    const verifierIv = createIv()
    const verifierEncrypted = await encryptText(key, 'agent1c-local-vault-verifier', verifierIv)
    await setVaultMeta({
      kdfSalt: salt,
      iterations,
      verifierEncrypted,
      verifierIv,
      createdAt: Date.now(),
    })
    appState.sessionKey = key
    appState.vaultReady = true
    appState.unlocked = true
  }

  const unlockVault = async (passphrase) => {
    const meta = await getVaultMeta()
    if (!meta) throw new Error('Vault has not been initialized yet.')
    try {
      const key = await deriveKey(passphrase, meta.kdfSalt, meta.iterations)
      const verifier = await decryptText(key, meta.verifierEncrypted, meta.verifierIv)
      if (verifier !== 'agent1c-local-vault-verifier') throw new Error('Incorrect passphrase.')
      appState.sessionKey = key
      appState.unlocked = true
    } catch {
      throw new Error('Incorrect passphrase.')
    }
  }

  const lockVault = () => {
    appState.sessionKey = null
    appState.unlocked = false
    appState.running = false
    appState.agent.status = 'idle'
    stopHeartbeatLoop()
    stopTelegramLoop()
    resetIdleLock()
    setStatus('Vault locked.')
  }

  const requireSessionKey = () => {
    if (!appState.sessionKey) throw new Error('Vault is locked.')
    return appState.sessionKey
  }

  const saveProviderKey = async (provider, value) => {
    if (!value || !value.trim()) throw new Error('Key cannot be empty.')
    const key = requireSessionKey()
    const iv = createIv()
    const encrypted = await encryptText(key, value.trim(), iv)
    await setSecret({ provider, encrypted, iv, updatedAt: Date.now() })
  }

  const readProviderKey = async (provider) => {
    const key = requireSessionKey()
    const secret = await getSecret(provider)
    if (!secret) return null
    return decryptText(key, secret.encrypted, secret.iv)
  }

  const completeOpenAIChat = async ({ apiKey, model, temperature, systemPrompt, messages }) => {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature,
        messages: [{ role: 'system', content: systemPrompt }].concat(
          messages.map((m) => ({ role: m.role, content: m.content })),
        ),
      }),
    })
    if (!response.ok) throw new Error(`OpenAI failed (${response.status}): ${(await response.text()).slice(0, 300)}`)
    const data = await response.json()
    const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content
    if (!content || typeof content !== 'string') throw new Error('OpenAI returned empty content.')
    return content
  }

  const testOpenAIKey = async (apiKey, model) => {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'Reply with ok' }],
      }),
    })
    if (!response.ok) throw new Error(`OpenAI test failed (${response.status}): ${(await response.text()).slice(0, 300)}`)
  }

  const fetchOpenAIModels = async (apiKey) => {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })
    if (!response.ok) throw new Error(`OpenAI model list failed (${response.status}): ${(await response.text()).slice(0, 300)}`)
    const data = await response.json()
    const ids = ((data && data.data) || [])
      .map((item) => item && item.id)
      .filter((id) => typeof id === 'string')
      .sort((a, b) => a.localeCompare(b))
    if (!ids.length) throw new Error('OpenAI model list is empty.')
    return Array.from(new Set(ids))
  }

  const telegramEndpoint = (token, method) => `https://api.telegram.org/bot${token}/${method}`

  const telegramJson = async (response) => {
    const data = await response.json()
    if (!response.ok || !data.ok) throw new Error(data.description || `Telegram API failed (${response.status})`)
    return data.result
  }

  const testTelegramToken = async (token) => {
    const response = await fetch(telegramEndpoint(token, 'getMe'))
    const result = await telegramJson(response)
    return result.username || result.first_name || 'bot'
  }

  const getTelegramUpdates = async (token, offset) => {
    const url = new URL(telegramEndpoint(token, 'getUpdates'))
    if (typeof offset === 'number') url.searchParams.set('offset', String(offset))
    url.searchParams.set('timeout', '0')
    url.searchParams.set('limit', '20')
    const response = await fetch(url.toString())
    return telegramJson(response)
  }

  const sendTelegramMessage = async (token, chatId, text) => {
    const response = await fetch(telegramEndpoint(token, 'sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    })
    await telegramJson(response)
  }

  const pushRolling = (role, content) => {
    const message = { role, content, createdAt: Date.now() }
    appState.agent.rollingMessages = appState.agent.rollingMessages.concat(message).slice(-appState.config.maxContextMessages)
  }

  const renderEvents = () => {
    if (!appState.events.length) {
      els.eventLog.innerHTML = '<p class="small">No events yet.</p>'
      return
    }
    els.eventLog.innerHTML = appState.events
      .map(
        (item) =>
          `<article class="event-row"><p class="event-head"><span>${escapeHtml(item.type)}</span><time>${new Date(item.createdAt).toLocaleString()}</time></p><p>${escapeHtml(item.message)}</p></article>`,
      )
      .join('')
  }

  const renderChat = () => {
    if (!appState.agent.rollingMessages.length) {
      els.chatLog.innerHTML = '<p class="small">No messages yet. Send one to build context.</p>'
      return
    }
    els.chatLog.innerHTML = appState.agent.rollingMessages
      .map(
        (message) =>
          `<article class="chat-bubble ${message.role}"><p class="chat-role">${message.role}</p><p>${escapeHtml(message.content)}</p></article>`,
      )
      .join('')
    requestAnimationFrame(() => {
      els.chatLog.scrollTop = els.chatLog.scrollHeight
    })
  }

  const setStatus = (message) => {
    if (!message) {
      els.statusBar.classList.add('hidden')
      els.statusBody.textContent = ''
      if (appState.windowManager) appState.windowManager.refreshDock()
      return
    }
    els.statusBar.classList.remove('hidden')
    els.statusBody.textContent = message
    if (appState.windowManager) appState.windowManager.refreshDock()
  }

  const setBusy = (value) => {
    appState.busy = value
    const controls = document.querySelectorAll('button, input, select, textarea')
    controls.forEach((node) => {
      if (node.dataset.alwaysEnabled === 'true') return
      if (node.id === 'chatToggleBtn') return
      if (!appState.unlocked && ['setupPassphrase', 'setupConfirm', 'setupForm', 'unlockPassphrase'].includes(node.id)) {
        return
      }
    })
  }

  const render = async () => {
    const hasOpenAi = Boolean(await getSecret('openai'))
    const hasTelegram = Boolean(await getSecret('telegram'))

    const firstRun = !appState.vaultReady

    els.heroWindow.classList.toggle('hidden', firstRun)
    els.chatShell.classList.toggle('hidden', firstRun)
    els.setupSection.classList.toggle('hidden', !firstRun)
    els.unlockSection.classList.toggle('hidden', firstRun || appState.unlocked)
    els.authedSections.classList.toggle('hidden', firstRun || !appState.unlocked)

    els.openaiBadge.className = `badge ${hasOpenAi ? 'ok' : 'warn'}`
    els.openaiBadge.textContent = hasOpenAi ? 'Saved in vault' : 'Missing key'
    els.telegramBadge.className = `badge ${hasTelegram ? 'ok' : 'warn'}`
    els.telegramBadge.textContent = hasTelegram ? 'Saved in vault' : 'Missing token'

    els.chatInput.disabled = !appState.unlocked || appState.busy
    els.chatSendBtn.disabled = !appState.unlocked || appState.busy
    els.chatInput.placeholder = appState.unlocked ? 'Write a message...' : 'Unlock vault to chat'

    els.loopStatus.textContent = appState.agent.status
    els.lastTick.textContent = appState.agent.lastTickAt
      ? new Date(appState.agent.lastTickAt).toLocaleString()
      : 'Never'

    els.startLoopBtn.disabled = appState.running || !appState.unlocked
    els.stopLoopBtn.disabled = !appState.running

    els.telegramEnabledSelect.value = appState.telegramEnabled ? 'on' : 'off'
    els.telegramBridgeState.textContent = appState.telegramEnabled ? 'enabled' : 'disabled'

    renderChat()
    renderEvents()
    if (appState.windowManager) {
      appState.windowManager.applyResponsiveLayout()
      appState.windowManager.refreshDock()
    }
  }

  const setModelOptions = (modelIds, selectedModel) => {
    const list = modelIds && modelIds.length ? modelIds : FALLBACK_OPENAI_MODELS
    const options = Array.from(new Set(list))
    if (!options.includes(selectedModel)) {
      options.unshift(selectedModel)
    }
    els.modelInput.innerHTML = options
      .map((id) => `<option value="${escapeHtml(id)}">${escapeHtml(id)}</option>`)
      .join('')
    els.modelInput.value = selectedModel
  }

  const refreshModelDropdownFromOpenAI = async (providedKey) => {
    try {
      const key = providedKey || (await readProviderKey('openai'))
      if (!key) {
        setModelOptions(appState.openAiModels, appState.config.model)
        return
      }
      const ids = await fetchOpenAIModels(key)
      appState.openAiModels = ids
      setModelOptions(ids, appState.config.model)
      setStatus(`Loaded ${ids.length} OpenAI models.`)
    } catch (error) {
      setModelOptions(appState.openAiModels, appState.config.model)
      setStatus(error instanceof Error ? error.message : 'Could not refresh model list.')
    }
  }

  const saveDraftFromInputs = () => {
    appState.config.model = els.modelInput.value.trim() || 'gpt-4.1-mini'
    appState.config.heartbeatIntervalMs = Math.max(5000, Number(els.heartbeatInput.value) || 60000)
    appState.config.maxContextMessages = Math.max(4, Number(els.contextInput.value) || 16)
    appState.config.temperature = Math.min(2, Math.max(0, Number(els.temperatureInput.value) || 0.4))
    appState.telegramPollMs = Math.max(5000, Number(els.telegramPollInput.value) || 15000)
    appState.telegramEnabled = els.telegramEnabledSelect.value === 'on'
    appState.agent.soulMd = els.soulInput.value
    appState.agent.heartbeatMd = els.heartbeatDocInput.value
  }

  const loadInputsFromState = () => {
    setModelOptions(appState.openAiModels, appState.config.model)
    els.heartbeatInput.value = String(appState.config.heartbeatIntervalMs)
    els.contextInput.value = String(appState.config.maxContextMessages)
    els.temperatureInput.value = String(appState.config.temperature)
    els.telegramPollInput.value = String(appState.telegramPollMs)
    els.telegramEnabledSelect.value = appState.telegramEnabled ? 'on' : 'off'
    els.soulInput.value = appState.agent.soulMd
    els.heartbeatDocInput.value = appState.agent.heartbeatMd
  }

  const persistConfigAndState = async () => {
    await setAgentConfig(appState.config)
    await setAgentState(appState.agent)
  }

  const resetIdleLock = () => {
    if (appState.idleTimer) {
      clearTimeout(appState.idleTimer)
      appState.idleTimer = null
    }
  }

  const refreshIdleLock = () => {
    if (!appState.unlocked) return
    resetIdleLock()
    appState.idleTimer = setTimeout(async () => {
      lockVault()
      await appendEvent('vault_locked', 'Vault auto-locked after inactivity.')
      setStatus('Vault auto-locked after inactivity.')
      await render()
    }, 10 * 60 * 1000)
  }

  const startHeartbeatLoop = async () => {
    if (appState.running) return
    appState.running = true
    appState.agent.status = 'running'
    await appendEvent('agent_started', 'Agent loop started')
    await runHeartbeatTick()
    appState.heartbeatTimer = setInterval(() => {
      void runHeartbeatTick()
    }, appState.config.heartbeatIntervalMs)
    await setAgentState(appState.agent)
    await render()
  }

  const stopHeartbeatLoop = () => {
    if (appState.heartbeatTimer) {
      clearInterval(appState.heartbeatTimer)
      appState.heartbeatTimer = null
    }
    appState.running = false
    appState.agent.status = 'idle'
  }

  const runHeartbeatTick = async () => {
    try {
      const apiKey = await readProviderKey('openai')
      if (!apiKey) return
      const now = Date.now()
      const heartbeatPrompt = `${appState.agent.heartbeatMd.trim()}\n\nCurrent time: ${new Date(now).toISOString()}\nOperate autonomously and decide the next best action.`
      appState.agent.lastTickAt = now
      appState.agent.status = 'running'
      await appendEvent('tick_started', `Heartbeat started at ${new Date(now).toLocaleTimeString()}`)
      pushRolling('user', heartbeatPrompt)
      const reply = await completeOpenAIChat({
        apiKey,
        model: appState.config.model,
        temperature: appState.config.temperature,
        systemPrompt: appState.agent.soulMd,
        messages: appState.agent.rollingMessages,
      })
      pushRolling('assistant', reply)
      await appendEvent('tick_completed', reply.slice(0, 140))
      await setAgentState(appState.agent)
      await render()
    } catch (error) {
      appState.agent.status = 'error'
      await appendEvent('tick_failed', error instanceof Error ? error.message : 'Heartbeat failed')
      setStatus(error instanceof Error ? error.message : 'Heartbeat failed')
      await setAgentState(appState.agent)
      await render()
    }
  }

  const stopTelegramLoop = () => {
    if (appState.telegramTimer) {
      clearInterval(appState.telegramTimer)
      appState.telegramTimer = null
    }
  }

  const refreshTelegramLoop = () => {
    stopTelegramLoop()
    if (!appState.unlocked || !appState.telegramEnabled) return
    appState.telegramTimer = setInterval(() => {
      void pollTelegram()
    }, appState.telegramPollMs)
    void pollTelegram()
  }

  const pollTelegram = async () => {
    if (appState.telegramPolling || !appState.unlocked || !appState.telegramEnabled) return
    appState.telegramPolling = true
    try {
      const [telegramToken, openAiKey] = await Promise.all([readProviderKey('telegram'), readProviderKey('openai')])
      if (!telegramToken || !openAiKey) return
      const offset =
        typeof appState.agent.telegramLastUpdateId === 'number' ? appState.agent.telegramLastUpdateId + 1 : undefined
      const updates = await getTelegramUpdates(telegramToken, offset)
      if (!updates || !updates.length) return
      await appendEvent('telegram_polled', `Fetched ${updates.length} Telegram update(s)`)

      for (const update of updates) {
        appState.agent.telegramLastUpdateId = update.update_id
        const message = update.message
        if (!message || !message.text || (message.from && message.from.is_bot)) continue
        const chatLabel = message.chat.username || message.chat.title || String(message.chat.id)
        pushRolling('user', `[telegram:${chatLabel}] ${message.text}`)
        const reply = await completeOpenAIChat({
          apiKey: openAiKey,
          model: appState.config.model,
          temperature: appState.config.temperature,
          systemPrompt: appState.agent.soulMd,
          messages: appState.agent.rollingMessages,
        })
        pushRolling('assistant', reply)
        await sendTelegramMessage(telegramToken, message.chat.id, reply.slice(0, 3900))
        await appendEvent('telegram_replied', `Replied to Telegram chat ${chatLabel}`)
      }

      await setAgentState(appState.agent)
      await render()
    } catch (error) {
      await appendEvent('tick_failed', error instanceof Error ? error.message : 'Telegram bridge failed')
      setStatus(error instanceof Error ? error.message : 'Telegram bridge failed')
    } finally {
      appState.telegramPolling = false
    }
  }

  const sendChat = async (text) => {
    const apiKey = await readProviderKey('openai')
    if (!apiKey) throw new Error('OpenAI key not found. Save key first.')
    pushRolling('user', text)
    await setAgentState(appState.agent)
    await render()
    const reply = await completeOpenAIChat({
      apiKey,
      model: appState.config.model,
      temperature: appState.config.temperature,
      systemPrompt: appState.agent.soulMd,
      messages: appState.agent.rollingMessages,
    })
    pushRolling('assistant', reply)
    await appendEvent('tick_completed', `Chat reply: ${reply.slice(0, 120)}`)
    await setAgentState(appState.agent)
    await render()
  }

  const escapeHtml = (value) =>
    String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;')

  const initWindowManager = () => {
    const windows = Array.from(document.querySelectorAll('.wm-window'))
    const dock = els.wmDock
    let zTop = 40
    const isHiddenTree = (node) => Boolean(node.closest('.hidden'))
    const isMobile = () => window.matchMedia('(max-width: 760px)').matches
    const baseRects = new Map()

    const setFocus = (win) => {
      if (!win || win.classList.contains('closed') || isHiddenTree(win)) return
      zTop += 1
      win.style.zIndex = String(zTop)
      windows.forEach((node) => node.classList.toggle('inactive', node !== win))
    }

    const applyResponsiveLayout = () => {
      const mobile = isMobile()
      const viewportW = window.innerWidth
      const viewportH = window.innerHeight
      let stackTop = 72

      windows.forEach((win) => {
        const base = baseRects.get(win)
        if (!base) return

        if (mobile) {
          const width = Math.min(base.width, Math.max(220, viewportW - 12))
          const maxWindowHeight = Math.max(140, viewportH - 46)
          const height = Math.min(base.height, maxWindowHeight)

          win.style.width = `${width}px`
          win.style.height = `${height}px`
          win.style.left = '6px'
          win.style.top = `${stackTop}px`
          stackTop += Math.min(height, 260) + 12
        } else {
          win.style.width = `${base.width}px`
          win.style.height = `${base.height}px`
          win.style.left = `${base.left}px`
          win.style.top = `${base.top}px`
        }
      })
    }

    const refreshDock = () => {
      dock.innerHTML = ''
      windows.forEach((win) => {
        if (isHiddenTree(win)) return
        const title = win.dataset.winTitle || win.querySelector('.wm-title')?.textContent || 'window'
        const button = document.createElement('button')
        if (win.classList.contains('closed')) {
          button.textContent = `✕ ${title}`
        } else if (win.classList.contains('minimized')) {
          button.textContent = `◇ ${title}`
        } else {
          button.textContent = title
        }
        button.addEventListener('click', () => {
          win.classList.remove('closed')
          win.classList.remove('minimized')
          setFocus(win)
          refreshDock()
        })
        dock.appendChild(button)
      })
    }

    windows.forEach((win, index) => {
      const rect = {
        left: Number(win.dataset.x || 24 + index * 18),
        top: Number(win.dataset.y || 24 + index * 14),
        width: Number(win.dataset.w || 420),
        height: Number(win.dataset.h || 260),
      }
      baseRects.set(win, rect)
      win.style.left = `${rect.left}px`
      win.style.top = `${rect.top}px`
      win.style.width = `${rect.width}px`
      win.style.height = `${rect.height}px`

      const titlebar = win.querySelector('[data-drag-handle]')
      if (!titlebar) return

      win.addEventListener('pointerdown', () => setFocus(win), { capture: true })

      let dragging = false
      let startX = 0
      let startY = 0
      let startLeft = 0
      let startTop = 0
      let previousOverflowY = ''

      titlebar.addEventListener(
        'pointerdown',
        (event) => {
          const target = event.target
          if (target instanceof Element && target.closest('button')) return
          event.preventDefault()
          dragging = true
          startX = event.clientX
          startY = event.clientY
          startLeft = parseInt(win.style.left || '0', 10)
          startTop = parseInt(win.style.top || '0', 10)
          previousOverflowY = els.wmDesktop.style.overflowY
          els.wmDesktop.style.overflowY = 'hidden'
          titlebar.setPointerCapture(event.pointerId)
          setFocus(win)
        },
        { passive: false },
      )

      titlebar.addEventListener(
        'pointermove',
        (event) => {
          if (!dragging) return
          event.preventDefault()
          const dx = event.clientX - startX
          const dy = event.clientY - startY
          const maxLeft = Math.max(0, els.wmDesktop.clientWidth - 120)
          const maxTop = Math.max(0, els.wmDesktop.clientHeight - 60)
          const nextLeft = Math.max(0, Math.min(maxLeft, startLeft + dx))
          const nextTop = Math.max(0, Math.min(maxTop, startTop + dy))
          win.style.left = `${nextLeft}px`
          win.style.top = `${nextTop}px`
        },
        { passive: false },
      )

      const stopDrag = () => {
        dragging = false
        els.wmDesktop.style.overflowY = previousOverflowY
      }
      titlebar.addEventListener('pointerup', stopDrag)
      titlebar.addEventListener('pointercancel', stopDrag)
      titlebar.addEventListener('lostpointercapture', stopDrag)

      win.querySelectorAll('[data-win-action]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const action = btn.getAttribute('data-win-action')
          if (action === 'close') {
            win.classList.add('closed')
          } else if (action === 'min') {
            win.classList.toggle('minimized')
          } else {
            setFocus(win)
          }
          refreshDock()
        })
      })
    })

    const firstVisible = windows.find((win) => !isHiddenTree(win))
    if (firstVisible) setFocus(firstVisible)
    applyResponsiveLayout()
    refreshDock()

    window.addEventListener('resize', () => {
      applyResponsiveLayout()
      refreshDock()
    })

    return {
      refreshDock,
      applyResponsiveLayout,
      focusById: (id) => {
        const win = windows.find((node) => node.dataset.winId === id)
        if (!win) return
        win.classList.remove('closed')
        win.classList.remove('minimized')
        setFocus(win)
        applyResponsiveLayout()
        refreshDock()
      },
      showAll: () => {
        windows.forEach((win) => {
          if (isHiddenTree(win)) return
          win.classList.remove('closed')
          win.classList.remove('minimized')
        })
        const first = windows.find((win) => !isHiddenTree(win))
        if (first) setFocus(first)
        applyResponsiveLayout()
        refreshDock()
      },
      minimizeAll: () => {
        windows.forEach((win) => {
          if (isHiddenTree(win)) return
          win.classList.add('minimized')
        })
        applyResponsiveLayout()
        refreshDock()
      },
    }
  }

  const wireDom = () => {
    const id = (name) => document.getElementById(name)
    Object.assign(els, {
      wmDesktop: id('wmDesktop'),
      wmDock: id('wmDock'),
      wmClock: id('wmClock'),
      menuFileBtn: id('menuFileBtn'),
      menuWinBtn: id('menuWinBtn'),
      heroWindow: id('heroWindow'),
      app: id('app'),
      chatShell: id('chatShell'),
      chatClearBtn: id('chatClearBtn'),
      chatToggleBtn: id('chatToggleBtn'),
      chatLog: id('chatLog'),
      chatForm: id('chatForm'),
      chatInput: id('chatInput'),
      chatSendBtn: id('chatSendBtn'),
      setupSection: id('setupSection'),
      unlockSection: id('unlockSection'),
      authedSections: id('authedSections'),
      setupForm: id('setupForm'),
      setupPassphrase: id('setupPassphrase'),
      setupConfirm: id('setupConfirm'),
      unlockForm: id('unlockForm'),
      unlockPassphrase: id('unlockPassphrase'),
      openaiForm: id('openaiForm'),
      openaiKeyInput: id('openaiKeyInput'),
      openaiTestBtn: id('openaiTestBtn'),
      lockBtn: id('lockBtn'),
      telegramForm: id('telegramForm'),
      telegramTokenInput: id('telegramTokenInput'),
      telegramTestBtn: id('telegramTestBtn'),
      openaiBadge: id('openaiBadge'),
      telegramBadge: id('telegramBadge'),
      modelInput: id('modelInput'),
      heartbeatInput: id('heartbeatInput'),
      contextInput: id('contextInput'),
      temperatureInput: id('temperatureInput'),
      telegramPollInput: id('telegramPollInput'),
      telegramEnabledSelect: id('telegramEnabledSelect'),
      telegramBridgeState: id('telegramBridgeState'),
      soulInput: id('soulInput'),
      heartbeatDocInput: id('heartbeatDocInput'),
      saveSettingsBtn: id('saveSettingsBtn'),
      startLoopBtn: id('startLoopBtn'),
      stopLoopBtn: id('stopLoopBtn'),
      loopStatus: id('loopStatus'),
      lastTick: id('lastTick'),
      eventLog: id('eventLog'),
      statusBar: id('statusBar'),
      statusBody: id('statusBody'),
    })

    appState.windowManager = initWindowManager()

    const updateClock = () => {
      const now = new Date()
      els.wmClock.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    updateClock()
    setInterval(updateClock, 30000)

    els.menuFileBtn.addEventListener('click', () => {
      appState.windowManager.showAll()
    })
    els.menuWinBtn.addEventListener('click', () => {
      appState.windowManager.minimizeAll()
    })

    els.chatToggleBtn.addEventListener('click', () => {
      const maximized = els.chatShell.classList.toggle('maximized')
      els.chatToggleBtn.textContent = maximized ? 'Minimize' : 'Maximize'
      requestAnimationFrame(() => {
        els.chatLog.scrollTop = els.chatLog.scrollHeight
      })
    })

    els.chatClearBtn.addEventListener('click', async () => {
      appState.agent.rollingMessages = []
      await setAgentState(appState.agent)
      await appendEvent('tick_completed', 'Rolling chat context cleared')
      setStatus('Chat context cleared.')
      await render()
    })

    els.setupForm.addEventListener('submit', async (event) => {
      event.preventDefault()
      if (els.setupPassphrase.value !== els.setupConfirm.value) {
        setStatus('Passphrase confirmation does not match.')
        return
      }
      try {
        await setupVault(els.setupPassphrase.value)
        els.setupPassphrase.value = ''
        els.setupConfirm.value = ''
        await appendEvent('vault_unlocked', 'Vault initialized and unlocked')
        setStatus('Vault initialized and unlocked.')
        refreshIdleLock()
        refreshTelegramLoop()
        await refreshModelDropdownFromOpenAI()
        await render()
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Could not set up vault')
      }
    })

    els.unlockForm.addEventListener('submit', async (event) => {
      event.preventDefault()
      try {
        await unlockVault(els.unlockPassphrase.value)
        els.unlockPassphrase.value = ''
        await appendEvent('vault_unlocked', 'Vault unlocked locally')
        setStatus('Vault unlocked.')
        refreshIdleLock()
        refreshTelegramLoop()
        await refreshModelDropdownFromOpenAI()
        await render()
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Unlock failed')
      }
    })

    els.lockBtn.addEventListener('click', async () => {
      lockVault()
      await appendEvent('vault_locked', 'Vault locked.')
      await render()
    })

    const activityEvents = ['mousemove', 'keydown', 'click', 'touchstart']
    activityEvents.forEach((name) => {
      window.addEventListener(name, () => {
        if (appState.unlocked) refreshIdleLock()
      }, { passive: true })
    })

    els.openaiForm.addEventListener('submit', async (event) => {
      event.preventDefault()
      try {
        await saveProviderKey('openai', els.openaiKeyInput.value)
        const savedKey = els.openaiKeyInput.value.trim()
        els.openaiKeyInput.value = ''
        await appendEvent('provider_key_saved', 'OpenAI key stored in encrypted local vault')
        await refreshModelDropdownFromOpenAI(savedKey)
        setStatus('OpenAI key saved locally (encrypted).')
        await render()
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Could not save OpenAI key')
      }
    })

    els.openaiTestBtn.addEventListener('click', async () => {
      try {
        const key = els.openaiKeyInput.value.trim() || (await readProviderKey('openai'))
        if (!key) throw new Error('No OpenAI key available. Add one first.')
        saveDraftFromInputs()
        await testOpenAIKey(key, appState.config.model)
        await refreshModelDropdownFromOpenAI(key)
        await appendEvent('provider_key_tested', `OpenAI key test succeeded for model ${appState.config.model}`)
        setStatus('OpenAI key test succeeded.')
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'OpenAI key test failed')
      }
    })

    els.telegramForm.addEventListener('submit', async (event) => {
      event.preventDefault()
      try {
        await saveProviderKey('telegram', els.telegramTokenInput.value)
        els.telegramTokenInput.value = ''
        await appendEvent('provider_key_saved', 'Telegram bot token stored in encrypted local vault')
        setStatus('Telegram token saved locally (encrypted).')
        refreshTelegramLoop()
        await render()
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Could not save Telegram token')
      }
    })

    els.telegramTestBtn.addEventListener('click', async () => {
      try {
        const token = els.telegramTokenInput.value.trim() || (await readProviderKey('telegram'))
        if (!token) throw new Error('No Telegram token available. Add one first.')
        const botName = await testTelegramToken(token)
        await appendEvent('provider_key_tested', `Telegram token test succeeded for @${botName}`)
        setStatus(`Telegram token works for @${botName}.`)
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Telegram token test failed')
      }
    })

    els.saveSettingsBtn.addEventListener('click', async () => {
      saveDraftFromInputs()
      await persistConfigAndState()
      refreshTelegramLoop()
      setStatus('Settings saved to local IndexedDB.')
      await render()
    })

    els.startLoopBtn.addEventListener('click', async () => {
      if (!appState.unlocked) {
        setStatus('Unlock vault first.')
        return
      }
      saveDraftFromInputs()
      await persistConfigAndState()
      await startHeartbeatLoop()
      setStatus('Agent loop running.')
    })

    els.stopLoopBtn.addEventListener('click', async () => {
      stopHeartbeatLoop()
      await appendEvent('agent_stopped', 'Agent loop stopped')
      await setAgentState(appState.agent)
      setStatus('Agent stopped.')
      await render()
    })

    els.telegramEnabledSelect.addEventListener('change', async () => {
      appState.telegramEnabled = els.telegramEnabledSelect.value === 'on'
      refreshTelegramLoop()
      await render()
    })

    els.telegramPollInput.addEventListener('change', () => {
      appState.telegramPollMs = Math.max(5000, Number(els.telegramPollInput.value) || 15000)
      refreshTelegramLoop()
    })

    els.chatForm.addEventListener('submit', async (event) => {
      event.preventDefault()
      const text = els.chatInput.value.trim()
      if (!text) return
      if (!appState.unlocked) {
        setStatus('Unlock vault first.')
        return
      }

      els.chatInput.value = ''
      try {
        setStatus('Thinking...')
        saveDraftFromInputs()
        await sendChat(text)
        setStatus('Reply received.')
      } catch (error) {
        await appendEvent('tick_failed', error instanceof Error ? error.message : 'Chat failed')
        setStatus(error instanceof Error ? error.message : 'Chat failed')
      }
    })
  }

  const bootstrap = async () => {
    wireDom()

    const [meta, storedConfig, storedState, events] = await Promise.all([
      getVaultMeta(),
      getAgentConfig(),
      getAgentState(),
      getRecentEvents(),
    ])

    appState.vaultReady = Boolean(meta)
    if (storedConfig) {
      appState.config = { ...appState.config, ...storedConfig }
    }
    let migrated = false
    if (storedState) {
      appState.agent = { ...appState.agent, ...storedState }
      if (appState.agent.soulMd === LEGACY_SOUL) {
        appState.agent.soulMd = DEFAULT_SOUL
        migrated = true
      }
      if (appState.agent.soulMd === PREV_HITOMI_SOUL) {
        appState.agent.soulMd = DEFAULT_SOUL
        migrated = true
      }
      if (appState.agent.heartbeatMd === LEGACY_HEARTBEAT) {
        appState.agent.heartbeatMd = DEFAULT_HEARTBEAT
        migrated = true
      }
    }
    appState.events = events

    loadInputsFromState()
    if (migrated) {
      await setAgentState(appState.agent)
    }
    if (appState.unlocked) {
      await refreshModelDropdownFromOpenAI()
    }
    await render()
    setStatus('Ready.')
  }

  bootstrap().catch((error) => {
    console.error(error)
    const status = document.getElementById('statusBar')
    const statusBody = document.getElementById('statusBody')
    if (status) {
      status.classList.remove('hidden')
      if (statusBody) {
        statusBody.textContent = error instanceof Error ? error.message : 'Initialization failed.'
      }
    }
  })
})()
