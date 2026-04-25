import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import { firestoreClient } from '@/api/firestoreClient';

const AUTH_CACHE_KEY = 'gamezone_auth_cache';

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

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  // Seed initial state from cache so the app renders immediately on return visits
  const _cache = readAuthCache();

  const [user, setUser]                   = useState(null);
  const [role, setRoleState]              = useState(_cache?.role ?? null);
  const [ownerId, setOwnerId]             = useState(_cache?.ownerId ?? null);
  const [isAuthenticated, setIsAuthenticated] = useState(!!_cache);
  // If we have a cache hit, skip the loading spinner entirely
  const [isLoadingAuth, setIsLoadingAuth] = useState(!_cache);
  const [authError, setAuthError]         = useState(null);

  useEffect(() => {
    if (!auth) {
      setIsLoadingAuth(false);
      return;
    }

    // Safety timeout — stop spinner if auth never fires (Android WebView edge case)
    const timeout = setTimeout(() => {
      setAuthError('Auth initialization timeout');
      setIsLoadingAuth(false);
    }, 8000);

    let unsubscribe = () => {};

    async function resolveUser(firebaseUser) {
      clearTimeout(timeout);
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

      try {
        // ── Fast path: check custom token claims first ──
        // monitorSignIn issues tokens with { role: "monitor", ownerId } claims.
        // This handles dual-role users (existing owners acting as monitors)
        // without needing a userIndex entry.
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

        // ── Standard path: check userIndex for regular monitors ──
        const monitorOwnerId = await firestoreClient.getMonitorOwner(firebaseUser.uid);

        if (monitorOwnerId) {
          // This user is a MONITOR — scoped to their owner's data
          writeAuthCache(firebaseUser.uid, 'monitor', monitorOwnerId);
          setUser(firebaseUser);
          setRoleState('monitor');
          setOwnerId(monitorOwnerId);
          setIsAuthenticated(true);
        } else {
          // This user is an OWNER — ensure their owner doc exists (first login)
          const exists = await firestoreClient.ownerExists(firebaseUser.uid);
          if (!exists) {
            await firestoreClient.createOwner(firebaseUser.uid, {
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || '',
            });
          }
          writeAuthCache(firebaseUser.uid, 'owner', firebaseUser.uid);
          setUser(firebaseUser);
          setRoleState('owner');
          setOwnerId(firebaseUser.uid);
          setIsAuthenticated(true);
        }
      } catch (err) {
        console.error('[AuthContext] resolveUser failed:', err);
        // Fallback: treat as owner using their own uid
        writeAuthCache(firebaseUser.uid, 'owner', firebaseUser.uid);
        setUser(firebaseUser);
        setRoleState('owner');
        setOwnerId(firebaseUser.uid);
        setIsAuthenticated(true);
      } finally {
        setIsLoadingAuth(false);
      }
    }

    try {
      // Fast-path: if a current user is already known, resolve immediately
      if (auth.currentUser) {
        resolveUser(auth.currentUser);
      }

      unsubscribe = onAuthStateChanged(
        auth,
        (firebaseUser) => resolveUser(firebaseUser),
        (error) => {
          clearTimeout(timeout);
          setAuthError(error?.message || 'Auth state listener failed');
          setIsLoadingAuth(false);
        }
      );
    } catch (error) {
      clearTimeout(timeout);
      setAuthError(error?.message || 'Auth initialization failed');
      setIsLoadingAuth(false);
    }

    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, []);

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
      role,       // 'owner' | 'monitor'
      ownerId,    // always the owner's uid — used to scope all data queries
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
