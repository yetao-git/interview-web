import { readJson, writeJson, PUBLIC_POOL_FILE, extractPublicRecord, readUserData } from './data.js';

export async function loadPublicPool() {
  const data = await readJson(PUBLIC_POOL_FILE);
  return data || { records: [] };
}

export async function savePublicPool(pool) {
  await writeJson(PUBLIC_POOL_FILE, pool);
}

export async function syncUserToPool(userId, userName) {
  const userData = await readUserData(userId);
  const pool = await loadPublicPool();

  pool.records = pool.records.filter((r) => r.userId !== userId);

  for (const interview of userData.interviews) {
    const publicRecord = extractPublicRecord(interview, userId, userName);
    pool.records.push(publicRecord);
  }

  await savePublicPool(pool);
  return pool;
}

export async function getPublicPool() {
  return await loadPublicPool();
}
