/**
 * Firestore-backed data layer for multi-tenant support.
 * All operations are scoped to owners/{ownerId}/{collection}/
 * so data is completely isolated between different zone owners.
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

function ownerCol(ownerId, col) {
  return collection(db, 'owners', ownerId, col);
}

function ownerDoc(ownerId, col, id) {
  return doc(db, 'owners', ownerId, col, id);
}

function makeEntity(col) {
  return {
    async list(ownerId, sortField, limitCount) {
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
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },

    async filter(ownerId, filters) {
      let q = ownerCol(ownerId, col);
      for (const [k, v] of Object.entries(filters)) {
        q = query(q, where(k, '==', v));
      }
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },

    async get(ownerId, id) {
      const snap = await getDoc(ownerDoc(ownerId, col, id));
      return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    },

    async create(ownerId, data) {
      const ref = await addDoc(ownerCol(ownerId, col), {
        ...data,
        created_date: new Date().toISOString(),
      });
      return { id: ref.id, ...data, created_date: new Date().toISOString() };
    },

    async update(ownerId, id, data) {
      const ref = ownerDoc(ownerId, col, id);
      await updateDoc(ref, data);
      return { id, ...data };
    },

    async delete(ownerId, id) {
      await deleteDoc(ownerDoc(ownerId, col, id));
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
};
