const COLUMN_DEFINITIONS = [
  { key: 'companyName', label: '公司名称' },
  { key: 'interviewType', label: '面试方式' },
  { key: 'salaryRange', label: '薪资范围' },
  { key: 'positionTitle', label: '岗位名称' },
  { key: 'location', label: '公司位置' },
  { key: 'notes', label: '面经' },
  { key: 'interviewTime', label: '面试时间' },
  { key: 'userName', label: '分享者' }
];

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatInterviewTimeDisplay(value) {
  if (!value || typeof value !== 'string') return '';
  const match = value.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2})(:\d{2})?$/);
  if (!match) return value;
  return `${match[1]} ${match[2]}:${match[3]}`;
}

function renderHead() {
  const head = document.querySelector('#table-head');
  const row = document.createElement('tr');

  for (const column of COLUMN_DEFINITIONS) {
    const th = document.createElement('th');
    th.textContent = column.label;
    row.appendChild(th);
  }

  head.replaceChildren(row);
}

function renderStats(poolRecords, filteredRecords) {
  const statsNode = document.querySelector('#pool-stats');
  if (!statsNode) return;

  const uniqueCompanies = new Set(poolRecords.map((r) => r.companyName));
  const uniqueUsers = new Set(poolRecords.map((r) => r.userId));

  const stats = [
    { label: '总记录数', value: poolRecords.length },
    { label: '公司数量', value: uniqueCompanies.size },
    { label: '参与者', value: uniqueUsers.size }
  ];

  const items = stats.map((stat) => {
    const item = document.createElement('div');
    item.className = 'pool-stat-item';
    item.innerHTML = `${escapeHtml(stat.label)}: <span class="pool-stat-value">${stat.value}</span>`;
    return item;
  });

  statsNode.replaceChildren(...items);
}

function renderRecordCount(count) {
  const node = document.querySelector('#record-count');
  if (node) {
    node.textContent = `共 ${count} 条记录`;
  }
}

let allRecords = [];
let currentPage = 1;
let pageSize = 5;

function getFilteredRecords() {
  const searchInput = document.querySelector('#search-input');
  const searchTerm = (searchInput?.value || '').trim().toLowerCase();

  if (!searchTerm) {
    return allRecords;
  }

  return allRecords.filter((record) =>
    (record.companyName || '').toLowerCase().includes(searchTerm)
  );
}

function render() {
  const filtered = getFilteredRecords();
  const visible = getVisibleRecords();
  renderHead();
  renderStats(allRecords, filtered);
  renderBody(visible);
  renderRecordCount(filtered.length);
  renderPagination(filtered.length);
}

function getTotalPages(totalCount) {
  return Math.max(1, Math.ceil(totalCount / pageSize));
}

function clampCurrentPage(totalCount) {
  const totalPages = getTotalPages(totalCount);
  currentPage = Math.min(Math.max(currentPage, 1), totalPages);
}

function getVisibleRecords() {
  const filtered = getFilteredRecords();
  const sorted = [...filtered].sort((a, b) => {
    const timeA = a.interviewTime || '';
    const timeB = b.interviewTime || '';
    return timeB.localeCompare(timeA);
  });
  const totalCount = sorted.length;
  clampCurrentPage(totalCount);
  const start = (currentPage - 1) * pageSize;
  return sorted.slice(start, start + pageSize);
}

function renderBody(records) {
  const body = document.querySelector('#table-body');

  if (records.length === 0) {
    const tr = document.createElement('tr');
    tr.className = 'pool-empty-row';
    const td = document.createElement('td');
    td.colSpan = COLUMN_DEFINITIONS.length;
    td.textContent = '暂无面试记录';
    tr.appendChild(td);
    body.replaceChildren(tr);
    return;
  }

  const rows = records.map((record) => {
    const tr = document.createElement('tr');

    for (const column of COLUMN_DEFINITIONS) {
      const td = document.createElement('td');

      if (column.key === 'userName') {
        const tag = document.createElement('span');
        tag.className = 'pool-user-tag';
        tag.textContent = record.userName || `用户${record.userId}`;
        td.appendChild(tag);
      } else if (column.key === 'interviewTime') {
        td.textContent = formatInterviewTimeDisplay(record[column.key]);
      } else {
        td.textContent = record[column.key] || '';
      }

      tr.appendChild(td);
    }

    return tr;
  });

  body.replaceChildren(...rows);
}

