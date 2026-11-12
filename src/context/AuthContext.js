import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, AppState } from 'react-native';
import {
  getCurrentUser,
  signIn as apiSignIn,
  signInWithRoleCheck as apiSignInWithRoleCheck,
  signUp as apiSignUp,
  signOut as apiSignOut,
} from '../lib/dataService';
import { supabase, isConfigured } from '../lib/supabase';
import { logActivity } from '../lib/activityLog';

const AuthContext = createContext({
  user: null,
  loading: true,
  isAccountDisabled: false,
  setIsAccountDisabled: () => {},
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
  const [isAccountDisabled, setIsAccountDisabled] = useState(false);

  // Restore session using getSession() or getUser()
  const loadUser = useCallback(async () => {
    try {
      setLoading(true);
      const currentUser = await getCurrentUser();
      if (currentUser) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('status')
          .eq('id', currentUser.id)
          .maybeSingle();

        if (prof?.status === 'disabled' && currentUser.role !== 'admin') {
          await apiSignOut();
          setUser(null);
          setIsAccountDisabled(true);
          return;
        }
      }
      setUser(currentUser);
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();

    if (isConfigured && supabase?.auth?.onAuthStateChange) {
      const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          setUser(null);
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          const updated = await getCurrentUser();
          if (updated) {
            const { data: prof } = await supabase
              .from('profiles')
              .select('status')
              .eq('id', updated.id)
              .maybeSingle();

            if (prof?.status === 'disabled' && updated.role !== 'admin') {
              await apiSignOut();
              setUser(null);
              setIsAccountDisabled(true);
              return;
            }
          }
          setUser(updated);
        }
      });

      return () => {
        authListener?.subscription?.unsubscribe();
      };
    }
  }, [loadUser]);

  // Realtime enforcement on worker's own profiles row
  useEffect(() => {
    if (!user || user.role === 'admin' || !isConfigured || !supabase?.channel) return;

    const channel = supabase
      .channel(`profile_status_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        async (payload) => {
          if (payload.new && payload.new.status === 'disabled') {
            await apiSignOut();
            setUser(null);
            setIsAccountDisabled(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Check account status on AppState change (foreground) & every 60s
  useEffect(() => {
    if (!user || user.role === 'admin' || !isConfigured || !supabase) return;

    const checkStatus = async () => {
      try {
        const { data: prof, error } = await supabase
          .from('profiles')
          .select('status')
          .eq('id', user.id)
          .maybeSingle();

        if (error || prof?.status === 'disabled') {
          await apiSignOut();
          setUser(null);
          setIsAccountDisabled(true);
        }
      } catch (_) {}
    };

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        checkStatus();
      }
    });

    const interval = setInterval(checkStatus, 60000);

    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, [user]);

  const signIn = useCallback(async (email, password) => {
    try {
      const loggedUser = await apiSignIn(email, password);
      setUser(loggedUser);
      setIsAccountDisabled(false);
      logActivity('auth.login', 'auth.users', loggedUser.id, { email: loggedUser.email });
      return loggedUser;
    } catch (err) {
      if (err.message === 'ACCOUNT_DISABLED' || err.code === 'ACCOUNT_DISABLED') {
        setIsAccountDisabled(true);
      }
      throw err;
    }
  }, []);

  const signInWithRoleCheck = useCallback(async (email, password, expectedRole) => {
    try {
      const loggedUser = await apiSignInWithRoleCheck(email, password, expectedRole);
      setUser(loggedUser);
      setIsAccountDisabled(false);
      logActivity('auth.login', 'auth.users', loggedUser.id, { email: loggedUser.email, role: loggedUser.role });
      return loggedUser;
    } catch (err) {
      if (err.message === 'ACCOUNT_DISABLED' || err.code === 'ACCOUNT_DISABLED') {
        setIsAccountDisabled(true);
      }
      throw err;
    }
  }, []);

  const signUp = useCallback(async (email, password, fullName) => {
    const result = await apiSignUp(email, password, fullName);
    if (result && !result.requiresEmailConfirmation) {
      setUser(result);
      setIsAccountDisabled(false);
      logActivity('auth.signup', 'auth.users', result.id, { email: result.email });
    }
    return result;
  }, []);

  const signOut = useCallback(async () => {
    if (user) {
      logActivity('auth.logout', 'auth.users', user.id, { email: user.email });
    }
    await apiSignOut();
    setUser(null);
  }, [user]);

  const refreshUser = useCallback(async () => {
    await loadUser();
  }, [loadUser]);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAccountDisabled,
      setIsAccountDisabled,
      isSupabaseLive: isConfigured,
      signIn,
      signInWithRoleCheck,
      signUp,
      signOut,
      refreshUser,
      setUser,
    }),
    [
      user,
      loading,
      isAccountDisabled,
      signIn,
      signInWithRoleCheck,
      signUp,
      signOut,
      refreshUser,
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
