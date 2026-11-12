import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import { supabase, isConfigured } from '../lib/supabase';

const ConnectionStatusContext = createContext({
  status: 'checking', // 'connected' | 'checking' | 'disconnected'
  lastCheckedTime: '',
  checkConnection: async () => {},
});

export function ConnectionStatusProvider({ children }) {
  const [status, setStatus] = useState(isConfigured ? 'checking' : 'disconnected');
  const [lastCheckedTime, setLastCheckedTime] = useState('');
  const isCheckingRef = useRef(false);

  const checkConnection = useCallback(async () => {
    if (!isConfigured || !supabase) {
      setStatus('disconnected');
      return;
    }

    if (isCheckingRef.current) return;
    isCheckingRef.current = true;

    try {
      const { error } = await supabase
        .from('categories')
        .select('id', { count: 'exact', head: true })
        .limit(1);

      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      setLastCheckedTime(`${hours}:${minutes}`);

      if (error) {
        setStatus('disconnected');
      } else {
        setStatus('connected');
      }
    } catch (_) {
      setStatus('disconnected');
    } finally {
      isCheckingRef.current = false;
    }
  }, []);

  useEffect(() => {
    checkConnection();

    const interval = setInterval(() => {
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        if (document.hidden) return;
      }
      checkConnection();
    }, 60 * 1000);

    const handleFocus = () => {
      checkConnection();
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('focus', handleFocus);
      document.addEventListener('visibilitychange', handleFocus);
    }

    return () => {
      clearInterval(interval);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener('focus', handleFocus);
        document.removeEventListener('visibilitychange', handleFocus);
      }
    };
  }, [checkConnection]);

  const value = useMemo(
    () => ({
      status,
      lastCheckedTime,
      checkConnection,
    }),
    [status, lastCheckedTime, checkConnection]
  );

  return (
    <ConnectionStatusContext.Provider value={value}>
      {children}
    </ConnectionStatusContext.Provider>
  );
}

export function useConnectionStatus() {
  return useContext(ConnectionStatusContext);
}
