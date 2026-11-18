import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase, isConfigured } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

let channelCounter = 0;

/**
 * useTaskLogsRealtime:
 * Subscribes to `postgres_changes` on `task_logs` (event '*') only after the session exists.
 * - Unique channel name.
 * - Logs channel status ('SUBSCRIBED', 'CHANNEL_ERROR', 'TIMED_OUT') in __DEV__.
 * - Resubscribes when session changes.
 * - Debounces 500ms on events.
 * - Invalidates queries by prefix: ['approvals'], ['task_logs'], ['taskLogs'], ['pending_approvals'], ['performance'], ['activity_logs'], ['calendar_tasks'].
 * - Exposes realtime status for dev indicator.
 */
export function useTaskLogsRealtime({ filterUserId = null } = {}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [realtimeStatus, setRealtimeStatus] = useState('DISCONNECTED');
  const debounceTimerRef = useRef(null);

  useEffect(() => {
    if (!isConfigured || !supabase?.channel || !user?.id) {
      setRealtimeStatus('NO_SESSION');
      return;
    }

    channelCounter += 1;
    const channelId = `task_logs_rt_${user.id}_${Date.now()}_${channelCounter}_${Math.random().toString(36).substring(2, 6)}`;
    const channel = supabase.channel(channelId);

    const triggerInvalidation = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        // Invalidate by shared prefixes
        queryClient.invalidateQueries({ queryKey: ['approvals'] });
        queryClient.invalidateQueries({ queryKey: ['pending_approvals'] });
        queryClient.invalidateQueries({ queryKey: ['task_logs'] });
        queryClient.invalidateQueries({ queryKey: ['taskLogs'] });
        queryClient.invalidateQueries({ queryKey: ['calendar_tasks'] });
        queryClient.invalidateQueries({ queryKey: ['performance'] });
        queryClient.invalidateQueries({ queryKey: ['activity_logs'] });
        queryClient.invalidateQueries({ queryKey: ['schedule_rules'] });
      }, 500);
    };

    const filterObj = {
      event: '*',
      schema: 'public',
      table: 'task_logs',
      ...(filterUserId ? { filter: `done_by=eq.${filterUserId}` } : {}),
    };

    channel.on('postgres_changes', filterObj, (payload) => {
      if (__DEV__) {
        console.log('[useTaskLogsRealtime event]', payload?.eventType, payload?.new?.id || payload?.old?.id);
      }
      triggerInvalidation();
    });

    channel.subscribe((status, err) => {
      setRealtimeStatus(status);
      if (__DEV__) {
        console.log(`[useTaskLogsRealtime status: ${status}]`, err || '');
      }
    });

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      supabase.removeChannel(channel);
      setRealtimeStatus('DISCONNECTED');
    };
  }, [user?.id, filterUserId, queryClient]);

  return { realtimeStatus };
}

export default useTaskLogsRealtime;

