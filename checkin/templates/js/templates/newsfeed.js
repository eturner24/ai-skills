// Newsfeed page. Source of truth is newsfeed.md (parsed at load time).

const STORAGE_KEY = 'pt-newsfeed-view';
const DAY = 86400000;

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function today() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((s || '').trim());
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}

function fmtDate(d) {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function daysUntil(d) {
  return Math.round((d - today()) / DAY);
}

// ── Parser ──────────────────────────────────────────────────────

export function parse(md) {
  md = md.replace(/<!--[\s\S]*?-->/g, '');
  const lines = md.split('\n');
  const data = { title: 'Newsfeed', lastReviewed: '', ticketBaseUrl: '', keyDates: {}, sections: [] };
  let section = null;
  let item = null;
  let inMeta = false;

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    let m;
    if ((m = /^# (.+)/.exec(line))) { data.title = m[1]; continue; }
    if ((m = /^Last reviewed:\s*(.+)/.exec(line))) { data.lastReviewed = m[1]; continue; }
    if ((m = /^Ticket base URL:\s*(\S+)/.exec(line))) { data.ticketBaseUrl = m[1].replace(/\/?$/, '/'); continue; }
    if ((m = /^## (.+)/.exec(line))) {
      section = { title: m[1], id: 'sec-' + slug(m[1]), items: [] };
      item = null;
      if (m[1] !== 'Key dates') data.sections.push(section);
      continue;
    }
    if (section && section.title === 'Key dates') {
      if (/^\|/.test(line) && !/^\|\s*:?-/.test(line) && !/^\|\s*Key\s*\|/.test(line)) {
        const c = line.split('|').slice(1, -1).map(x => x.trim());
        if (c[0]) data.keyDates[c[0]] = { key: c[0], date: parseDate(c[1]), raw: c[1], label: c[2] || c[0], source: c[3] || '', received: c[4] || '' };
      }
      continue;
    }
    if ((m = /^### (.+)/.exec(line)) && section) {
      item = { title: m[1], section: section.title, sectionId: section.id, tags: [], dates: [], body: [], received: '', source: '', expires: '', ticket: '' };
      section.items.push(item);
      inMeta = true;
      continue;
    }
    if (!item) continue;
    if (inMeta && (m = /^- (received|source|tags|expires|dates|ticket):\s*(.*)$/.exec(line))) {
      const [, k, v] = m;
      if (k === 'tags' || k === 'dates') item[k] = v.split(',').map(x => x.trim()).filter(Boolean);
      else item[k] = v.trim();
      continue;
    }
    inMeta = false;
    item.body.push(line);
  }
  return data;
}

// ── Rendering ───────────────────────────────────────────────────

function inline(text, keyDates) {
  let s = esc(text);
  s = s.replace(/\{\{([^}]+)\}\}/g, (_, k) => {
    const kd = keyDates[k.trim()];
    if (!kd || !kd.date) return `<span class="nf-date nf-date-missing" title="Key date '${esc(k)}' not in table">[date removed]</span>`;
    return `<span class="nf-date" title="${esc(kd.label)} (${esc(kd.source)})">${fmtDate(kd.date)}</span>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return s;
}

function renderBody(lines, keyDates) {
  const out = [];
  let list = null;
  let para = [];
  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(' '), keyDates)}</p>`); para = []; } };
  const flushList = () => { if (list) { out.push(`<ul>${list.map(l => `<li>${inline(l, keyDates)}</li>`).join('')}</ul>`); list = null; } };
  for (const l of lines) {
    if (/^- /.test(l)) { flushPara(); (list = list || []).push(l.slice(2)); }
    else if (!l.trim()) { flushPara(); flushList(); }
    else { flushList(); para.push(l.trim()); }
  }
  flushPara(); flushList();
  return out.join('');
}

function renderItem(item, keyDates, ticketBaseUrl) {
  const exp = parseDate(item.expires);
  const expired = exp && exp < today();
  const tags = item.tags.map(t => `<button type="button" class="nf-tag" data-tag="${esc(t)}">${esc(t)}</button>`).join('');
  const ticket = !item.ticket ? ''
    : ticketBaseUrl
      ? `<a class="nf-ticket" href="${esc(ticketBaseUrl + item.ticket)}" target="_blank" rel="noopener">${esc(item.ticket)}</a>`
      : `<span class="nf-ticket">${esc(item.ticket)}</span>`;
  const expTag = expired ? '<span class="nf-expired">Expired</span>' : '';
  const search = esc([item.title, item.source, item.tags.join(' '), item.body.join(' ')].join(' ').toLowerCase());
  return `<article class="nf-item${expired ? ' is-expired' : ''}" data-tags="${esc(item.tags.join(','))}"
      data-received="${esc(item.received)}" data-expires="${esc(item.expires)}" data-section="${esc(item.sectionId)}" data-search="${search}">
    <header class="nf-item-head">
      <h3 class="nf-item-title">${inline(item.title, keyDates)}</h3>
      ${expTag}
    </header>
    <div class="nf-item-body">${renderBody(item.body, keyDates)}</div>
    <footer class="nf-item-meta">
      <span class="nf-meta-text">${esc(item.source)}${item.received ? ' · ' + esc(item.received) : ''}${item.expires ? ' · expires ' + esc(item.expires) : ''}</span>
      ${ticket}${tags}
    </footer>
  </article>`;
}

function renderKeyDates(keyDates) {
  const rows = Object.values(keyDates).sort((a, b) => (a.date || 0) - (b.date || 0)).map(kd => {
    const n = kd.date ? daysUntil(kd.date) : null;
    const cls = n === null ? '' : n < 0 ? ' is-past' : n <= 7 ? ' is-soon' : '';
    const when = n === null ? 'invalid date' : n < 0 ? `${-n} days ago` : n === 0 ? 'today' : `in ${n} days`;
    return `<tr class="${cls.trim()}">
      <td class="nf-kd-date">${kd.date ? fmtDate(kd.date) : esc(kd.raw)}</td>
      <td class="nf-kd-when">${when}</td>
      <td>${esc(kd.label)}</td>
      <td class="nf-kd-source">${esc(kd.source)} · ${esc(kd.received)}</td>
    </tr>`;
  }).join('');
  if (!rows) return '';
  return `<section class="nf-panel" id="sec-key-dates">
    <h2 class="nf-section-title">Key dates</h2>
    <table class="nf-kd-table"><tbody>${rows}</tbody></table>
  </section>`;
}

export function render(data) {
  const all = data.sections.flatMap(s => s.items);
  const tagCounts = {};
  all.forEach(i => i.tags.forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; }));
  const tagChips = Object.keys(tagCounts).sort().map(t =>
    `<button type="button" class="nf-chip" data-filter-tag="${esc(t)}">${esc(t)} <span class="nf-chip-count">${tagCounts[t]}</span></button>`).join('');

  data.sidebarNav = [{
    group: 'Sections',
    items: [{ anchor: 'sec-key-dates', label: 'Key dates' }, ...data.sections.map(s => ({ anchor: s.id, label: s.title }))]
  }];

  const sectionsHtml = data.sections.map(s => `<section class="nf-section" id="${s.id}">
      <h2 class="nf-section-title">${esc(s.title)} <span class="nf-count" data-count-for="${s.id}"></span></h2>
      <div class="nf-items">${s.items.map(i => renderItem(i, data.keyDates, data.ticketBaseUrl)).join('')}</div>
    </section>`).join('');

  return `<h1 class="page-title">${esc(data.title)}</h1>
    <p class="page-subtitle">News from check-ins that does not go into the daily log. Last reviewed ${esc(data.lastReviewed || 'never')}.</p>
    ${renderKeyDates(data.keyDates)}
    <div class="nf-toolbar">
      <input type="search" class="nf-search" id="nf-search" placeholder="Search news" aria-label="Search news">
      <label class="nf-sort-label">Sort
        <select id="nf-sort" class="nf-sort">
          <option value="section">By section</option>
          <option value="newest">Newest first</option>
          <option value="expires">Expires soonest</option>
        </select>
      </label>
      <label class="nf-sort-label"><input type="checkbox" id="nf-show-expired"> Show expired</label>
      <span class="nf-result-count" id="nf-result-count"></span>
    </div>
    <div class="nf-chips" id="nf-chips">${tagChips}<button type="button" class="nf-chip nf-chip-clear" id="nf-clear" hidden>Clear tags</button></div>
    <div id="nf-grouped">${sectionsHtml}</div>
    <div id="nf-flat" class="nf-items" hidden></div>`;
}

