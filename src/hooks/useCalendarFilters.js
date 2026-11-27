import { useState, useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useSystemFilter } from '../context/SystemFilterContext';

const CALENDAR_FILTERS_STORAGE_KEY = '@pm_calendar_filters_v2';

const DEFAULT_FILTERS = {
  view: 'tasks', // 'tasks' | 'reports'
  status: 'all',
  group: 'all',
  system: 'ALL',
  range: 'day', // 'day' | 'week' | 'last7'
};

export function useCalendarFilters(initialView = 'tasks') {
  const { selectedSystem, setSelectedSystem } = useSystemFilter();

  const [filters, setFiltersState] = useState(() => {
    let initial = { ...DEFAULT_FILTERS, view: initialView, system: selectedSystem || 'ALL' };
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      try {
        const saved = window.localStorage.getItem(CALENDAR_FILTERS_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          initial = {
            ...initial,
            ...parsed,
            view: initialView || parsed.view || 'tasks',
            system: selectedSystem || parsed.system || 'ALL',
          };
        }
      } catch (_) {}
    }
    return initial;
  });

  const prevSystemFromContext = useRef(selectedSystem);
  const prevSystemInFilters = useRef(filters.system);

  // Sync when sidebar selectedSystem changes
  useEffect(() => {
    if (selectedSystem && selectedSystem !== prevSystemFromContext.current) {
      prevSystemFromContext.current = selectedSystem;
      setFiltersState((prev) => {
        if (prev.system === selectedSystem) return prev;
        prevSystemInFilters.current = selectedSystem;
        return { ...prev, system: selectedSystem };
      });
    }
  }, [selectedSystem]);

  // Sync outwards when filters.system changes
  useEffect(() => {
    if (filters.system !== prevSystemInFilters.current) {
      prevSystemInFilters.current = filters.system;
      if (filters.system !== selectedSystem) {
        prevSystemFromContext.current = filters.system;
        setSelectedSystem(filters.system);
      }
    }
  }, [filters.system, selectedSystem, setSelectedSystem]);

  // Persist to localStorage
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(
          CALENDAR_FILTERS_STORAGE_KEY,
          JSON.stringify({
            view: filters.view,
            status: filters.status,
            group: filters.group,
            system: filters.system,
            range: filters.range,
          })
        );
      } catch (_) {}
    }
  }, [filters]);

  const setFilters = useCallback((updater) => {
    setFiltersState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      return { ...prev, ...next };
    });
  }, []);

  return [filters, setFilters];
}

export default useCalendarFilters;