function renderPagination(totalCount) {
  const node = document.querySelector('#pagination');
  if (!node) return;

  const totalPages = getTotalPages(totalCount);
  clampCurrentPage(totalCount);

  if (totalCount === 0) {
    node.replaceChildren();
    return;
  }

  const info = document.createElement('div');
  info.className = 'pagination-info';
  info.textContent = `第 ${currentPage} / ${totalPages} 页，共 ${totalCount} 条`;

  const pageSizeSelect = document.createElement('select');
  pageSizeSelect.id = 'pagination-page-size';
  for (const ps of [5, 10, 20]) {
    const opt = document.createElement('option');
    opt.value = String(ps);
    opt.textContent = `${ps} 条/页`;
    if (ps === pageSize) opt.selected = true;
    pageSizeSelect.appendChild(opt);
  }
  pageSizeSelect.value = String(pageSize);
  pageSizeSelect.addEventListener('change', () => {
    pageSize = Number(pageSizeSelect.value) || 5;
    currentPage = 1;
    render();
  });

  const actions = document.createElement('div');
  actions.className = 'pagination-actions';

  const prev = document.createElement('button');
  prev.type = 'button';
  prev.id = 'pagination-prev';
  prev.textContent = '上一页';
  prev.disabled = currentPage === 1;
  prev.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      render();
    }
  });

  const next = document.createElement('button');
  next.type = 'button';
  next.id = 'pagination-next';
  next.textContent = '下一页';
  next.disabled = currentPage === totalPages;
  next.addEventListener('click', () => {
    if (currentPage < totalPages) {
      currentPage++;
      render();
    }
  });

  actions.appendChild(prev);
  actions.appendChild(next);
  node.replaceChildren(info, pageSizeSelect, actions);
}

async function fetchPoolRecords() {
  const response = await fetch('/api/public/pool');
  if (!response.ok) {
    throw new Error('获取数据失败');
  }
  const data = await response.json();
  return data.records || [];
}

function handleSearch() {
  render();
}

function showPasswordModal() {
  const modal = document.querySelector('#password-modal');
  const input = document.querySelector('#password-input');
  const error = document.querySelector('#password-error');

  if (modal) {
    modal.style.display = 'flex';
    input.value = '';
    error.style.display = 'none';
    input.focus();
  }
}

function hidePasswordModal() {
  const modal = document.querySelector('#password-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

async function handlePasswordSubmit() {
  const input = document.querySelector('#password-input');
  const error = document.querySelector('#password-error');
  const password = input.value.trim();

  if (!password) {
    error.textContent = '请输入密码';
    error.style.display = 'block';
    return;
  }

  try {
    const response = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password })
    });

    const data = await response.json();

    if (!response.ok) {
      error.textContent = data.error || '密码错误';
      error.style.display = 'block';
      return;
    }

    sessionStorage.setItem('interview-session', JSON.stringify({
      userId: data.userId,
      name: data.name,
      role: data.role
    }));

    window.location.href = `/index.html?userId=${data.userId}`;
  } catch (e) {
    error.textContent = '验证失败，请重试';
    error.style.display = 'block';
  }
}

function showUserModal() {
  const modal = document.querySelector('#user-modal');
  const nameInput = document.querySelector('#user-name-input');
  const passwordInput = document.querySelector('#user-password-input');
  const error = document.querySelector('#user-error');

  if (modal) {
    modal.style.display = 'flex';
    nameInput.value = '';
    passwordInput.value = '';
    error.style.display = 'none';
    nameInput.focus();
  }
}

function hideUserModal() {
  const modal = document.querySelector('#user-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

async function handleUserSubmit() {
  const nameInput = document.querySelector('#user-name-input');
  const passwordInput = document.querySelector('#user-password-input');
  const error = document.querySelector('#user-error');
  const name = nameInput.value.trim();
  const password = passwordInput.value.trim();

  if (!name) {
    error.textContent = '请输入姓名';
    error.style.display = 'block';
    return;
  }

  if (!password) {
    error.textContent = '请输入密码';
    error.style.display = 'block';
    return;
  }

  if (password.length < 6 || password.length > 15) {
    error.textContent = '密码长度应为6-15位字符';
    error.style.display = 'block';
    return;
  }

  try {
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, password })
    });

    const data = await response.json();

    if (!response.ok) {
      error.textContent = data.error || '添加用户失败';
      error.style.display = 'block';
      return;
    }

    hideUserModal();
    alert('用户添加成功！');
  } catch (e) {
    error.textContent = '添加用户失败，请重试';
    error.style.display = 'block';
  }
}

function initialize() {
  document.querySelector('#my-records-button')?.addEventListener('click', showPasswordModal);
  document.querySelector('#password-cancel')?.addEventListener('click', hidePasswordModal);
  document.querySelector('#password-submit')?.addEventListener('click', handlePasswordSubmit);
  document.querySelector('#password-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handlePasswordSubmit();
    if (e.key === 'Escape') hidePasswordModal();
  });

  document.querySelector('#add-user-button')?.addEventListener('click', showUserModal);
  document.querySelector('#user-cancel')?.addEventListener('click', hideUserModal);
  document.querySelector('#user-submit')?.addEventListener('click', handleUserSubmit);
  document.querySelector('#user-name-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.querySelector('#user-password-input')?.focus();
  });
  document.querySelector('#user-password-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleUserSubmit();
    if (e.key === 'Escape') hideUserModal();
  });

  const searchInput = document.querySelector('#search-input');
  const clearButton = document.querySelector('#clear-search-button');

  searchInput?.addEventListener('input', handleSearch);
  clearButton?.addEventListener('click', () => {
    if (searchInput) {
      searchInput.value = '';
      render();
    }
  });

  fetchPoolRecords()
    .then((records) => {
      allRecords = records;
      render();
    })
    .catch((error) => {
      console.error('加载数据失败:', error);
    });
}

initialize();
