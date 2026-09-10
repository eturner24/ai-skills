const STATUS_CLASSES = {
  'Done': 'pf-m-green', 'In progress': 'pf-m-blue', 'Not started': 'pf-m-grey',
  'Review': 'pf-m-blue', 'Blocked': 'pf-m-red', 'Ongoing': 'pf-m-teal',
  'Handed off': 'pf-m-purple', 'Ready': 'pf-m-teal', 'Not needed': 'pf-m-grey',
  'Closed as duplicate': 'pf-m-grey',
};

function md(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function statusLabel(status) {
  const cls = STATUS_CLASSES[status] || 'pf-m-grey';
  return `<span class="pf-v6-c-label ${cls}"><span class="pf-v6-c-label__content"><span class="pf-v6-c-label__text">${status}</span></span></span>`;
}

function notesHtml(notes) {
  if (!notes) return '';
  if (typeof notes === 'string') return md(notes);
  if (notes.length === 0) return '';
  return `<ul style="margin:0 0 0 16px; list-style:disc;">${notes.map(n => `<li>${md(n)}</li>`).join('')}</ul>`;
}

function childrenTable(children) {
  const rows = children.map(c => {
    const jiraTd = `<td><a href="${c.jiraUrl}">${c.jira}</a></td>`;
    const descTd = `<td>${c.description}</td>`;
    const spTd = `<td>${c.sp != null ? c.sp : ''}</td>`;
    const statusTd = `<td>${statusLabel(c.status)}</td>`;
    return `<tr>${jiraTd}${descTd}${spTd}${statusTd}</tr>`;
  }).join('');
  return `<table class="pf-v6-c-table pf-m-compact child-table" role="grid">
    <thead><tr><th class="col-jira">Jira</th><th>Description</th><th class="col-sp">SP</th><th class="col-status">Status</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function ticketRow(t) {
  const jiraTd = `<td><a href="${t.jiraUrl}">${t.jira}</a></td>`;
  const descTd = `<td>${t.description}</td>`;
  const spTd = `<td>${t.sp != null ? t.sp : ''}</td>`;
  const statusTd = `<td>${statusLabel(t.status)}</td>`;
  return `<tr class="main-row${t.children && t.children.length ? ' has-details' : ''}">${jiraTd}${descTd}${spTd}${statusTd}</tr>`;
}

function renderTable(sub) {
  const cols = '<th class="col-jira">Jira</th><th>Description</th><th class="col-sp">SP</th><th class="col-status">Status</th>';

  let rows = '';
  for (const t of (sub.tickets || [])) {
    rows += ticketRow(t);
    if (t.children && t.children.length) {
      rows += `<tr class="detail-row"><td colspan="4">${childrenTable(t.children)}</td></tr>`;
    }
  }

  return `<table class="pf-v6-c-table pf-m-compact pf-m-grid-md" role="grid">
    <thead><tr>${cols}</tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderNonJira(items) {
  if (!items || items.length === 0) return '';
  return `<div class="non-jira-section">
    <h4>Non-Jira Items</h4>
    <table class="pf-v6-c-table pf-m-compact pf-m-grid-md" role="grid">
      <thead><tr><th style="width:30%">Short Description</th><th>Notes</th></tr></thead>
      <tbody>${items.map(item => `<tr><td>${item.description}</td><td>${notesHtml(item.notes)}</td></tr>`).join('')}</tbody>
    </table>
  </div>`;
}

function renderFlatTable(tickets) {
  const hasSP = tickets.some(t => t.sp !== undefined);

  let cols, rowFn;
  if (hasSP) {
    cols = '<th class="col-jira">Jira</th><th>Description</th><th class="col-sp">SP</th><th class="col-status">Status</th>';
    rowFn = t => `<tr class="main-row"><td><a href="${t.jiraUrl}">${t.jira}</a></td><td>${t.description}</td><td>${t.sp != null ? t.sp : ''}</td><td>${statusLabel(t.status)}</td></tr>`;
  } else {
    cols = '<th class="col-jira">Jira</th><th>Description</th><th class="col-status">Status</th>';
    rowFn = t => `<tr class="main-row"><td><a href="${t.jiraUrl}">${t.jira}</a></td><td>${t.description}</td><td>${statusLabel(t.status)}</td></tr>`;
  }

  return `<table class="pf-v6-c-table pf-m-compact pf-m-grid-md" role="grid">
    <thead><tr>${cols}</tr></thead>
    <tbody>${tickets.map(rowFn).join('')}</tbody>
  </table>`;
}

function renderRelease(release) {
  const meta = (release.meta || []).map(m =>
    `<span class="meta-chip"><strong>${m.label}:</strong> ${m.value}</span>`
  ).join('');

  let body = '';

  if (release.subReleases && release.subReleases.length > 0) {
    body = release.subReleases.map(sub => {
      const open = sub.collapsible ? '' : ' open';
      return `<details class="sub-release-collapsible"${open}>
        <summary class="sub-release-heading">${sub.heading}</summary>
        ${renderTable(sub)}
      </details>`;
    }).join('');
  } else if (release.tickets && release.tickets.length > 0) {
    body = renderFlatTable(release.tickets);
  } else {
    body = '<table class="pf-v6-c-table pf-m-compact pf-m-grid-md" role="grid"><thead><tr><th class="col-jira">Jira</th><th>Description</th><th class="col-status">Status</th></tr></thead><tbody></tbody></table>';
  }

  return `<div class="pf-v6-c-card release-card" id="${release.id}">
    <div class="pf-v6-c-card__header"><div class="pf-v6-c-card__title">${release.title}</div></div>
    ${meta ? `<div class="release-meta">${meta}</div>` : ''}
    <div class="pf-v6-c-card__body">
      ${body}
      ${renderNonJira(release.nonJiraItems)}
    </div>
  </div>`;
}

function renderArchive(section) {
  const chevron = `<svg viewBox="0 0 256 512" width="12"><path d="M64 448c-8.2 0-16.4-3.1-22.6-9.4-12.5-12.5-12.5-32.8 0-45.3L178.7 256 41.4 118.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l160 160c12.5 12.5 12.5 32.8 0 45.3l-160 160C80.4 444.9 72.2 448 64 448z" fill="currentColor"/></svg>`;
  return `<div class="archive-section">
    <div class="pf-v6-c-expandable-section" id="${section.id}">
      <button class="pf-v6-c-expandable-section__toggle" type="button" aria-expanded="false">
        <span class="pf-v6-c-expandable-section__toggle-icon">${chevron}</span>
        <span class="pf-v6-c-expandable-section__toggle-text">${section.title}</span>
      </button>
      <div class="pf-v6-c-expandable-section__content" hidden>
        ${section.releases.map(r => renderRelease(r)).join('')}
      </div>
    </div>
  </div>`;
}

export function render(data) {
  let html = `<div class="page-title">${data.title}</div>
    <div class="page-subtitle">${data.subtitle}</div>`;

  for (const section of data.sections) {
    if (section.type === 'active') {
      html += `<div class="section-title">${section.title}</div>`;
      html += section.releases.map(renderRelease).join('');
    } else {
      html += renderArchive(section);
    }
  }
  return html;
}

export function init() {
  // Expandable archive sections
  document.querySelectorAll('.pf-v6-c-expandable-section__toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.closest('.pf-v6-c-expandable-section');
      const content = section.querySelector('.pf-v6-c-expandable-section__content');
      const expanded = section.classList.toggle('pf-m-expanded');
      btn.setAttribute('aria-expanded', expanded);
      content.hidden = !expanded;
    });
  });

  // Accordion: click main-row with has-details to toggle its detail-row
  document.querySelectorAll('tr.main-row.has-details').forEach(row => {
    const detail = row.nextElementSibling;
    if (detail && detail.classList.contains('detail-row')) {
      row.addEventListener('click', () => {
        row.classList.toggle('expanded');
        detail.classList.toggle('visible');
      });
    }
  });

  // Sortable columns
  const statusOrder = {
    'blocked': 0, 'review': 1, 'in progress': 2, 'early draft': 3,
    'ready': 4, 'ongoing': 5, 'handed off': 6, 'not started': 7,
    'waiting for release': 8, 'new': 9, 'done': 10, 'done & closed': 11,
    'not needed': 12, 'closed as duplicate': 13
  };

  document.querySelectorAll('.pf-v6-c-table:not(.child-table)').forEach(table => {
    const ths = table.querySelectorAll('thead th');
    ths.forEach((th, colIdx) => {
      const arrow = document.createElement('span');
      arrow.className = 'sort-icon';
      arrow.textContent = '↕';
      th.appendChild(arrow);

      th.addEventListener('click', () => {
        const tbody = table.querySelector('tbody');
        const pairs = [];
        const rows = Array.from(tbody.children);
        for (let i = 0; i < rows.length; i++) {
          if (rows[i].classList.contains('main-row')) {
            const det = (rows[i + 1] && rows[i + 1].classList.contains('detail-row')) ? rows[i + 1] : null;
            pairs.push({ main: rows[i], detail: det });
            if (det) i++;
          }
        }
        const wasAsc = th.classList.contains('sort-asc');
        ths.forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
        const dir = wasAsc ? 'desc' : 'asc';
        th.classList.add('sort-' + dir);

        pairs.sort((a, b) => {
          const cA = a.main.children[colIdx], cB = b.main.children[colIdx];
          if (!cA || !cB) return 0;
          const tA = cA.textContent.trim().toLowerCase(), tB = cB.textContent.trim().toLowerCase();
          const hName = th.textContent.replace(/[^\w\s]/g, '').trim().toLowerCase();
          let cmp = 0;
          if (hName === 'sp') { cmp = (parseFloat(tA) || 0) - (parseFloat(tB) || 0); }
          else if (hName === 'status') { cmp = ((statusOrder[tA] ?? 50) - (statusOrder[tB] ?? 50)); }
          else { cmp = tA.localeCompare(tB); }
          return dir === 'asc' ? cmp : -cmp;
        });
        pairs.forEach(p => { tbody.appendChild(p.main); if (p.detail) tbody.appendChild(p.detail); });
      });
    });
  });

  // Active nav link on scroll
  const navLinks = document.querySelectorAll('[data-anchor]');
  function updateActiveLink() {
    let current = '';
    document.querySelectorAll('.release-card[id], .pf-v6-c-expandable-section[id]').forEach(el => {
      if (el.getBoundingClientRect().top <= 120) current = el.id;
    });
    navLinks.forEach(link => {
      link.classList.remove('pf-m-current');
      if (link.dataset.anchor === current) link.classList.add('pf-m-current');
    });
  }
  window.addEventListener('scroll', updateActiveLink);
  updateActiveLink();

  // Auto-calculate story points in sub-release headings
  document.querySelectorAll('.sub-release-heading').forEach(heading => {
    const parent = heading.closest('.sub-release-collapsible');
    let table;
    if (parent) {
      table = parent.querySelector('table:not(.child-table)');
    } else {
      table = heading.nextElementSibling?.tagName === 'TABLE'
        ? heading.nextElementSibling
        : heading.nextElementSibling?.nextElementSibling;
    }
    if (!table || table.tagName !== 'TABLE') return;
    const hdrs = Array.from(table.querySelectorAll('thead th'));
    const spIdx = hdrs.findIndex(th => th.textContent.trim().toLowerCase().replace(/[^\w]/g, '') === 'sp');
    if (spIdx === -1) return;
    let total = 0, unestimated = 0;
    table.querySelectorAll('tbody > tr.main-row').forEach(row => {
      const cell = row.children[spIdx];
      if (!cell) return;
      const val = parseFloat(cell.textContent.trim());
      if (isNaN(val)) unestimated++; else total += val;
    });
    const prefix = heading.textContent.split(/—/)[0].trim();
    let spText = total + ' SP';
    if (unestimated > 0) spText += ' (' + unestimated + ' unestimated)';
    heading.innerHTML = prefix + ' &mdash; ' + spText;
  });

  // Auto-calculate total story points in release meta
  document.querySelectorAll('.release-card').forEach(card => {
    const spChip = Array.from(card.querySelectorAll('.release-meta .meta-chip'))
      .find(chip => chip.textContent.includes('Story points:'));
    if (!spChip) return;
    let total = 0, unestimated = 0;
    card.querySelectorAll('.sub-release-heading').forEach(heading => {
      const match = heading.textContent.match(/(\d+)\s*SP/);
      if (match) total += parseInt(match[1]);
      const unMatch = heading.textContent.match(/\((\d+)\s*unestimated\)/);
      if (unMatch) unestimated += parseInt(unMatch[1]);
    });
    let spText = '<strong>Story points:</strong> ' + total;
    if (unestimated > 0) spText += ' (' + unestimated + ' unestimated)';
    spChip.innerHTML = spText;
  });

  // Open external links in new tab
  document.querySelectorAll('.main-content a[href^="http"]').forEach(a => {
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener');
  });
}
