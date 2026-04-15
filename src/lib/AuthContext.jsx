import React, { createContext, useContext } from 'react';

const AuthContext = createContext();

// Local auth — always authenticated as a local user, no external service needed.
const LOCAL_USER = { id: 'local', email: 'admin@gamezone.local', full_name: 'Game Zone Admin' };

export const AuthProvider = ({ children }) => {
  return (
    <AuthContext.Provider value={{
      user: LOCAL_USER,
      isAuthenticated: true,
      isLoadingAuth: false,
      isLoadingPublicSettings: false,
      authError: null,
      appPublicSettings: null,
      logout: () => {},
      navigateToLogin: () => {},
      checkAppState: () => {},
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
