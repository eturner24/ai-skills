import { renderSidebar, initSidebarScrolling } from './templates/shell.js';
import { render as renderReleaseSummary } from './templates/release-summary.js';
import { render as renderReleaseSummaryAll } from './templates/release-summary-all.js';
import { render as renderQuarterlyConnection } from './templates/quarterly-connection.js';
import { render as renderProjectTracking, init as initProjectTracking } from './templates/project-tracking.js';
import { render as renderTodoList, init as initTodoList } from './templates/todo-list.js';

import navData from '../data/nav.js';

const TEMPLATES = {
  'release-summary':     { render: renderReleaseSummary },
  'release-summary-all': { render: renderReleaseSummaryAll },
  'quarterly-connection': { render: renderQuarterlyConnection },
  'project-tracking':    { render: renderProjectTracking, init: initProjectTracking },
  'todo-list':           { render: renderTodoList, init: initTodoList },
};

const dataCache = {};

async function loadData(path) {
  if (dataCache[path]) return dataCache[path];
  const mod = await import('../' + path);
  dataCache[path] = mod.default;
  return mod.default;
}

let currentCssLinks = [];

function loadCSS(hrefs) {
  currentCssLinks.forEach(link => link.remove());
  currentCssLinks = hrefs.map(href => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
    return link;
  });
}

const appTitle = document.title || 'Project Tracking';

async function handleRoute() {
  try {
    let hash = location.hash;
    if (!hash || hash === '#' || hash === '#/') {
      location.hash = navData.defaultRoute;
      return;
    }

    const page = navData.pages.find(p => p.route === hash);
    if (!page) {
      location.hash = navData.defaultRoute;
      return;
    }

    document.title = `${page.title} — ${appTitle}`;
    loadCSS(page.css);

    const data = await loadData(page.dataFile);
    const tmpl = TEMPLATES[page.template];

    document.getElementById('sidebar').innerHTML = renderSidebar(navData, page.id, data.sidebarNav);
    document.getElementById('main-content').innerHTML = tmpl.render(data);

    initSidebarScrolling();

    if (tmpl.init) tmpl.init(data);

    window.scrollTo(0, 0);
  } catch (e) {
    console.error('Route error:', e);
    document.getElementById('main-content').innerHTML =
      `<pre style="color:red;padding:20px;white-space:pre-wrap;">${e.message}\n${e.stack}</pre>`;
  }
}

window.addEventListener('hashchange', handleRoute);
handleRoute();
