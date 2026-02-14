// HedgeyTube - Retro YouTube RSS Browser

const APP_STATE = {
  sources: [],
  selectedSourceId: null,
  selectedVideoId: null,
  feedCache: {},
  proxyMode: 'A',
  proxyUrl: ''
};

// DOM Elements
const elements = {
  urlInput: null,
  addBtn: null,
  settingsBtn: null,
  aboutBtn: null,
  sourcesList: null,
  sourcesDropdown: null,
  feedList: null,
  feedTitle: null,
  playerContainer: null,
  playerIframe: null,
  tvStatic: null,
  videoMeta: null,
  statusText: null,
  settingsModal: null,
  aboutModal: null,
  proxyMode: null,
  proxyUrl: null,
  proxySave: null,
  proxyCancel: null,
  aboutClose: null
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initElements();
  loadState();
  bindEvents();
  renderSources();
  
  if (APP_STATE.selectedSourceId) {
    selectSource(APP_STATE.selectedSourceId);
  }
  
  setStatus('Ready');
});

function initElements() {
  elements.urlInput = document.getElementById('url-input');
  elements.addBtn = document.getElementById('add-btn');
  elements.settingsBtn = document.getElementById('settings-btn');
  elements.aboutBtn = document.getElementById('about-btn');
  elements.sourcesList = document.getElementById('sources-list');
  elements.sourcesDropdown = document.getElementById('sources-dropdown');
  elements.feedList = document.getElementById('feed-list');
  elements.feedTitle = document.getElementById('feed-title');
  elements.playerContainer = document.getElementById('player-container');
  elements.playerIframe = document.getElementById('player-iframe');
  elements.tvStatic = document.getElementById('tv-static');
  elements.videoMeta = document.getElementById('video-meta');
  elements.statusText = document.getElementById('status-text');
  elements.settingsModal = document.getElementById('settings-modal');
  elements.aboutModal = document.getElementById('about-modal');
  elements.proxyMode = document.getElementById('proxy-mode');
  elements.proxyUrl = document.getElementById('proxy-url');
  elements.proxySave = document.getElementById('proxy-save');
  elements.proxyCancel = document.getElementById('proxy-cancel');
  elements.aboutClose = document.getElementById('about-close');
}

function bindEvents() {
  elements.addBtn.addEventListener('click', handleAddSource);
  elements.urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAddSource();
  });
  elements.settingsBtn.addEventListener('click', openSettings);
  elements.aboutBtn.addEventListener('click', openAbout);
  elements.proxySave.addEventListener('click', saveProxy);
  elements.proxyCancel.addEventListener('click', closeSettings);
  elements.aboutClose.addEventListener('click', closeAbout);
  elements.sourcesDropdown.addEventListener('change', (e) => {
    if (e.target.value) selectSource(e.target.value);
  });
  
  // Close modals on overlay click
  elements.settingsModal.addEventListener('click', (e) => {
    if (e.target === elements.settingsModal) closeSettings();
  });
  elements.aboutModal.addEventListener('click', (e) => {
    if (e.target === elements.aboutModal) closeAbout();
  });

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSettings();
      closeAbout();
    }
  });
}

// State Management
function loadState() {
  try {
    const saved = localStorage.getItem('hedgeytube_state');
    if (saved) {
      const parsed = JSON.parse(saved);
      APP_STATE.sources = parsed.sources || [];
      APP_STATE.selectedSourceId = parsed.selectedSourceId || null;
      APP_STATE.selectedVideoId = parsed.selectedVideoId || null;
      APP_STATE.proxyMode = parsed.proxyMode || 'A';
      APP_STATE.proxyUrl = parsed.proxyUrl || '';
    }
  } catch (e) {
    console.error('Failed to load state:', e);
  }
}

function saveState() {
  try {
    localStorage.setItem('hedgeytube_state', JSON.stringify({
      sources: APP_STATE.sources,
      selectedSourceId: APP_STATE.selectedSourceId,
      selectedVideoId: APP_STATE.selectedVideoId,
      proxyMode: APP_STATE.proxyMode,
      proxyUrl: APP_STATE.proxyUrl
    }));
  } catch (e) {
    console.error('Failed to save state:', e);
  }
}

// Status Bar
function setStatus(text, isError = false) {
  elements.statusText.textContent = text;
  elements.statusText.classList.toggle('error', isError);
}

