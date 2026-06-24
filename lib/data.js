import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const USERS_DIR = path.join(DATA_DIR, 'users');

export const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
export const PUBLIC_POOL_FILE = path.join(DATA_DIR, 'public-pool.json');

export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

export async function readJson(filePath) {
  await ensureDir(path.dirname(filePath));
  try {
    await fs.access(filePath);
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw || '{}');
  } catch {
    return null;
  }
}

export async function writeJson(filePath, data) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

export function getUserDataFile(userId) {
  return path.join(USERS_DIR, `user-${userId}.json`);
}

export async function readUserData(userId) {
  const file = getUserDataFile(userId);
  const data = await readJson(file);
  return data || { userId, interviews: [] };
}

export async function writeUserData(userId, data) {
  const file = getUserDataFile(userId);
  await writeJson(file, data);
}

export function extractPublicRecord(fullRecord, userId, userName) {
  return {
    id: fullRecord.id,
    userId,
    userName,
    companyName: fullRecord.companyName,
    interviewTime: fullRecord.interviewTime,
    interviewType: fullRecord.interviewType,
    salaryRange: fullRecord.salaryRange,
    positionTitle: fullRecord.positionTitle,
    location: fullRecord.location,
    notes: fullRecord.notes,
    updatedAt: new Date().toISOString()
  };
}
