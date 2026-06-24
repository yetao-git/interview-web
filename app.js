import { STAGES, INTERVIEW_TYPES, INTERVIEW_FEEDBACKS } from './lib/constants.js';
import { normalizeInterviewRow, normalizeInterviewTimeValue, formatDateTimeValue, toDateTimeLocalValue, formatInterviewTimeDisplayValue } from './lib/normalize.js';

export { STAGES, INTERVIEW_TYPES, INTERVIEW_FEEDBACKS };
export { normalizeInterviewRow, normalizeInterviewTimeValue, formatDateTimeValue, toDateTimeLocalValue, formatInterviewTimeDisplayValue };
export { createEmptyInterview, normalizeColumnWidths };

const SESSION_KEY = 'interview-session';

const COLUMN_DEFINITIONS = [
  { key: 'index', label: '序号', readonly: true },
  { key: 'companyName', label: '公司名称' },
  { key: 'interviewTime', label: '面试时间', type: 'datetime-local' },
  { key: 'interviewType', label: '面试方式', type: 'select', options: INTERVIEW_TYPES },
  { key: 'stage', label: '面试阶段', type: 'select', options: STAGES },
  { key: 'interviewFeedback', label: '面试反馈', type: 'select', options: INTERVIEW_FEEDBACKS },
  { key: 'salaryRange', label: '薪资范围' },
  { key: 'positionTitle', label: '岗位名称' },
  { key: 'location', label: '公司位置' },
  { key: 'notes', label: '面经' },
  { key: 'actions', label: '操作', readonly: true }
];

const DEFAULT_COLUMN_WIDTHS = {
  index: 72, companyName: 180, interviewTime: 190, interviewType: 120,
  stage: 120, interviewFeedback: 120, salaryRange: 140, positionTitle: 180,
  location: 160, notes: 260, actions: 96
};

const COLUMN_WIDTHS_KEY = 'interview-table-widths';

