import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  getCurrentUser,
  signIn as apiSignIn,
  signInWithRoleCheck as apiSignInWithRoleCheck,
  signUp as apiSignUp,
  signOut as apiSignOut,
} from '../lib/dataService';
import { isConfigured } from '../lib/supabase';

const AuthContext = createContext({
  user: null,
  loading: true,
  isSupabaseLive: false,
  signIn: async () => {},
  signInWithRoleCheck: async () => {},
  signUp: async () => {},
  signOut: async () => {},
  refreshUser: async () => {},
  setUser: () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = async () => {
    try {
      setLoading(true);
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (err) {
      console.warn('Error loading user:', err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  const signIn = async (email, password) => {
    const loggedUser = await apiSignIn(email, password);
    setUser(loggedUser);
    return loggedUser;
  };

  const signInWithRoleCheck = async (email, password, expectedRole) => {
    const loggedUser = await apiSignInWithRoleCheck(email, password, expectedRole);
    setUser(loggedUser);
    return loggedUser;
  };

  const signUp = async (email, password, fullName) => {
    const result = await apiSignUp(email, password, fullName);
    // If email confirmation required, don't set user yet
    if (result && !result.requiresEmailConfirmation) {
      setUser(result);
    }
    return result;
  };

  const signOut = async () => {
    await apiSignOut();
    setUser(null);
  };

  const refreshUser = async () => {
    await loadUser();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isSupabaseLive: isConfigured,
        signIn,
        signInWithRoleCheck,
        signUp,
        signOut,
        refreshUser,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
