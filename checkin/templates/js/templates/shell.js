export function renderSidebar(navData, currentPageId, contextNavGroups) {
  const groupsHtml = navData.sidebarGroups.map(group => {
    const items = group.items.map(item => {
      const page = navData.pages.find(p => p.id === item.id);
      const route = page ? page.route : '#';
      const current = item.id === currentPageId ? ' pf-m-current' : '';
      return `<li class="pf-v6-c-nav__item"><a href="${route}" class="pf-v6-c-nav__link${current}">${item.label}</a></li>`;
    }).join('');
    return `<div class="pf-v6-c-nav__group">
      <h3 class="pf-v6-c-nav__section-title">${group.group}</h3>
      <ul class="pf-v6-c-nav__list">${items}</ul>
    </div>`;
  }).join('');

  const contextHtml = (contextNavGroups || []).map(group => {
    const items = group.items.map(item =>
      `<li class="pf-v6-c-nav__item"><a href="javascript:void(0)" class="pf-v6-c-nav__link" data-anchor="${item.anchor}">${item.label}</a></li>`
    ).join('');
    return `<div class="pf-v6-c-nav__group">
      <h3 class="pf-v6-c-nav__section-title">${group.group}</h3>
      <ul class="pf-v6-c-nav__list">${items}</ul>
    </div>`;
  }).join('');

  return `<nav class="pf-v6-c-nav" aria-label="Side navigation">
    ${groupsHtml}
    ${contextHtml}
  </nav>`;
}

export function initSidebarScrolling() {
  document.querySelectorAll('[data-anchor]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const anchor = link.dataset.anchor;
      const target = document.getElementById(anchor);
      if (target) {
        const expSection = target.closest('.pf-v6-c-expandable-section');
        if (expSection && !expSection.classList.contains('pf-m-expanded')) {
          expSection.querySelector('.pf-v6-c-expandable-section__toggle').click();
        }
        setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
      }
    });
  });
}