// URL Parsing
function parseYouTubeUrl(input) {
  input = input.trim();
  
  // Handle raw channel/playlist IDs
  if (/^UC[\w-]{22}$/.test(input)) {
    return { type: 'channel', channelId: input };
  }
  if (/^PL[\w-]+$/.test(input)) {
    return { type: 'playlist', playlistId: input };
  }
  if (input.startsWith('@')) {
    return { type: 'handle', handle: input };
  }
  
  // Parse URLs
  let url;
  try {
    if (!input.startsWith('http')) {
      input = 'https://' + input;
    }
    url = new URL(input);
  } catch {
    return null;
  }
  
  const hostname = url.hostname.replace('www.', '');
  if (!hostname.includes('youtube.com') && !hostname.includes('youtu.be')) {
    return null;
  }
  
  const pathname = url.pathname;
  const params = url.searchParams;
  
  // Video URLs
  if (params.has('v')) {
    return { type: 'video', videoId: params.get('v') };
  }
  if (hostname === 'youtu.be') {
    const id = pathname.slice(1).split('/')[0];
    if (id) return { type: 'video', videoId: id };
  }
  if (pathname.startsWith('/shorts/')) {
    return { type: 'video', videoId: pathname.split('/')[2] };
  }
  if (pathname.startsWith('/live/')) {
    return { type: 'video', videoId: pathname.split('/')[2] };
  }
  if (pathname.startsWith('/embed/')) {
    return { type: 'video', videoId: pathname.split('/')[2] };
  }
  
  // Playlist URLs
  if (params.has('list')) {
    return { type: 'playlist', playlistId: params.get('list') };
  }
  
  // Channel URLs
  if (pathname.startsWith('/channel/')) {
    return { type: 'channel', channelId: pathname.split('/')[2] };
  }
  if (pathname.startsWith('/@')) {
    return { type: 'handle', handle: pathname.split('/')[1] };
  }
  if (pathname.startsWith('/c/')) {
    return { type: 'customUrl', customUrl: pathname.split('/')[2] };
  }
  if (pathname.startsWith('/user/')) {
    return { type: 'user', user: pathname.split('/')[2] };
  }
  
  return null;
}

// Proxy Fetch
async function proxyFetch(url) {
  let fetchUrl = url;
  
  if (APP_STATE.proxyUrl) {
    if (APP_STATE.proxyMode === 'A') {
      fetchUrl = APP_STATE.proxyUrl + encodeURIComponent(url);
    } else {
      fetchUrl = APP_STATE.proxyUrl + url;
    }
  }
  
  const response = await fetch(fetchUrl);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response;
}

// Source Resolution
async function resolveSource(parsed) {
  setStatus('Resolving source...');
  
  try {
    if (parsed.type === 'channel') {
      return {
        id: 'ch_' + parsed.channelId,
        type: 'channel',
        channelId: parsed.channelId,
        name: 'Channel ' + parsed.channelId.slice(0, 8) + '...'
      };
    }
    
    if (parsed.type === 'playlist') {
      return {
        id: 'pl_' + parsed.playlistId,
        type: 'playlist',
        playlistId: parsed.playlistId,
        name: 'Playlist ' + parsed.playlistId.slice(0, 8) + '...'
      };
    }
    
    if (parsed.type === 'video') {
      // Use oEmbed to get channel info
      const watchUrl = `https://www.youtube.com/watch?v=${parsed.videoId}`;
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`;
      
      const response = await proxyFetch(oembedUrl);
      const data = await response.json();
      
      if (data.author_url) {
        const channelParsed = parseYouTubeUrl(data.author_url);
        if (channelParsed && channelParsed.type === 'channel') {
          return {
            id: 'ch_' + channelParsed.channelId,
            type: 'channel',
            channelId: channelParsed.channelId,
            name: data.author_name || 'Unknown Channel'
          };
        }
        // Handle handle URLs from oEmbed
        if (channelParsed && (channelParsed.type === 'handle' || channelParsed.type === 'customUrl')) {
          return resolveHandleOrCustom(channelParsed, data.author_name);
        }
      }
      throw new Error('Could not resolve channel from video');
    }
    
    if (parsed.type === 'handle' || parsed.type === 'customUrl' || parsed.type === 'user') {
      return resolveHandleOrCustom(parsed);
    }
    
    throw new Error('Unknown source type');
  } catch (error) {
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      throw new Error('CORS blocked. Set a proxy in Settings.');
    }
    throw error;
  }
}

async function resolveHandleOrCustom(parsed, knownName = null) {
  let channelUrl;
  if (parsed.type === 'handle') {
    channelUrl = `https://www.youtube.com/${parsed.handle}`;
  } else if (parsed.type === 'customUrl') {
    channelUrl = `https://www.youtube.com/c/${parsed.customUrl}`;
  } else {
    channelUrl = `https://www.youtube.com/user/${parsed.user}`;
  }
  
  setStatus('Fetching channel page...');
  const response = await proxyFetch(channelUrl);
  const html = await response.text();
  
  // Extract channel ID from page
  const channelIdMatch = html.match(/"channelId":"(UC[\w-]{22})"/);
  if (channelIdMatch) {
    const channelId = channelIdMatch[1];
    
    // Try to extract channel name
    let name = knownName;
    if (!name) {
      const nameMatch = html.match(/"title":"([^"]+)"/);
      name = nameMatch ? nameMatch[1] : parsed.handle || parsed.customUrl || parsed.user;
    }
    
    return {
      id: 'ch_' + channelId,
      type: 'channel',
      channelId: channelId,
      name: name
    };
  }
  
  // Fallback: look for feed link
  const feedMatch = html.match(/feeds\/videos\.xml\?channel_id=(UC[\w-]{22})/);
  if (feedMatch) {
    return {
      id: 'ch_' + feedMatch[1],
      type: 'channel',
      channelId: feedMatch[1],
      name: knownName || parsed.handle || parsed.customUrl || parsed.user
    };
  }
  
  throw new Error('Could not extract channel ID');
}

