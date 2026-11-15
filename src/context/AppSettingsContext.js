import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, isConfigured } from '../lib/supabase';

const AppSettingsContext = createContext(null);

const DEFAULT_SETTINGS = {
  maintenance_mode: false,
  maintenance_message: 'The app is under maintenance. Please come back later.',
  support_contact: 'support@solarpm.com',
  updated_by: 'Admin',
  updated_at: new Date().toISOString(),
};

export function AppSettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSettings = useCallback(async () => {
    if (!isConfigured || !supabase) return;
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('app_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      if (err) {
        if (__DEV__) {
          console.warn('[AppSettings] Fetch notice (run settings SQL in Supabase if table is missing):', err.message);
        }
        setError(err.message);
        return;
      }

      if (data) {
        setSettings({
          maintenance_mode: !!data.maintenance_mode,
          maintenance_message: data.maintenance_message || DEFAULT_SETTINGS.maintenance_message,
          support_contact: data.support_contact || DEFAULT_SETTINGS.support_contact,
          updated_by: data.updated_by || null,
          updated_at: data.updated_at || null,
        });
        setError(null);
      }
    } catch (e) {
      if (__DEV__) {
        console.warn('[AppSettings] Unexpected fetch notice:', e.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch and 30s background poll
  useEffect(() => {
    fetchSettings();
    const interval = setInterval(fetchSettings, 30000);
    return () => clearInterval(interval);
  }, [fetchSettings]);

  // Realtime subscription to app_settings
  useEffect(() => {
    if (!isConfigured || !supabase?.channel) return;

    const channelId = `app_settings_rt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_settings' },
        (payload) => {
          if (payload.new && payload.new.id === 1) {
            setSettings({
              maintenance_mode: !!payload.new.maintenance_mode,
              maintenance_message: payload.new.maintenance_message || DEFAULT_SETTINGS.maintenance_message,
              support_contact: payload.new.support_contact || DEFAULT_SETTINGS.support_contact,
              updated_by: payload.new.updated_by || null,
              updated_at: payload.new.updated_at || null,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const updateSettings = useCallback(async (partial, updatedByName = 'Admin') => {
    setSettings((prev) => ({
      ...prev,
      ...partial,
      updated_by: updatedByName,
      updated_at: new Date().toISOString(),
    }));

    if (!isConfigured || !supabase) return;

    try {
      const { error: err } = await supabase
        .from('app_settings')
        .upsert({
          id: 1,
          ...partial,
          updated_by: updatedByName,
          updated_at: new Date().toISOString(),
        });

      if (err) {
        throw err;
      }
    } catch (e) {
      fetchSettings();
      throw e;
    }
  }, [fetchSettings]);

  const value = useMemo(
    () => ({
      settings,
      loading,
      error,
      refreshSettings: fetchSettings,
      updateSettings,
    }),
    [settings, loading, error, fetchSettings, updateSettings]
  );

  return (
    <AppSettingsContext.Provider value={value}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  const context = useContext(AppSettingsContext);
  if (!context) {
    throw new Error('useAppSettings must be used within an <AppSettingsProvider>. Ensure AppSettingsProvider wraps the component tree in App.js.');
  }
  return context;
}
