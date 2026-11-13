const PRIORITY_CLASS = { high: 'tag-priority-high', medium: 'tag-priority-medium', low: 'tag-priority-low' };
const PRIORITY_LABEL = { high: 'High', medium: 'Medium', low: 'Low' };

function renderItem(item, isCompleted) {
  const completedClass = isCompleted ? ' completed' : '';
  const checked = isCompleted ? ' checked' : '';
  const ticketTag = item.ticket
    ? `<span class="todo-tag tag-ticket"><a href="${item.ticket.url}">${item.ticket.key}</a></span>`
    : '';
  const releaseTag = item.release
    ? `<span class="todo-tag tag-release">${item.release}</span>`
    : '';
  const priorityTag = item.priority
    ? `<span class="todo-tag ${PRIORITY_CLASS[item.priority]}">${PRIORITY_LABEL[item.priority]}</span>`
    : '';
  const waitingTag = item.waiting
    ? '<span class="todo-tag tag-waiting">Waiting</span>'
    : '';

  return `<li class="todo-item${completedClass}">
    <input type="checkbox" class="todo-checkbox" data-key="${item.key}"${checked}>
    <div class="todo-body">
      <div class="todo-text">${item.text}</div>
      <div class="todo-meta">
        ${ticketTag}${releaseTag}${priorityTag}${waitingTag}
      </div>
    </div>
  </li>`;
}

function renderGroup(group, completedKeys) {
  const isCompletedGroup = group.id === 'completed';
  const items = group.items.map(item => {
    const isDone = isCompletedGroup || completedKeys.has(item.key);
    return renderItem(item, isDone);
  }).join('');

  const collapsible = group.collapsible
    ? ` style="cursor:pointer;" onclick="document.getElementById('${group.id}-list').classList.toggle('collapsed')"`
    : '';
  const toggleHint = group.collapsible
    ? ' <span style="font-size:12px; font-weight:400; color:#6a6e73; margin-left:auto;">(click to toggle)</span>'
    : '';
  const listClass = group.collapsible ? ' collapsed' : '';

  return `<div class="todo-group" id="${group.id}">
    <div class="todo-group-header"${collapsible}>
      ${group.title} <span class="todo-group-count" data-group="${group.id}"></span>${toggleHint}
    </div>
    <ul class="todo-list${listClass}" id="${group.id}-list" data-group-list="${group.id}">
      ${items}
    </ul>
  </div>`;
}

export function render(data) {
  const completedKeys = new Set();
  const completedGroup = data.groups.find(g => g.id === 'completed');
  if (completedGroup) completedGroup.items.forEach(item => completedKeys.add(item.key));

  return `<h1 class="page-title">${data.title}</h1>
    <p class="page-subtitle">${data.subtitle}</p>
    <div class="summary-bar">
      <div class="summary-stat"><div class="stat-value stat-total" id="stat-total">0</div><div class="stat-label">Total</div></div>
      <div class="summary-stat"><div class="stat-value stat-open" id="stat-open">0</div><div class="stat-label">Open</div></div>
      <div class="summary-stat"><div class="stat-value stat-done" id="stat-done">0</div><div class="stat-label">Done</div></div>
    </div>
    ${data.groups.map(g => renderGroup(g, completedKeys)).join('')}
    <div class="save-bar hidden" id="save-bar">
      <button class="save-btn" id="save-btn">Save to file</button>
      <span class="save-status" id="save-status"></span>
    </div>`;
}

export function init(data) {
  const STORAGE_KEY = 'pt-todo-state';
  let dirty = false;

  function loadLocalState() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
  }

  function saveLocalState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function getCurrentState() {
    const state = {};
    document.querySelectorAll('.todo-checkbox').forEach(cb => {
      state[cb.dataset.key] = cb.closest('.todo-item').classList.contains('completed');
    });
    return state;
  }

  function moveToCompleted(item) {
    const completedList = document.getElementById('completed-list');
    item.classList.add('completed');
    item.querySelector('.todo-checkbox').checked = true;
    if (completedList) completedList.appendChild(item);
  }

  function moveToOriginal(item) {
    item.classList.remove('completed');
    item.querySelector('.todo-checkbox').checked = false;

    const tag = item.querySelector('.tag-release');
    const release = tag ? tag.textContent.trim() : '';
    let targetGroup = 'general';
    if (release.startsWith('3.4')) targetGroup = '34ga';
    else if (release.startsWith('3.5')) targetGroup = '35';

    const list = document.querySelector(`[data-group-list="${targetGroup}"]`);
    if (list) list.appendChild(item);
  }

  function updateCounts() {
    const allItems = document.querySelectorAll('.todo-item');
    let total = allItems.length;
    let done = document.querySelectorAll('.todo-item.completed').length;
    let open = total - done;

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-open').textContent = open;
    document.getElementById('stat-done').textContent = done;

    document.querySelectorAll('.todo-group-count').forEach(badge => {
      const group = badge.dataset.group;
      const list = document.querySelector(`[data-group-list="${group}"]`);
      if (list) {
        const items = list.querySelectorAll('.todo-item');
        const checked = list.querySelectorAll('.todo-item.completed');
        badge.textContent = group === 'completed' ? checked.length : (items.length - checked.length) + ' open';
      }
    });
  }

  function markDirty() {
    dirty = true;
    document.getElementById('save-bar').classList.remove('hidden');
    document.getElementById('save-status').textContent = '';
  }

  // Load state: try todo-state.json first, fall back to localStorage
  async function loadState() {
    let state = {};
    try {
      const resp = await fetch('todo-state.json');
      if (resp.ok) {
        const jsonState = await resp.json();
        const localState = loadLocalState();
        const allKeys = new Set([...Object.keys(jsonState), ...Object.keys(localState)]);
        allKeys.forEach(k => { state[k] = jsonState[k] || localState[k] || false; });
      } else {
        state = loadLocalState();
      }
    } catch {
      state = loadLocalState();
    }

    document.querySelectorAll('.todo-checkbox').forEach(cb => {
      const key = cb.dataset.key;
      if (state[key]) {
        moveToCompleted(cb.closest('.todo-item'));
      }

      cb.addEventListener('change', () => {
        if (cb.checked) {
          moveToCompleted(cb.closest('.todo-item'));
        } else {
          moveToOriginal(cb.closest('.todo-item'));
        }
        saveLocalState(getCurrentState());
        updateCounts();
        markDirty();
      });
    });

    updateCounts();
  }

  loadState();

  // Save button
  document.getElementById('save-btn').addEventListener('click', () => {
    const state = getCurrentState();
    const json = JSON.stringify(state, null, 2) + '\n';
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'todo-state.json';
    a.click();
    URL.revokeObjectURL(url);
    dirty = false;
    document.getElementById('save-status').textContent = 'Saved. Replace todo-state.json with the downloaded file.';
    setTimeout(() => {
      if (!dirty) document.getElementById('save-bar').classList.add('hidden');
    }, 5000);
  });

  // Open external links in new tab
  document.querySelectorAll('#main-content a[href^="http"]').forEach(a => {
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener');
  });
}
