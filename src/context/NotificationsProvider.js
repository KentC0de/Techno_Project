import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { supabase, isConfigured } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useToast } from '../components/feedback';

const NotificationsContext = createContext(null);

let channelIdCounter = 0;

export function NotificationsProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(0);

  // Load initial batch of 30 notifications
  const fetchBatch = useCallback(async (page = 0, append = false) => {
    if (!isConfigured || !supabase || !userId) return;
    try {
      setLoading(true);
      const pageSize = 30;
      const from = page * pageSize;
      const to = from + pageSize - 1;

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        if (error.code === '42P01') {
          if (__DEV__) console.warn('Run the notifications SQL in Supabase');
          return;
        }
        throw error;
      }

      if (data) {
        setItems((prev) => (append ? [...prev, ...data] : data));
        setHasMore(data.length === pageSize);
      }
    } catch (err) {
      if (err?.code === '42P01') {
        if (__DEV__) console.warn('Run the notifications SQL in Supabase');
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    if (!isConfigured || !supabase || !userId) return;
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('read_at', null);

      if (error) {
        if (error.code === '42P01') {
          if (__DEV__) console.warn('Run the notifications SQL in Supabase');
          return;
        }
        throw error;
      }
      setUnreadCount(count || 0);
    } catch (_) {}
  }, [userId]);

  // Initial load on user change
  useEffect(() => {
    if (userId) {
      pageRef.current = 0;
      fetchBatch(0, false);
      fetchUnreadCount();
    } else {
      setItems([]);
      setUnreadCount(0);
    }
  }, [userId, fetchBatch, fetchUnreadCount]);

  // Load more function
  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;
    pageRef.current += 1;
    fetchBatch(pageRef.current, true);
  }, [loading, hasMore, fetchBatch]);

  // Mark specific IDs as read
  const markRead = useCallback(async (ids) => {
    if (!isConfigured || !supabase || !ids) return;
    const idArray = Array.isArray(ids) ? ids : [ids];
    if (idArray.length === 0) return;

    // Optimistic update
    const idSet = new Set(idArray);
    const nowIso = new Date().toISOString();
    let markedCount = 0;
    setItems((prev) =>
      prev.map((n) => {
        if (idSet.has(n.id) && !n.read_at) {
          markedCount++;
          return { ...n, read_at: nowIso };
        }
        return n;
      })
    );
    setUnreadCount((prev) => Math.max(0, prev - markedCount));

    try {
      const { error } = await supabase.rpc('mark_notifications_read', {
        p_ids: idArray,
      });
      if (error) {
        // Fallback update
        await supabase
          .from('notifications')
          .update({ read_at: nowIso })
          .in('id', idArray);
      }
    } catch (_) {}
  }, []);

  // Mark all as read
  const markAllRead = useCallback(async () => {
    if (!isConfigured || !supabase || !userId) return;

    // Optimistic
    const nowIso = new Date().toISOString();
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || nowIso })));
    setUnreadCount(0);

    try {
      const { error } = await supabase.rpc('mark_notifications_read', {
        p_ids: null,
      });
      if (error) {
        await supabase
          .from('notifications')
          .update({ read_at: nowIso })
          .eq('user_id', userId)
          .is('read_at', null);
      }
    } catch (_) {}
  }, [userId]);

  // ONE Realtime Subscription for notifications filtered by user_id=eq.<my id>
  useEffect(() => {
    if (!isConfigured || !supabase?.channel || !userId) return;

    channelIdCounter += 1;
    const channelName = `notifs_${userId}_${Date.now()}_${channelIdCounter}`;
    const channel = supabase.channel(channelName);

    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const newNotif = payload?.new;
        if (!newNotif) return;

        // Prepend to items list
        setItems((prev) => [newNotif, ...prev]);
        setUnreadCount((prev) => prev + 1);

        // Toast built strictly from notification (title + body)
        const toastTitle = newNotif.title || 'Notification';
        const toastBody = newNotif.body || '';
        const toastType =
          newNotif.type === 'task_rejected'
            ? 'error'
            : newNotif.type === 'task_approved'
            ? 'success'
            : 'info';

        if (toast) {
          if (toastType === 'error') {
            toast.error(toastBody, { title: toastTitle });
          } else if (toastType === 'success') {
            toast.success(toastBody, { title: toastTitle });
          } else {
            toast.info(toastBody, { title: toastTitle });
          }
        }
      }
    );

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, toast]);

  // Update browser tab title on web: e.g. "(2) Solar PM Hub"
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const baseTitle = 'Solar PM Hub';
      if (unreadCount > 0) {
        document.title = `(${unreadCount}) ${baseTitle}`;
      } else {
        document.title = baseTitle;
      }
    }
  }, [unreadCount]);

  const value = useMemo(
    () => ({
      notifications: items,
      unreadCount,
      loading,
      hasMore,
      loadMore,
      markRead,
      markAllRead,
      refetch: () => {
        fetchBatch(0, false);
        fetchUnreadCount();
      },
    }),
    [items, unreadCount, loading, hasMore, loadMore, markRead, markAllRead, fetchBatch, fetchUnreadCount]
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotificationsContext() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error('useNotificationsContext must be used within a NotificationsProvider');
  }
  return ctx;
}

export default NotificationsProvider;

