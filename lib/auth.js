import { readJson, writeJson, CONFIG_FILE } from './data.js';
import crypto from 'node:crypto';

export function generateUserId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let userId = '';
  const bytes = crypto.randomBytes(20);
  for (let i = 0; i < 20; i++) {
    userId += chars[bytes[i] % chars.length];
  }
  return userId;
}

export async function loadConfig() {
  const config = await readJson(CONFIG_FILE);
  return config || { users: [] };
}

export async function saveConfig(config) {
  await writeJson(CONFIG_FILE, config);
}

export async function findUserByPassword(password) {
  const config = await loadConfig();
  return config.users.find((u) => u.password === password) || null;
}

export async function findUserById(userId) {
  const config = await loadConfig();
  return config.users.find((u) => u.userId === userId) || null;
}

export async function addUser(name, password) {
  const config = await loadConfig();
  const newUser = {
    userId: generateUserId(),
    name,
    password,
    role: 'member'
  };
  config.users.push(newUser);
  await saveConfig(config);
  return newUser;
}
