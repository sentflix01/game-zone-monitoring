/**
 * Platform-aware storage adapter — multi-tenant edition.
 * - Web/Electron: Firestore (cloud, ownerId-scoped)
 * - Capacitor native: local Preferences storage (offline-first)
 */

import { Preferences } from '@capacitor/preferences';
import { firestoreClient } from './firestoreClient';

const DB_KEY = 'gamezone_db';
const COLLECTIONS = ['Console', 'Session', 'Pricing', 'Player', 'Expense'];

function isNative() {
  return typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() === true;
}

function createEmptyDb() {
  return { Console: [], Session: [], Pricing: [], Player: [], Expense: [] };
}

function normalizeDb(db) {
  const normalized = createEmptyDb();
  if (!db || typeof db !== 'object') return normalized;
  for (const col of COLLECTIONS) {
    if (Array.isArray(db[col])) normalized[col] = db[col];
  }
  return normalized;
}

function readLocalFallbackDb() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    return raw ? normalizeDb(JSON.parse(raw)) : null;
  } catch { return null; }
}

function saveLocalFallbackDb(db) {
  try { localStorage.setItem(DB_KEY, JSON.stringify(db)); return true; } catch { return false; }
}

async function saveNativeDb(db) {
  try { await Preferences.set({ key: DB_KEY, value: JSON.stringify(db) }); return true; } catch { return false; }
}

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(`storageAdapter: ${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (val) => { clearTimeout(id); resolve(val); },
      (err) => { clearTimeout(id); reject(err); }
    );
  });
}

async function getNativeDb() {
  const fallbackDb = readLocalFallbackDb();
  try {
    const { value } = await withTimeout(Preferences.get({ key: DB_KEY }), 5000, 'Preferences.get');
    if (value) {
      const nativeDb = normalizeDb(JSON.parse(value));
      saveLocalFallbackDb(nativeDb);
      return nativeDb;
    }
  } catch (err) {
    if (fallbackDb) return fallbackDb;
    console.error(`storageAdapter: failed to read native database — ${err.message}`);
  }
  if (fallbackDb) { await saveNativeDb(fallbackDb); return fallbackDb; }
  return createEmptyDb();
}

async function saveNativeDbFull(db) {
  const normalizedDb = normalizeDb(db);
  const savedLocally = saveLocalFallbackDb(normalizedDb);
  const savedNatively = await saveNativeDb(normalizedDb);
  if (!savedLocally && !savedNatively) {
    return Promise.reject(new Error('storageAdapter: failed to persist database'));
  }
}

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ---------------------------------------------------------------------------
// Capacitor (native) entity — uses local Preferences, no ownerId needed
// ---------------------------------------------------------------------------
function makeCapacitorEntity(collection) {
  return {
    async list(_ownerId, sortField, limit) {
      const db = await getNativeDb();
      let items = [...(db[collection] || [])];
      if (sortField) {
        const desc = sortField.startsWith('-');
        const field = desc ? sortField.slice(1) : sortField;
        items.sort((a, b) => {
          const av = a[field] ?? a.created_date ?? '';
          const bv = b[field] ?? b.created_date ?? '';
          return desc ? (bv > av ? 1 : -1) : (av > bv ? 1 : -1);
        });
      }
      if (limit) items = items.slice(0, limit);
      return items;
    },
    async filter(_ownerId, query) {
      const db = await getNativeDb();
      return (db[collection] || []).filter((item) =>
        Object.entries(query).every(([k, v]) => item[k] === v)
      );
    },
    async get(_ownerId, id) {
      const db = await getNativeDb();
      return (db[collection] || []).find((i) => i.id === id) || null;
    },
    async create(_ownerId, data) {
      const db = await getNativeDb();
      if (!db[collection]) db[collection] = [];
      const item = { ...data, id: generateId(), created_date: new Date().toISOString() };
      db[collection].push(item);
      await saveNativeDbFull(db);
      return item;
    },
    async update(_ownerId, id, data) {
      const db = await getNativeDb();
      const idx = (db[collection] || []).findIndex((i) => i.id === id);
      if (idx === -1) return Promise.reject(new Error(`storageAdapter: ${collection} ${id} not found`));
      db[collection][idx] = { ...db[collection][idx], ...data };
      await saveNativeDbFull(db);
      return db[collection][idx];
    },
    async delete(_ownerId, id) {
      const db = await getNativeDb();
      db[collection] = (db[collection] || []).filter((i) => i.id !== id);
      await saveNativeDbFull(db);
    },
  };
}

// ---------------------------------------------------------------------------
// Adapter — routes to Firestore (web) or Capacitor local (native)
// All methods now accept ownerId as the first argument.
// ---------------------------------------------------------------------------
function makeAdapterEntity(collection) {
  const native = makeCapacitorEntity(collection);
  const cloud  = firestoreClient.entities[collection];

  return {
    list   (ownerId, sortField, limit) { return isNative() ? native.list(ownerId, sortField, limit)   : cloud.list(ownerId, sortField, limit); },
    filter (ownerId, query)            { return isNative() ? native.filter(ownerId, query)             : cloud.filter(ownerId, query); },
    get    (ownerId, id)               { return isNative() ? native.get(ownerId, id)                   : cloud.get(ownerId, id); },
    create (ownerId, data)             { return isNative() ? native.create(ownerId, data)              : cloud.create(ownerId, data); },
    update (ownerId, id, data)         { return isNative() ? native.update(ownerId, id, data)          : cloud.update(ownerId, id, data); },
    delete (ownerId, id)               { return isNative() ? native.delete(ownerId, id)                : cloud.delete(ownerId, id); },
  };
}

export const storageAdapter = {
  entities: {
    Console: makeAdapterEntity('Console'),
    Session: makeAdapterEntity('Session'),
    Pricing: makeAdapterEntity('Pricing'),
    Player:  makeAdapterEntity('Player'),
    Expense: makeAdapterEntity('Expense'),
  },
};
