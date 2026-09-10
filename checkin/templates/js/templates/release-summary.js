export function renderStats(stats) {
  return `<div id="stats" class="section-title">Overview</div>
    <div class="stat-grid">
      ${stats.map(s => `<div class="stat-card">
        <div class="stat-label">${s.label}</div>
        <div class="stat-value">${s.value}</div>
        ${s.detail ? `<div class="stat-detail">${s.detail}</div>` : ''}
      </div>`).join('')}
    </div>`;
}

export function renderVelocity(velocity) {
  const max = Math.max(...velocity.bars.map(b => b.value));
  return `<div id="velocity" class="chart-card">
    <div class="chart-title">${velocity.title}</div>
    <div class="bar-chart">
      ${velocity.bars.map(bar => {
        const pct = max > 0 ? Math.round((bar.value / max) * 100) : 0;
        const extra = bar.style || (bar.projected ? ' opacity: 0.6;' : '');
        return `<div class="bar-group">
          <div class="bar-value">${bar.value}</div>
          <div class="bar" style="height: ${pct}%;${extra}"></div>
          <div class="bar-label">${bar.label}</div>
        </div>`;
      }).join('')}
    </div>
    ${velocity.footnote ? `<div style="font-size: 11px; color: #6a6e73; margin-top: 8px;">${velocity.footnote}</div>` : ''}
  </div>`;
}

const STATUS_DOT = { done: 'dot-done', inProgress: 'dot-progress', notStarted: 'dot-new', review: 'dot-review' };
const STATUS_LABEL = { done: 'Done', inProgress: 'In Progress', notStarted: 'Not Started', review: 'Review' };

function renderReleases(releases) {
  return `<div id="releases" class="section-title">Release Breakdown</div>
    ${releases.map(r => {
      const statusItems = Object.entries(r.statusCounts || {})
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `<div class="status-item"><span class="status-dot ${STATUS_DOT[k]}"></span> ${STATUS_LABEL[k]}: <strong>${v}</strong></div>`)
        .join('');
      return `<div class="release-breakdown">
        <div class="release-breakdown-header">
          <div>
            <span class="release-breakdown-title">${r.title}</span>
            ${r.statusChip ? `<span class="status-chip">${r.statusChip}</span>` : ''}
          </div>
          <div class="release-breakdown-meta">
            <span>${r.date}</span>
            ${r.sp != null ? `<span>${r.sp} SP</span>` : ''}
          </div>
        </div>
        <div class="release-breakdown-body">
          <div class="status-row">${statusItems}</div>
          <div class="progress-bar-container"><div class="progress-bar-fill" style="width: ${r.progressPercent}%"></div></div>
          ${r.progressText ? `<div class="progress-text">${r.progressText}</div>` : ''}
        </div>
      </div>`;
    }).join('')}`;
}

export function render(data) {
  return `<div class="page-title">${data.title}</div>
    <div class="page-subtitle">${data.subtitle}</div>
    ${renderStats(data.stats)}
    ${renderVelocity(data.velocity)}
    ${renderReleases(data.releases)}`;
}
