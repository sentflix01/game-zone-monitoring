import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';

const AuthContext = createContext();

const ROLE_KEY = 'gamezone_user_role';

function getStoredRoleForUser(uid) {
  let storedRole = localStorage.getItem(ROLE_KEY);
  if (!storedRole) {
    const ADMIN_UIDS = import.meta.env.VITE_ADMIN_UIDS
      ? import.meta.env.VITE_ADMIN_UIDS.split(',').map((s) => s.trim())
      : [];
    storedRole = ADMIN_UIDS.includes(uid) ? 'admin' : 'user';
    localStorage.setItem(ROLE_KEY, storedRole);
  }
  return storedRole;
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRoleState] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    // If auth is missing, avoid blocking the UI behind a spinner.
    if (!auth) {
      setIsLoadingAuth(false);
      return;
    }

    // Fast-path: if we already have a current user (common right after login),
    // don't block the UI waiting for the listener.
    if (auth.currentUser) {
      const storedRole = getStoredRoleForUser(auth.currentUser.uid);
      setUser(auth.currentUser);
      setRoleState(storedRole);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
    }

    // Safety timeout — if onAuthStateChanged never fires (e.g. IndexedDB hang
    // on Android WebView), stop the spinner after 5 seconds.
    const timeout = setTimeout(() => {
      setAuthError('Auth initialization timeout');
      setIsLoadingAuth(false);
    }, 5000);

    let unsubscribe = () => {};

    try {
      unsubscribe = onAuthStateChanged(
        auth,
        (firebaseUser) => {
          clearTimeout(timeout);
          setAuthError(null);
          if (firebaseUser) {
            const storedRole = getStoredRoleForUser(firebaseUser.uid);
            setUser(firebaseUser);
            setRoleState(storedRole);
            setIsAuthenticated(true);
          } else {
            setUser(null);
            setRoleState(null);
            setIsAuthenticated(false);
          }
          setIsLoadingAuth(false);
        },
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
      localStorage.removeItem(ROLE_KEY);
      setUser(null);
      setRoleState(null);
      setIsAuthenticated(false);
    }
  };

  const setRole = (uid, newRole) => {
    if (newRole !== 'admin' && newRole !== 'user') {
      throw new Error(`Invalid role: ${newRole}. Must be 'admin' or 'user'.`);
    }
    localStorage.setItem(ROLE_KEY, newRole);
    setRoleState(newRole);
  };

  return (
    <AuthContext.Provider value={{
      user,
      role,
      isAuthenticated,
      isLoadingAuth,
      authError,
      logout,
      setRole,
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
