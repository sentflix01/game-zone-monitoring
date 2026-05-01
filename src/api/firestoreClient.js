/**
 * Firestore-backed data layer for multi-tenant support.
 * All operations are scoped to owners/{ownerId}/{collection}/
 * so data is completely isolated between different zone owners.
 *
 * Caching strategy: stale-while-revalidate
 * - list() and filter() serve from localStorage instantly (if cached),
 *   then fetch from Firestore in the background and update the cache.
 * - Writes (create/update/delete) update the cache immediately so the
 *   next read is always fresh without a network round-trip.
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ---------------------------------------------------------------------------
// Simple localStorage cache
// ---------------------------------------------------------------------------
const CACHE_PREFIX = 'gz_cache_';
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes (was 5) — fresher data

function cacheKey(ownerId, col, suffix = '') {
  return `${CACHE_PREFIX}${ownerId}_${col}${suffix ? '_' + suffix : ''}`;
}

function readCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    return { data, stale: Date.now() - ts > CACHE_TTL_MS };
  } catch { return null; }
}

function writeCache(key, data) {
  try { localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); } catch {}
}

function invalidateCache(ownerId, col) {
  try {
    const prefix = `${CACHE_PREFIX}${ownerId}_${col}`;
    Object.keys(localStorage)
      .filter((k) => k.startsWith(prefix))
      .forEach((k) => localStorage.removeItem(k));
  } catch {}
}

// Invalidate only list/filter caches, keep individual item caches
function invalidateListCaches(ownerId, col) {
  try {
    const prefix = `${CACHE_PREFIX}${ownerId}_${col}_list`;
    const filterPrefix = `${CACHE_PREFIX}${ownerId}_${col}_filter`;
    Object.keys(localStorage)
      .filter((k) => k.startsWith(prefix) || k.startsWith(filterPrefix))
      .forEach((k) => localStorage.removeItem(k));
  } catch {}
}

// ---------------------------------------------------------------------------
// Firestore helpers
// ---------------------------------------------------------------------------
function ownerCol(ownerId, col) {
  return collection(db, 'owners', ownerId, col);
}

function ownerDoc(ownerId, col, id) {
  return doc(db, 'owners', ownerId, col, id);
}

function makeEntity(col) {
  return {
    async list(ownerId, sortField, limitCount) {
      const key = cacheKey(ownerId, col, `list_${sortField || ''}_${limitCount || ''}`);
      const cached = readCache(key);

      // Fetch from Firestore
      const fetchFresh = async () => {
        let q = ownerCol(ownerId, col);
        if (sortField) {
          const desc = sortField.startsWith('-');
          const field = desc ? sortField.slice(1) : sortField;
          q = query(q, orderBy(field, desc ? 'desc' : 'asc'));
        }
        if (limitCount) {
          q = query(q, firestoreLimit(limitCount));
        }
        const snap = await getDocs(q);
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        writeCache(key, data);
        return data;
      };

      // Cache hit — return immediately, refresh in background if stale
      if (cached) {
        if (cached.stale) fetchFresh().catch(() => {});
        return cached.data;
      }

      // Cache miss — must wait for Firestore
      return fetchFresh();
    },

    async filter(ownerId, filters) {
      const filterStr = JSON.stringify(filters);
      const key = cacheKey(ownerId, col, `filter_${filterStr}`);
      const cached = readCache(key);

      const fetchFresh = async () => {
        let q = ownerCol(ownerId, col);
        for (const [k, v] of Object.entries(filters)) {
          q = query(q, where(k, '==', v));
        }
        const snap = await getDocs(q);
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        writeCache(key, data);
        return data;
      };

      if (cached) {
        if (cached.stale) fetchFresh().catch(() => {});
        return cached.data;
      }

      return fetchFresh();
    },

    async get(ownerId, id) {
      const key = cacheKey(ownerId, col, `item_${id}`);
      const cached = readCache(key);
      if (cached && !cached.stale) return cached.data;

      const snap = await getDoc(ownerDoc(ownerId, col, id));
      const data = snap.exists() ? { id: snap.id, ...snap.data() } : null;
      if (data) writeCache(key, data);
      return data;
    },

    async create(ownerId, data) {
      const ref = await addDoc(ownerCol(ownerId, col), {
        ...data,
        created_date: new Date().toISOString(),
      });
      // Only invalidate list caches — item caches for other docs stay valid
      invalidateListCaches(ownerId, col);
      const created = { id: ref.id, ...data, created_date: new Date().toISOString() };
      writeCache(cacheKey(ownerId, col, `item_${ref.id}`), created);
      return created;
    },

    async update(ownerId, id, data) {
      const ref = ownerDoc(ownerId, col, id);
      await updateDoc(ref, data);
      // Invalidate list caches and the specific item cache
      invalidateListCaches(ownerId, col);
      try { localStorage.removeItem(cacheKey(ownerId, col, `item_${id}`)); } catch {}
      return { id, ...data };
    },

    async delete(ownerId, id) {
      await deleteDoc(ownerDoc(ownerId, col, id));
      invalidateListCaches(ownerId, col);
      try { localStorage.removeItem(cacheKey(ownerId, col, `item_${id}`)); } catch {}
    },
  };
}

export const firestoreClient = {
  entities: {
    Console: makeEntity('consoles'),
    Session: makeEntity('sessions'),
    Pricing: makeEntity('pricing'),
    Player: makeEntity('players'),
    Expense: makeEntity('expenses'),
  },

  /**
   * Called on first signup — writes the owner's profile document.
   */
  async createOwner(uid, { email, displayName }) {
    await setDoc(doc(db, 'owners', uid), {
      email,
      displayName: displayName || email,
      createdAt: serverTimestamp(),
      role: 'owner',
    });
  },

  /**
   * Checks whether an owner document already exists.
   */
  async ownerExists(uid) {
    const snap = await getDoc(doc(db, 'owners', uid));
    return snap.exists();
  },

  /**
   * Looks up the userIndex to find which ownerId a monitor belongs to.
   * Returns null if the uid is not a monitor (i.e. they are an owner).
   */
  async getMonitorOwner(uid) {
    const snap = await getDoc(doc(db, 'userIndex', uid));
    return snap.exists() ? snap.data().ownerId : null;
  },

  /**
   * Lists all monitors belonging to an owner.
   */
  async listMonitors(ownerId) {
    const snap = await getDocs(collection(db, 'owners', ownerId, 'users'));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  /**
   * Direct monitor creation (fallback when Cloud Function not deployed).
   * Writes the monitor record to owners/{ownerId}/users/{monitorUid} and
   * userIndex/{monitorUid}.
   */
  async createMonitorDirect(ownerId, monitorUid, { email, username, phone, displayName, isExistingOwner }) {
    // owners/{ownerId}/users/{monitorUid}
    await setDoc(doc(db, 'owners', ownerId, 'users', monitorUid), {
      email: email || '',
      username: username || '',
      phone: phone || '',
      displayName,
      isExistingOwner: isExistingOwner ?? false,
      createdAt: serverTimestamp(),
    });
    // userIndex/{monitorUid} — only for new (non-owner) monitors
    if (!isExistingOwner) {
      await setDoc(doc(db, 'userIndex', monitorUid), {
        ownerId,
        email: email || '',
        username: username || '',
        phone: phone || '',
        role: 'monitor',
        createdAt: serverTimestamp(),
      });
    }
  },

  /**
   * Direct monitor deletion (fallback when Cloud Function not deployed).
   * Removes the monitor record and userIndex entry.
   */
  async deleteMonitorDirect(ownerId, monitorUid) {
    await deleteDoc(doc(db, 'owners', ownerId, 'users', monitorUid));
    try {
      await deleteDoc(doc(db, 'userIndex', monitorUid));
    } catch { /* may not exist */ }
  },

  /**
   * Creates an invite document at invites/{code}.
   */
  async createInvite(code, data) {
    if (!db) throw new Error('Firestore is not initialized. Check Firebase configuration.');
    await setDoc(doc(db, 'invites', code), data);
  },

  /**
   * Lists all invites created by an owner.
   */
  async listInvites(ownerId) {
    const q = query(
      collection(db, 'invites'),
      where('ownerId', '==', ownerId)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  /**
   * Reads a single invite by code.
   */
  async getInvite(code) {
    const snap = await getDoc(doc(db, 'invites', code));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  },

  /**
   * Marks an invite as used.
   */
  async markInviteUsed(code, monitorUid) {
    await updateDoc(doc(db, 'invites', code), {
      used: true,
      usedBy: monitorUid,
    });
  },

  /**
   * Lists notifications for an owner, ordered newest first.
   */
  async listNotifications(ownerId) {
    const q = query(
      collection(db, 'owners', ownerId, 'notifications'),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  /**
   * Marks a single notification as read.
   */
  async markNotificationRead(ownerId, notificationId) {
    await updateDoc(
      doc(db, 'owners', ownerId, 'notifications', notificationId),
      { read: true }
    );
  },
};