// Feed Fetching
async function fetchFeed(source) {
  setStatus('Fetching feed...');
  
  let feedUrl;
  if (source.type === 'channel') {
    feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${source.channelId}`;
  } else if (source.type === 'playlist') {
    feedUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=${source.playlistId}`;
  } else {
    throw new Error('Unknown feed type');
  }
  
  const response = await proxyFetch(feedUrl);
  const xml = await response.text();
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  
  const entries = doc.querySelectorAll('entry');
  const videos = [];
  
  entries.forEach((entry, index) => {
    if (index >= 15) return;
    
    const videoIdEl = entry.querySelector('videoId');
    const titleEl = entry.querySelector('title');
    const publishedEl = entry.querySelector('published');
    const thumbnailEl = entry.querySelector('thumbnail');
    
    if (videoIdEl) {
      videos.push({
        videoId: videoIdEl.textContent,
        title: titleEl ? titleEl.textContent : 'Untitled',
        published: publishedEl ? publishedEl.textContent : null,
        thumbnail: thumbnailEl ? thumbnailEl.getAttribute('url') : `https://i.ytimg.com/vi/${videoIdEl.textContent}/mqdefault.jpg`
      });
    }
  });
  
  // Try to update source name from feed
  const feedTitle = doc.querySelector('feed > title');
  if (feedTitle && feedTitle.textContent) {
    source.name = feedTitle.textContent;
    saveState();
    renderSources();
  }
  
  return videos;
}

// UI Handlers
async function handleAddSource() {
  const input = elements.urlInput.value.trim();
  if (!input) {
    setStatus('Please enter a YouTube URL', true);
    return;
  }
  
  const parsed = parseYouTubeUrl(input);
  if (!parsed) {
    setStatus('Invalid YouTube URL', true);
    return;
  }
  
  try {
    const source = await resolveSource(parsed);
    
    // Check for duplicate
    const existing = APP_STATE.sources.find(s => s.id === source.id);
    if (existing) {
      setStatus('Source already added');
      selectSource(source.id);
      elements.urlInput.value = '';
      return;
    }
    
    APP_STATE.sources.push(source);
    saveState();
    renderSources();
    selectSource(source.id);
    elements.urlInput.value = '';
    setStatus('Source added: ' + source.name);
  } catch (error) {
    setStatus(error.message, true);
  }
}

function removeSource(sourceId, event) {
  event.stopPropagation();
  APP_STATE.sources = APP_STATE.sources.filter(s => s.id !== sourceId);
  
  if (APP_STATE.selectedSourceId === sourceId) {
    APP_STATE.selectedSourceId = null;
    APP_STATE.selectedVideoId = null;
    elements.feedList.innerHTML = '<div class="empty-state">Select a source to view videos.</div>';
    elements.feedTitle.textContent = 'Latest Videos';
    clearPlayer();
  }
  
  saveState();
  renderSources();
  setStatus('Source removed');
}

async function selectSource(sourceId) {
  const source = APP_STATE.sources.find(s => s.id === sourceId);
  if (!source) return;
  
  APP_STATE.selectedSourceId = sourceId;
  saveState();
  renderSources();
  
  elements.feedTitle.textContent = source.name;
  elements.feedList.innerHTML = '<div class="loading">⏳ Fetching feed...</div>';
  
  try {
    const videos = await fetchFeed(source);
    APP_STATE.feedCache[sourceId] = videos;
    renderFeed(videos);
    setStatus('Loaded ' + videos.length + ' videos');
  } catch (error) {
    elements.feedList.innerHTML = `<div class="empty-state error-state">Error: ${error.message}</div>`;
    setStatus(error.message, true);
  }
}

