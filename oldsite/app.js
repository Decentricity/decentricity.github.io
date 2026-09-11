const SOURCES = {
  reviews: '../_posts/2000-01-03-reviews.md',
  tools: '../_posts/2000-01-05-tools.md',
  essay: '../_posts/2000-01-06-essay.md',
  intro: '../_posts/2000-01-01-intro.md',
  video: '../_posts/2000-01-07-video.md'
};

const loaded = new Set();

function stripFrontMatter(text) {
  return text.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '');
}

function inline(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/(^|\W)\*([^*]+)\*(?=\W|$)/g, '$1<em>$2</em>');
}

function markdown(text) {
  text = stripFrontMatter(text).replace(/\r/g, '').trim();
  const lines = text.split('\n');
  let html = '';
  let paragraph = [];
  let list = null;
  let quote = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html += `<p>${inline(paragraph.join(' '))}</p>`;
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    html += `</${list}>`;
    list = null;
  };
  const flushQuote = () => {
    if (!quote.length) return;
    html += `<blockquote><p>${inline(quote.join(' '))}</p></blockquote>`;
    quote = [];
  };
  const flush = () => { flushParagraph(); flushList(); flushQuote(); };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flush();
      const level = Math.min(3, heading[1].length);
      const label = heading[2].replace(/<[^>]+>/g, '');
      const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      html += `<h${level} id="${id}">${inline(heading[2])}</h${level}>`;
      continue;
    }
    if (/^[-*_]{3,}$/.test(line)) { flush(); html += '<hr>'; continue; }
    const ul = line.match(/^[-*+]\s+(.+)$/);
    const ol = line.match(/^\d+[.)]\s+(.+)$/);
    if (ul || ol) {
      flushParagraph(); flushQuote();
      const type = ul ? 'ul' : 'ol';
      if (list && list !== type) flushList();
      if (!list) { list = type; html += `<${type}>`; }
      html += `<li>${inline((ul || ol)[1])}</li>`;
      continue;
    }
    if (line.startsWith('>')) {
      flushParagraph(); flushList();
      quote.push(line.replace(/^>\s?/, ''));
      continue;
    }
    paragraph.push(line);
  }
  flush();
  return html;
}

async function loadArchive(view) {
  if (!SOURCES[view] || loaded.has(view)) return;
  const target = document.getElementById(`${view}-content`);
  try {
    const res = await fetch(SOURCES[view], { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    target.innerHTML = markdown(text);
    target.classList.remove('loading');
    loaded.add(view);
  } catch (err) {
    target.classList.remove('loading');
    target.innerHTML = `<p>The archived source could not be loaded in this browser. <a href="${SOURCES[view]}">Open the raw source directly</a>.</p>`;
    console.error(err);
  }
}

function show(view, pushHash = true) {
  const valid = view === 'map' || SOURCES[view];
  if (!valid) view = 'map';
  document.querySelectorAll('[data-view-panel]').forEach(el => {
    el.classList.toggle('active', el.dataset.viewPanel === view);
  });
  document.querySelectorAll('.navlink').forEach(el => {
    el.classList.toggle('active', el.dataset.view === view);
  });
  loadArchive(view);
  if (pushHash) history.replaceState(null, '', view === 'map' ? '#map' : `#${view}`);
  window.scrollTo({ top: 0, behavior: 'instant' });
}

document.addEventListener('click', e => {
  const trigger = e.target.closest('[data-view]');
  if (!trigger) return;
  e.preventDefault();
  show(trigger.dataset.view);
});

window.addEventListener('hashchange', () => show(location.hash.slice(1) || 'map', false));
show(location.hash.slice(1) || 'map', false);
