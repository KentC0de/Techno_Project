import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isConfigured } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function useNotifications(options = {}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  // Unread count: head: true, count: 'exact' where read_at is null
  const countQuery = useQuery({
    queryKey: ['notifications', 'unread_count', userId],
    queryFn: async () => {
      if (!isConfigured || !supabase || !userId) return 0;
      try {
        const { count, error } = await supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .is('read_at', null);

        if (error) {
          if (error.code === '42P01') {
            if (__DEV__) console.warn('Run the notifications SQL in Supabase');
            return 0;
          }
          throw error;
        }
        return count || 0;
      } catch (err) {
        if (err?.code === '42P01') {
          if (__DEV__) console.warn('Run the notifications SQL in Supabase');
          return 0;
        }
        return 0;
      }
    },
    enabled: !!userId,
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  // Notifications list query
  const listQuery = useQuery({
    queryKey: ['notifications', 'list', userId],
    queryFn: async () => {
      if (!isConfigured || !supabase || !userId) return [];
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(30);

        if (error) {
          if (error.code === '42P01') {
            if (__DEV__) console.warn('Run the notifications SQL in Supabase');
            return [];
          }
          throw error;
        }
        return data || [];
      } catch (err) {
        if (err?.code === '42P01') {
          if (__DEV__) console.warn('Run the notifications SQL in Supabase');
          return [];
        }
        return [];
      }
    },
    enabled: !!userId,
    staleTime: 15 * 1000,
  });

  // Mark specific IDs as read
  const markReadMutation = useMutation({
    mutationFn: async (ids) => {
      if (!isConfigured || !supabase || !ids || ids.length === 0) return 0;
      const idArray = Array.isArray(ids) ? ids : [ids];
      // Try RPC first, fallback to update
      try {
        const { data, error } = await supabase.rpc('mark_notifications_read', {
          p_ids: idArray,
        });
        if (!error) return data;
      } catch (_) {}

      // Fallback
      const { error: updErr } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .in('id', idArray);
      if (updErr && updErr.code !== '42P01') throw updErr;
      return idArray.length;
    },
    onMutate: async (ids) => {
      const idSet = new Set(Array.isArray(ids) ? ids : [ids]);
      await queryClient.cancelQueries({ queryKey: ['notifications', 'list', userId] });
      await queryClient.cancelQueries({ queryKey: ['notifications', 'unread_count', userId] });

      const prevList = queryClient.getQueryData(['notifications', 'list', userId]) || [];
      const nowIso = new Date().toISOString();

      let markedCount = 0;
      const nextList = prevList.map((item) => {
        if (idSet.has(item.id) && !item.read_at) {
          markedCount++;
          return { ...item, read_at: nowIso };
        }
        return item;
      });

      queryClient.setQueryData(['notifications', 'list', userId], nextList);
      queryClient.setQueryData(['notifications', 'unread_count', userId], (old = 0) => Math.max(0, old - markedCount));

      return { prevList };
    },
    onError: (err, ids, context) => {
      if (context?.prevList) {
        queryClient.setQueryData(['notifications', 'list', userId], context.prevList);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Mark all read mutation
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      if (!isConfigured || !supabase || !userId) return 0;
      try {
        const { data, error } = await supabase.rpc('mark_notifications_read', {
          p_ids: null,
        });
        if (!error) return data;
      } catch (_) {}

      // Fallback
      const { error: updErr } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', userId)
        .is('read_at', null);
      if (updErr && updErr.code !== '42P01') throw updErr;
      return 1;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['notifications', 'list', userId] });
      await queryClient.cancelQueries({ queryKey: ['notifications', 'unread_count', userId] });

      const prevList = queryClient.getQueryData(['notifications', 'list', userId]) || [];
      const nowIso = new Date().toISOString();

      const nextList = prevList.map((item) => ({
        ...item,
        read_at: item.read_at || nowIso,
      }));

      queryClient.setQueryData(['notifications', 'list', userId], nextList);
      queryClient.setQueryData(['notifications', 'unread_count', userId], 0);

      return { prevList };
    },
    onError: (err, vars, context) => {
      if (context?.prevList) {
        queryClient.setQueryData(['notifications', 'list', userId], context.prevList);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  return {
    notifications: listQuery.data || [],
    isLoading: listQuery.isLoading,
    unreadCount: countQuery.data || 0,
    refetch: listQuery.refetch,
    refetchCount: countQuery.refetch,
    markRead: (ids) => markReadMutation.mutate(ids),
    markAllRead: () => markAllReadMutation.mutate(),
  };
}

export default useNotifications;

