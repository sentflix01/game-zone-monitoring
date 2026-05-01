import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import { firestoreClient } from '@/api/firestoreClient';

const AUTH_CACHE_KEY = 'gamezone_auth_cache';
// Reduced from 8s → 3s: fail fast on network issues, don't make users wait
const AUTH_FETCH_TIMEOUT_MS = 3000;

function readAuthCache() {
  try {
    const raw = localStorage.getItem(AUTH_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function writeAuthCache(uid, role, ownerId) {
  try { localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({ uid, role, ownerId })); } catch {}
}

function clearAuthCache() {
  try { localStorage.removeItem(AUTH_CACHE_KEY); } catch {}
}

async function withTimeout(promise, ms, timeoutMessage) {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(timeoutMessage)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  // Seed initial state from cache — app renders immediately on return visits
  const _cache = readAuthCache();

  const [user, setUser]                       = useState(null);
  const [role, setRoleState]                  = useState(_cache?.role ?? null);
  const [ownerId, setOwnerId]                 = useState(_cache?.ownerId ?? null);
  const [isAuthenticated, setIsAuthenticated] = useState(!!_cache);
  // Skip loading spinner entirely on cache hit
  const [isLoadingAuth, setIsLoadingAuth]     = useState(!_cache);
  const [authError, setAuthError]             = useState(null);

  useEffect(() => {
    if (!auth) {
      setIsLoadingAuth(false);
      return;
    }

    // Safety timeout — stop spinner if auth never fires
    const safetyTimeout = setTimeout(() => {
      setAuthError('Auth initialization timeout');
      setIsLoadingAuth(false);
    }, 5000);

    let unsubscribe = () => {};

    async function resolveUser(firebaseUser) {
      clearTimeout(safetyTimeout);
      setAuthError(null);

      if (!firebaseUser) {
        clearAuthCache();
        setUser(null);
        setRoleState(null);
        setOwnerId(null);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
        return;
      }

      // ── Optimization 1: If cache uid matches, skip ALL Firestore calls ──
      // The user is the same person as last time — trust the cache immediately.
      if (_cache && _cache.uid === firebaseUser.uid) {
        setUser(firebaseUser);
        // Role/ownerId already seeded from cache in useState — just confirm auth
        setIsAuthenticated(true);
        setIsLoadingAuth(false);
        // Verify in background without blocking the UI
        verifyRoleInBackground(firebaseUser);
        return;
      }

      try {
        // ── Fast path: check custom token claims first ──
        const tokenResult = await firebaseUser.getIdTokenResult();
        if (tokenResult.claims.role === 'monitor' && tokenResult.claims.ownerId) {
          writeAuthCache(firebaseUser.uid, 'monitor', tokenResult.claims.ownerId);
          setUser(firebaseUser);
          setRoleState('monitor');
          setOwnerId(tokenResult.claims.ownerId);
          setIsAuthenticated(true);
          setIsLoadingAuth(false);
          return;
        }

        // ── Optimization 2: Parallelize monitor check + owner check ──
        // Run both Firestore reads simultaneously instead of sequentially.
        const [monitorOwnerId, ownerExists] = await withTimeout(
          Promise.all([
            firestoreClient.getMonitorOwner(firebaseUser.uid),
            firestoreClient.ownerExists(firebaseUser.uid),
          ]),
          AUTH_FETCH_TIMEOUT_MS,
          'Auth resolution timed out.'
        );

        if (monitorOwnerId) {
          writeAuthCache(firebaseUser.uid, 'monitor', monitorOwnerId);
          setUser(firebaseUser);
          setRoleState('monitor');
          setOwnerId(monitorOwnerId);
          setIsAuthenticated(true);
        } else {
          // Owner path
          if (!ownerExists) {
            // Create owner doc in background — don't block the UI
            firestoreClient.createOwner(firebaseUser.uid, {
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || '',
            }).catch((err) => console.warn('[AuthContext] createOwner failed:', err));
          }
          writeAuthCache(firebaseUser.uid, 'owner', firebaseUser.uid);
          setUser(firebaseUser);
          setRoleState('owner');
          setOwnerId(firebaseUser.uid);
          setIsAuthenticated(true);
        }
      } catch (err) {
        const offlineLike =
          err?.code === 'unavailable' ||
          err?.code === 'failed-precondition' ||
          String(err?.message || '').toLowerCase().includes('offline') ||
          String(err?.message || '').toLowerCase().includes('timed out');
        if (offlineLike) {
          console.warn('[AuthContext] offline/timeout — using owner fallback.');
        } else {
          console.error('[AuthContext] resolveUser failed:', err);
        }
        // Fallback: treat as owner
        writeAuthCache(firebaseUser.uid, 'owner', firebaseUser.uid);
        setUser(firebaseUser);
        setRoleState('owner');
        setOwnerId(firebaseUser.uid);
        setIsAuthenticated(true);
      } finally {
        setIsLoadingAuth(false);
      }
    }

    // Background role verification — runs after UI is already shown
    async function verifyRoleInBackground(firebaseUser) {
      try {
        const tokenResult = await firebaseUser.getIdTokenResult();
        if (tokenResult.claims.role === 'monitor' && tokenResult.claims.ownerId) {
          // Update if role changed
          if (_cache?.role !== 'monitor' || _cache?.ownerId !== tokenResult.claims.ownerId) {
            writeAuthCache(firebaseUser.uid, 'monitor', tokenResult.claims.ownerId);
            setRoleState('monitor');
            setOwnerId(tokenResult.claims.ownerId);
          }
          return;
        }
        const monitorOwnerId = await firestoreClient.getMonitorOwner(firebaseUser.uid);
        if (monitorOwnerId && _cache?.role !== 'monitor') {
          writeAuthCache(firebaseUser.uid, 'monitor', monitorOwnerId);
          setRoleState('monitor');
          setOwnerId(monitorOwnerId);
        }
      } catch { /* background — ignore errors */ }
    }

    try {
      if (auth.currentUser) {
        resolveUser(auth.currentUser);
      }

      unsubscribe = onAuthStateChanged(
        auth,
        (firebaseUser) => resolveUser(firebaseUser),
        (error) => {
          clearTimeout(safetyTimeout);
          setAuthError(error?.message || 'Auth state listener failed');
          setIsLoadingAuth(false);
        }
      );
    } catch (error) {
      clearTimeout(safetyTimeout);
      setAuthError(error?.message || 'Auth initialization failed');
      setIsLoadingAuth(false);
    }

    return () => {
      clearTimeout(safetyTimeout);
      unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      setAuthError(error?.message || 'Failed to sign out');
    } finally {
      clearAuthCache();
      setUser(null);
      setRoleState(null);
      setOwnerId(null);
      setIsAuthenticated(false);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      role,
      ownerId,
      isAuthenticated,
      isLoadingAuth,
      authError,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