// ── Interaction ─────────────────────────────────────────────────

export function init() {
  let view = { tags: [], sort: 'section', q: '', showExpired: false };
  try { view = { ...view, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; } catch {}

  const $ = id => document.getElementById(id);
  const items = [...document.querySelectorAll('.nf-item')];
  const homes = new Map(items.map(el => [el, el.parentElement]));

  $('nf-sort').value = view.sort;
  $('nf-search').value = view.q;
  $('nf-show-expired').checked = view.showExpired;

  function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(view)); } catch {} }

  function apply() {
    const sel = new Set(view.tags);
    document.querySelectorAll('[data-filter-tag]').forEach(c => c.classList.toggle('is-on', sel.has(c.dataset.filterTag)));
    document.querySelectorAll('.nf-tag').forEach(c => c.classList.toggle('is-on', sel.has(c.dataset.tag)));
    $('nf-clear').hidden = sel.size === 0;

    let shown = 0;
    items.forEach(el => {
      const tags = el.dataset.tags.split(',');
      const okTag = sel.size === 0 || tags.some(t => sel.has(t));
      const okQ = !view.q || el.dataset.search.includes(view.q.toLowerCase());
      const okExp = view.showExpired || !el.classList.contains('is-expired');
      const ok = okTag && okQ && okExp;
      el.hidden = !ok;
      if (ok) shown++;
    });
    $('nf-result-count').textContent = `${shown} of ${items.length} items`;

    const grouped = view.sort === 'section';
    $('nf-grouped').hidden = !grouped;
    $('nf-flat').hidden = grouped;
    if (grouped) {
      items.forEach(el => homes.get(el).appendChild(el));
      document.querySelectorAll('.nf-section').forEach(sec => {
        const n = sec.querySelectorAll('.nf-item:not([hidden])').length;
        sec.hidden = n === 0;
        sec.querySelector('.nf-count').textContent = n;
      });
    } else {
      const key = view.sort === 'newest' ? 'received' : 'expires';
      const dir = view.sort === 'newest' ? -1 : 1;
      [...items].sort((a, b) => dir * (a.dataset[key] || '9999').localeCompare(b.dataset[key] || '9999'))
        .forEach(el => $('nf-flat').appendChild(el));
    }
    save();
  }

  function toggleTag(t) {
    view.tags = view.tags.includes(t) ? view.tags.filter(x => x !== t) : [...view.tags, t];
    apply();
  }

  document.querySelectorAll('[data-filter-tag]').forEach(c => c.addEventListener('click', () => toggleTag(c.dataset.filterTag)));
  document.querySelectorAll('.nf-tag').forEach(c => c.addEventListener('click', () => toggleTag(c.dataset.tag)));
  $('nf-clear').addEventListener('click', () => { view.tags = []; apply(); });
  $('nf-sort').addEventListener('change', e => { view.sort = e.target.value; apply(); });
  $('nf-search').addEventListener('input', e => { view.q = e.target.value.trim(); apply(); });
  $('nf-show-expired').addEventListener('change', e => { view.showExpired = e.target.checked; apply(); });

  apply();
}
