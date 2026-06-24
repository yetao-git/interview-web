const SESSION_KEY = 'interview-session';

function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setSession(data) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

function redirectToMain() {
  window.location.href = '/index.html';
}

function redirectToPool() {
  window.location.href = '/pool.html';
}

function showError(message) {
  const errorNode = document.querySelector('#login-error');
  if (errorNode) {
    errorNode.textContent = message;
  }
}

function clearError() {
  const errorNode = document.querySelector('#login-error');
  if (errorNode) {
    errorNode.textContent = '';
  }
}

async function handleLogin(event) {
  event.preventDefault();

  const input = document.querySelector('#invite-code-input');
  const button = document.querySelector('#login-button');
  const inviteCode = (input?.value || '').trim();

  clearError();

  if (!inviteCode) {
    showError('请输入邀请码');
    return;
  }

  button.disabled = true;
  button.textContent = '登录中...';

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ inviteCode })
    });

    const data = await response.json();

    if (!response.ok) {
      showError(data.error || '登录失败');
      return;
    }

    setSession({
      userId: data.userId,
      name: data.name,
      role: data.role
    });

    if (data.role === 'admin') {
      redirectToMain();
    } else {
      redirectToPool();
    }
  } catch (error) {
    showError('网络错误，请重试');
  } finally {
    button.disabled = false;
    button.textContent = '登录';
  }
}

function initialize() {
  const session = getSession();
  if (session) {
    if (session.role === 'admin') {
      redirectToMain();
    } else {
      redirectToPool();
    }
    return;
  }

  const form = document.querySelector('#login-form');
  form?.addEventListener('submit', handleLogin);
}

initialize();
