import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findUserByPassword, loadConfig, addUser } from './lib/auth.js';
import { readUserData, writeUserData, PUBLIC_POOL_FILE, readJson, writeJson } from './lib/data.js';
import { syncUserToPool, getPublicPool } from './lib/pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_ROOT_DIR = __dirname;
const DEFAULT_DATA_FILE = path.join(__dirname, 'data', 'interviews.json');

const STAGES = ['1 面', '2 面', '3 面', 'HR 面', '谈薪', 'Offer'];
const INTERVIEW_TYPES = ['线上', '线下', '线上+线下'];
const INTERVIEW_FEEDBACKS = ['待面试', '推进中', '无反馈', '主动取消', '不匹配', '背调中', '待入职', '已入职'];

const STATIC_FILE_ALLOWLIST = new Map([
  ['/', 'index.html'],
  ['/index.html', 'index.html'],
  ['/styles.css', 'styles.css'],
  ['/app.js', 'app.js'],
  ['/login.html', 'login.html'],
  ['/login.js', 'login.js'],
  ['/pool.html', 'pool.html'],
  ['/pool.js', 'pool.js'],
  ['/pool.css', 'pool.css'],
  ['/lib/constants.js', 'lib/constants.js'],
  ['/lib/normalize.js', 'lib/normalize.js'],
  ['/lib/data.js', 'lib/data.js'],
  ['/lib/auth.js', 'lib/auth.js'],
  ['/lib/pool.js', 'lib/pool.js']
]);

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8'
  });
  response.end(JSON.stringify(payload));
}

async function readRequestJson(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
  }
  return JSON.parse(body || '{}');
}

function isValidInterviewTime(value) {
  if (typeof value !== 'string') return false;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return false;
  const [, year, month, day, hour, minute, second] = match;
  const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
  return Number.isFinite(date.getTime())
    && date.getUTCFullYear() === Number(year)
    && date.getUTCMonth() + 1 === Number(month)
    && date.getUTCDate() === Number(day)
    && date.getUTCHours() === Number(hour)
    && date.getUTCMinutes() === Number(minute)
    && date.getUTCSeconds() === Number(second);
}

function normalizeInterviewTimeValue(value) {
  if (typeof value !== 'string') return value;
  const match = value.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2}):\d{2}$/);
  if (!match) return value;
  return `${match[1]} ${match[2]}:${match[3]}:00`;
}

function normalizeInterviewFeedbackValue(value) {
  return value === '待推进' ? '推进中' : value;
}

function isValidRow(row) {
  return Boolean(
    row && typeof row === 'object'
      && typeof row.id === 'string'
      && typeof row.companyName === 'string'
      && isValidInterviewTime(row.interviewTime)
      && typeof row.interviewType === 'string'
      && INTERVIEW_TYPES.includes(row.interviewType)
      && typeof row.stage === 'string'
      && STAGES.includes(row.stage)
      && typeof row.interviewFeedback === 'string'
      && INTERVIEW_FEEDBACKS.includes(normalizeInterviewFeedbackValue(row.interviewFeedback))
      && typeof row.salaryRange === 'string'
      && typeof row.positionTitle === 'string'
      && typeof row.location === 'string'
      && typeof row.notes === 'string'
  );
}

async function handleAuth(request, response) {
  const body = await readRequestJson(request);
  const { password } = body;

  if (!password || typeof password !== 'string') {
    sendJson(response, 400, { error: '请输入密码' });
    return;
  }

  const user = await findUserByPassword(password.trim());
  if (!user) {
    sendJson(response, 401, { error: '密码错误' });
    return;
  }

  sendJson(response, 200, {
    userId: user.userId,
    name: user.name,
    role: user.role
  });
}

async function handleAddUser(request, response) {
  const body = await readRequestJson(request);
  const { name, password } = body;

  if (!name || typeof name !== 'string') {
    sendJson(response, 400, { error: '请输入姓名' });
    return;
  }

  if (!password || typeof password !== 'string') {
    sendJson(response, 400, { error: '请输入密码' });
    return;
  }

  const config = await loadConfig();
  const exists = config.users.some((u) => u.password === password.trim());
  if (exists) {
    sendJson(response, 400, { error: '密码已存在' });
    return;
  }

  const newUser = await addUser(name.trim(), password.trim());
  sendJson(response, 200, { ok: true, userId: newUser.userId });
}

async function handleGetMyInterviews(request, response, url) {
  const userId = url.searchParams.get('userId');
  if (!userId) {
    sendJson(response, 400, { error: '缺少 userId' });
    return;
  }

  const userData = await readUserData(userId);
  sendJson(response, 200, userData);
}