function selectVideo(videoId) {
  APP_STATE.selectedVideoId = videoId;
  saveState();
  
  const videos = APP_STATE.feedCache[APP_STATE.selectedSourceId] || [];
  const video = videos.find(v => v.videoId === videoId);
  
  renderFeed(videos); // Re-render to show selection
  
  // Show player
  elements.tvStatic.style.display = 'none';
  elements.playerIframe.style.display = 'block';
  elements.playerIframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`;
  
  // Show metadata
  if (video) {
    const publishedDate = video.published ? new Date(video.published).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }) : 'Unknown date';
    
    elements.videoMeta.innerHTML = `
      <div class="meta-title">${escapeHtml(video.title)}</div>
      <div class="meta-date">📅 ${publishedDate}</div>
      <a href="https://www.youtube.com/watch?v=${videoId}" target="_blank" class="meta-link bevel-out">🔗 Watch on YouTube</a>
    `;
    
    setStatus('Playing: ' + video.title);
  }
}

function clearPlayer() {
  elements.tvStatic.style.display = 'flex';
  elements.playerIframe.style.display = 'none';
  elements.playerIframe.src = '';
  elements.videoMeta.innerHTML = '';
}

// Rendering
function renderSources() {
  // Desktop list
  if (APP_STATE.sources.length === 0) {
    elements.sourcesList.innerHTML = '<div class="empty-state">No sources yet!<br>Paste a YouTube URL above.</div>';
  } else {
    elements.sourcesList.innerHTML = APP_STATE.sources.map(source => `
      <div class="source-item ${source.id === APP_STATE.selectedSourceId ? 'selected bevel-in' : 'bevel-out'}" 
           onclick="selectSource('${source.id}')">
        <span class="source-name">${escapeHtml(source.name)}</span>
        <button class="source-remove" onclick="removeSource('${source.id}', event)">×</button>
      </div>
    `).join('');
  }
  
  // Mobile dropdown
  elements.sourcesDropdown.innerHTML = '<option value="">-- Select Source --</option>' +
    APP_STATE.sources.map(source => 
      `<option value="${source.id}" ${source.id === APP_STATE.selectedSourceId ? 'selected' : ''}>${escapeHtml(source.name)}</option>`
    ).join('');
}

function renderFeed(videos) {
  if (videos.length === 0) {
    elements.feedList.innerHTML = '<div class="empty-state">No videos found in feed.</div>';
    return;
  }
  
  elements.feedList.innerHTML = videos.map(video => {
    const publishedDate = video.published ? new Date(video.published).toLocaleDateString('en-US', {
      year: '2-digit',
      month: 'short',
      day: 'numeric'
    }) : '';
    
    return `
      <div class="feed-item ${video.videoId === APP_STATE.selectedVideoId ? 'selected bevel-in' : 'bevel-out'}"
           onclick="selectVideo('${video.videoId}')">
        <img class="feed-thumb" src="${video.thumbnail}" alt="" loading="lazy">
        <div class="feed-info">
          <div class="feed-item-title">${escapeHtml(video.title)}</div>
          <div class="feed-date">${publishedDate}</div>
        </div>
      </div>
    `;
  }).join('');
}

// Modal Handlers
function openSettings() {
  elements.proxyMode.value = APP_STATE.proxyMode;
  elements.proxyUrl.value = APP_STATE.proxyUrl;
  elements.settingsModal.classList.add('open');
}

function closeSettings() {
  elements.settingsModal.classList.remove('open');
}

function saveProxy() {
  APP_STATE.proxyMode = elements.proxyMode.value;
  APP_STATE.proxyUrl = elements.proxyUrl.value.trim();
  saveState();
  closeSettings();
  setStatus('Proxy settings saved');
}

function openAbout() {
  elements.aboutModal.classList.add('open');
}

function closeAbout() {
  elements.aboutModal.classList.remove('open');
}

// Utilities
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Expose functions globally for inline handlers
window.selectSource = selectSource;
window.selectVideo = selectVideo;
window.removeSource = removeSource;

/*
====== CLOUDFLARE WORKER PROXY SNIPPET ======
Deploy this as a Cloudflare Worker for your own CORS proxy:

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  const targetUrl = url.searchParams.get('url')
  
  if (!targetUrl) {
    return new Response('Missing url parameter', { status: 400 })
  }
  
  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HedgeyTube/1.0)'
      }
    })
    
    const headers = new Headers(response.headers)
    headers.set('Access-Control-Allow-Origin', '*')
    
    return new Response(response.body, {
      status: response.status,
      headers: headers
    })
  } catch (error) {
    return new Response('Fetch failed: ' + error.message, { status: 500 })
  }
}

====== END CLOUDFLARE WORKER PROXY SNIPPET ======
*/