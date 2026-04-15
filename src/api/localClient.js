/**
 * Pure local data layer — no third-party backend.
 * All data is persisted in localStorage under the key "gamezone_db".
 */

const DB_KEY = 'gamezone_db';

function getDb() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    return raw ? JSON.parse(raw) : { Console: [], Session: [], Pricing: [] };
  } catch {
    return { Console: [], Session: [], Pricing: [] };
  }
}

function saveDb(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function makeEntity(collection) {
  return {
    list(sortField, limit) {
      const db = getDb();
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
      return Promise.resolve(items);
    },

    filter(query) {
      const db = getDb();
      const items = (db[collection] || []).filter((item) =>
        Object.entries(query).every(([k, v]) => item[k] === v)
      );
      return Promise.resolve(items);
    },

    get(id) {
      const db = getDb();
      const item = (db[collection] || []).find((i) => i.id === id);
      return Promise.resolve(item || null);
    },

    create(data) {
      const db = getDb();
      if (!db[collection]) db[collection] = [];
      const item = { ...data, id: generateId(), created_date: new Date().toISOString() };
      db[collection].push(item);
      saveDb(db);
      return Promise.resolve(item);
    },

    update(id, data) {
      const db = getDb();
      const idx = (db[collection] || []).findIndex((i) => i.id === id);
      if (idx === -1) return Promise.reject(new Error(`${collection} ${id} not found`));
      db[collection][idx] = { ...db[collection][idx], ...data };
      saveDb(db);
      return Promise.resolve(db[collection][idx]);
    },

    delete(id) {
      const db = getDb();
      db[collection] = (db[collection] || []).filter((i) => i.id !== id);
      saveDb(db);
      return Promise.resolve();
    },
  };
}

export const localClient = {
  entities: {
    Console: makeEntity('Console'),
    Session: makeEntity('Session'),
    Pricing: makeEntity('Pricing'),
    Player: makeEntity('Player'),
    Expense: makeEntity('Expense'),
  },
};