async function handlePostMyInterviews(request, response) {
  const body = await readRequestJson(request);
  const { userId, interviews } = body;

  if (!userId || !Array.isArray(interviews)) {
    sendJson(response, 400, { error: '缺少 userId 或 interviews' });
    return;
  }

  for (const row of interviews) {
    if (!isValidRow(row)) {
      sendJson(response, 400, { error: '无效的面试记录数据' });
      return;
    }
  }

  const normalizedInterviews = interviews.map((row) => ({
    ...row,
    interviewTime: normalizeInterviewTimeValue(row.interviewTime),
    interviewFeedback: normalizeInterviewFeedbackValue(row.interviewFeedback)
  }));

  await writeUserData(userId, { userId, interviews: normalizedInterviews });

  const config = await import('./lib/auth.js').then((m) => m.loadConfig());
  const user = config.users.find((u) => u.userId === userId);
  const userName = user ? user.name : `用户${userId}`;

  await syncUserToPool(userId, userName);

  sendJson(response, 200, { ok: true });
}

async function handleGetPublicPool(request, response) {
  const pool = await getPublicPool();
  sendJson(response, 200, pool);
}

async function handleLegacyGetInterviews(response, dataFile) {
  try {
    await fs.access(dataFile);
    const raw = await fs.readFile(dataFile, 'utf8');
    const rows = JSON.parse(raw || '[]');
    sendJson(response, 200, Array.isArray(rows) ? rows : []);
  } catch {
    await fs.mkdir(path.dirname(dataFile), { recursive: true });
    await fs.writeFile(dataFile, '[]\n', 'utf8');
    sendJson(response, 200, []);
  }
}

async function handleLegacyPostInterviews(request, response, dataFile) {
  const rows = await readRequestJson(request);
  if (!Array.isArray(rows)) {
    sendJson(response, 400, { error: 'rows must be an array' });
    return;
  }
  for (const row of rows) {
    if (!isValidRow(row)) {
      sendJson(response, 400, { error: 'invalid row payload, stage, or interviewTime' });
      return;
    }
  }
  const normalizedRows = rows.map((row) => ({
    ...row,
    interviewTime: normalizeInterviewTimeValue(row.interviewTime),
    interviewFeedback: normalizeInterviewFeedbackValue(row.interviewFeedback)
  }));
  await writeJson(dataFile, normalizedRows);
  sendJson(response, 200, { ok: true });
}

async function handleApi(request, response, dataFile) {
  const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');

  if (request.method === 'POST' && requestUrl.pathname === '/api/auth/verify') {
    await handleAuth(request, response);
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/users') {
    await handleAddUser(request, response);
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/api/my/interviews') {
    await handleGetMyInterviews(request, response, requestUrl);
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/my/interviews') {
    await handlePostMyInterviews(request, response);
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/api/public/pool') {
    await handleGetPublicPool(request, response);
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/api/interviews') {
    await handleLegacyGetInterviews(response, dataFile);
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/interviews') {
    await handleLegacyPostInterviews(request, response, dataFile);
    return;
  }

  sendJson(response, 404, { error: 'Not Found' });
}

function getContentType(filePath) {
  const extension = path.extname(filePath);
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8'
  };
  return types[extension] || 'application/octet-stream';
}

export function isPathInsideRoot(rootDir, filePath) {
  const relativePath = path.relative(rootDir, filePath);
  return relativePath === ''
    || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

async function serveStatic(request, response, rootDir) {
  const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
  const mappedPath = STATIC_FILE_ALLOWLIST.get(requestUrl.pathname);

  if (!mappedPath) {
    sendJson(response, 404, { error: 'Not Found' });
    return;
  }

  const resolvedRoot = path.resolve(rootDir);
  const filePath = path.resolve(resolvedRoot, mappedPath);

  if (!isPathInsideRoot(resolvedRoot, filePath)) {
    sendJson(response, 403, { error: 'Forbidden' });
    return;
  }

  const content = await fs.readFile(filePath);
  response.writeHead(200, { 'content-type': getContentType(filePath) });
  response.end(content);
}

export function createServer({ rootDir = DEFAULT_ROOT_DIR, dataFile = DEFAULT_DATA_FILE } = {}) {
  return http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
      if (requestUrl.pathname.startsWith('/api/')) {
        await handleApi(request, response, dataFile);
        return;
      }
      await serveStatic(request, response, rootDir);
    } catch (error) {
      if (error instanceof SyntaxError) {
        sendJson(response, 400, { error: error.message });
        return;
      }
      if (error && typeof error === 'object' && 'code' in error && error.code === 'VALIDATION_ERROR') {
        sendJson(response, 400, { error: error.message });
        return;
      }
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        sendJson(response, 404, { error: 'Not Found' });
        return;
      }
      sendJson(response, 500, { error: error instanceof Error ? error.message : 'Internal Server Error' });
    }
  });
}

if (process.argv[1] === __filename) {
  const port = 8888;
  const server = createServer();
  server.listen(port, '127.0.0.1', () => {
    console.log(`server listening on http://127.0.0.1:${port}`);
  });
}
