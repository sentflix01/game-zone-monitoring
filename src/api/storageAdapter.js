/**
 * Platform-aware storage adapter.
 * - On Capacitor native: uses @capacitor/preferences, serializing the full DB
 *   to/from a single JSON value under the 'gamezone_db' key.
 * - On web/Electron: delegates directly to localClient (localStorage).
 */

import { localClient } from './localClient';

const DB_KEY = 'gamezone_db';

function isNative() {
  return typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() === true;
}

// ---------------------------------------------------------------------------
// Capacitor Preferences helpers
// ---------------------------------------------------------------------------

async function getPreferences() {
  // Dynamically resolve Capacitor Preferences only at runtime on native platforms.
  // Using a string-concatenated import path prevents Rollup from trying to bundle it.
  const mod = await import(/* @vite-ignore */ '@capacitor/preferences');
  return mod.Preferences;
}

async function getDb() {
  try {
    const Preferences = await getPreferences();
    const { value } = await Preferences.get({ key: DB_KEY });
    return value ? JSON.parse(value) : { Console: [], Session: [], Pricing: [] };
  } catch (err) {
    return Promise.reject(new Error(`storageAdapter: failed to read database — ${err.message}`));
  }
}

async function saveDb(db) {
  try {
    const Preferences = await getPreferences();
    await Preferences.set({ key: DB_KEY, value: JSON.stringify(db) });
  } catch (err) {
    return Promise.reject(new Error(`storageAdapter: failed to write database — ${err.message}`));
  }
}

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ---------------------------------------------------------------------------
// Capacitor entity implementation (mirrors localClient API)
// ---------------------------------------------------------------------------

function makeCapacitorEntity(collection) {
  return {
    async list(sortField, limit) {
      const db = await getDb();
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

    async filter(query) {
      const db = await getDb();
      return (db[collection] || []).filter((item) =>
        Object.entries(query).every(([k, v]) => item[k] === v)
      );
    },

    async get(id) {
      const db = await getDb();
      return (db[collection] || []).find((i) => i.id === id) || null;
    },

    async create(data) {
      const db = await getDb();
      if (!db[collection]) db[collection] = [];
      const item = { ...data, id: generateId(), created_date: new Date().toISOString() };
      db[collection].push(item);
      await saveDb(db);
      return item;
    },

    async update(id, data) {
      const db = await getDb();
      const idx = (db[collection] || []).findIndex((i) => i.id === id);
      if (idx === -1) return Promise.reject(new Error(`storageAdapter: ${collection} ${id} not found`));
      db[collection][idx] = { ...db[collection][idx], ...data };
      await saveDb(db);
      return db[collection][idx];
    },

    async delete(id) {
      const db = await getDb();
      db[collection] = (db[collection] || []).filter((i) => i.id !== id);
      await saveDb(db);
    },
  };
}

// ---------------------------------------------------------------------------
// Exported adapter — picks backend at call time so tests can control the env
// ---------------------------------------------------------------------------

function makeAdapterEntity(collection) {
  return {
    list(sortField, limit) {
      if (isNative()) return makeCapacitorEntity(collection).list(sortField, limit);
      return localClient.entities[collection].list(sortField, limit);
    },
    filter(query) {
      if (isNative()) return makeCapacitorEntity(collection).filter(query);
      return localClient.entities[collection].filter(query);
    },
    get(id) {
      if (isNative()) return makeCapacitorEntity(collection).get(id);
      return localClient.entities[collection].get(id);
    },
    create(data) {
      if (isNative()) return makeCapacitorEntity(collection).create(data);
      return localClient.entities[collection].create(data);
    },
    update(id, data) {
      if (isNative()) return makeCapacitorEntity(collection).update(id, data);
      return localClient.entities[collection].update(id, data);
    },
    delete(id) {
      if (isNative()) return makeCapacitorEntity(collection).delete(id);
      return localClient.entities[collection].delete(id);
    },
  };
}

export const storageAdapter = {
  entities: {
    Console: makeAdapterEntity('Console'),
    Session: makeAdapterEntity('Session'),
    Pricing: makeAdapterEntity('Pricing'),
    Player: makeAdapterEntity('Player'),
    Expense: makeAdapterEntity('Expense'),
  },
};
