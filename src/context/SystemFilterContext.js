import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';

const STORAGE_KEY = '@pm_admin_selected_system';

export const SYSTEM_OPTIONS = [
  { id: 'ALL', label: 'All Systems', shortLabel: 'All systems', code: 'ALL', description: 'Complete solar plant' },
  { id: 'A', label: 'A - Inverter Station Area', shortLabel: 'A - Inverter Station Area', code: 'A', description: 'Inverter & transformer yard' },
  { id: 'B', label: 'B - PV Field Area', shortLabel: 'B - PV Field Area', code: 'B', description: 'PV field area' },
  { id: 'C', label: 'C - MV & LV System', shortLabel: 'C - MV & LV System', code: 'C', description: 'Combiner boxes & trackers' },
  { id: 'D', label: 'D - Other System', shortLabel: 'D - Other System', code: 'D', description: 'Substation, CCTV & auxiliaries' },
];

const SystemFilterContext = createContext({
  selectedSystem: 'ALL',
  setSelectedSystem: () => {},
  systemOptions: SYSTEM_OPTIONS,
});

export function SystemFilterProvider({ children }) {
  const [selectedSystem, setSelectedSystemState] = useState('ALL');

  useEffect(() => {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved && SYSTEM_OPTIONS.some((opt) => opt.id === saved)) {
          setSelectedSystemState(saved);
        }
      }
    } catch (_) {}
  }, []);

  const setSelectedSystem = useCallback((systemId) => {
    setSelectedSystemState((prev) => (prev === systemId ? prev : systemId));
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, systemId);
      }
    } catch (_) {}
  }, []);

  const value = useMemo(
    () => ({
      selectedSystem,
      setSelectedSystem,
      systemOptions: SYSTEM_OPTIONS,
    }),
    [selectedSystem, setSelectedSystem]
  );

  return (
    <SystemFilterContext.Provider value={value}>
      {children}
    </SystemFilterContext.Provider>
  );
}

export function useSystemFilter() {
  return useContext(SystemFilterContext);
}