function getSession(win) {
  try {
    const href = win?.location?.href;
    if (href) {
      const url = new URL(href);
      const userId = url.searchParams.get('userId');
      if (userId) {
        return { userId };
      }
    }
    const storage = win?.sessionStorage;
    if (!storage) return null;
    const raw = storage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function logout(win) {
  if (win?.location) win.location.href = '/pool.html';
}

function createEmptyInterview() {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    companyName: '', interviewTime: '',
    interviewType: INTERVIEW_TYPES[0], stage: STAGES[0],
    interviewFeedback: INTERVIEW_FEEDBACKS[0],
    salaryRange: '', positionTitle: '', location: '', notes: ''
  };
}

function normalizeColumnWidths(rawWidths) {
  const widths = { ...DEFAULT_COLUMN_WIDTHS };
  for (const key of Object.keys(DEFAULT_COLUMN_WIDTHS)) {
    const nextWidth = Number(rawWidths?.[key]);
    if (Number.isFinite(nextWidth) && nextWidth >= 120) widths[key] = nextWidth;
  }
  widths.index = Math.max(72, widths.index);
  widths.actions = Math.max(96, widths.actions);
  return widths;
}

function loadColumnWidths(win) {
  try {
    const raw = win.localStorage?.getItem(COLUMN_WIDTHS_KEY) || '{}';
    return normalizeColumnWidths(JSON.parse(raw));
  } catch { return { ...DEFAULT_COLUMN_WIDTHS }; }
}

function saveColumnWidths(win, widths) {
  win.localStorage?.setItem(COLUMN_WIDTHS_KEY, JSON.stringify(widths));
}

function createEditor(doc, column, currentValue) {
  if (column.type === 'select') {
    const select = doc.createElement('select');
    for (const opt of (column.options || [])) {
      const option = doc.createElement('option');
      option.value = opt; option.textContent = opt;
      select.appendChild(option);
    }
    select.value = (column.options || []).includes(currentValue) ? currentValue : (column.options[0] || '');
    return select;
  }
  const input = doc.createElement('input');
  input.type = column.type || 'text';
  input.value = column.type === 'datetime-local' ? toDateTimeLocalValue(currentValue) : currentValue;
  return input;
}

export function createApp({ document, window, fetch }) {
  const state = {
    rows: [], editing: null, columnWidths: loadColumnWidths(window),
    lastSavedRowsSnapshot: '[]', pageSize: 5, currentPage: 1,
    statsVisible: true, searchTerm: '', isSearchActive: false
  };
  let activeDragSession = null;

  function setMessage(text, isError = false) {
    const node = document.querySelector('#message');
    if (node) { node.textContent = text; node.style.color = isError ? '#b91c1c' : '#2563eb'; }
  }

  async function fetchRows() {
    const session = getSession(window);
    if (session) {
      const response = await fetch(`/api/my/interviews?userId=${session.userId}`);
      if (!response.ok) throw new Error('读取数据失败');
      const data = await response.json();
      return (data.interviews || []).map((row) => normalizeInterviewRow(row));
    }
    const response = await fetch('/api/interviews');
    if (!response.ok) throw new Error('读取数据失败');
    const rows = await response.json();
    return rows.map((row) => normalizeInterviewRow(row));
  }

  function commitActiveEditing() {
    const draft = getEditingDraftState();
    if (draft) { updateRow(draft.rowId, draft.columnKey, draft.draftValue); state.editing = null; renderBody(); }
  }

  async function saveRows() {
    const session = getSession(window);
    commitActiveEditing();
    state.rows = state.rows.map((row) => normalizeInterviewRow(row));
    if (session) {
      const response = await fetch('/api/my/interviews', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: session.userId, interviews: state.rows })
      });
      if (response.ok) { state.lastSavedRowsSnapshot = JSON.stringify(state.rows); return; }
      const body = await response.json().catch(() => ({ error: '保存失败' }));
      throw new Error(body.error || '保存失败');
    }
    const response = await fetch('/api/interviews', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(state.rows)
    });
    if (response.ok) { state.lastSavedRowsSnapshot = JSON.stringify(state.rows); return; }
    const body = await response.json().catch(() => ({ error: '保存失败' }));
    throw new Error(body.error || '保存失败');
  }

  function getEditingDraftState() {
    if (!state.editing) return null;
    const { rowId, columnKey } = state.editing;
    const row = state.rows.find((i) => i.id === rowId);
    const column = COLUMN_DEFINITIONS.find((i) => i.key === columnKey);
    const control = document.querySelector('.cell-editor');
    if (!row || !column || !control) return null;
    const currentValue = row[columnKey] || '';
    const draftValue = column.type === 'datetime-local' ? formatDateTimeValue(control.value) : String(control.value).trim();
    return { rowId, columnKey, currentValue, draftValue, hasChanges: draftValue !== currentValue };
  }

  function hasUnsavedChanges() {
    return JSON.stringify(state.rows) !== state.lastSavedRowsSnapshot || Boolean(getEditingDraftState()?.hasChanges);
  }

  function getInterviewFeedbackPriority(fb) {
    const n = fb === '待推进' ? '推进中' : (INTERVIEW_FEEDBACKS.includes(fb) ? fb : INTERVIEW_FEEDBACKS[0]);
    return n === '待面试' ? 0 : n === '推进中' ? 1 : 2;
  }

  function compareRowsForDisplay(a, b) {
    const d = getInterviewFeedbackPriority(a.interviewFeedback) - getInterviewFeedbackPriority(b.interviewFeedback);
    if (d !== 0) return d;
    const tA = a.interviewTime || '', tB = b.interviewTime || '';
    if (tA !== tB) return tB.localeCompare(tA);
    return String(b.id || '').localeCompare(String(a.id || ''));
  }

  function getTotalPages() {
    let count = state.rows.length;
    if (state.searchTerm) {
      count = state.rows.filter((r) => (r.companyName || '').toLowerCase().includes(state.searchTerm.toLowerCase())).length;
    }
    return Math.max(1, Math.ceil(count / state.pageSize));
  }

  function clampCurrentPage() { state.currentPage = Math.min(Math.max(state.currentPage, 1), getTotalPages()); }

  function getVisibleRows() {
    clampCurrentPage();
    let rows = state.rows;
    if (state.searchTerm) rows = rows.filter((r) => (r.companyName || '').toLowerCase().includes(state.searchTerm.toLowerCase()));
    const total = rows.length, start = (state.currentPage - 1) * state.pageSize;
    return [...rows].sort(compareRowsForDisplay).slice(start, start + state.pageSize)
      .map((row, i) => ({ row, displayIndex: total - start - i }));
  }

  function getStatsSummary() {
    return state.rows.reduce((s, r) => {
      const fb = r.interviewFeedback === '待推进' ? '推进中' : (INTERVIEW_FEEDBACKS.includes(r.interviewFeedback) ? r.interviewFeedback : INTERVIEW_FEEDBACKS[0]);
      if (fb === '待面试') s.pending++; if (fb === '推进中') s.active++; if (r.stage === 'Offer') s.offer++;
      return s;
    }, { pending: 0, active: 0, offer: 0 });
  }

  function renderStatsToggle() {
    const btn = document.querySelector('#toggle-stats-button');
    if (!btn) return;
    const text = state.statsVisible ? '隐藏' : '显示';
    btn.setAttribute('aria-label', `${text}统计数据`);
    btn.setAttribute('aria-pressed', String(state.statsVisible));
    btn.setAttribute('title', `${text}统计数据`);
    btn.textContent = state.statsVisible ? '🙈' : '👀';
  }

  function renderStats() {
    const node = document.querySelector('#stats');
    if (!node) return;
    if (!state.statsVisible) { node.replaceChildren(); return; }
    const summary = getStatsSummary();
    const cards = [
      { key: 'pending', label: '待面试', value: summary.pending, className: 'pending' },
      { key: 'active', label: '推进中', value: summary.active, className: 'active' },
      { key: 'offer', label: 'Offer', value: summary.offer, className: 'offer' }
    ].map((item) => {
      const card = document.createElement('section'); card.className = `stat-card ${item.className}`;
      const v = document.createElement('div'); v.className = 'stat-card-value'; v.textContent = String(item.value);
      const l = document.createElement('div'); l.className = 'stat-card-label'; l.textContent = item.label;
      card.appendChild(v); card.appendChild(l); return card;
    });
    node.replaceChildren(...cards);
  }

  function renderHead() {
    const head = document.querySelector('#table-head');
    const row = document.createElement('tr');
    for (const col of COLUMN_DEFINITIONS) {
      const th = document.createElement('th'); th.dataset.columnKey = col.key;
      th.style.width = `${state.columnWidths[col.key]}px`; th.textContent = col.label;
      const handle = document.createElement('button'); handle.type = 'button';
      handle.className = 'resize-handle'; handle.dataset.columnKey = col.key;
      handle.setAttribute('aria-label', `调整${col.label}列宽`);
      th.appendChild(handle); row.appendChild(th);
    }
    head.replaceChildren(row);
  }

  function renderBody() {
    const body = document.querySelector('#table-body');
    renderStats();
    if (state.rows.length === 0) {
      const tr = document.createElement('tr'); tr.className = 'empty-row';
      const td = document.createElement('td'); td.colSpan = COLUMN_DEFINITIONS.length;
      td.textContent = '暂无面试记录，点击“新增记录”开始填写';
      tr.appendChild(td); body.replaceChildren(tr); applyColumnWidths(); return;
    }
    if (state.searchTerm && getVisibleRows().length === 0) {
      const tr = document.createElement('tr'); tr.className = 'empty-row';
      const td = document.createElement('td'); td.colSpan = COLUMN_DEFINITIONS.length;
      td.textContent = '未找到匹配的记录';
      tr.appendChild(td); body.replaceChildren(tr); applyColumnWidths(); return;
    }
    const rows = getVisibleRows().map(({ row: item, displayIndex }) => {
      const tr = document.createElement('tr');
      for (const col of COLUMN_DEFINITIONS) {
        const td = document.createElement('td'); td.dataset.columnKey = col.key;
        td.style.width = `${state.columnWidths[col.key]}px`;
        if (col.key === 'index') td.textContent = String(displayIndex);
        else if (col.key === 'actions') {
          const btn = document.createElement('button'); btn.type = 'button';
          btn.className = 'danger'; btn.textContent = '删除';
          btn.addEventListener('click', () => deleteRow(item.id)); td.appendChild(btn);
        } else {
          td.dataset.rowId = item.id; td.className = 'editable-cell'; td.tabIndex = 0;
          td.textContent = col.key === 'interviewTime' ? formatInterviewTimeDisplayValue(item[col.key]) : (item[col.key] || '');
          td.addEventListener('click', () => startEditing(item.id, col.key));
        }
        tr.appendChild(td);
      }
      return tr;
    });
    body.replaceChildren(...rows); applyColumnWidths();
  }

  function renderPagination() {
    const node = document.querySelector('#pagination');
    if (!node) return;
    let totalRows = state.rows.length;
    if (state.searchTerm) totalRows = state.rows.filter((r) => (r.companyName || '').toLowerCase().includes(state.searchTerm.toLowerCase())).length;
    const totalPages = getTotalPages(); clampCurrentPage();
    if (totalRows === 0) { node.replaceChildren(); return; }
    const info = document.createElement('div'); info.className = 'pagination-info';
    info.textContent = `第 ${state.currentPage} / ${totalPages} 页，共 ${totalRows} 条`;
    const pageSizeSelect = document.createElement('select'); pageSizeSelect.id = 'pagination-page-size';
    for (const ps of [5, 10, 20]) {
      const opt = document.createElement('option'); opt.value = String(ps); opt.textContent = `${ps} 条/页`;
      if (ps === state.pageSize) opt.selected = true; pageSizeSelect.appendChild(opt);
    }
    pageSizeSelect.value = String(state.pageSize);
    pageSizeSelect.addEventListener('change', () => {
      state.editing = null; state.pageSize = Number(pageSizeSelect.value) || 5;
      state.currentPage = 1; renderBody(); renderPagination();
    });
    const actions = document.createElement('div'); actions.className = 'pagination-actions';
    const prev = document.createElement('button'); prev.type = 'button'; prev.id = 'pagination-prev';
    prev.textContent = '上一页'; prev.disabled = state.currentPage === 1;
    prev.addEventListener('click', () => { if (state.currentPage > 1) { state.editing = null; state.currentPage--; renderBody(); renderPagination(); } });
    const next = document.createElement('button'); next.type = 'button'; next.id = 'pagination-next';
    next.textContent = '下一页'; next.disabled = state.currentPage === totalPages;
    next.addEventListener('click', () => { if (state.currentPage < totalPages) { state.editing = null; state.currentPage++; renderBody(); renderPagination(); } });
    actions.appendChild(prev); actions.appendChild(next);
    node.replaceChildren(info, pageSizeSelect, actions);
  }

  function render() { renderHead(); renderStatsToggle(); renderStats(); renderBody(); renderPagination(); applyColumnWidths(); bindResizeHandles(); }

  function updateRow(rowId, columnKey, value) {
    state.rows = state.rows.map((r) => r.id === rowId ? { ...r, [columnKey]: value } : r);
  }

  function startEditing(rowId, columnKey) {
    if (state.editing) return;
    const cell = document.querySelector(`[data-row-id="${rowId}"][data-column-key="${columnKey}"]`);
    const row = state.rows.find((i) => i.id === rowId);
    const column = COLUMN_DEFINITIONS.find((i) => i.key === columnKey);
    if (!cell || !row || !column) return;
    state.editing = { rowId, columnKey };
    const currentValue = row[columnKey] || '';
    const control = createEditor(document, column, currentValue);
    control.className = 'cell-editor';
    control.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commitEditing(rowId, columnKey, control.value, column.type); }
      if (e.key === 'Escape') cancelEditing();
    });
    control.addEventListener('blur', () => commitEditing(rowId, columnKey, control.value, column.type));
    cell.replaceChildren(control); control.focus(); control.select?.();
  }

  function commitEditing(rowId, columnKey, rawValue, type) {
    if (!state.editing) return;
    const nextValue = type === 'datetime-local' ? formatDateTimeValue(rawValue) : String(rawValue).trim();
    updateRow(rowId, columnKey, nextValue); state.editing = null; renderBody();
  }

  function cancelEditing() { state.editing = null; renderBody(); }

  function deleteRow(rowId) {
    if (!window.confirm('确认删除这条记录吗？')) return;
    state.rows = state.rows.filter((r) => r.id !== rowId);
    clampCurrentPage(); renderBody(); renderPagination();
  }

  function applyColumnWidths() {
    const table = document.querySelector('.interview-table');
    const total = COLUMN_DEFINITIONS.reduce((s, c) => s + state.columnWidths[c.key], 0);
    if (table) table.style.width = `${total}px`;
    for (const n of document.querySelectorAll('th, td')) {
      const key = n.dataset.columnKey, w = state.columnWidths[key];
      if (key && w) n.style.width = `${w}px`;
    }
  }

  function cleanupDragSession(shouldPersist = false) {
    if (!activeDragSession) return;
    const { onMove, onUp, onBlur } = activeDragSession;
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    window.removeEventListener('blur', onBlur);
    activeDragSession = null;
    if (shouldPersist) saveColumnWidths(window, state.columnWidths);
  }

  function bindResizeHandles() {
    for (const handle of document.querySelectorAll('.resize-handle')) {
      handle.onmousedown = (e) => {
        e.preventDefault(); cleanupDragSession();
        const key = handle.dataset.columnKey, startX = e.clientX, startW = state.columnWidths[key];
        const onMove = (me) => { state.columnWidths[key] = Math.max(120, startW + me.clientX - startX); applyColumnWidths(); };
        const onUp = () => cleanupDragSession(true);
        activeDragSession = { onMove, onUp, onBlur: onUp };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        window.addEventListener('blur', onUp);
      };
    }
  }

  function handleSearchToggle() {
    const btn = document.querySelector('#search-button'), input = document.querySelector('#search-input'), clear = document.querySelector('#clear-search-button');
    if (!btn || !input || !clear) return;
    state.isSearchActive = !state.isSearchActive;
    if (state.isSearchActive) { btn.classList.add('active'); input.style.display = 'inline-block'; clear.style.display = 'inline-flex'; input.focus(); }
    else { btn.classList.remove('active'); input.style.display = 'none'; clear.style.display = 'none'; state.searchTerm = ''; input.value = ''; state.currentPage = 1; renderBody(); renderPagination(); }
  }

  function handleSearchInput(e) {
    const term = e.target.value.trim();
    if (term !== state.searchTerm) { state.searchTerm = term; state.currentPage = 1; renderBody(); renderPagination(); }
  }

  function handleClearSearch() {
    const input = document.querySelector('#search-input');
    if (input) { state.searchTerm = ''; input.value = ''; state.currentPage = 1; renderBody(); renderPagination(); input.focus(); }
  }

  async function initialize() {
    const session = getSession(window);

    if (!session && window?.location) {
      window.location.href = '/pool.html';
      return;
    }

    document.querySelector('#add-button')?.addEventListener('click', () => {
      state.rows = [...state.rows, createEmptyInterview()]; state.currentPage = 1; renderBody(); renderPagination();
    });
    document.querySelector('#save-button')?.addEventListener('click', async () => {
      try { await saveRows(); setMessage('保存成功'); } catch (e) { setMessage(e.message, true); }
    });
    document.querySelector('#toggle-stats-button')?.addEventListener('click', () => {
      state.statsVisible = !state.statsVisible; renderStatsToggle(); renderStats();
    });
    document.querySelector('#search-button')?.addEventListener('click', handleSearchToggle);
    document.querySelector('#search-input')?.addEventListener('input', handleSearchInput);
    document.querySelector('#clear-search-button')?.addEventListener('click', handleClearSearch);
    document.querySelector('#logout-button')?.addEventListener('click', () => logout(window));
    document.querySelector('#pool-button')?.addEventListener('click', () => { window.location.href = '/pool.html'; });

    document.querySelector('#reload-button')?.addEventListener('click', async () => {
      if (hasUnsavedChanges() && !window.confirm('当前有未保存修改，确认要刷新并覆盖吗？')) return;
      state.editing = null;
      try { state.rows = await fetchRows(); state.lastSavedRowsSnapshot = JSON.stringify(state.rows); state.currentPage = 1; render(); setMessage('已刷新'); }
      catch (e) { setMessage(e.message, true); }
    });

    try {
      state.rows = await fetchRows(); state.lastSavedRowsSnapshot = JSON.stringify(state.rows);
      state.currentPage = 1; render(); setMessage('数据已加载');
    } catch (e) { setMessage(e.message, true); }
  }

  return { state, fetchRows, saveRows, render, updateRow, startEditing, commitEditing, cancelEditing, deleteRow, initialize };
}

if (typeof document !== 'undefined' && typeof window !== 'undefined' && typeof fetch !== 'undefined') {
  createApp({ document, window, fetch }).initialize();
}
