import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';

const SidebarContext = createContext({
  sidebarOpen: true,
  isCollapsed: false,
  toggleSidebar: () => {},
  closeSidebar: () => {},
  openSidebar: () => {},
  toggleCollapse: () => {},
  setIsCollapsed: () => {},
});

const STORAGE_KEY_OPEN = '@pm_admin_sidebar_open';
const STORAGE_KEY_COLLAPSED = '@pm_admin_sidebar_collapsed';

export function SidebarProvider({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isCollapsed, setIsCollapsedState] = useState(false);

  // Restore persisted state on mount
  useEffect(() => {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        const isNarrow = window.innerWidth < 900;
        const savedOpen = window.localStorage.getItem(STORAGE_KEY_OPEN);
        if (savedOpen !== null) {
          setSidebarOpen(isNarrow ? false : savedOpen === 'true');
        } else {
          setSidebarOpen(!isNarrow);
        }

        const savedCollapsed = window.localStorage.getItem(STORAGE_KEY_COLLAPSED);
        if (savedCollapsed !== null) {
          setIsCollapsedState(savedCollapsed === 'true');
        }
      }
    } catch (_) {}
  }, []);

  const toggleCollapse = useCallback(() => {
    setIsCollapsedState((prev) => {
      const next = !prev;
      try {
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(STORAGE_KEY_COLLAPSED, String(next));
        }
      } catch (_) {}
      return next;
    });
  }, []);

  // Keyboard shortcut Ctrl+B / Cmd+B to toggle collapse
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key?.toLowerCase() === 'b') {
        e.preventDefault();
        toggleCollapse();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleCollapse]);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => {
      const next = !prev;
      try {
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(STORAGE_KEY_OPEN, String(next));
        }
      } catch (_) {}
      return next;
    });
  }, []);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY_OPEN, 'false');
      }
    } catch (_) {}
  }, []);

  const openSidebar = useCallback(() => {
    setSidebarOpen(true);
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY_OPEN, 'true');
      }
    } catch (_) {}
  }, []);

  const setIsCollapsed = useCallback((collapsed) => {
    setIsCollapsedState(collapsed);
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY_COLLAPSED, String(collapsed));
      }
    } catch (_) {}
  }, []);

  const value = useMemo(
    () => ({
      sidebarOpen,
      isCollapsed,
      toggleSidebar,
      closeSidebar,
      openSidebar,
      toggleCollapse,
      setIsCollapsed,
    }),
    [
      sidebarOpen,
      isCollapsed,
      toggleSidebar,
      closeSidebar,
      openSidebar,
      toggleCollapse,
      setIsCollapsed,
    ]
  );

  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
