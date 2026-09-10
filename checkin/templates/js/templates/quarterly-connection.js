export function render(data) {
  return `<div class="page-title">${data.title}</div>
    <div class="page-subtitle">${data.subtitle}</div>
    ${data.quarters.map(q => `<div class="quarter-card" id="${q.id}">
      <div class="quarter-header">
        <div class="quarter-title">${q.title}</div>
        <div class="quarter-stats">${q.stats}</div>
      </div>
      <div class="quarter-body">
        ${q.subsections.map(sub => `<div class="quarter-subsection">
          <div class="quarter-subsection-title">${sub.title}</div>
          <ul class="quarter-list">
            ${sub.items.map(item =>
              item.release
                ? `<li><span class="quarter-release-tag">${item.release}</span> ${item.text}</li>`
                : `<li>${item.text}</li>`
            ).join('')}
          </ul>
        </div>`).join('')}
      </div>
    </div>`).join('')}`;
}
