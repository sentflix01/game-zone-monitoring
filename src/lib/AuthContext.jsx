import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import { firestoreClient } from '@/api/firestoreClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser]                   = useState(null);
  const [role, setRoleState]              = useState(null);   // 'owner' | 'monitor'
  const [ownerId, setOwnerId]             = useState(null);   // the owner's UID (same as uid if owner)
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
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
        setUser(null);
        setRoleState(null);
        setOwnerId(null);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
        return;
      }

      try {
        // Check if this uid belongs to a monitor (has a userIndex entry)
        const monitorOwnerId = await firestoreClient.getMonitorOwner(firebaseUser.uid);

        if (monitorOwnerId) {
          // This user is a MONITOR — scoped to their owner's data
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
          setUser(firebaseUser);
          setRoleState('owner');
          setOwnerId(firebaseUser.uid);
          setIsAuthenticated(true);
        }
      } catch (err) {
        console.error('[AuthContext] resolveUser failed:', err);
        // Fallback: treat as owner using their own uid
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
