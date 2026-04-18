import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';

const AuthContext = createContext();

const ROLE_KEY = 'gamezone_user_role';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRoleState] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    // If auth is a stub (Firebase failed to init), mark as not loading
    if (!auth || typeof auth.onAuthStateChanged !== 'function') {
      setIsLoadingAuth(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        let storedRole = localStorage.getItem(ROLE_KEY);
        if (!storedRole) {
          // Hardcoded admin UIDs — add your UID here
          const ADMIN_UIDS = import.meta.env.VITE_ADMIN_UIDS
            ? import.meta.env.VITE_ADMIN_UIDS.split(',').map(s => s.trim())
            : [];
          storedRole = ADMIN_UIDS.includes(firebaseUser.uid) ? 'admin' : 'user';
          localStorage.setItem(ROLE_KEY, storedRole);
        }
        setUser(firebaseUser);
        setRoleState(storedRole);
        setIsAuthenticated(true);
        setIsLoadingAuth(false);
      } else {
        setUser(null);
        setRoleState(null);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    await signOut(auth);
    localStorage.removeItem(ROLE_KEY);
    setUser(null);
    setRoleState(null);
    setIsAuthenticated(false);
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
