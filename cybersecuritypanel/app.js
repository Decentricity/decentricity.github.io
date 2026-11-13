'use strict';
const $ = id => document.getElementById(id);
const player = $('player');
let videos = [], current = 0, toastTimer;
const time = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const sourceTime = seconds => `${Math.floor(seconds / 3600) ? `${Math.floor(seconds / 3600)}:` : ''}${Math.floor(seconds / 3600) ? String(Math.floor(seconds % 3600 / 60)).padStart(2, '0') : Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
function notify(message) {
  $('toast').textContent = message;
  $('toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3200);
}
function renderPlaylist() {
  const query = $('search').value.trim().toLowerCase();
  const items = videos.filter(v => `${v.topic} ${v.summary}`.toLowerCase().includes(query));
  $('playlist-items').replaceChildren(...items.map(v => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'playlist-item';
    button.setAttribute('aria-current', String(v.id === videos[current].id));
    button.setAttribute('aria-label', `Play chapter ${v.id}: ${v.topic}, ${time(v.duration)}`);
    button.dataset.chapter = v.id;
    const number = document.createElement('span');
    number.className = 'item-number';
    number.textContent = v.id === videos[current].id ? '▶' : String(v.id).padStart(2, '0');
    const thumb = document.createElement('span');
    thumb.className = 'thumb-wrap';
    const image = document.createElement('img');
    image.src = v.thumbnail;
    image.alt = '';
    image.loading = 'lazy';
    image.width = 960;
    image.height = 540;
    const duration = document.createElement('span');
    duration.className = 'thumb-duration';
    duration.textContent = time(v.duration);
    thumb.append(image, duration);
    const info = document.createElement('span');
    info.className = 'item-info';
    const title = document.createElement('span');
    title.className = 'item-title';
    title.textContent = v.topic;
    const subtitle = document.createElement('span');
    subtitle.className = 'item-subtitle';
    subtitle.textContent = v.id === videos[current].id ? 'Now selected' : 'Decentricity · Forum';
    info.append(title, subtitle);
    button.append(number, thumb, info);
    button.addEventListener('click', () => selectVideo(v.id - 1, true));
    return button;
  }));
  $('empty-search').hidden = items.length !== 0;
}
function selectVideo(index, play = false, updateURL = true) {
  if (index < 0 || index >= videos.length) return;
  current = index;
  const v = videos[index];
  player.pause();
  player.poster = v.thumbnail;
  player.src = v.src;
  player.replaceChildren();
  const track = document.createElement('track');
  track.kind = 'captions';
  track.label = 'English (auto-generated)';
  track.srclang = 'en';
  track.src = v.captions;
  player.append(track);
  player.setAttribute('aria-label', v.topic);
  $('video-title').textContent = v.topic;
  document.title = `${v.topic} — Decentricity Forum`;
  $('chapter-label').textContent = `CHAPTER ${String(v.id).padStart(2, '0')} / ${videos.length}`;
  $('playlist-position').textContent = `${v.id} of ${videos.length}`;
  $('duration').textContent = `${time(v.duration)} min`;
  $('summary').textContent = v.summary;
  $('source-link').href = `https://www.youtube.com/watch?v=tqsSengl0q8&t=${Math.floor(v.ranges[0][0])}s`;
  $('source-time').textContent = `${sourceTime(v.ranges[0][0])} – ${sourceTime(v.ranges.at(-1)[1])}`;
  $('download').href = v.src;
  $('download').download = v.filename;
  $('download').title = `Download ${v.topic}${v.bytes ? ` (${(v.bytes / 1000000).toFixed(1)} MB)` : ''}`;
  $('ranges-detail').hidden = v.ranges.length < 2;
  $('ranges-detail').open = false;
  $('ranges').replaceChildren(...v.ranges.map(([a, b]) => {
    const link = document.createElement('a');
    link.textContent = `${sourceTime(a)} – ${sourceTime(b)} ↗`;
    link.href = `https://www.youtube.com/watch?v=tqsSengl0q8&t=${Math.floor(a)}s`;
    link.target = '_blank';
    link.rel = 'noopener';
    return link;
  }));
  $('previous').disabled = index === 0;
  $('next').disabled = index === videos.length - 1;
  if (updateURL) history.replaceState(null, '', `#${v.slug}`);
  $('loading-cover').hidden = true;
  renderPlaylist();
  if (play) player.play().catch(() => notify('Press play to start this chapter.'));
}
$('search').addEventListener('input', renderPlaylist);
$('previous').addEventListener('click', () => selectVideo(current - 1, true));
$('next').addEventListener('click', () => selectVideo(current + 1, true));
player.addEventListener('ended', () => {
  if ($('autoplay').checked && current < videos.length - 1) selectVideo(current + 1, true);
});
player.addEventListener('error', () => {
  $('loading-cover').hidden = true;
  notify('The video could not load. Try the download button or original recording.');
});
$('share').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    notify('Chapter link copied');
  } catch {
    notify('Copy this page’s address to share the chapter.');
  }
});
window.addEventListener('hashchange', () => {
  const index = videos.findIndex(v => `#${v.slug}` === location.hash);
  if (index >= 0 && index !== current) selectVideo(index, false, false);
});
fetch('videos.json').then(response => {
  if (!response.ok) throw new Error('Playlist request failed');
  return response.json();
}).then(data => {
  videos = data;
  const initial = videos.findIndex(v => `#${v.slug}` === location.hash);
  selectVideo(initial < 0 ? 0 : initial, false);
}).catch(() => {
  $('loading-cover').textContent = 'Unable to load the playlist. Please refresh the page.';
});
