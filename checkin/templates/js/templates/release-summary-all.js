import { renderStats, renderVelocity } from './release-summary.js';

function renderYears(years) {
  return `<div id="yearly" class="section-title">Year-over-Year</div>
    ${years.map(y => `<div class="release-breakdown">
      <div class="release-breakdown-header">
        <div>
          <span class="release-breakdown-title">${y.title}</span>
          ${y.chip ? `<span class="status-chip">${y.chip}</span>` : ''}
        </div>
        <div class="release-breakdown-meta">
          ${y.meta.map(m => `<span>${m}</span>`).join('')}
        </div>
      </div>
      <div class="release-breakdown-body">
        <div class="status-row"><div class="status-item">${y.releasesDescription}</div></div>
        <div class="progress-text"><a href="${y.detailLink}">${y.detailLabel}</a></div>
      </div>
    </div>`).join('')}`;
}

export function render(data) {
  return `<div class="page-title">${data.title}</div>
    <div class="page-subtitle">${data.subtitle}</div>
    ${renderStats(data.stats)}
    ${renderVelocity(data.velocity)}
    ${renderYears(data.years)}`;
}
